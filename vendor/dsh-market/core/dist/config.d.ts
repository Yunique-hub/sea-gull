import type { CoreConfig, GitHubBinding, UserProfile } from "./types.js";
/**
 * #249 · jsDelivr 公共镜像基座：国内直连 GitHub Pages / dsh.market 常年不可达
 * （实测 lite 10MB 在 180s 内下不完），jsDelivr 同文件 1.7–7s。
 * gh 分支引用缓存 12h：市场数据每日 06:00 更新一次，最坏滞后半天，可接受。
 * 取数候选 = 默认地址 + 这些镜像（见 config.ts → withMirrors / data.ts → remoteCandidates）。
 */
export declare const MIRROR_BASES: readonly ["https://cdn.jsdelivr.net/gh/2BingLing/dsh-market@master/web/public", "https://fastly.jsdelivr.net/gh/2BingLing/dsh-market@master/web/public"];
/**
 * 单地址 → [原地址, ...镜像地址]。
 * 仅对默认 Pages 地址套镜像；用户自定义源（env / config 传入）不认识 jsDelivr 上的
 * 对应文件，原样返回——自定义即用户自负其责。
 */
export declare function withMirrors(url: string): string[];
export interface ResolvedConfig {
    dshHome: string;
    skillsDir: string;
    profilesDir: string;
    dataDir: string;
    defaultProfile: string;
    remoteUrl: string;
    /** 瘦身索引地址；与 remoteUrl 相同表示不启用 */
    liteUrl: string;
    localDataPath: string | null;
    cacheTtlMs: number;
}
/** 解析并归一化配置（路径不存在时按需创建目录） */
export declare function resolveConfig(config?: CoreConfig): ResolvedConfig;
/** 确保数据目录存在 */
export declare function ensureDataDir(cfg: ResolvedConfig): string;
export interface LocalSettings {
    /** 用户手动覆盖的模式 */
    modeOverride: "auto" | "novice" | "veteran";
    /** 目标 profile */
    profile: string;
}
/** 读取画像；无则返回 null */
export declare function readProfile(cfg: ResolvedConfig): UserProfile | null;
/** 写入画像 */
export declare function writeProfile(cfg: ResolvedConfig, profile: UserProfile): void;
/** 读取 GitHub 绑定 */
export declare function readBinding(cfg: ResolvedConfig): GitHubBinding | null;
/** 写入 GitHub 绑定 */
export declare function writeBinding(cfg: ResolvedConfig, binding: GitHubBinding): void;
/** 读取本地设置（默认值兜底） */
export declare function readSettings(cfg: ResolvedConfig): LocalSettings;
/** 写入本地设置 */
export declare function writeSettings(cfg: ResolvedConfig, patch: Partial<LocalSettings>): void;
/** 回滚快照目录 */
export declare function snapshotDir(cfg: ResolvedConfig): string;
/** 当前 harness 运行的 profile（尽力探测：env → 默认） */
export declare function detectActiveProfile(cfg: ResolvedConfig): string;
