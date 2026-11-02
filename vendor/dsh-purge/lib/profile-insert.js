/**
 * 用户层 profile/cordis.patch.yml 的本体 insert（#154 / #159 / #191）。
 *
 * 包内 overlay 只改已入队行的 inject/config，不能再 insert 一次（Hub 已入队会
 * already queued）。postinstall 和演练台子行都走这里：行不存在就写一条。
 *
 * #191：文件本身是一个完整文档时（宿主生成的空 flow 序列 `[]`），不能再追加，
 * 追加会变成第二个文档，宿主启动解析失败。
 */
import fs from "node:fs";
import path from "node:path";
import { atomicWriteSync } from "./core.js";

export const PURGE_NAME = "dsh-purge";

export const INSERT_BLOCK = [
  "- insert:",
  "    - id: dsh-purge",
  "      name: dsh-purge",
  "      inject: [systemPrompt, tools]",
  "      config:",
  "        enabled: true",
  "        stripMnemon: true",
  "        capabilityProtocol: true",
  "        hooksDenyBypass: true",
  "",
].join("\n");

export function profileHasPurgeBodyInsert(text) {
  const lines = String(text || "").split(/\r?\n/);
  let insertIndent = -1;
  for (const line of lines) {
    if (/^-\s*insert:\s*$/.test(line) || /^\s+-\s*insert:\s*$/.test(line)) {
      insertIndent = (line.match(/^[ \t]*/) || [""])[0].length;
      continue;
    }
    if (insertIndent < 0) continue;
    const indent = (line.match(/^[ \t]*/) || [""])[0].length;
    const trimmed = line.trim();
    if (trimmed && indent <= insertIndent && /^-\s/.test(trimmed)) {
      insertIndent = -1;
      if (/^-\s*insert:\s*$/.test(trimmed)) {
        insertIndent = indent;
      }
      continue;
    }
    // 本体行：id: dsh-purge，或用户按 #159 临时绕过写的 dsh-purge-main / name: dsh-purge
    if (/^-\s*id:\s*dsh-purge(-main)?\s*$/.test(trimmed)) return true;
    if (/^-\s*name:\s*dsh-purge\s*$/.test(trimmed)) return true;
  }
  return false;
}

/**
 * 判断 cordis.patch.yml 的数据部分形态（#191）。
 *
 * 宿主生成的 profile 层 patch 文件可能整体只有一个空 flow 序列 `[]`，
 * 那是**一个完整 YAML 文档**。往文件尾追加 `- insert:` 会变成第二个文档，
 * 宿主启动解析报 "end of the stream or a document separator is expected"。
 *
 * 只看最后一个文档的根节点类型（追加内容落在最后一个文档里）：
 *   - "empty"       没有数据行（空文件 / 只有注释和空行）
 *   - "empty-flow"  数据部分恰好是空 flow 序列 `[]`（可带 `---` 前缀）
 *   - "block-seq"   正常块序列（顶层 `- ...`），沿用旧的追加行为
 *   - "flow-seq"    非空 flow 序列（宿主/用户内容，动不得）
 *   - "unknown"     其它形态（顶层映射等），认不准就不写
 */
export function classifyPatchBody(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const dataLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue; // 空行
    if (trimmed.startsWith("#")) continue; // 注释行
    dataLines.push({ index: i, trimmed });
  }
  // 按 `---` 切成多个文档，只看最后一个（追加内容会落在最后一个文档里）
  const lastDoc = [];
  for (const item of dataLines) {
    if (item.trimmed === "---") {
      lastDoc.length = 0;
      continue;
    }
    lastDoc.push(item);
  }
  if (lastDoc.length === 0) return { kind: "empty", lines };
  // 空 flow 序列：`[]` / `[ ]`，允许行尾注释
  if (lastDoc.length === 1 && /^\[\s*\]\s*(#.*)?$/.test(lastDoc[0].trimmed)) {
    return { kind: "empty-flow", lines, emptyFlowIndex: lastDoc[0].index };
  }
  if (lastDoc[0].trimmed.startsWith("[")) return { kind: "flow-seq", lines };
  if (/^-(\s|$)/.test(lastDoc[0].trimmed)) {
    // 块序列里混进顶层 flow 序列 → 本身就是坏 YAML，认不准就不动
    if (lastDoc.slice(1).some((item) => item.trimmed.startsWith("["))) return { kind: "unknown", lines };
    return { kind: "block-seq", lines };
  }
  return { kind: "unknown", lines };
}

