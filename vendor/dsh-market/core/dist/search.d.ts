/**
 * 搜索：Fuse.js 关键词召回 + 中文意图词典扩展 + 标签 AND 过滤 + 排序
 * 支持语义翻译注入（UI 层可把自然语言经 LLM 翻译成标签后传入 semanticTags）。
 */
import Fuse from "fuse.js";
import type { DshPlugin } from "@dsh-market/schema";
export interface SearchOptions {
    /** 语义翻译出的标签（LLM 增强：自然语言 → 标签），与关键词共同参与召回 */
    semanticTags?: string[];
    /** 标签 AND 过滤 */
    tags?: string[];
    /** 插件类型过滤 */
    type?: "skill" | "cordis-plugin" | null;
    /** 需要配置（needsConfig）过滤：false 时只返回 needsConfig=false 的 */
    noConfigOnly?: boolean;
    /** 排序：relevance（默认）/ score / newest */
    sortBy?: "relevance" | "score" | "newest";
    /** 返回条数 */
    limit?: number;
    /** 排除的插件 id（已装） */
    excludeIds?: string[];
}
export interface SearchResult {
    plugin: DshPlugin;
    /** 0-100 相关度（Fuse 分数换算） */
    relevance: number;
    /** 标签命中数（语义/过滤标签） */
    tagHits: number;
    /** 中文意图词典命中的意图名（如「记事本」），用于结果页提示"为什么搜到了它" */
    via?: string[];
}
/** 构建 Fuse 索引 */
export declare function createSearchIndex(plugins: DshPlugin[]): Fuse<DshPlugin>;
/** 关键词搜索（空查询返回全部，按 score 排序） */
export declare function search(plugins: DshPlugin[], query: string, options?: SearchOptions): SearchResult[];
