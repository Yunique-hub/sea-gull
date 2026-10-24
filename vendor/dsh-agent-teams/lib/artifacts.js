/**
 * Workspace byte identity: the only module in this plugin that reads artifact
 * bytes off disk.
 *
 * Two plugin surfaces need it:
 *  · a quality verdict must record which revision it judged (issue #161), so
 *    delivery can refuse to advertise bytes no review ever saw;
 *  · an auto-generated work order must record the workspace it was derived
 *    from (issue #174), so it can be marked stale after a later round edits a
 *    cited file.
 *
 * Safety rules this module must never lose:
 *  · directory traversal never follows symlinks, and every explicitly named
 *    path is resolved with `realpath` and rejected when it leaves the
 *    workspace — a symlink must not become a read of arbitrary host files, and
 *    a symlink cycle must not become an infinite walk;
 *  · a scope that cannot be enumerated completely (file cap, unreadable
 *    directory, non-workspace-relative path) produces an explicit
 *    {@link ArtifactScopeGap} instead of a short list that reads as complete;
 *  · "could not be read" is recorded separately from "does not exist";
 *  · plugins and secrets never enter a broad scope by accident.
 *
 * The gate rules themselves stay pure: they receive {@link ArtifactDigest}
 * values from here and never touch the filesystem.
 * @module dsh-agent-teams/artifacts
 */
