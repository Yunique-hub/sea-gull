import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { envForDetachedSpawn } from "./core.js";
import {
  cmdlineOf,
  dshHomeDir,
  killPid,
  listenerPids,
  looksLikeDshWeb,
  writeRecord,
} from "./web-reclaim.js";

const encoded = process.env.DSH_PURGE_RESTART;
if (!encoded) process.exit(1);

let info;
try {
  info = JSON.parse(encoded);
} catch {
  process.exit(1);
}

const port = Number(info.port) || 3080;
const host = typeof info.host === "string" && info.host ? info.host : "127.0.0.1";

function portFree() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(true));
  });
}

/**
 * 杀掉「发起重启的那个进程」；再按端口兜底一次，清掉旧版本留下、没有 pid 记录的孤儿
 * （#197：只按 info.pid 杀时，上一轮 detached 起来的 server 永远没人管）。
 */
function killOldServer() {
  const pid = Number(info.pid);
  if (pid && pid !== process.pid) killPid(pid);
  for (const other of listenerPids(port)) {
    if (other === process.pid || other === pid) continue;
    if (!looksLikeDshWeb(cmdlineOf(other))) continue;
    killPid(other);
  }
}

function openBrowser(url) {
  if (!url) return;
  if (process.platform === "win32") {
    /* cmd 的 start 会把 & 当命令分隔符：整条命令必须带引号，否则 ?a=1&b=2 的地址只打开前半截。 */
    spawn("cmd.exe", ["/d", "/s", "/c", `start "" "${String(url).replace(/"/g, "")}"`], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return;
  }
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
}

async function waitFree() {
  for (let i = 0; i < 40; i++) {
    if (await portFree()) return true;
    if (i === 8) killOldServer();
    await new Promise((r) => setTimeout(r, 120));
  }
  killOldServer();
  for (let i = 0; i < 40; i++) {
    if (await portFree()) return true;
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

const ok = await waitFree();
if (!ok) {
  /* 旧进程杀不掉时以前直接 exit(1)，用户看到的是 web 服务凭空消失。
     端口还占着说明旧 server 大概率还活着：把页面重新打开并留下日志，至少不是静默失败。 */
  try {
    const dir = path.join(dshHomeDir(), "dsh-purge");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "restart-web.log"),
      `${new Date().toISOString()} restart aborted: port ${port} still busy
`, "utf8");
  } catch { /* 日志失败不影响提示 */ }
  openBrowser(info.url || "");
  process.exit(1);
}

// 接着 stdout 里的新地址打开浏览器。旧页面的 token 在新进程里无效，只刷新会打不开。
let opened = false;
const child = spawn(info.execPath, info.argv, {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  cwd: info.cwd || process.cwd(),
  env: envForDetachedSpawn(),
  windowsHide: true,
  shell: false,
});
child.on("error", () => process.exit(1));
// #197：记下这个后台 server 的 pid。下次 `dsh web` 启动时，注入到宿主 bin.js 的
// preflight 会先把它收掉，不会再撞 EADDRINUSE。
child.on("spawn", () => {
  try {
    writeRecord(dshHomeDir(), port, child.pid, { host, url: "" });
  } catch {
    /* 记录失败不影响重启 */
  }
});
const wantBrowser = info.openBrowser !== false;
const takeUrl = (chunk) => {
  const text = String(chunk || "");
  if (opened) return;
  const match = text.match(/dsh web:\s+(https?:\/\/\S+)/);
  if (!match) return;
  opened = true;
  const url = match[1].replace(/[),.;]+$/, "");
  try {
    writeRecord(dshHomeDir(), port, child.pid, { host, url });
  } catch {
    /* ignore */
  }
  if (!wantBrowser) return;
  openBrowser(url);
};
child.stdout?.on("data", takeUrl);
child.stderr?.on("data", takeUrl);
child.unref();
if (wantBrowser) {
  const started = Date.now();
  while (!opened && Date.now() - started < 20000) {
    await new Promise((r) => setTimeout(r, 200));
  }
} else {
  // 等子进程真正起来再退出，避免端口未监听时父链误判失败又拉一把。
  await new Promise((r) => setTimeout(r, 1500));
}
process.exit(0);