export function ensureProfileBodyInsert(profileDir) {
  const fp = path.join(profileDir, "cordis.patch.yml");
  // 海鸥 bundle 已显式插入本体；不要再向用户 profile 写入第二条。
  const plugin = path.join(profileDir, "node_modules", PURGE_NAME);
  if (readJson(path.join(plugin, "package.json"))?.seagull?.updateManaged) {
    try {
      if (profileHasPurgeBodyInsert(fs.readFileSync(path.join(plugin, "cordis.patch.yml"), "utf8"))) {
        return { ok: true, wrote: false, path: fp };
      }
    } catch { /* 缺少 bundle 时仍使用上游自愈路径。 */ }
  }
  let text = "";
  try { text = fs.readFileSync(fp, "utf8"); } catch { text = ""; }
  if (profileHasPurgeBodyInsert(text)) {
    return { ok: true, wrote: false, path: fp };
  }
  const shape = classifyPatchBody(text);
  if (shape.kind === "empty-flow") {
    // `[]` 本身是一个完整文档：把整行替换成 insert 块，绝不追加成第二个文档（#191）
    const blockLines = INSERT_BLOCK.replace(/\n$/, "").split("\n");
    const out = [
      ...shape.lines.slice(0, shape.emptyFlowIndex),
      ...blockLines,
      ...shape.lines.slice(shape.emptyFlowIndex + 1),
    ].join("\n");
    atomicWriteSync(fp, `${out.endsWith("\n") ? out : `${out}\n`}`, "utf8");
    return { ok: true, wrote: true, path: fp };
  }
  if (shape.kind === "flow-seq" || shape.kind === "unknown") {
    // 宿主 / 用户自己的内容，宁可不动也别写坏（#191）
    return { ok: false, wrote: false, path: fp };
  }
  // 空文件 / 只有注释 → 直接写 insert 块；正常块序列 → 沿用旧的追加行为
  const prefix = text && !text.endsWith("\n") ? "\n" : "";
  atomicWriteSync(fp, `${text}${prefix}${text ? "\n" : ""}${INSERT_BLOCK}`, "utf8");
  return { ok: true, wrote: true, path: fp };
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

function profileOwnsPurge(dir) {
  const pkg = readJson(path.join(dir, "package.json"));
  const bundles = pkg?.dsh?.profile?.bundles;
  if (Array.isArray(bundles) && bundles.includes(PURGE_NAME)) return true;
  try {
    return fs.existsSync(path.join(dir, "node_modules", PURGE_NAME, "package.json"));
  } catch {
    return false;
  }
}

export function listProfileDirs(dshHome) {
  const root = path.join(dshHome || "", "profiles");
  const out = [];
  let names = [];
  try { names = fs.readdirSync(root); } catch { return out; }
  for (const name of names) {
    const dir = path.join(root, name);
    try {
      if (fs.statSync(dir).isDirectory()) out.push(dir);
    } catch { /* skip */ }
  }
  return out;
}

export function ensureProfileBundles(profileDir) {
  const fp = path.join(profileDir, "package.json");
  const pkg = readJson(fp);
  if (!pkg) return { ok: false, wrote: false, path: fp };
  pkg.dsh = pkg.dsh && typeof pkg.dsh === "object" ? pkg.dsh : {};
  pkg.dsh.profile = pkg.dsh.profile && typeof pkg.dsh.profile === "object" ? pkg.dsh.profile : {};
  const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];
  if (bundles.includes(PURGE_NAME)) return { ok: true, wrote: false, path: fp };
  pkg.dsh.profile.bundles = [...bundles, PURGE_NAME];
  atomicWriteSync(fp, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return { ok: true, wrote: true, path: fp };
}

/**
 * pnpm allowBuilds 期望键（#185）。
 *
 * registry / tarball / git 安装写裸包名 `dsh-purge`。pnpm 11.28 对 injected
 * `file:` 依赖的严格构建检查按 `包名@file:...` 标识匹配，因此该形态同时写精确 file 键。
 * `dsh-purge@https://...` 这类键在早期 pnpm 11（DSH 内置
 * 11.2.2）会被 semver 解析器当成版本联合，直接报
 * `[ERR_PNPM_INVALID_VERSION_UNION] Invalid versions union` 让 install 崩掉。
 *
 */
export function purgePnpmBuildSpecs(profileDir) {
  const spec = readJson(path.join(profileDir || "", "package.json"))?.dependencies?.[PURGE_NAME];
  if (typeof spec === "string" && spec.startsWith("file:")) {
    return [PURGE_NAME, `${PURGE_NAME}@${spec}`];
  }
  return [PURGE_NAME];
}

function isPurgeAllowBuildKey(key) {
  const name = String(key || "").replace(/^['"]|['"]$/g, "");
  return name === PURGE_NAME || name.startsWith(`${PURGE_NAME}@`);
}

/** 导出仅供单测 round-trip（#180）。 */
export function parseAllowBuildLine(line) {
  const text = String(line || "").replace(/\r$/, "");
  // 引号包裹：键整段取出，URL 里的冒号不会切碎键
  const quoted = text.match(/^[ \t]+(?:"([^"]+)"|'([^']+)')[ \t]*:[ \t]*(.*?)\s*$/);
  if (quoted) return { key: quoted[1] !== undefined ? quoted[1] : quoted[2], value: String(quoted[3] || "").trim() };
  // 未加引号的键：要求有缩进（顶层键不算），只在「冒号+空白（或行尾）」处切分，且取最后一次出现的位置——
  // URL 里的 `:` 后面跟的是 `/`，不会断键；`dsh-purge@https: true`（畸形历史键）也能正常切成键+值（#180）
  if (!/^[ \t]+/.test(text)) return null;
  let split = -1;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== ":") continue;
    if (i + 1 >= text.length || /[ \t]/.test(text[i + 1])) split = i;
  }
  if (split < 0) return null;
  const key = text.slice(0, split).trim();
  if (!key) return null;
  return { key, value: text.slice(split + 1).trim() };
}

/** 导出仅供单测 round-trip（#180）。 */
export function formatAllowBuildLine(key) {
  const name = String(key || "");
  // 含 `://` 的 URL 键加引号，避免 YAML 把 URL 里的冒号当分隔符（#180）
  if (name.includes("://")) return `  ${JSON.stringify(name)}: true`;
  return `  ${name}: true`;
}

/**
 * 重写前做最小校验：顶层键、allowBuilds 段内键都不重复，每个键写回格式都能被
 * parseAllowBuildLine 无损还原。校验不过就不写盘，宁可不动用户的文件（#180）。
 * 导出仅供单测（#180）。
 */
export function validateAllowBuildRewrite(text) {
  const lines = String(text || "").split("\n");
  let inAllow = false;
  let allowIndent = -1;
  const topKeys = new Set();
  const allowKeys = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue; // 注释行原样保留，不参与校验
    if (/^\S/.test(line)) {
      inAllow = /^allowBuilds[ \t]*:/.test(line);
      allowIndent = -1;
      const m = line.match(/^(\S+?)[ \t]*:/);
      if (!m) return false;
      if (topKeys.has(m[1])) return false;
      topKeys.add(m[1]);
      continue;
    }
    if (!inAllow) continue;
    const indent = (line.match(/^[ \t]*/) || [""])[0].length;
    if (allowIndent < 0) allowIndent = indent;
    if (indent < allowIndent) {
      // 缩进回到 allowBuilds 的子键层级以上，说明段已结束
      inAllow = false;
      continue;
    }
    const parsed = parseAllowBuildLine(line);
    if (!parsed || !parsed.key) return false;
    const name = parsed.key;
    if (allowKeys.has(name)) return false;
    // 写回后的行必须能无损解析出同一个键
    if (parseAllowBuildLine(formatAllowBuildLine(name))?.key !== name) return false;
    allowKeys.add(name);
  }
  return true;
}

