import type { CommandRunner } from "./types.js";
/** 从 pnpm 输出解析被拦的构建脚本包名（去版本号） */
export declare function parseBlockedBuilds(output: string): string[];
/** 提取 pnpm 错误码（如 ERR_PNPM_NO_MATCHING_VERSION） */
export declare function parsePnpmErrorCode(output: string): string | null;
/** 判定失败是否为"构建脚本被拦"（P0-4 前的可读信号） */
export declare function isBuildBlockedFailure(output: string): boolean;
/** 构造 pnpm-workspace.yaml 路径 */
export declare function pnpmWorkspacePath(profileDir: string): string;
/** 探测 pnpm 主版本（注入 runner；stdout 无法捕获时回退 10） */
export declare function detectPnpmMajor(opts: {
    runner: CommandRunner;
    cwd?: string;
}): Promise<number>;
/** pnpm 主版本 → 配置键名 */
export declare function buildAllowKey(pnpmMajor: number): "allowBuilds" | "onlyBuiltDependencies";
/** 在 profileDir 的 pnpm-workspace.yaml 中合并放行包（保留原内容），返回变更信息 */
export declare function writeBuildApprovals(profileDir: string, packages: string[], opts?: {
    pnpmMajor?: number;
    dryRun?: boolean;
}): {
    ok: boolean;
    key: string;
    merged: string[];
    written: boolean;
    error?: string;
};
/** 读取当前已放行的包清单（allowBuilds=map / onlyBuiltDependencies=array，按 pnpm 主版本选键） */
export declare function readBuildApprovals(profileDir: string, pnpmMajor?: number): string[];
