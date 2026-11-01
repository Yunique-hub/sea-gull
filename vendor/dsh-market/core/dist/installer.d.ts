import type { DshPlugin } from "@dsh-market/schema";
import type { ResolvedConfig } from "./config.js";
import type { InstallOptions, InstallResult } from "./types.js";
/** 安装插件 */
export declare function installPlugin(cfg: ResolvedConfig, plugin: DshPlugin, options: InstallOptions): Promise<InstallResult>;
/** 是否为文件占用/权限类失败（Windows 上更新运行中 profile 的常见病；命中则不应重试） */
export declare function isLockFailure(outputOrMessage: string): boolean;
/**
 * 技能目录命名约定（issue #102）：与 harness 实际扫描/加载一致——无版本后缀。
 * 曾用 `<name>-latest`（旧），导致：装完 harness 可见性/冒烟/已装匹配全部错位、
 * splitNameVersion 也解析不了 `-latest`。所有路径一律走 skillsDestName 唯一出口。
 */
export declare const SKILL_DEST_SUFFIX = "";
/** skill 型安装目标目录名（唯一出口：installer/router/verify/update 共用） */
export declare function skillsDestName(plugin: DshPlugin): string;
/** 从插件推断 npm 包名（cordis 型）：优先 homepage npm 路径，其次 name */
export declare function installPackageName(plugin: DshPlugin): string;
/** 卸载（skill 型：删目录；cordis 型：dsh plugin remove） */
export declare function uninstallPlugin(cfg: ResolvedConfig, plugin: DshPlugin, options: InstallOptions): Promise<{
    ok: boolean;
    error?: string;
}>;
