import type { ResolvedConfig } from "./config.js";
import type { SmokeCheck } from "./types.js";
/** 配方有效期：90 天（超期先重新冒烟，冒烟失败才重学） */
export declare const RECIPE_TTL_MS: number;
export interface RecipeConfigBlock {
    /** env=环境变量配置 · file=配置文件 · none=无需配置 */
    type: "env" | "file" | "none";
    /** 需要向用户确认的配置项（API Key / Token 等） */
    prompt?: string;
    /** 配置模板（追加行 / env 名 / 文件片段） */
    snippet?: string;
    /** 配置后是否需要重启 harness */
    restart?: boolean;
}
export interface Recipe {
    pluginId: string;
    /** 安装来源版本（成功后回填；解析命令路径暂为 null） */
    version: string | null;
    /** 环境指纹（平台+shell+包管理器+Node 大版本 的哈希），不匹配不命中 */
    envFingerprint: string;
    /** 与 DshPlugin.type 一致（skill / cordis-plugin） */
    type: "skill" | "cordis-plugin";
    /** 有效安装命令（逐条执行，退出码 0 才继续） */
    commands: string[];
    /** 前置检查（可选；预留，P1 未启用） */
    precheck?: string[];
    /** 冒烟检查（结构化项进程内直查；字符串命令交给 shell——T1 学习/用户提供时均为字符串） */
    smoke: SmokeCheck[];
    /** 配置提供块 */
    config?: RecipeConfigBlock;
    /** 配方来源：parsed=collector 解析/一键安装 · t1/t2=子代理学习 */
    learnedFrom: "parsed" | "t1" | "t2";
    /** 最近验证时间（冒烟通过即刷新） */
    verifiedAt: string;
    /** 最近一次冒烟结果 */
    lastSmoke: "pass" | "fail" | null;
}
/** 配方目录（dataDir/recipes） */
export declare function recipeDir(cfg: ResolvedConfig): string;
export declare function recipePath(cfg: ResolvedConfig, pluginId: string): string;
/** 环境指纹：平台 + shell + 包管理器集合 + Node 大版本 → 哈希 */
export declare function envFingerprint(): string;
/** 读取配方；无/损坏返回 null */
export declare function readRecipe(cfg: ResolvedConfig, pluginId: string): Recipe | null;
/** 写入配方（失败不抛出：配方不是安装的必要条件） */
export declare function writeRecipe(cfg: ResolvedConfig, recipe: Recipe): void;
/** 删除配方（供用户手动清理/修正） */
export declare function deleteRecipe(cfg: ResolvedConfig, pluginId: string): void;
/** 列出全部配方（透明可审查） */
export declare function listRecipes(cfg: ResolvedConfig): Array<{
    pluginId: string;
    type: Recipe["type"];
    learnedFrom: Recipe["learnedFrom"];
    verifiedAt: string;
    lastSmoke: Recipe["lastSmoke"];
}>;
/** 是否未过期（超期先重新冒烟，失败才重学） */
export declare function isRecipeFresh(recipe: Recipe, now?: number, ttlMs?: number): boolean;
