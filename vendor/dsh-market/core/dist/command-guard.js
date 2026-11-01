/** shell 结构性操作符：管道 / 链式 / 后台 / 重定向 / 命令替换 / 换行（白名单形态用不到它们，出现即拒） */
const SHELL_OPERATOR_RE = /[|;&`<>]|\$\(|\r?\n/i;
/** 远端脚本执行信号（用于给出更可读的拒绝原因；命中白名单前就被操作符规则拦下，这里兜底可读性） */
const REMOTE_EXEC_RE = /\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod|invoke-expression|iex)\b/i;
function isGlobalFlag(token) {
    const t = token.toLowerCase();
    return t === "-g" || t === "--global" || t === "global";
}
/** registry 包名形态：拒协议源（https/git+/github:/file: 等）、路径（~ / 盘符 / 根）、.. 穿越 */
function isRegistryPkg(token) {
    if (/^(https?:|git\+|github:|gitlab:|bitbucket:|file:|link:|workspace:)/i.test(token))
        return false;
    if (/^~/.test(token))
        return false;
    if (/^([a-z]:)?[\\/]/i.test(token))
        return false;
    if (token.includes(".."))
        return false;
    return true;
}
/** 归一化路径用于前缀比较（Windows 大小写不敏感、分隔符统一） */
function normPath(p) {
    return p.replace(/\//g, "\\").toLowerCase().replace(/\\+$/, "");
}
export function guardInstallCommands(plugin, commands, opts) {
    const blocked = [];
    for (const raw of commands) {
        const command = raw.trim();
        const reject = (reason) => blocked.push({ command: raw, reason });
        if (!command) {
            reject("空命令");
            continue;
        }
        if (SHELL_OPERATOR_RE.test(command)) {
            reject(REMOTE_EXEC_RE.test(command)
                ? "包含远程脚本下载执行（curl/wget 管道 bash 等），已阻止直装"
                : "包含管道/链式/重定向等 shell 操作符");
            continue;
        }
        const tokens = command.split(/\s+/).filter(Boolean);
        const head = (tokens[0] ?? "").toLowerCase();
        if (head === "dsh") {
            if ((tokens[1] ?? "").toLowerCase() === "plugin" &&
                tokens.some((t) => /^(add|install)$/i.test(t))) {
                continue;
            }
            reject("dsh 命令仅放行「dsh plugin ... add <pkg>」形态");
            continue;
        }
        if (head === "git") {
            const urlIdx = tokens.findIndex((t, i) => i >= 2 && /^https:\/\/github\.com\//i.test(t));
            const url = urlIdx > 0 ? tokens[urlIdx] : "";
            const m = url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
            const own = m !== null && `${m[1]}/${m[2]}`.toLowerCase() === plugin.fullName.toLowerCase();
            if ((tokens[1] ?? "").toLowerCase() !== "clone" || !own) {
                reject("git 仅放行克隆插件自身 GitHub 仓库");
                continue;
            }
            const dest = tokens.length > urlIdx + 1 ? tokens[tokens.length - 1] : "";
            if (dest) {
                const destBad = dest.startsWith("~") ||
                    dest.includes("..") ||
                    (/^([a-z]:)?[\\/]/i.test(dest) &&
                        !(opts?.allowedDestPrefix && normPath(dest).startsWith(normPath(opts.allowedDestPrefix))));
                if (destBad) {
                    reject("git clone 目标目录越界（~ / .. / 非技能目录的绝对路径）");
                    continue;
                }
            }
            continue;
        }
        if (head === "npm" || head === "pnpm") {
            const sub = (tokens[1] ?? "").toLowerCase();
            if (!["install", "i", "add"].includes(sub)) {
                reject(`${head} 仅放行 install/i/add 形态`);
                continue;
            }
            if (tokens.some(isGlobalFlag)) {
                reject("全局安装（-g/--global）已阻止：插件应装进 profile 或技能目录");
                continue;
            }
            const pkgs = tokens.slice(2).filter((t) => !t.startsWith("-"));
            if (pkgs.length === 0) {
                reject("缺少包名");
                continue;
            }
            if (!pkgs.every(isRegistryPkg)) {
                reject("包名含 URL/git 源/路径形态，已阻止（仅放行 registry 包名）");
                continue;
            }
            continue;
        }
        reject("非白名单命令形态");
    }
    return { ok: blocked.length === 0, blocked };
}
