import type { DshPlugin, MarketData } from "@dsh-market/schema";
import type { ResolvedConfig } from "./config.js";
import type { CommandRunner, InstalledPlugin } from "./types.js";
/** 扫描已装插件，并与市场数据匹配 */
export declare function scanInstalled(cfg: ResolvedConfig, market?: MarketData | null): InstalledPlugin[];
/** 目录名 name-version → { baseName, version } */
export declare function splitNameVersion(name: string): {
    baseName: string;
    version: string | null;
};
/**
 * 用已装依赖名匹配市场条目（issue #56：兼容 scoped 包名的误判）。
 * 归一化口径：
 *   - 先按原名精确匹配 name / fullName（无 scope 或恰好同名）；
 *   - 对 `@scope/pkg`：`pkg` 对齐仓库名 `name`（npm 包名常等于仓库名）；
 *     `scope/pkg` 对齐 `owner/repo`（GitHub owner 大小写不敏感，npm scope 必须小写）。
 * 两种都试，命中即返回；均未命中返回 null。
 */
export declare function matchMarketPlugin(dep: string, byName: ReadonlyMap<string, DshPlugin>, byFull: ReadonlyMap<string, DshPlugin>): DshPlugin | null;
/** 读某个 profile 下已装 npm 包的实际版本（供更新 before/after 对比、验证复用） */
export declare function readInstalledVersionForProfile(cfg: ResolvedConfig, profile: string, name: string): string | null;
/** 读本地 git 目录当前 HEAD commit（skill 型更新 before/after 对比用） */
export declare function readLocalHeadCommit(runner: CommandRunner, dir: string): Promise<string | null>;
