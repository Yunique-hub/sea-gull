import { readSettings, writeSettings } from "./config.js";
import { scanInstalled } from "./installed.js";
import { routeInstall } from "./router.js";
export const BACKUP_KIND = "dsh-market-backup";
export const BACKUP_SCHEMA_VERSION = 1;
/** 构建备份对象（不落盘：文件写出由客户端触发下载，Host 不碰用户文件选择） */
export function buildBackup(cfg, market, opts = {}) {
    const installed = scanInstalled(cfg, market).map((i) => ({
        pluginId: i.pluginId,
        localName: i.localName,
        version: i.version,
        source: i.source,
        ...(i.plugin ? { pluginName: i.plugin.name, fullName: i.plugin.fullName } : {}),
    }));
    const s = readSettings(cfg);
    return {
        kind: BACKUP_KIND,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        ...(opts.appVersion ? { appVersion: opts.appVersion } : {}),
        settings: { modeOverride: s.modeOverride, profile: s.profile },
        ...(opts.favorites && opts.favorites.length > 0 ? { favorites: [...opts.favorites] } : {}),
        installed,
    };
}
/** 备份文件形状校验（导入前必过：坏文件给"不认识"而不是装到一半炸） */
export function isBackupFile(x) {
    if (!x || typeof x !== "object")
        return false;
    const b = x;
    return (b.kind === BACKUP_KIND &&
        b.schemaVersion === BACKUP_SCHEMA_VERSION &&
        typeof b.generatedAt === "string" &&
        Array.isArray(b.installed));
}
/**
 * 导入合并：对每条备份记录，已装 → already；市场已无 → unmatched；
 * 缺失 → T0 确定性安装。settings 有值时一并恢复（本地写 json，幂等）。
 */
export async function importBackup(cfg, market, backup, opts) {
    if (!isBackupFile(backup)) {
        throw new Error("不是有效的 dsh-market 备份文件（kind/schemaVersion 不匹配）");
    }
    const profile = opts.profile ?? backup.settings?.profile ?? readSettings(cfg).profile;
    if (backup.settings?.modeOverride || backup.settings?.profile) {
        writeSettings(cfg, {
            ...(backup.settings.modeOverride ? { modeOverride: backup.settings.modeOverride } : {}),
            ...(backup.settings.profile ? { profile: backup.settings.profile } : {}),
        });
    }
    const currentIds = new Set(scanInstalled(cfg, market)
        .map((i) => i.pluginId)
        .filter((x) => Boolean(x)));
    const byId = new Map(market.plugins.map((p) => [p.id, p]));
    const result = {
        restored: [],
        already: [],
        failed: [],
        unmatched: [],
        requiresRestart: false,
    };
    const entries = backup.installed;
    let done = 0;
    for (const entry of entries) {
        const name = entry.pluginName ?? entry.fullName ?? entry.localName;
        opts.onProgress?.({ done, total: entries.length, name });
        const plugin = entry.pluginId ? byId.get(entry.pluginId) : undefined;
        if (!plugin) {
            result.unmatched.push(entry);
            done++;
            continue;
        }
        if (currentIds.has(plugin.id)) {
            result.already.push(plugin.id);
            done++;
            continue;
        }
        try {
            const r = await routeInstall(cfg, plugin, {
                profile,
                runner: opts.runner,
                signal: opts.signal,
            });
            if (r.ok && !r.needAi) {
                result.restored.push(plugin.id);
                if (r.result?.requiresRestart)
                    result.requiresRestart = true;
            }
            else {
                result.failed.push({
                    pluginId: plugin.id,
                    name,
                    error: r.reason ?? r.result?.error ?? "需要 AI 兜底安装（导入只走确定性路由）",
                });
            }
        }
        catch (err) {
            if (opts.signal?.aborted)
                throw err;
            result.failed.push({ pluginId: plugin.id, name, error: err.message });
        }
        done++;
    }
    opts.onProgress?.({ done, total: entries.length, name: "" });
    return result;
}