/**
 * 把 dsh-purge 写成 true，避免装别的插件还报 ERR_PNPM_IGNORED_BUILDS（#168）。
 *
 * #185：URL / 版本历史键会触发 ERR_PNPM_INVALID_VERSION_UNION，统一丢弃。
 * SeaGull 的 injected `file:` 依赖保留精确 file 键，兼容 pnpm 11.28 的严格构建检查；
 * 非 purge 键原样保留。
 */
export function rewritePnpmAllowBuilds(raw, profileDir) {
  const wanted = purgePnpmBuildSpecs(profileDir);
  const wantedSet = new Set(wanted);
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const wantedBlock = wanted.map(formatAllowBuildLine);
  if (!text.trim()) {
    return `allowBuilds:\n${wantedBlock.join("\n")}\n`;
  }
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^allowBuilds[ \t]*:/.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    const prefix = text.endsWith("\n") ? "" : "\n";
    return `${text}${prefix}\nallowBuilds:\n${wantedBlock.join("\n")}\n`;
  }
  let end = lines.length;
  const kept = [];
  const seen = new Set();
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      end = i;
      break;
    }
    if (/^\S/.test(line)) {
      end = i;
      break;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      kept.push(line);
      continue;
    }
    const parsed = parseAllowBuildLine(line);
    if (!parsed) {
      kept.push(line);
      continue;
    }
    if (isPurgeAllowBuildKey(parsed.key)) {
      // 只保留精确等于期望键的行，且去重；其余历史 purge 键丢弃（#180 自愈）
      if (!wantedSet.has(parsed.key) || seen.has(parsed.key)) continue;
      kept.push(formatAllowBuildLine(parsed.key));
      seen.add(parsed.key);
      continue;
    }
    // 非 purge 键原样保留；同键重复（会让 pnpm 报 duplicated mapping key）只留第一份
    if (seen.has(parsed.key)) continue;
    seen.add(parsed.key);
    kept.push(line);
  }
  for (let i = 0; i < wanted.length; i += 1) {
    if (!seen.has(wanted[i])) {
      kept.push(wantedBlock[i]);
      seen.add(wanted[i]);
    }
  }
  const next = [...lines.slice(0, start + 1), ...kept, ...lines.slice(end)].join("\n");
  return next.endsWith("\n") ? next : `${next}\n`;
}

