import type { DshPlugin } from "@dsh-market/schema";
import type { ResolvedConfig } from "./config.js";
import type { ActivationState, ActivationStatus } from "./types.js";
/** 装后四态验证（通用入口：skill 目录存在即 live；cordis 走 verifyCordis） */
export declare function verifyActivation(cfg: ResolvedConfig, opts: {
    type: "skill" | "cordis-plugin";
    /** cordis 型：目标 profile */
    profile?: string;
    /** cordis 型：依赖键名（npm 包名），skill 型：技能目录名 */
    name: string;
}): ActivationStatus;
/** 安装成功后做装后验证（installer 之外的薄封装：解析真实包名/目录名） */
export declare function verifyAfterInstall(cfg: ResolvedConfig, plugin: DshPlugin, opts: {
    profile?: string;
    skillDirName?: string;
}): ActivationStatus;
/** 解析 cordis 插件的安装包名（npm 包名优先，其次仓库名） */
export declare function resolveInstallName(plugin: DshPlugin): string;
/** 状态 → 中文标签（UI 展示用） */
export declare const ACTIVATION_LABELS: Record<ActivationState, string>;
