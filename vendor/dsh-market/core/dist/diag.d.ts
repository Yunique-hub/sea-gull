import { type ResolvedConfig } from "./config.js";
export interface DiagSnapshot {
    /** 快照生成时间（ISO） */
    time: string;
    /** 插件市场自身版本（读不到为 null） */
    pluginVersion: string | null;
    /** 本机 DSH 宿主版本（探测不到 version 为 null，source 说明探测途径） */
    host: {
        version: string | null;
        source: string;
    };
    runtime: {
        node: string;
        platform: string;
    };
    /** 当前 profile（如 web） */
    profile: string | null;
    /** 模式覆盖（auto/novice/veteran） */
    mode: string;
    /** 快照自身读取失败的字段（诊断的故障也要可见，静默吞掉等于造假） */
    errors: string[];
}
/**
 * 构建诊断快照。`pluginVersion` 由调用方传入（cli.ts 里已有现成实现，不重复探测）。
 */
export declare function buildDiagSnapshot(cfg: ResolvedConfig, pluginVersion: string | null): DiagSnapshot;
