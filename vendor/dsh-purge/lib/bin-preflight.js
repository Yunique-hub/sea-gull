// #197：把「启动前回收残留 web server」的钩子挂到宿主 bin.js 顶部。
// 必须在 Cordis 激活之前跑：webserver 插件绑端口失败在 0.2.x 是 fatal，等插件层再处理就晚了。
// 注入形态与 hide-console 一致：宿主 lib 下放一个 sidecar + bin.js 顶部加一行 import。
// 与 hide-console 的区别：这里跨平台生效（detached 重启在 macOS/Linux 同样会留下孤儿）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAsarSealedPath } from "./desktop.js";
import { looksLikeSourceCliRoot, resolveDshBinRoot, writeHostFileAtomic } from "./hide-console.js";

const MARK = "dsh-purge-web-preflight";
const IMPORT_LINE = `import "./${MARK}.js"; // [dsh-purge] web preflight`;
const ENTRY = fileURLToPath(new URL("./web-preflight-entry.js", import.meta.url));

export function installBinPreflight(aiBase) {
  const root = resolveDshBinRoot(aiBase);
  if (!root) return "missing_bin";
  // 源码部署的 apps/cli/lib 是 tsdown 产物：只准读、不准改（#41）。
  if (looksLikeSourceCliRoot(root)) return "skipped_source_cli";
  const binJs = path.join(root, "lib", "bin.js");
  const side = path.join(root, "lib", `${MARK}.js`);
  if (isAsarSealedPath(root) || isAsarSealedPath(binJs)) return "sealed_asar";

  let source;
  try {
    source = fs.readFileSync(ENTRY, "utf8");
    writeHostFileAtomic(fs, side, source);
  } catch (e) {
    return `error:${e && e.message ? e.message : e}`;
  }

  let text;
  try {
    text = fs.readFileSync(binJs, "utf8");
  } catch (e) {
    return `error:${e && e.message ? e.message : e}`;
  }
  if (text.includes(IMPORT_LINE)) return "already_injected";
  text = text.replace(/^import "\.\/dsh-purge-web-preflight\.js";.*\r?\n/gm, "");
  if (/^#!/.test(text)) {
    const nl = text.indexOf("\n");
    text =
      nl >= 0
        ? text.slice(0, nl + 1) + `${IMPORT_LINE}\n` + text.slice(nl + 1)
        : `${text}\n${IMPORT_LINE}\n`;
  } else {
    text = `${IMPORT_LINE}\n${text}`;
  }
  try {
    writeHostFileAtomic(fs, binJs, text);
  } catch (e) {
    return `error:${e && e.message ? e.message : e}`;
  }
  return "injected";
}

export function revertBinPreflight(aiBase) {
  const root = resolveDshBinRoot(aiBase);
  if (!root) return "missing_bin";
  const binJs = path.join(root, "lib", "bin.js");
  const side = path.join(root, "lib", `${MARK}.js`);
  let changed = false;
  if (!looksLikeSourceCliRoot(root)) {
    try {
      const text = fs.readFileSync(binJs, "utf8");
      const next = text.replace(/^import "\.\/dsh-purge-web-preflight\.js";.*\r?\n/gm, "");
      if (next !== text) {
        writeHostFileAtomic(fs, binJs, next);
        changed = true;
      }
    } catch (e) {
      return `error:${e && e.message ? e.message : e}`;
    }
  }
  try {
    if (fs.existsSync(side)) {
      fs.unlinkSync(side);
      changed = true;
    }
  } catch {
    /* 重启后再删 */
  }
  return changed ? "reverted" : "absent";
}
