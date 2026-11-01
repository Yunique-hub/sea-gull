/**
 * Recipe 配方缓存（路由模式 P1 的核心资产）：
 * 一次成功安装沉淀为可复用配方 → write-once, read-many。
 * 命中需满足：pluginId 相同 + 环境指纹一致 + 未过期。
 * 纯 Node 模块，零 DSH API 依赖；配方是纯文本 JSON，可人工审查/删除。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ensureDataDir } from "./config.js";
/** 配方有效期：90 天（超期先重新冒烟，冒烟失败才重学） */
export const RECIPE_TTL_MS = 90 * 24 * 3600 * 1000;
/** 配方目录（dataDir/recipes） */
export function recipeDir(cfg) {
    return join(ensureDataDir(cfg), "recipes");
}
export function recipePath(cfg, pluginId) {
    return join(recipeDir(cfg), `${pluginId.replace(/[/\\]/g, "_")}.json`);
}
/** 常用包管理器/工具探测（环境指纹的一部分；结果进程级缓存） */
const PM_PROBES = ["npm", "pnpm", "yarn", "bun", "pip", "pip3", "uv", "brew", "cargo", "go", "git", "dsh"];
const DETECT_CMD = process.platform === "win32" ? "where" : "which";
let pmProbeCache = null;
function detectPackageManagers() {
    if (pmProbeCache)
        return pmProbeCache;
    const found = [];
    for (const name of PM_PROBES) {
        try {
            // N7：windowsHide 防 Windows 上每个探测闪一个控制台窗口
            const r = spawnSync(DETECT_CMD, [name], { timeout: 2000, stdio: "ignore", windowsHide: true });
            if (r.status === 0)
                found.push(name);
        }
        catch {
            /* 探测失败忽略该工具 */
        }
    }
    pmProbeCache = found;
    return found;
}
/** djb2 稳定哈希（非加密用途） */
function djb2(input) {
    let h = 5381;
    for (let i = 0; i < input.length; i++)
        h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
    return h;
}
let fpCache = null;
/** 环境指纹：平台 + shell + 包管理器集合 + Node 大版本 → 哈希 */
export function envFingerprint() {
    if (fpCache)
        return fpCache;
    const platform = process.platform;
    const shell = platform === "win32" ? "cmd" : (process.env.SHELL?.split(/[\\/]/).pop() ?? "sh");
    const pms = detectPackageManagers().sort();
    const raw = [platform, shell, `node${process.versions.node.split(".")[0]}`, ...pms].join("|");
    fpCache = djb2(raw).toString(16);
    return fpCache;
}
/** 读取配方；无/损坏返回 null */
export function readRecipe(cfg, pluginId) {
    try {
        const file = recipePath(cfg, pluginId);
        if (!existsSync(file))
            return null;
        const r = JSON.parse(readFileSync(file, "utf8"));
        return r && typeof r.pluginId === "string" ? r : null;
    }
    catch {
        return null;
    }
}
/** 写入配方（失败不抛出：配方不是安装的必要条件） */
export function writeRecipe(cfg, recipe) {
    try {
        const dir = recipeDir(cfg);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        writeFileSync(recipePath(cfg, recipe.pluginId), JSON.stringify(recipe, null, 2), "utf8");
    }
    catch {
        /* 配方写入失败不阻断安装 */
    }
}
/** 删除配方（供用户手动清理/修正） */
export function deleteRecipe(cfg, pluginId) {
    try {
        rmSync(recipePath(cfg, pluginId), { force: true });
    }
    catch {
        /* 忽略 */
    }
}
/** 列出全部配方（透明可审查） */
export function listRecipes(cfg) {
    try {
        const dir = recipeDir(cfg);
        if (!existsSync(dir))
            return [];
        return readdirSync(dir)
            .filter((f) => f.endsWith(".json"))
            .map((f) => {
            try {
                const r = JSON.parse(readFileSync(join(dir, f), "utf8"));
                return {
                    pluginId: r.pluginId,
                    type: r.type,
                    learnedFrom: r.learnedFrom,
                    verifiedAt: r.verifiedAt,
                    lastSmoke: r.lastSmoke,
                };
            }
            catch {
                return null;
            }
        })
            .filter((r) => r !== null);
    }
    catch {
        return [];
    }
}
/** 是否未过期（超期先重新冒烟，失败才重学） */
export function isRecipeFresh(recipe, now = Date.now(), ttlMs = RECIPE_TTL_MS) {
    const v = Date.parse(recipe.verifiedAt);
    return Number.isFinite(v) && now - v <= ttlMs;
}