/** pnpm 11/12 默认拦 postinstall（ERR_PNPM_IGNORED_BUILDS）。写进 profile 的 allowBuilds，下次 add 能跑脚本。 */
export function ensurePnpmAllowBuild(profileDir) {
  const fp = path.join(profileDir, "pnpm-workspace.yaml");
  let text = "";
  try { text = fs.readFileSync(fp, "utf8"); } catch { text = ""; }
  const current = String(text || "").replace(/\r\n/g, "\n");
  const next = rewritePnpmAllowBuilds(current, profileDir);
  if (next === current) return { ok: true, wrote: false, path: fp };
  // 写前校验不过就不写盘，宁可保持现状（#180）
  if (!validateAllowBuildRewrite(next)) return { ok: false, wrote: false, path: fp, reason: "allowBuilds-invalid" };
  atomicWriteSync(fp, next, "utf8");
  return { ok: true, wrote: true, path: fp };
}

/** 已装进 bundles / node_modules 但缺 insert 的 profile，补上本体行。 */
export function ensureAllProfileBodyInserts(dshHome) {
  return ensureAllProfileInstall(dshHome).map((item) => ({
    dir: item.dir,
    ok: item.ok,
    wrote: Boolean(item.insert?.wrote),
    path: item.insert?.path || path.join(item.dir || "", "cordis.patch.yml"),
    error: item.error,
  }));
}

/** bundles + 本体 insert + pnpm allowBuilds。postinstall 被跳过、升级覆盖 overlay 之后靠这条把按钮找回来。 */
export function ensureAllProfileInstall(dshHome, profile = process.env.DSH_PROFILE) {
  const results = [];
  for (const dir of listProfileDirs(dshHome)) {
    // 宿主指定当前 profile 时，不修改其他已安装环境。
    if (profile && path.basename(dir) !== profile) continue;
    if (!profileOwnsPurge(dir)) continue;
    try {
      const bundles = ensureProfileBundles(dir);
      const insert = ensureProfileBodyInsert(dir);
      const pnpm = ensurePnpmAllowBuild(dir);
      results.push({ dir, ok: true, bundles, insert, pnpm });
    } catch (error) {
      results.push({
        dir,
        ok: false,
        error: error && error.message ? error.message : String(error),
      });
    }
  }
  return results;
}
