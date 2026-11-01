/**
 * 推荐引擎：
 * - 分阶段：新手（高分精选 + 新手友好引导）/ 老手（标签相似 + 新颖 + MMR 多样性）
 * - 场景推荐：由会话上下文标签命中（harness 独有能力）
 * - 理由：规则生成
 */
import type { DshPlugin } from "@dsh-market/schema";
import type { Recommendation, UserProfile } from "./types.js";
/** MMR 多样性系数（λ=0.7：相关度为主，多样性为辅） */
export declare const MMR_LAMBDA = 0.7;
/** 新颖窗口：近 30 天更新视为"新" */
export declare const NOVEL_DAYS = 30;
export interface RecommendOptions {
    /** 已装插件 id（排除） */
    excludeIds?: string[];
    /** 会话场景标签（由 UI 层注入：正在使用的 skill 标签等） */
    sceneTags?: string[];
    /** 返回条数（默认 20） */
    limit?: number;
    /** 强制阶段（默认按画像推断） */
    stage?: "novice" | "veteran";
    /** 是否包含场景推荐（默认 true） */
    includeScene?: boolean;
    /** 参考时间（测试注入，默认 now） */
    now?: Date;
}
export interface SceneMatch {
    plugin: DshPlugin;
    hitTags: string[];
}
/**
 * 推荐主入口：返回按 origin 分组排序的推荐列表
 * 顺序：scene（场景命中）→ guess（画像猜测）→ curated/trending（兜底）
 */
export declare function recommend(plugins: DshPlugin[], profile: UserProfile, options?: RecommendOptions): Recommendation[];
/** 场景匹配：标签命中数排序 */
export declare function findSceneMatches(pool: DshPlugin[], sceneTags: string[], now: Date): SceneMatch[];
/**
 * 宽松标签命中：标签精确/包含匹配 + 中文简介子串兜底
 * （collector 标签体系与用户自然语言词存在差异，如"飞书" vs "通知提醒"）
 */
export declare function looseTagHit(p: DshPlugin, tag: string): boolean;
