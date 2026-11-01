import { describeRange, satisfiesRange } from "./version.js";
import { detectDshVersion } from "./host.js";
/**
 * 判定某个插件与（默认本机的）DSH 宿主是否兼容。
 * @param plugin 市场条目
 * @param opts.localVersion 显式指定宿主版本（不传则探测本机；传 null 表示强制"未知"）
 * @param opts.cfg 传入则以 profile 作为最后一级探测来源
 */
export function checkDshCompat(plugin, opts = {}) {
    const info = opts.cfg ? detectDshVersion(opts.cfg) : detectDshVersion();
    const local = "localVersion" in opts ? (opts.localVersion ?? null) : info.version;
    const locals = { local, localSource: info.source };
    const required = plugin.install?.dshEngines ?? null;
    const requiredSource = plugin.install?.dshEnginesSource ?? null;
    const soft = requiredSource === "peer-dep" || requiredSource === "dev-dep";
    if (!required) {
        return {
            status: "unknown",
            required: null,
            requiredSource,
            ...locals,
            soft: false,
            reason: "该插件未声明 DSH 宿主版本要求，无法判断兼容性",
            block: false,
        };
    }
    const need = describeRange(required);
    if (!local) {
        return {
            status: "unknown",
            required,
            requiredSource,
            ...locals,
            soft,
            reason: `该插件要求 ${need}；本机 DSH 版本读取失败，无法确认`,
            block: false,
        };
    }
    const ok = satisfiesRange(local, required);
    if (ok === null) {
        return {
            status: "unknown",
            required,
            requiredSource,
            ...locals,
            soft,
            // 范围解析不了（作者写了奇怪的值）→ 只提示需求，不做判断
            reason: `该插件声明 ${need}；本机 DSH ${local}，要求无法解析，请自行确认`,
            block: false,
        };
    }
    if (ok) {
        return {
            status: "ok",
            required,
            requiredSource,
            ...locals,
            soft,
            reason: `兼容：要求 ${need}，本机 DSH ${local}`,
            block: false,
        };
    }
    const hint = soft ? `（要求来自 package.json 的依赖推断，可能不是作者本意）` : "";
    return {
        status: "incompatible",
        required,
        requiredSource,
        ...locals,
        soft,
        reason: `不兼容：该插件要求 ${need}，本机 DSH 是 ${local}${hint}`,
        // 推断来源不阻断（可能只是开发期对齐）；作者显式声明的才阻断
        block: !soft,
    };
}
/**
 * 生成 UI 用的精简兼容信息。
 * **只在插件真的声明了要求时返回**（未声明 → undefined）——避免给全量 6000+ 条目
 * 都塞一个恒为"未知"的字段，白白撑大 RPC 载荷。
 */
export function liteDshCompat(plugin, opts = {}) {
    const required = plugin.install?.dshEngines ?? null;
    if (!required)
        return undefined;
    const c = checkDshCompat(plugin, opts);
    return {
        status: c.status,
        label: describeRange(required),
        required,
        reason: c.reason,
        block: c.block,
        soft: c.soft,
        local: c.local,
    };
}
