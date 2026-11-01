import type { ResolvedConfig } from "./config.js";
export type DshVersionSource = "env" | "runtime" | "global-npm" | "profile" | "unknown";
export interface DshVersionInfo {
    version: string | null;
    source: DshVersionSource;
    /** 找到版本的 package.json 路径（排障用） */
    from: string | null;
}
/** 清缓存（测试 / DSH 升级后重新探测用） */
export declare function resetDshVersionCache(): void;
/**
 * 探测本机 DSH 宿主版本；读不到返回 `{ version: null, source: "unknown" }`。
 * 结果带缓存（运行期不会变），需要重探时先调 `resetDshVersionCache()`。
 */
export declare function detectDshVersion(cfg?: Pick<ResolvedConfig, "profilesDir" | "defaultProfile">): DshVersionInfo;