import { createHash } from 'node:crypto';
import { closeSync, lstatSync, openSync, readSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { isDefaultExcludedPath, normalizeWorkspacePath } from "./quality-gates.js";
/**
 * Directory segments never walked when a scope pattern names a directory:
 * version control, the harness state root, plugin-private team state, and
 * installed packages. They are either huge, plugin-private, or not project
 * artifacts.
 */
const SKIPPED_SEGMENTS = new Set(['.git', '.dsh', '.agent-teams', 'node_modules']);
/**
 * Upper bound on files expanded from one scope. Verdicts are about a revision
 * and an unbounded walk of a large tree would make every gate close slow, so
 * the walk stops here — and says so with a gap, because a silently truncated
 * list would let a change outside the list pass as "unchanged".
 */
export const MAX_EXPANDED_ARTIFACTS = 200;
function errorCode(error) {
    const code = error?.code;
    return typeof code === 'string' ? code : 'EIO';
}
function workspaceRootOf(workspace) {
    try {
        return realpathSync(workspace);
    }
    catch {
        return undefined;
    }
}
/** Is `absolute` (already resolved) inside the workspace root? */
function insideRoot(root, absolute) {
    const rel = relative(root, absolute);
    return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}
/** `true` inside, `false` escapes the workspace, `undefined` unresolvable. */
function resolvesInside(root, absolute) {
    try {
        return insideRoot(root, realpathSync(absolute));
    }
    catch {
        return undefined;
    }
}
/**
 * Chunk size for the streaming digest. The activity panel polls the audit
 * about once a second, so hashing must never read a whole artifact into
 * memory: a multi-gigabyte file would otherwise stall the host process.
 */
const HASH_CHUNK_BYTES = 64 * 1024;
/**
 * sha256 one file in constant memory (one reusable chunk buffer), never
 * loading the whole artifact. Throws the underlying filesystem error so the
 * caller can distinguish "cannot read" from "absent".
 */
function hashFileConstantMemory(absolute) {
    const handle = openSync(absolute, 'r');
    try {
        const hash = createHash('sha256');
        const buffer = Buffer.allocUnsafe(HASH_CHUNK_BYTES);
        let size = 0;
        for (;;) {
            const read = readSync(handle, buffer, 0, buffer.byteLength, null);
            if (read <= 0)
                break;
            size += read;
            // `update` consumes the bytes synchronously, so the buffer is reused.
            hash.update(read === buffer.byteLength ? buffer : buffer.subarray(0, read));
        }
        return { sha256: hash.digest('hex'), size };
    }
    finally {
        closeSync(handle);
    }
}
function inspectPath(workspaceRoot, workspace, normalized) {
    const absolute = join(workspace, normalized);
    let stats;
    try {
        stats = lstatSync(absolute);
    }
    catch (error) {
        const code = errorCode(error);
        return code === 'ENOENT' || code === 'ENOTDIR'
            ? { kind: 'absent' }
            : { kind: 'unreadable', reason: `${normalized} cannot be inspected (${code})` };
    }
    if (workspaceRoot === undefined) {
        return { kind: 'unreadable', reason: `${normalized} cannot be verified against the workspace root` };
    }
    // Containment is checked on the fully resolved path, not only when the last
    // segment is a symlink: an intermediate symlinked directory would otherwise
    // let any inner path read (or walk) host files outside the workspace.
    const inside = resolvesInside(workspaceRoot, absolute);
    if (inside === undefined)
        return { kind: 'unreadable', reason: `${normalized} cannot be resolved (broken or cyclic link)` };
    if (!inside)
        return { kind: 'unreadable', reason: `${normalized} resolves outside the workspace; refusing to read it` };
    if (stats.isSymbolicLink()) {
        try {
            stats = statSync(absolute);
        }
        catch (error) {
            return { kind: 'unreadable', reason: `${normalized} symlink target cannot be inspected (${errorCode(error)})` };
        }
    }
    if (stats.isDirectory())
        return { kind: 'directory' };
    if (!stats.isFile())
        return { kind: 'unreadable', reason: `${normalized} is not a regular file` };
    try {
        const { sha256, size } = hashFileConstantMemory(absolute);
        return {
            kind: 'file',
            digest: {
                path: normalized,
                present: true,
                sha256,
                size,
                mtimeMs: stats.mtimeMs,
            },
        };
    }
    catch (error) {
        return { kind: 'unreadable', reason: `${normalized} cannot be read (${errorCode(error)})` };
    }
}
function isSkipped(relativePath) {
    return relativePath.split('/').some((segment) => SKIPPED_SEGMENTS.has(segment)) || isDefaultExcludedPath(relativePath);
}
function walkDirectory(input) {
    // The prefix itself must be inside the workspace before it is enumerated:
    // `escape/` may be a symlink to an outside directory, and readdir would
    // happily list host names through it. Nested prefixes come from
    // non-symlink directory entries of an already-verified parent.
    if (input.prefix !== '') {
        if (input.workspaceRoot === undefined) {
            input.gap(`${input.pattern}: the workspace root cannot be resolved, so it is not enumerated`);
            return;
        }
        let inside;
        try {
            inside = insideRoot(input.workspaceRoot, realpathSync(join(input.workspace, input.prefix)));
        }
        catch (error) {
            if (errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR') {
                input.gap(`${input.pattern}: ${input.prefix} does not exist, so the scope could not be enumerated`);
                return;
            }
            inside = undefined;
        }
        if (inside === undefined) {
            input.gap(`${input.pattern}: ${input.prefix} cannot be resolved (broken or cyclic link); refusing to enumerate it`);
            return;
        }
        if (!inside) {
            input.gap(`${input.pattern}: ${input.prefix} resolves outside the workspace; refusing to enumerate it`);
            return;
        }
    }
    const queue = input.prefix === '' ? [''] : [input.prefix];
    while (queue.length > 0) {
        const current = queue.shift();
        let entries;
        try {
            entries = readdirSync(join(input.workspace, current), { withFileTypes: true });
        }
        catch (error) {
            input.gap(`${input.pattern}: cannot list ${current === '' ? '.' : current} (${errorCode(error)})`);
            continue;
        }
        for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
            const relativePath = `${current === '' ? '' : `${current}/`}${entry.name}`;
            // Traversal never follows symlinks: a symlinked directory can point
            // outside the workspace or form a cycle, and neither may become a read
            // or an unbounded walk.
            if (entry.isSymbolicLink())
                continue;
            if (isSkipped(relativePath))
                continue;
            if (entry.isDirectory()) {
                queue.push(relativePath);
                continue;
            }
            if (!entry.isFile())
                continue;
            if (input.full()) {
                input.gap(`${input.pattern}: stopped at the ${MAX_EXPANDED_ARTIFACTS}-file cap, so its contents are only partially recorded`);
                return;
            }
            input.push(relativePath);
        }
    }
}
/**
 * Read a declared scope: expand directory patterns to their current files,
 * keep explicitly named paths even when they do not exist (a later creation is
 * drift too), and report every part that could not be fully resolved.
 */
