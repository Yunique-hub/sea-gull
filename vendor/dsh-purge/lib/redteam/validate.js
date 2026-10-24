/**
 * 写库前的校验与规范化（零依赖）。
 *
 * 从 core.js 抽出来的模块：这些函数决定"什么值允许进库"，
 * 是安全边界所在（路径穿越、非法枚举），值得单独一处、单独读、单独测。
 */

import { resolve, sep } from 'node:path'

export const WEBSHELL_TYPES = ['behinder', 'godzilla', 'antSword', 'antsword', 'custom']
export const WEBSHELL_STATUSES = ['online', 'offline', 'dead', 'unknown']

/**
 * 规范化马类型：大小写不敏感、允许中文别名（冰蝎/哥斯拉/蚁剑）。
 * 认不出就抛错而不是静默存原文 —— 面板的"用户连不上"红标、会话页的连接口令复制
 * 都按这个字段判断，存进去一个拼错的值不会报错，只会让这两处判定静默失效。
 * @param value - 原始值（可为空）。
 * @returns 规范化后的值或 null（空值合法 = 未声明）。
 */
export function normalizeShellType(value) {
  const raw = value === undefined || value === null ? '' : String(value).trim()
  if (raw === '') return null
  const lower = raw.toLowerCase()
  if (/behinder|冰蝎/.test(lower)) return 'behinder'
  if (/godzilla|哥斯拉/.test(lower)) return 'godzilla'
  if (/antsword|蚁剑/.test(lower)) return 'antSword'
  if (lower === 'custom' || lower === 'custom-shell' || /自定义|自研/.test(raw)) return 'custom'
  throw new Error("Invalid webshell shell_type: " + JSON.stringify(value)
    + ". The deliverable must be a **Behinder / Godzilla webshell** (the user must be able to connect to it themselves); "
    + "for any other type use custom (temporary relay only; the panel will flag it as \"user cannot connect\").")
}

/** 规范化马状态（界面按 online/offline/unknown 三态显示）。 */
export function normalizeShellStatus(value) {
  const raw = String(value === undefined || value === null ? '' : value).trim().toLowerCase()
  const aliases = { up: 'online', alive: 'online', down: 'offline', failed: 'offline', removed: 'dead' }
  const normalized = aliases[raw] || raw
  if (normalized === '') return 'online'
  if (!WEBSHELL_STATUSES.includes(normalized)) {
    throw new Error("Invalid webshell status: " + JSON.stringify(value) + ". Valid values are " + WEBSHELL_STATUSES.join(" / ") + ".")
  }
  return normalized
}


/**
 * 路径必须在允许的根目录内（防目录穿越）。
 *
 * 为什么需要：`readAttackFile` / `pocGet` 读的是**数据库里的 path 列**，
 * 而那个列是智能体自己经 `addAttackFile` / `savePoc` 写进去的 —— 也就是不可信输入。
 * 一旦填成 `/etc/passwd` 或 `~/.ssh/id_rsa`，面板点一下就把文件读到浏览器里了。
 * `deletePoc` 早有 startsWith 防护，读路径与写路径却漏了，这里补成一处共用实现。
 * @param target - 待校验的路径。
 * @param allowedRoots - 允许的根目录（数组）。
 * @returns 规范化后的绝对路径。
 * @throws 越界时抛错（调用方按"查不到"处理，不要静默返回内容）。
 */
export function assertPathWithin(target, allowedRoots) {
  const abs = resolve(String(target || ""))
  const roots = (allowedRoots || []).filter((r) => typeof r === "string" && r !== "").map((r) => resolve(r))
  const okFlag = roots.some((root) => abs === root || abs.startsWith(root + sep))
  if (!okFlag) {
    throw new Error("path outside allowed roots: " + abs
      + " (allowed roots: " + roots.join(", ") + "). This record's file path is outside the target directory; read refused.")
  }
  return abs
}
