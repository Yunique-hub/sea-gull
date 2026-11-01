/**
 * 用户画像：已装 + GitHub 加星 + 冷启动问卷 三层信号 → 标签权重
 * EMA 增量更新（α=0.3）；置信度 = 信号丰富度。
 */
import type { DshPlugin } from "@dsh-market/schema";
import type { InstalledPlugin, UserProfile } from "./types.js";
/** EMA 衰减系数（新信号占比） */
export declare const EMA_ALPHA = 0.3;
/** 新建空画像 */
export declare function emptyProfile(): UserProfile;
/** 由已装插件构建标签贡献（每装一个：标签权重 +1，数量开方压缩） */
export declare function tagsFromInstalled(installed: InstalledPlugin[], market: DshPlugin[]): Record<string, number>;
/** 由 GitHub 加星（命中收录的插件）构建标签贡献（权重略低于已装） */
export declare function tagsFromStarred(starredFullNames: string[], market: DshPlugin[]): Record<string, number>;
/** 由问卷选中的标签构建贡献 */
export declare function tagsFromQuiz(pickedTags: string[]): Record<string, number>;
/** EMA 合并新标签贡献到旧画像（标签级增量更新） */
export declare function mergeTags(old: Record<string, number>, incoming: Record<string, number>): Record<string, number>;
/**
 * 更新画像（增量）：
 * @param prev 旧画像（null 则新建）
 * @param market 市场数据
 * @param signals 本次会话的新信号
 */
export declare function updateProfile(prev: UserProfile | null, market: DshPlugin[], signals: {
    installed?: InstalledPlugin[];
    starredFullNames?: string[];
    quizTags?: string[];
}): UserProfile;
/** 由画像判定推荐阶段（尊重手动覆盖） */
export declare function stageOf(profile: UserProfile): "novice" | "veteran";
/** 画像前 N 个标签（展示用） */
export declare function topTags(profile: UserProfile, n?: number): string[];
