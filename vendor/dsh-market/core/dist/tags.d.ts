/**
 * 标签治理：聚合/过滤/匹配（从 web/src/lib/tags.ts 迁移，保持与 Web 端一致）
 */
import type { DshPlugin } from "@dsh-market/schema";
export interface TagStat {
    tag: string;
    count: number;
}
/** 聚合所有插件的细分中文标签（过滤宽泛标签） */
export declare function aggregateTags(plugins: DshPlugin[]): TagStat[];
/** 热门标签（前 N 个） */
export declare function hotTags(plugins: DshPlugin[], n?: number): TagStat[];
/** 是否包含全部选中标签（AND 语义） */
export declare function matchesTags(plugin: DshPlugin, selected: string[]): boolean;
/** 插件与标签集合的匹配数 */
export declare function tagMatchCount(plugin: DshPlugin, selected: string[]): number;
/** 可推荐标签：过滤宽泛标签后的全量中文标签 */
export declare function usableTags(plugin: DshPlugin): string[];
