const API_BASE = "https://api.github.com";
const PER_PAGE = 100;
/** 获取当前用户信息（需有效 token） */
export async function fetchCurrentUser(token, fetchImpl = fetch) {
    const res = await fetchImpl(`${API_BASE}/user`, {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "dsh-market" },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
        throw new Error(`GitHub /user ${res.status}`);
    const d = (await res.json());
    return { login: d.login, avatar_url: d.avatar_url };
}
/**
 * 拉取加星仓库 fullName 列表
 * @param token 可选：有 token 走 /user/starred（含私有加星，GitHub App 令牌不可用）；
 *              无 token 时用 username 走 /users/{username}/starred（仅公开）
 */
export async function fetchStarred(opts, fetchImpl = fetch) {
    const { token, username } = opts;
    if (!token && !username)
        return [];
    const headers = { "User-Agent": "dsh-market" };
    if (token)
        headers.Authorization = `Bearer ${token}`;
    const tryBase = async (base, h) => {
        const out = [];
        let page = 1;
        // 公开加星可能几千条，限制拉取页数保护配额（默认最多 10 页 = 1000 条）
        const maxPages = 10;
        for (; page <= maxPages; page++) {
            const res = await fetchImpl(`${base}?per_page=${PER_PAGE}&page=${page}`, { headers: h, signal: AbortSignal.timeout(15000) });
            if (!res.ok)
                throw new Error(`GitHub starred ${res.status}`);
            const arr = (await res.json());
            if (!arr.length)
                break;
            for (const r of arr)
                out.push(r.full_name);
            if (arr.length < PER_PAGE)
                break;
        }
        return out;
    };
    if (!token) {
        return tryBase(`${API_BASE}/users/${encodeURIComponent(username)}/starred`, headers);
    }
    // 有 token：优先 /user/starred（含私有加星）
    try {
        return await tryBase(`${API_BASE}/user/starred`, headers);
    }
    catch (err) {
        // GitHub App 设备流 token 不支持 /user/starred（403/404）→
        // 降级：拿 login 后读公开加星
        if (err.message.includes("403") || err.message.includes("404")) {
            const user = await fetchCurrentUser(token, fetchImpl);
            return tryBase(`${API_BASE}/users/${encodeURIComponent(user.login)}/starred`, { "User-Agent": "dsh-market" });
        }
        throw err;
    }
}
/** 加星仓库中命中市场收录的插件 id 列表 */
export function starredPluginIds(starredFullNames, market) {
    const lower = new Set(starredFullNames.map((s) => s.toLowerCase()));
    return market
        .filter((p) => lower.has(p.fullName.toLowerCase()) || lower.has(p.id.toLowerCase()))
        .map((p) => p.id);
}
