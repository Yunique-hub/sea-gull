/**
 * 版本与范围工具（N2 · Host-aware 兼容门禁的基础设施）
 *
 * 为什么自己写而不引 semver：core 层要保持「纯 Node + 零重依赖」（可独立测试、打包体积小），
 * 而这里只需要 semver 范围里最常见的一个子集。
 *
 * ⚠️ 与 `update.ts` 的关系（别混用）：
 *   - `update.ts` 的 `parseVersion` / `compareVersions` 做的是**标准 semver 排序**
 *     （要求三段版本号，且「正式版 > 预发布」按规范比较）——服务于"我该不该升级"。
 *   - 本模块的 `parseVersionForRange` / `compareVersionsForRange` 做的是**范围边界匹配**
 *     （容忍 1~2 段版本号，且**故意忽略预发布**）——服务于"这个插件能不能跑在我的宿主上"。
 *   两者语义不同，故意不合并。导出名带 ForRange 就是为了防止误用。
 *
 * ⚠️ 一处**故意的语义偏离**（务必先读懂再改）：
 *   标准 semver 规定「预发布版本不满足指向正式版的比较」——即 `0.1.5-rc.1` **不**满足 `>=0.1.5`。
 *   但 DSH 的宿主版本常态就是 `0.1.1-rc.2` / `0.1.5-rc.1` 这种 rc 形态。若照标准来，
 *   本机 `0.1.5-rc.1` 对上插件声明的 `>=0.1.5` 会判成"不兼容"→ 拦住一次其实能用的安装。
 *   而"错误地拦住"比"漏一次提醒"糟糕得多（用户会立刻失去信任）。
 *   → 因此本模块采用 **prerelease 宽容比较**：比较边界时只看 主.次.补 三元组，
 *     于是 `0.1.5-rc.1` 满足 `>=0.1.5`、`0.1.5-rc.1` 也满足 `^0.1.2`。
 *   代价：极少数"作者严格要求正式版"的场景会被放过（由 UI 提示，不阻断）。
 *   **不可判定时一律返回 null（未知），调用方必须按"未知"处理，绝不拦截。**
 */
export interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    /** 预发布标识（如 "rc.1"），无则 null —— 仅用于展示，不参与边界比较 */
    pre: string | null;
}
/** 解析版本；容忍 `v` 前缀、缺省 minor/patch（`1` → 1.0.0）、build metadata */
export declare function parseVersionForRange(input: string | null | undefined): ParsedVersion | null;
/** 比较两个版本（prerelease 宽容：只看三元组）。无法解析返回 null */
export declare function compareVersionsForRange(a: string, b: string): number | null;
/**
 * 判断 `version` 是否满足 `range`。
 *
 * 支持：`*` / 比较运算符 / `^` / `~` / 通配段 / 空格与逗号表示 AND / `||` 表示 OR /
 *      `0.1.0 - 0.2.0` 连字符区间。
 * 返回 **null = 无法判定**（范围或版本不能被解析）——调用方必须按"未知"处理，不要当作 false。
 */
export declare function satisfiesRange(version: string | null | undefined, range: string | null | undefined): boolean | null;
/** 把范围翻成人话（用于 UI 提示） */
export declare function describeRange(range: string | null | undefined): string;
