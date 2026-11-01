import type { ResolvedConfig } from "./config.js";
/** t1 事件的阶段：start=升级子代理 · done=子代理完成（有 verdict 或失败返回） */
export type InstallMetricPhase = "start" | "done";
export interface InstallMetricEvent {
    ts: string;
    pluginId: string;
    /** install=一键安装 · ai=AI 代理安装（路由式） */
    type: "install" | "ai";
    /** already=已装跳过 · recipe=配方命中 · parsed=解析命令 · builtin=内置确定性兜底 · t1=子代理 · direct=一键安装 */
    mode: "already" | "recipe" | "parsed" | "builtin" | "t1" | "direct";
    ok: boolean;
    /** ai 型 t1：启动/完成标记 */
    phase?: InstallMetricPhase;
    alreadyInstalled?: boolean;
    smokeFailed?: boolean;
    recipeLearned?: boolean;
    /** T1 完成：会话累计字符量（token 粗略代理） */
    sessionChars?: number;
    /** 失败/升级原因（可为 null） */
    error?: string | null;
}
export declare function metricsDir(cfg: ResolvedConfig): string;
/** 追加一条度量事件（失败静默：度量不阻断安装） */
export declare function recordInstallMetric(cfg: ResolvedConfig, event: InstallMetricEvent): void;
export interface MetricSummary {
    /** 全部事件数（含 start 阶段） */
    total: number;
    /** 按 mode 计数（t1 只计完成事件） */
    byMode: Record<string, number>;
    /** T0 命中率 = ai 型中非子代理占比（already+recipe+parsed）/ aiTotal */
    t0Rate: number;
    /** AI 参与率 = t1 完成事件 / aiTotal */
    aiRate: number;
    /** 整体成功率（一键安装 + ai 完成事件） */
    okRate: number;
    /** T1 会话字符均值（token 粗略代理），无数据为 null */
    avgSessionChars: number | null;
    /** 最近 10 条（倒序） */
    recent: InstallMetricEvent[];
}
/** 读全部事件（跳过损坏行） */
export declare function readMetrics(cfg: ResolvedConfig): InstallMetricEvent[];
/** 聚合摘要：t1 只统计 phase=done 的完成事件（start 仅作轨迹可见性） */
export declare function metricSummary(cfg: ResolvedConfig): MetricSummary;
