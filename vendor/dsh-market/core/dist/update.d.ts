import type { DshPlugin } from "@dsh-market/schema";
import type { ResolvedConfig } from "./config.js";
import type { CommandRunner, InstalledPlugin } from "./types.js";
export interface UpdateCheckResult {
    /** 已装项本地名（skill 目录名 / npm 依赖名） */
    localName: string;
    /** 市场插件 id（未收录为 null） */
    pluginId: string | null;
    /** 检测方式：npm（cordis）/ github（skill）/ none（无法检测） */
    kind: "npm" | "github" | "none";
    /** 本地版本（npm）或本地目录 mtime ISO（github） */
    current: string | null;
    /** 远端最新版本（npm）或仓库 pushedAt ISO（github） */
    latest: string | null;
    /** 是否有新版本 */
    hasUpdate: boolean;
    /** 无法检测的原因 */
    error?: string;
}
/** 解析 semver（支持 v 前缀与预发布；build metadata 忽略），失败返回 null */
export declare function parseVersion(v: string): {
    nums: number[];
    pre: string[];
} | null;
/** semver 比较：a < b → -1，相等 → 0，a > b → 1；无法解析时字典序兜底 */
export declare function compareVersions(a: string, b: string): -1 | 0 | 1;
/** fetch 兼容类型（测试 mock 友好；真 fetch 天然可赋值） */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
/** 查询 npm registry 指定包的最新版本（带内存缓存；失败返回 null）。
 *  #265 · registry 参数 = 安装侧实际使用的源（pnpm config get registry）：检测与安装
 *  必须同源——官方源看到的新版本，用户镜像没同步时 pnpm 装上的仍是旧版，
 *  造成「可更新但永远装不上」。只显示安装源里存在的更新。 */
export declare function fetchNpmLatest(pkgName: string, fetchImpl?: FetchLike, registry?: string): Promise<string | null>;
/** 查询 GitHub 仓库 pushed_at（带内存缓存；失败返回 null） */
export declare function fetchRepoPushedAt(fullName: string, fetchImpl?: FetchLike): Promise<string | null>;
export declare function resolveNpmRegistry(profileDir: string, runner?: CommandRunner): Promise<string>;
/** 已装插件更新检测（分批并发，默认每批 4 个请求，避免瞬时打满限额） */
export declare function checkUpdates(cfg: ResolvedConfig, installed: InstalledPlugin[], opts?: {
    force?: boolean;
    fetchImpl?: FetchLike;
    registry?: string;
}): Promise<UpdateCheckResult[]>;
/** 插件自身更新检测：npm 最新版 vs 当前安装版本（force 绕过 1h 内存缓存） */
export declare function checkSelfUpdate(currentVersion: string, opts?: {
    fetchImpl?: FetchLike;
    force?: boolean;
    registry?: string;
}): Promise<{
    current: string | null;
    latest: string | null;
    hasUpdate: boolean;
}>;
/**
 * 更新执行（P0-3）：before/after 对比，杜绝"点了更新、显示成功、版本号没动"。
 * - npm(cordis) 目标：前后读实际安装版本；未变且 npm 有更高版 → 判定被 minimumReleaseAge 挡住（附放宽动作）
 * - github(skill) 目标：前后读本地 HEAD commit；未变 → "上游无新提交"
 */
export interface ApplyUpdateResult {
    /** 是否真正执行成功 */
    applied: boolean;
    /** 更新前版本 / HEAD commit */
    before: string | null;
    /** 更新后版本 / HEAD commit */
    after: string | null;
    /** 版本/commit 是否未变化（假更新） */
    noChange: boolean;
    /** 被 pnpm minimumReleaseAge 发布年龄门槛挡住 */
    blocked?: "minimum-release-age" | null;
    /** 人类可读原因 */
    reason?: string;
    error?: string;
    /** 装后四态验证（cordis 更新成功时附带） */
    activation?: import("./types.js").ActivationStatus;
}
/** 读 profile 的 pnpm-workspace.yaml 中 minimumReleaseAge（秒；0=不限制） */
export declare function readMinimumReleaseAge(profileDir: string): number | null;
/** 写 profile 的 minimumReleaseAge（放宽门槛：0 = 不限制） */
export declare function writeMinimumReleaseAge(profileDir: string, value: number): {
    ok: boolean;
    value: number;
    error?: string;
};
/** 执行更新（skill 重新 clone；cordis 重新 add @latest），带 before/after 对比 */
export declare function applyUpdate(cfg: ResolvedConfig, plugin: DshPlugin, item: InstalledPlugin, opts: {
    runner: CommandRunner;
    profile?: string;
    dryRun?: boolean;
    fetchImpl?: FetchLike;
    registry?: string;
}): Promise<ApplyUpdateResult>;
