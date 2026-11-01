/**
 * P6 错误分类：把安装/更新/卸载的原始失败输出翻译成人话。
 *
 * 目标（竞品借鉴项 P6）：用户看到的不该是 30 行 pnpm 报错，而是
 * 「什么原因（title）+ 该做什么（hint）」，再附关键行（keyLines）给需要深究的人。
 *
 * 分类是**保守的单次正则匹配**，按优先级短路：同一个输出可能同时含多个关键词
 * （如 rate limit 页面里也有 403），先命中的类别优先级更高。
 * 兜底 unknown 也给出有用的 keyLines（输出尾部），绝不返回空手。
 */
export interface FailureClass {
    /** 机器可读类别（写进操作日志，便于统计高频失败原因） */
    code: "incompatible" | "network" | "rate-limit" | "not-found" | "version" | "file-locked" | "permission" | "disk" | "unknown";
    /** 人话原因（一句话，面板直接展示） */
    title: string;
    /** 建议动作（一句话，可操作） */
    hint: string;
    /** 原始输出里的关键行（≤5 行，给复制诊断/人工排查用） */
    keyLines: string[];
}
/**
 * 分类失败输出。任何输入都返回可用结果——分类器自己绝不抛错、绝不返回空。
 */
export declare function classifyFailure(output: string): FailureClass;
