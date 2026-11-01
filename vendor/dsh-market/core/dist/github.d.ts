/**
 * GitHub API 客户端（纯 Node，token 由 UI 层注入）
 * - GET /user：取当前用户 login（设备流/PAT 绑定后验证身份）
 * - GET /user/starred：取用户全部加星（PAT 可用；GitHub App 令牌不可用此端点）
 * - GET /users/{username}/starred：取用户公开加星（任意 token 甚至无 token 可用）
 */
import type { DshPlugin } from "@dsh-market/schema";
export interface GitHubUser {
    login: string;
    avatar_url: string | null;
}
/** 获取当前用户信息（需有效 token） */
export declare function fetchCurrentUser(token: string, fetchImpl?: typeof fetch): Promise<GitHubUser>;
/**
 * 拉取加星仓库 fullName 列表
 * @param token 可选：有 token 走 /user/starred（含私有加星，GitHub App 令牌不可用）；
 *              无 token 时用 username 走 /users/{username}/starred（仅公开）
 */
export declare function fetchStarred(opts: {
    token?: string;
    username?: string;
}, fetchImpl?: typeof fetch): Promise<string[]>;
/** 加星仓库中命中市场收录的插件 id 列表 */
export declare function starredPluginIds(starredFullNames: string[], market: DshPlugin[]): string[];
