import { type ResolvedConfig } from "./config.js";
export interface OpLogEntry {
    /** ISO 时间 */
    t: string;
    /** 操作名：install / update / uninstall / ai-install … */
    op: string;
    ok: boolean;
    /** 失败分类 code（P6 classifyFailure；成功时无） */
    code?: string;
    /** 人话摘要（≤120 字符） */
    msg?: string;
    /** 目标插件（可写 pluginId） */
    target?: string;
    /** 原始输出尾部（≤500 字符，仅失败时） */
    detail?: string;
}
/** 追加一条操作日志；任何失败静默放弃（日志永不能拖垮主流程） */
export declare function appendOpLog(cfg: ResolvedConfig, entry: OpLogEntry): void;
/** 读最近 n 条（文件缺失/个别行损坏都容忍——坏行跳过） */
export declare function readOpLogTail(cfg: ResolvedConfig, n?: number): OpLogEntry[];
/**
 * 导出为可直接粘贴/截图的文本。`versions` 由调用方传（ui 侧 readVersions
 * 有 plugin/core/schema 三件套），core 自己只知道自己的版本。
 */
export declare function exportLogText(cfg: ResolvedConfig, versions?: Record<string, string>): string;