export function readArtifactScope(workspace, patterns) {
    const workspaceRoot = workspaceRootOf(workspace);
    const gaps = [];
    const concrete = [];
    const seen = new Set();
    const full = () => concrete.length >= MAX_EXPANDED_ARTIFACTS;
    const push = (path) => {
        if (seen.has(path))
            return;
        seen.add(path);
        concrete.push(path);
    };
    const gap = (pattern, reason) => {
        if (gaps.some((item) => item.pattern === pattern && item.reason === reason))
            return;
        gaps.push({ pattern, reason });
    };
    for (const raw of patterns) {
        if (typeof raw !== 'string')
            continue;
        const trimmed = raw.trim();
        const posix = trimmed.replaceAll('\\', '/');
        const directory = posix.endsWith('/') || posix === '.';
        const normalized = normalizeWorkspacePath(raw);
        if (normalized === undefined) {
            // Absolute paths, `..`, `~`, drive letters: illegal, and never a reason
            // to fall back to the workspace root.
            gap(trimmed, 'not a workspace-relative path (absolute paths and ".." can never match scope)');
            continue;
        }
        if (!directory) {
            if (normalized === '') {
                gap(trimmed, 'empty path is not a file; use "." for the whole workspace');
                continue;
            }
            if (full()) {
                gap(trimmed, `stopped at the ${MAX_EXPANDED_ARTIFACTS}-path cap, so the scope is only partially recorded`);
                continue;
            }
            push(normalized);
            continue;
        }
        // Only an explicitly root-anchored pattern means the workspace root.
        const rootAnchored = posix === '.' || posix === './' || posix.startsWith('./');
        if (normalized === '' && !rootAnchored) {
            gap(trimmed, 'unresolved directory pattern; use "./" explicitly for the workspace root');
            continue;
        }
        if (full()) {
            gap(trimmed, `stopped at the ${MAX_EXPANDED_ARTIFACTS}-path cap, so its contents are only partially recorded`);
            continue;
        }
        walkDirectory({ workspace, workspaceRoot, pattern: trimmed, prefix: normalized, push, gap: (reason) => gap(trimmed, reason), full });
    }
    const artifacts = [];
    // Index-based: expanding an explicitly named directory appends its files to
    // `concrete`, and those must be digested in the same pass.
    for (let index = 0; index < concrete.length; index += 1) {
        const normalized = concrete[index];
        const outcome = inspectPath(workspaceRoot, workspace, normalized);
        if (outcome.kind === 'file') {
            artifacts.push(outcome.digest);
            continue;
        }
        if (outcome.kind === 'directory') {
            // An explicitly named directory is expanded instead of being reported as
            // unreadable: `src/lib` and `src/lib/` must behave the same.
            walkDirectory({ workspace, workspaceRoot, pattern: normalized, prefix: normalized, push, gap: (reason) => gap(normalized, reason), full });
            continue;
        }
        if (outcome.kind === 'absent') {
            artifacts.push({ path: normalized, present: false });
            continue;
        }
        artifacts.push({ path: normalized, present: false, unreadable: true, reason: outcome.reason });
    }
    return { artifacts: artifacts.sort((a, b) => a.path.localeCompare(b.path)), gaps };
}
/**
 * Read the current bytes of workspace-relative paths (directories expand).
 * Illegal and unreadable paths are reported, never silently dropped.
 */
export function digestWorkspacePaths(workspace, paths) {
    return readArtifactScope(workspace, paths).artifacts;
}
/**
 * Does this workspace-relative path currently exist as a file or directory?
 * Uses the same containment rules as the digest reader: a symlink that leaves
 * the workspace is not "an existing workspace path".
 */
export function workspacePathExists(workspace, path) {
    const normalized = normalizeWorkspacePath(path);
    if (normalized === undefined)
        return false;
    const outcome = inspectPath(workspaceRootOf(workspace), workspace, normalized);
    return outcome.kind === 'file' || outcome.kind === 'directory';
}
/** Expand scope patterns to the concrete files they currently cover. */
export function expandScopePaths(workspace, patterns) {
    return readArtifactScope(workspace, patterns)
        .artifacts
        .filter((artifact) => artifact.present)
        .map((artifact) => artifact.path)
        .sort();
}
/**
 * Read one coherent snapshot of the given scope patterns. Directory patterns
 * expand to the files they currently contain; a pattern naming a path that
 * does not exist is recorded as `present: false` so a later creation or
 * deletion is visible as drift, and any incomplete coverage is carried in
 * `gaps`.
 */
export function snapshotWorkspacePaths(workspace, patterns) {
    const at = Date.now();
    const { artifacts, gaps } = readArtifactScope(workspace, patterns);
    return { at, artifacts, ...gaps.length === 0 ? {} : { gaps } };
}
