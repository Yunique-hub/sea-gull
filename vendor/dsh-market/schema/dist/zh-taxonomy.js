import { ZH_INTENTS, isTokenTerm, rawTerm, tokenInText } from "./zh-intent.js";
/** 实用分归一读取（全量 score.total / lite scoreTotal 双形态） */
export function facetScoreOf(p) {
    return p.score?.total ?? p.scoreTotal ?? 0;
}
/** 对单个插件判断一组召回词的命中层级。hay 传 null 时跳过弱信号判定。 */
export function matchTerms(nameLower, fullNameLower, tagsLower, hay, terms) {
    let weak = false;
    for (const t of terms) {
        const raw = rawTerm(t);
        if (tagsLower.includes(raw))
            return "strong";
        if (isTokenTerm(t)) {
            // 词边界召回词：名称/简介里作为独立词出现才算（防 email/main 吃掉 "ai"）
            if (tokenInText(raw, nameLower) || tokenInText(raw, fullNameLower))
                return "strong";
            if (hay !== null && !weak && tokenInText(raw, hay))
                weak = true;
        }
        else {
            if (nameLower.includes(raw) || fullNameLower.includes(raw))
                return "strong";
            if (hay !== null && !weak && hay.includes(raw))
                weak = true;
        }
    }
    return weak ? "weak" : null;
}
/** 意图 key → 召回词（查不到返回 null；分类过滤 UI 用） */
export function intentTerms(key) {
    return ZH_INTENTS.find((it) => it.key === key)?.terms ?? null;
}
/**
 * 为全库构建中文分类 facets。只统计强信号（browse 场景，精度优先，
 * "宁缺毋滥"与词典设计约定一致）；少于 minCount 个插件的意图不展示。
 * 按覆盖数降序；一次性 O(意图数 × 插件数)，9k × ~100 在首页加载时约百毫秒级。
 */
export function buildZhFacets(plugins, minCount = 3) {
    // 每个插件的小写字段只算一次（104 意图 × 9k 插件重复 toLowerCase 得不偿失）
    const lowered = new Map();
    for (const p of plugins) {
        lowered.set(p, {
            name: p.name.toLowerCase(),
            full: p.fullName.toLowerCase(),
            tags: p.tags.map((t) => t.toLowerCase()),
        });
    }
    const out = [];
    for (const it of ZH_INTENTS) {
        const strong = [];
        for (const p of plugins) {
            const l = lowered.get(p);
            const tier = matchTerms(l.name, l.full, l.tags, null, it.terms);
            if (tier === "strong")
                strong.push(p);
        }
        if (strong.length >= minCount) {
            strong.sort((a, b) => facetScoreOf(b) - facetScoreOf(a));
            out.push({ key: it.key, count: strong.length, plugins: strong });
        }
    }
    return out.sort((a, b) => b.count - a.count);
}
