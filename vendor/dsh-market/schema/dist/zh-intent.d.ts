/**
 * 中文意图词典：把口语化查询扩展成可召回的关键词组。
 *
 * 解决的问题：用户搜「记事本」，插件叫 dsh-notes、简介写"笔记工具"——
 * Fuse 和子串都召回不到（字面不相交），后面的 LLM 精排再强也选不到池外的条目。
 * 这一层是**确定性的、零 token 的**，直接参与普通搜索（区别于默认关闭的 LLM 语义精排）。
 *
 * 设计约定：
 * - `words` 是**触发词**：用户查询里出现任一 → 命中该意图；
 * - `terms` 是**召回词**：对全库做子串扫描（名称/简介/标签），命中即进入候选；
 * - **词边界标记**：召回词以 `#` 前缀标记时（如 `"#ai"`），名称/简介侧按
 *   **词边界（token）**匹配而非子串——用于短而泛的英文裸词（ai/ip/web/log/dev…）。
 *   动机（2026-09-29 真实数据审计，9145 条）：`ai` 子串命中 email/main/pipeline 等
 *   713 个名称，AI大模型 facet 被撑到 17.5%；token 化后只命中 ai-chat/ai-tools 这类
 *   真把 "ai" 当独立词的条目。标签侧始终是精确匹配，不受标记影响。
 * - 词表只收「高频 + 映射明确」的意图，宁缺毋滥——错误的扩展比没有扩展更伤排序。
 *   召回词里的高频中文标签来自数据侧挖掘（2026-09-29：全库高频标签 × 词典覆盖审计），
 *   如 MCP/桌宠/数据分析/多模态/提示词/报告生成六个新意图即由标签频次驱动补充。
 */
export interface ZhIntent {
    /** 意图名（最典型的中文说法，UI 提示用） */
    key: string;
    /** 触发词：查询中出现任一即命中 */
    words: string[];
    /** 召回词：中英混合，参与全库匹配；`#` 前缀 = 按词边界匹配（见文件头） */
    terms: string[];
}
export declare const ZH_INTENTS: ZhIntent[];
export interface ZhExpansion {
    /** 命中的意图（保持词典顺序，供 UI 提示与 via 标记） */
    intents: string[];
    /** 意图 → 召回词（已去重、已剔除会被主查询覆盖的词） */
    expansions: Array<{
        intent: string;
        terms: string[];
    }>;
    /** 全部召回词的扁平集合（去重，含 `#` 词边界标记） */
    terms: string[];
}
/** 该召回词是否为词边界（token）匹配 */
export declare function isTokenTerm(term: string): boolean;
/** 去掉词边界标记后的实际匹配词 */
export declare function rawTerm(term: string): string;
/**
 * 词边界（token）匹配：`term` 在文本中作为独立词出现才命中。
 * 边界 = 非小写字母数字（大小写不敏感，文本需先转小写）——
 * "ai-chat" 命中 "ai"、"AI聊天" 命中（CJK 是边界）、"email"/"main" 不命中。
 */
export declare function tokenInText(term: string, text: string): boolean;
/**
 * 对查询做意图扩展。查询里包含某意图的任一触发词 → 展开该意图的召回词。
 * 纯内存字符串操作，无网络无 LLM；查询不命中任何意图时返回空扩展（搜索行为不变）。
 */
export declare function expandZhQuery(query: string): ZhExpansion;
