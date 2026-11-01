/**
 * P12 诊断快照：出路面板「一键导出诊断」的数据源。
 *
 * 设计约束：
 * - **诊断工具绝不能自己抛错**——每个字段独立 try/catch，坏的字段进 `errors` 而不是让整个快照失败；
 * - **只读本地，不访问网络**——崩溃场景下网络/数据源本身可能就是病因，快照必须秒回。
 */
import { detectDshVersion } from "./host.js";
import { readSettings } from "./config.js";
function safe(label, errors, fn, fallback) {
    try {
        return fn();
    }
    catch (e) {
        errors.push(`${label}: ${e.message?.slice(0, 120) ?? "未知错误"}`);
        return fallback;
    }
}
/**
 * 构建诊断快照。`pluginVersion` 由调用方传入（cli.ts 里已有现成实现，不重复探测）。
 */
export function buildDiagSnapshot(cfg, pluginVersion) {
    const errors = [];
    const host = safe("host", errors, () => detectDshVersion(cfg), {
        version: null,
        source: "unknown",
        from: null,
    });
    const settings = safe("settings", errors, () => readSettings(cfg), null);
    return {
        time: new Date().toISOString(),
        pluginVersion: safe("pluginVersion", errors, () => pluginVersion, null),
        host: {
            version: safe("host.version", errors, () => host.version, null),
            source: safe("host.source", errors, () => host.source, "error"),
        },
        runtime: {
            node: safe("node", errors, () => process.version, "?"),
            platform: safe("platform", errors, () => `${process.platform}/${process.arch}`, "?"),
        },
        profile: settings ? safe("profile", errors, () => settings.profile, null) : null,
        mode: settings ? safe("mode", errors, () => settings.modeOverride, "?") : "?",
        errors,
    };
}
