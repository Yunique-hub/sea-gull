/**
 * 安装路由度量（设计稿 §10）：JSONL 事件日志 + 聚合摘要，全部零 LLM。
 * sessionChars 为 T1 子代理会话累计字符量（≈ token 粗略代理，约 4 字符/token）。
 * 目标数值：T0 命中率、AI 参与率、成功率、T1 平均会话量。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDataDir } from "./config.js";
export function metricsDir(cfg) {
    return join(ensureDataDir(cfg), "metrics");
}
const METRIC_FILE = "install-events.jsonl";
/** 追加一条度量事件（失败静默：度量不阻断安装） */
export function recordInstallMetric(cfg, event) {
    try {
        const dir = metricsDir(cfg);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        appendFileSync(join(dir, METRIC_FILE), JSON.stringify(event) + "\n", "utf8");
    }
    catch {
        /* 忽略 */
    }
}
/** 读全部事件（跳过损坏行） */
export function readMetrics(cfg) {
    try {
        const file = join(metricsDir(cfg), METRIC_FILE);
        if (!existsSync(file))
            return [];
        return readFileSync(file, "utf8")
            .split("\n")
            .filter((l) => l.trim().length > 0)
            .map((l) => {
            try {
                const e = JSON.parse(l);
                return e && typeof e.pluginId === "string" && typeof e.mode === "string" ? e : null;
            }
            catch {
                return null;
            }
        })
            .filter((e) => e !== null);
    }
    catch {
        return [];
    }
}
/** 聚合摘要：t1 只统计 phase=done 的完成事件（start 仅作轨迹可见性） */
export function metricSummary(cfg) {
    const events = readMetrics(cfg);
    const done = events.filter((e) => e.mode !== "t1" || e.phase === "done");
    const byMode = {};
    for (const e of done)
        byMode[e.mode] = (byMode[e.mode] ?? 0) + 1;
    const t1 = byMode.t1 ?? 0;
    const aiTotal = (byMode.already ?? 0) + (byMode.recipe ?? 0) + (byMode.parsed ?? 0) + t1;
    const ok = done.filter((e) => e.ok).length;
    const chars = done.filter((e) => e.sessionChars != null).map((e) => e.sessionChars);
    return {
        total: events.length,
        byMode,
        t0Rate: aiTotal > 0 ? (aiTotal - t1) / aiTotal : 0,
        aiRate: aiTotal > 0 ? t1 / aiTotal : 0,
        okRate: done.length > 0 ? ok / done.length : 0,
        avgSessionChars: chars.length > 0 ? Math.round(chars.reduce((a, b) => a + b, 0) / chars.length) : null,
        recent: events.slice(-10).reverse(),
    };
}
