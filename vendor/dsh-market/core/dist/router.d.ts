import type { DshPlugin } from "@dsh-market/schema";
import type { CommandRunner, InstallResult, SmokeCheck, StepCallback } from "./types.js";
import type { ResolvedConfig } from "./config.js";
import { type Recipe } from "./recipe.js";
export type RouterMode = "already" | "recipe" | "parsed" | "builtin" | "ai";
export interface RouterResult {
    /** 实际走的路径：already=已装跳过 · recipe=配方命中 · parsed=解析命令 · ai=需升级子代理 */
    mode: RouterMode;
    ok: boolean;
    /** 已装跳过 */
    alreadyInstalled?: boolean;
    /** true = 需要升级 T1 子代理（插件侧据此发起子代理） */
    needAi: boolean;
    /** 升级/失败原因（原样进 T1 提示词的「前序尝试」） */
    reason?: string;
    result?: InstallResult;
    recipe?: Recipe | null;
}
export interface RouteOptions {
    /** 目标 profile（cordis 型） */
    profile: string;
    /** 命令执行器（Host 注入） */
    runner: CommandRunner;
    /** 覆盖已装跳过 */
    force?: boolean;
    onStep?: StepCallback;
    /** 是否允许命中配方缓存（默认 true；false 用于诊断） */
    useRecipe?: boolean;
    /** 取消信号（#165 建议三）：透传给安装执行器，abort 后停止执行与重试 */
    signal?: AbortSignal;
}
/** 展开 `~`（README 命令常见；Windows 上 cmd 的 ~ 展开不可靠，这里统一处理） */
export declare function expandHome(p: string): string;
/**
 * 从 cordis 安装命令提取真实包名（`dsh plugin --profile <p> add <pkg>` / `pnpm add <pkg>` 等）。
 * 市场数据里大量 name 字段是 "owner/repo" 格式，installPackageName 猜不出真实安装名，
 * 冒烟必须对"实际执行的安装"做验证 → 优先从命令本身提取。
 */
export declare function extractInstallPkgName(command: string): string | null;
/**
 * skill 解析命令规范化（数据质量兜底）：
 * 市场里大量 skill 的 README 命令把克隆目标写成 ~/.dsh/skills、~/.claude/skills 等，
 * 与 harness 实际扫描的技能目录（cfg.skillsDir）不一致 → 装完不可见、冒烟必失败、误升级 AI。
 * 仅处理"单条 git clone"形态；目标统一重定向为 <skillsDir>/<name>（与已装检测/
 * 冒烟/卸载约定一致，issue #102）。其余形态（多命令脚本 / cordis 错分类等）原样交付，由冒烟失败 →
 * T1 子代理兜底，不伪报成功。
 */
export declare function normalizeSkillCommands(cfg: ResolvedConfig, plugin: DshPlugin, commands: string[]): string[];
/** 推导冒烟检查（结构化，进程内执行——规避 cmd/sh 引号与 node -e 被打断的问题）：
 *  skill → 技能目录含 SKILL.md（优先新约定 <name>；旧 <name>-latest 残留也认，过渡期兼容）；
 *  cordis → profile package.json 依赖含包名
 *  pkgName：解析命令提取的真实包名优先（name 字段常为 owner/repo，installPackageName 猜不准） */
export declare function deriveSmokeCommands(cfg: ResolvedConfig, plugin: DshPlugin, profile: string, pkgName?: string): SmokeCheck[];
/** 安装是否已完成（skill：<name> 或旧 <name>-latest 存在；cordis：profile 依赖含包名；pkgName 同上优先级） */
export declare function isInstalled(cfg: ResolvedConfig, plugin: DshPlugin, profile: string, pkgName?: string): boolean;
/** 内置安装路径对应的规范命令（一键安装成功后学配方用） */
export declare function canonicalCommands(cfg: ResolvedConfig, plugin: DshPlugin, profile: string): string[];
/** T0 路由安装：已装 → 配方 → 解析命令；全部落空/失败 → needAi */
export declare function routeInstall(cfg: ResolvedConfig, plugin: DshPlugin, opts: RouteOptions): Promise<RouterResult>;
/** 手动/子代理学习配方（T1 JSON verdict 落库 / 用户修正；命令不一定已验证 → lastSmoke=null） */
export declare function learnRecipe(cfg: ResolvedConfig, plugin: DshPlugin, profile: string, input: {
    commands: string[];
    smoke?: Recipe["smoke"];
    config?: Recipe["config"];
    learnedFrom?: Recipe["learnedFrom"];
}): void;
/** T1 子代理 JSON verdict（协议输出，见 plugin/ui 的 buildInstallPrompt） */
export interface InstallVerdict {
    ok?: boolean;
    commands?: string[];
    smoke?: string[];
    fail?: string;
    configNeeded?: {
        what?: string;
        hint?: string;
    } | null;
    recipe?: {
        commands?: string[];
        smoke?: string[];
    };
}
/** 解析 T1 子代理的严格 JSON verdict：容忍 ```json 围栏与前后杂文本；无 ok 字段视为无效 */
export declare function parseInstallVerdict(text: string): InstallVerdict | null;
