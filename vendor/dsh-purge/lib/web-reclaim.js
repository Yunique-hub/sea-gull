// #197：Web「应用 → 自动重启」用 detached 子进程接管 server，父进程 250ms 后退出，
// 关窗/关终端都杀不到它；下一次 `dsh web` 撞 EADDRINUSE，0.2.x 把 required 插件
// 激活失败当 fatal，宿主直接起不来。
//
// 这个模块提供三件事，供 restart-web.js（记录 pid）和注入到宿主 bin.js 的启动前
// 回收脚本（清理残留）共用：
//   1. pid 记录文件 $DSH_HOME/dsh-purge/web-server-<port>.json
//   2. 按端口反查监听 pid（win32: netstat；darwin/linux: lsof）
//   3. 判定某个 pid 是不是 `dsh web`，只杀自己人
//
// 本模块刻意不 import core.js（core 会 import 本模块的方向，避免循环依赖）。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const RECORD_DIR = "dsh-purge";
export const RECORD_PREFIX = "web-server-";
/** 宿主入口的稳定特征：@deepseek-ai/dsh/lib/bin.js */
export const DSH_BIN_PATTERN = /@deepseek-ai[\\/]dsh[\\/]lib[\\/]bin\.js/;

export function dshHomeDir(env = process.env) {
  const home = typeof env?.DSH_HOME === "string" ? env.DSH_HOME.trim() : "";
  return home || path.join(os.homedir(), ".dsh");
}

export function recordPath(dshHome, port) {
  return path.join(dshHome, RECORD_DIR, `${RECORD_PREFIX}${Number(port) || 3080}.json`);
}

export function writeRecord(dshHome, port, pid, extra = {}) {
  const fp = recordPath(dshHome, port);
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    const payload = { pid: Number(pid) || 0, port: Number(port) || 3080, ...extra, at: new Date().toISOString() };
    fs.writeFileSync(fp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return fp;
  } catch {
    return "";
  }
}

/**
 * 命令行长什么样才算「我们自己起的 dsh web」。
 * 只认 bin.js 入口 + 带 web 子命令，避免误杀同机其它 node 进程。
 */
export function looksLikeDshWeb(cmdline) {
  const text = String(cmdline || "");
  if (!text || !DSH_BIN_PATTERN.test(text)) return false;
  return /(^|[\s"'])web([\s"']|$)/.test(text) || /(^|[\s"'])web\s+--/.test(text);
}

/** win32 netstat -ano 的 LISTENING 行 → [{ address, port, pid }] */
export function parseNetstatListeners(output) {
  const out = [];
  for (const line of String(output || '').split(/\r?\n/)) {
    const m = line.match(/^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    if (!m) continue;
    out.push({ address: m[1], port: Number(m[2]), pid: Number(m[3]) });
  }
  return out;
}

/** ss -ltnp 的输出里取监听某端口的 pid（users:(("node",pid=123,fd=22))） */
export function parseSsListeners(output, port) {
  const want = Number(port) || 3080;
  const pids = [];
  for (const line of String(output || "").split(/\r?\n/)) {
    if (!line.includes(`:${want} `) && !line.includes(`:${want}\t`)) continue;
    for (const m of line.matchAll(/pid=(\d+)/g)) pids.push(Number(m[1]));
  }
  return [...new Set(pids.filter((n) => Number.isInteger(n) && n > 0))];
}

/** lsof -nP -iTCP:PORT -sTCP:LISTEN -t 的输出 → pid 数组 */
export function parseLsofPids(output) {
  return String(output || "")
    .split(/\s+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function run(file, args, options = {}) {
  try {
    const r = spawnSync(file, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 8000,
      ...options,
    });
    if (r.error || r.status !== 0) return "";
    return String(r.stdout || "");
  } catch {
    return "";
  }
}

/** 当前监听某端口的 pid（跨平台） */
export function listenerPids(port) {
  const p = Number(port) || 3080;
  if (process.platform === "win32") {
    const rows = parseNetstatListeners(run("netstat", ["-ano"]));
    return [...new Set(rows.filter((r) => r.port === p).map((r) => r.pid))];
  }
  const viaLsof = parseLsofPids(run("lsof", ["-nP", `-iTCP:${p}`, "-sTCP:LISTEN", "-t"]));
  if (viaLsof.length > 0) return viaLsof;
  /* 精简容器里常常没有 lsof（只有 ss）：没有它时以前直接返回空，回收逻辑静默失效。 */
  const ss = run("ss", ["-ltnp"]);
  return parseSsListeners(ss, p);
}

/** 取某个 pid 的完整命令行（拿不到就返回空串） */
export function cmdlineOf(pid) {
  const n = Number(pid) || 0;
  if (!n) return "";
  if (process.platform === "win32") {
    const out = run("powershell.exe", [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${n}" -ErrorAction SilentlyContinue).CommandLine`,
    ]);
    return out.trim();
  }
  return run("ps", ["-p", String(n), "-o", "command="]).trim();
}

export function pidAlive(pid) {
  const n = Number(pid) || 0;
  if (!n) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

export function killPid(pid) {
  const n = Number(pid) || 0;
  if (!n || n === process.pid) return false;
  if (process.platform === "win32") {
    const r = spawnSync("taskkill", ["/PID", String(n), "/F"], { windowsHide: true, stdio: "ignore" });
    return !r.error && r.status === 0;
  }
  try {
    process.kill(n, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}
