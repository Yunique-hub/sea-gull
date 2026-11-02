import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";

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
const cleanup = Array.isArray(info.cleanup) ? info.cleanup : [];

function spawnEnv() {
  const env = { ...process.env };
  delete env.DSH_PERMISSION_MODE;
  delete env.DSH_PURGE_RESTART;
  return env;
}

function portFree() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(true));
  });
}

async function waitFree() {
  for (let i = 0; i < 80; i++) {
    if (await portFree()) return true;
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

function rmTree(dir) {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 });
  } catch {
    // 锁着就留下
  }
}

const ok = await waitFree();
/* 端口等不到也要清理：以前直接退出，插件的目录和文件就永远留在那里，
   用户以为卸载成功，重启后插件还在。删不掉的会被 rmTree 吞掉，下一步照常。 */
for (const dir of cleanup) rmTree(dir);
if (info.helper) {
  try {
    fs.unlinkSync(info.helper);
  } catch {
    // ignore
  }
}

/* 端口没释放就不拉起新进程（会立刻撞端口），但上面的清理已经做完了。 */
if (!ok) process.exit(1);

const child = spawn(info.execPath, info.argv, {
  detached: true,
  stdio: "ignore",
  cwd: info.cwd || process.cwd(),
  env: spawnEnv(),
  windowsHide: true,
  shell: false,
});

child.on("error", () => process.exit(1));
child.unref();
await new Promise((r) => setTimeout(r, 400));
process.exit(0);
