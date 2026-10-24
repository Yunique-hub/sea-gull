/**
 * 计分规则：判定口径 + 默认得分点（零依赖，只用 node: 内置模块）。
 *
 * 从 core.js 抽出来的模块，也是本项目**最该单独读的一份代码**：
 * 面板 / 报告 / 攻击链三处总分必须一致，靠的就是这里的 applyScoreCaps 与
 * evaluateScoreBoard 是**唯一实现** —— 三处各写一遍必然漂移成不同口径。
 *
 * 分工：
 *   · applyScoreCaps       —— 给定命中行，标出哪条计分、哪条被封顶/超上限；
 *   · evaluateScoreBoard   —— 把"读元数据 + 调 applyScoreCaps + 回填标记"包成一个入口；
 *   · DEFAULT_SCORE_POINTS —— 规则文档展开后的得分点定义（src/rule/cap/dedup_scope）。
 */

/* targetHasIpv6Host 要判定 IPv6 字面量：复用 ip-utils 的同一份实现，避免两套正则漂移 */
import { isIpv6 } from './ip-utils.js'

/* ------------------------------------------------------------------ 判定规则 */

/* ------------------------------------------------------------------ 判定规则 */

/**
 * 什么算"真隧道"（算边界突破/内网突破的凭证）：**必须跨越了靶标边界**，
 * 即通道的一端在目标侧。三种情况：
 *   · target-outbound：目标主动连出到我的服务器（反弹 shell 落地、目标上跑 frp/Stowaway 客户端）
 *   · target-http：经目标 WebShell/HTTP 通道（suo5、Neo-ReGeorg、reGeorg、自研 HTTP 隧道）
 *   · target-agent：经目标上已控进程/会话转发的隧道（SSH -R 由目标发起等）
 * 不算的：self-only —— 只在自己 VPS / 自建服务器上开的代理或服务端，没碰到目标。
 */
const TUNNEL_ENTRY_KINDS = {
  'target-outbound': "Target-initiated outbound (reverse shell / frp client running on the target)",
  'target-http': "Target WebShell/HTTP channel (suo5 / Neo-ReGeorg)",
  'target-agent': "Forwarding through a compromised process/session on the target (SSH -R, etc.)",
  'self-only': "Own VPS/self-hosted server only (does not count as a breach)",
}
export { TUNNEL_ENTRY_KINDS }

/** 这条隧道算不算"跨越了靶标边界"。未声明（老数据/没填）返回 null，界面按"待确认"显示。 */
export function tunnelIsLegit(entryKind) {
  const k = String(entryKind || '').trim()
  if (k === '') return null
  return k !== 'self-only'
}

/**
 * 账号/权限类得分点：**自己注册、自己创建的账号不算拿到权限**（演练得分针对"拿到别人已有的"）。
 * 这些得分点命中时会要求声明 self_created，避免把自助注册当成战果。
 */
const ACCOUNT_POINT_CODES = ['web-account-user', 'web-account-admin', 'server-shell', 'db-access', 'internal-pivot', 'core-system']
export { ACCOUNT_POINT_CODES }

/**
 * 按「服务」封顶的得分点：**同一个资产的同一个端口只算一次分**。
 *
 *   · 账号类（web-account-user / web-account-admin）——拿到最高权限账号即该服务拿满：
 *     普通账号 10 分、管理员 20 分，同一服务上再刷几个账号都不再累加
 *     （两种账号算**同一类**：先拿普通账号、后拿管理员，只有管理员那条计分，总分按最高那条算）。
 *   · 数据库类（db-access）——同口径：一个库权限拿满，同服务再刷第二个库账号不重复计分。
 *
 * 其它得分点（webshell/rce/sensitive-data/boundary/…）仍然不设上限，按命中次数累加。
 */
const SERVICE_CAPPED_POINT_CODES = ['web-account-user', 'web-account-admin', 'db-access']
export { SERVICE_CAPPED_POINT_CODES }

/**
 * 从 target 里解析端口：`http://h:8080/x`、`10.0.0.5:6379`、`10.0.0.5:22`。
 * 没有端口或解析不出返回 null（**不要编造 80/443**，否则会把不同服务并成一个）。
 */
export function parseTargetPort(target) {
  const t = String(target || '').trim()
  if (t === '') return null
  const url = /^[a-z][a-z0-9+.-]*:\/\/([^/?#\s]+)/i.exec(t)
  const authority = url !== null ? url[1] : (/^([^\s/?#]+)/.exec(t) || [])[1]
  if (!authority) return null
  const m = /:(\d{1,5})$/.exec(authority)
  if (m === null) return null
  const n = Number(m[1])
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null
}

/** 库列的 port 值（老库可能是 null/0/空串）。 */
function normalizePort(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null
}

/**
 * 从 target 里取「服务标识」：host[:port]。
 *   · 端口取显式写的那个；没写就按协议推默认端口（http→80、https→443、其它→不推断），
 *     这样 `http://h/x` 与 `http://h:80/y` 会归到同一个服务；
 *   · 路径/参数/查询串一律丢掉（`http://h:8080/a/b?c=1` → `h:8080`）。
 * 解析不出 host 时返回 null。
 */
function targetAuthority(target) {
  const t = String(target || '').trim()
  if (t === '') return null
  const url = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]+)/i.exec(t)
  const scheme = url !== null ? url[1].toLowerCase() : null
  const authority = url !== null ? url[2] : (/^([^\s/?#]+)/.exec(t) || [])[1]
  if (!authority) return null
  const host = authority.replace(/:\d{1,5}$/, '').toLowerCase()
  if (host === '') return null
  let port = parseTargetPort(t)
  /* 没写端口时按协议补默认端口：避免同一个服务的两种写法被算成两个服务而被重复计分 */
  if (port === null) {
    if (scheme === 'http') port = 80
    else if (scheme === 'https') port = 443
  }
  return port === null ? host : host + ':' + port
}

/**
 * 「服务」键：得分封顶的粒度 = 同一个资产的同一个端口。
 *   · target 能解析出 host[:port] → 就用它（`t10.20.30.40:3306`）——
 *     同一个服务可能由不同的人记分，有的带 asset_id、有的只写 target，
 *     以目标为准才能把它们归到一起；
 *   · target 解析不出（缺失/只写了名字）→ 退到资产：有端口用 `a<id>:<port>`，
 *     没端口记 `a<id>:0`（该资产的未知端口）；
 *   · 两样都没有 → null（拿不到服务信息，这条不参与封顶）。
 */
export function scoreServiceKey(hit = {}) {
  const authority = targetAuthority(hit.target)
  if (authority !== null) return 't' + authority
  const assetId = hit.asset_id === null || hit.asset_id === undefined || hit.asset_id === '' ? null : Number(hit.asset_id)
  if (assetId === null) return null
  const port = normalizePort(hit.port)
  return 'a' + assetId + ':' + (port === null ? 0 : port)
}

/** 「服务」的可读标签，给告警/报告用（如 `10.1.2.3:8080`）。 */
export function serviceLabel(hit = {}, assetIp) {
  const ip = assetIp || hit.asset_ip || ''
  const port = normalizePort(hit.port) ?? parseTargetPort(hit.target)
  if (ip !== '') return port === null ? ip : ip + ':' + port
  /* 没有资产 id 时用 target 的 host[:port]（去掉路径与参数，别把整条 URL 当服务名）；
     端口来自库列而 target 里没写时补上，便于一眼看出是哪个服务。 */
  const authority = targetAuthority(hit.target)
  if (authority === null) return hit.target ? String(hit.target) : "(service not specified)"
  if (port !== null && !/:\d{1,5}$/.test(authority)) return authority + ':' + port
  return authority
}

/**
 * 得分封顶与去重的**唯一实现**（数据驱动，v0.11.0 起）。
 *
 * 判定字段来自得分点本身（`score_point.rule / cap / dedup_scope`），不再靠代码里的硬编码名单：
 *   · `dedup_scope = service` —— 同一（资产, 端口）只算分值最高的一条；
 *   · `dedup_scope = system`  —— 同一（资产, 端口, 系统名）只算最高权限一条，
 *     用于"同一个系统只计算一次最高权限分"（邮箱/OA/集权系统等）；
 *   · `dedup_scope = target`  —— 整个目标只算一次（突破网络边界、IPv6 加成）；
 *   · `dedup_scope = none`    —— 不去重，按台/卡/节点数累加（算力卡等）。
 * 之后按 `rule` 分组累计，超过该规则 `cap` 的部分标 `capped`（cap = 0 表示不设上限）。
 *
 * `self_created = 1`（自己注册/自建的账号）本来就不计分，既不参与竞争也不占位。
 *
 * @param {Array} rows - 命中行（需带 code / points / asset_id / port / target / recorded_at；
 *                       可选 system_key 供 system 口径使用）
 * @param {Map|Object|null} pointsByCode - code → `{rule, cap, dedup_scope, points}`；
 *                       省略时退化为"每个 code 自成一组、只去重不封顶"（兼容旧调用）
 * @returns {{capped:number, items:Array, caps:Map}} 打过标记的行 + 被封顶条数 + 各规则上限用量
 */
export function applyScoreCaps(rows = [], pointsByCode = null, nameByAsset = null) {
  const metaOf = (r) => {
    const m = pointsByCode === null || pointsByCode === undefined
      ? undefined
      : (typeof pointsByCode.get === 'function' ? pointsByCode.get(r.code) : pointsByCode[r.code])
    const rule = m && m.rule !== null && m.rule !== undefined ? Number(m.rule) : null
    const legacyScope = legacyCapGroup(r.code)
    return {
      group: rule === null ? 'code:' + String(r.code || '') : 'rule:' + rule,
      cap: m && Number(m.cap) > 0 ? Number(m.cap) : 0,
      scope: (m && m.dedup_scope) || legacyScope || 'none',
      rule,
    }
  }
  const flagged = (rows || []).map((r) => {
    const m = metaOf(r)
    return {
      ...r, capped: false, capped_by_id: null, capped_reason_kind: null,
      service_key: null, cap_group: m.group, dedup_scope: m.scope, rule: m.rule, rule_cap: m.cap,
    }
  })

  /* ① 计分口径去重：同一口径键内只保留分值最高的一条（同分取更早记的） */
  const buckets = new Map()
  for (const r of flagged) {
    if (Number(r.self_created) === 1) continue
    const scope = r.dedup_scope
    if (scope === 'none' || scope === null || scope === undefined) continue
    let key
    if (scope === 'target') key = 'target'
    else if (scope === 'system') key = 'sys:' + String(systemKeyOf(r, nameByAsset) || '')
    else {
      /* `service` 口径必须有真正的服务键（`t<host[:port]>` / `a<id>:<port>`）。
         拿不到服务信息时**不参与去重**，而不是退回"每条自成一键" —— 后者会让
         `svc:#hit7` 这种键把同一口径的命中全部互相顶掉：实测 62 条无 target 的
         terminal-access 命中里 61 条被判 dedup 不计分、只留 1 条，等于静默吃掉成果。
         宁可少封顶也不能错封：认不出服务就各算各的。 */
      const svc = scoreServiceKey(r)
      if (svc === null || svc === undefined || String(svc) === '') continue
      key = 'svc:' + String(svc)
    }
    if (key === '' || key === 'svc:null' || key === 'sys:null') continue
    const k = r.cap_group + '|' + key
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(r)
  }
  let capped = 0
  for (const list of buckets.values()) {
    if (list.length < 2) continue
    const best = pickBestHit(list)
    for (const r of list) {
      if (r === best) continue
      r.capped = true
      r.capped_by_id = best.id
      r.capped_by_points = Number(best.points) || 0
      r.capped_by_evidence = best.evidence || null
      r.capped_reason_kind = 'dedup'
      capped += 1
    }
  }

  /* ② 规则上限：同一 rule 的计分命中累计不得超过 cap（按分值从高到低累计，超出的标 capped） */
  const caps = new Map()
  const byRule = new Map()
  for (const r of flagged) {
    if (r.capped === true || Number(r.self_created) === 1) continue
    if (r.rule_cap <= 0) continue
    if (!byRule.has(r.cap_group)) byRule.set(r.cap_group, [])
    byRule.get(r.cap_group).push(r)
  }
  for (const [group, list] of byRule.entries()) {
    const cap = list[0].rule_cap
    const ordered = [...list].sort((a, b) => {
      const pa = Number(a.points) || 0; const pb = Number(b.points) || 0
      if (pb !== pa) return pb - pa
      return Number(a.id) - Number(b.id)
    })
    let used = 0; let nCapped = 0
    for (const r of ordered) {
      const pts = Number(r.points) || 0
      if (used + pts > cap) {
        r.capped = true
        r.capped_reason_kind = 'cap'
        r.capped_by_points = null
        nCapped += 1
        capped += 1
      } else {
        used += pts
      }
    }
    caps.set(group, { rule: list[0].rule, cap, used, capped: nCapped })
  }
  return { capped, items: flagged, caps }
}

/**
 * 参与 `system` 口径去重的"系统键"。
 *
 * 规则原文是"同一个系统只计算一次最高权限分"（邮箱、OA、集权系统等）。
 * 判定顺序：
 *   ① 命中自带的 `system_key`（调用方显式指定，最准）；
 *   ② 资产的 `primary_name`（系统名/域名的首选名）；资产名往往是同一套系统，最接近"同一个系统"；
 *   ③ 退回服务键（资产:端口）。
 * 三条都拿不到返回 null —— 此时**不参与该口径去重**，宁可不封顶也不要错封。
 */
function systemKeyOf(hit = {}, nameByAsset = null) {
  const svc = scoreServiceKey(hit)
  const svcText = svc === null || svc === undefined ? '' : String(svc)

  /* ① 调用方显式给的 system_key：**只有它带上服务键前缀（t<host[:port]> / a<id>:<port>）才采信**。
     调用方（listScorePoints / scoreReport / scoreChain）会预造 `资产名|端口` 这种键，
     资产还没有名字时会退化成 `"|8080"` —— 若直接采信，10.7.7.7:8080 与 10.7.7.8:8080
     会被并成"同一个系统"，把另一台主机的成果白白封顶。
     不能采信时**继续往下走**，用服务键兜底，而不是丢掉整个 system 口径。 */
  const explicit = String(hit.system_key || '').trim()
  if (explicit !== '' && (svcText === '' || explicit.includes(svcText))) {
    /* 没有服务键可校验时，要求"名字段非空"（避免只认端口的野键把所有服务并在一起） */
    const head = explicit.split('|')[0]
    if (svcText !== '' || String(head).trim() !== '') return explicit
  }

  /* ② 资产名（系统名/域名首选名）+ 服务键 —— **这是 system 口径的主力路径**。
     规则原文是"同一个系统只计算一次最高权限分"，覆盖面是"同一系统 + 同一端口"：
     同一套系统跑在多台主机、多个端口时是不同实例，各自算一次最高权限。
     ⚠️ 真的需要"跨主机、跨端口只算一次"时，应显式给 system_key 并用同一个值
     （见上 ①）——但那时请自己确认这些命中确实是同一个系统实例。 */
  const id = hit.asset_id === null || hit.asset_id === undefined || hit.asset_id === '' ? null : Number(hit.asset_id)
  const nameOf = (assetId) => {
    if (assetId === null || nameByAsset === null || nameByAsset === undefined) return null
    const raw = typeof nameByAsset.get === 'function' ? nameByAsset.get(assetId) : nameByAsset[assetId]
    const text = raw === null || raw === undefined ? '' : String(raw).trim()
    return text === '' ? null : text
  }
  const name = nameOf(id)
  if (name !== null) return name + '|' + svcText

  /* ③ 退到服务键：同（资产, 端口）只算一次最高权限 —— 与 service 口径等效，
     这是"同一主机上的系统权限、应用权限、数据库权限按最高权限只得一次分"（G1）的兜底。 */
  if (svcText !== '') return svcText

  /* ④ 三条都拿不到（没有 asset_id、没有系统名、target 也解析不出 host）：
     退回**本条命中自己的 id** —— 即"互不相同"，各算各的。
     宁可少封顶也不能错封：把两条无从区分的命中判成"同一个系统"会白白吃掉用户的成果。
     ⚠️ 这里**不能**用 Math.random()：同一个 hit 在两次调用（面板 / 报告 / 攻击链）里
     会拿到不同的键，计分口径就不稳定了。 */
  return '#hit' + String(hit.id ?? '0')
}

/** 从一组同口径命中里挑"计分的那一条"：分值最高，同分取更早记的（id 小的）。 */
function pickBestHit(list) {
  return list.reduce((a, b) => {
    const pa = Number(a.points) || 0; const pb = Number(b.points) || 0
    if (pb !== pa) return pb > pa ? b : a
    return Number(b.id) < Number(a.id) ? b : a
  }, list[0])
}

/** 旧口径分组（兼容 v0.10 及以前：账号类与数据库类按"同资产同端口"封顶）。 */
function legacyCapGroup(code) {
  const c = String(code || '').trim()
  if (c === 'web-account-user' || c === 'web-account-admin') return 'service'
  return SERVICE_CAPPED_POINT_CODES.includes(c) ? 'service' : null
}


/**
 * 读取得分点元数据（code → `{ rule, cap, dedup_scope, points, enabled, builtin, src }`）。
 * 面板 / 报告 / 攻击链三处共用，避免"同一份规则三处各读一遍、字段各漏一个"。
 * @param db - 靶标库句柄。
 */
function loadScoreMeta(db) {
  return new Map(db.prepare('SELECT code, rule, cap, dedup_scope, points, enabled, builtin, src FROM score_point')
    .all()
    .map((r) => [String(r.code), {
      rule: r.rule === null || r.rule === undefined ? null : Number(r.rule),
      cap: Number(r.cap) || 0,
      dedup_scope: r.dedup_scope || 'service',
      points: Number(r.points) || 0,
      enabled: r.enabled === null || r.enabled === undefined ? 1 : Number(r.enabled),
      builtin: Number(r.builtin) === 1,
      src: r.src === null || r.src === undefined ? null : Number(r.src),
    }]))
}

/**
 * 资产 id → 系统名（primary_name），`system` 口径要用它把"同一套系统"归到一起。
 * @param db - 靶标库句柄。
 */
function loadAssetNames(db) {
  return new Map(db.prepare('SELECT id, primary_name FROM asset').all()
    .filter((a) => a.primary_name).map((a) => [Number(a.id), a.primary_name]))
}

/**
 * 本条命中的**实际分值** = 档位分值 × 倍率。
 *   · 档位分值：命中自带优先（合并版同一条含多档），缺省回落到得分点默认分值；
 *   · 倍率：G5 数据规模翻倍（超 1 亿条 / 10TB，或控制知识库相关系统）×2、
 *     G6 IPv6 成果 ×3。倍率作用在**权限分**上，所以乘在分值里、随上限一起被 cap 约束
 *     （文档要求"上限仍按对应系统类型的原上限计算，不因倍数突破上限"）。
 */
function hitPointsOf(hit = {}, metaByCode = null) {
  let base = 0
  if (hit.points !== null && hit.points !== undefined && hit.points !== '') {
    base = Number(hit.points) || 0
  } else {
    const code = hit.code === null || hit.code === undefined ? null : String(hit.code)
    if (code !== null && metaByCode !== null && metaByCode !== undefined) {
      const meta = typeof metaByCode.get === 'function' ? metaByCode.get(code) : metaByCode[code]
      if (meta !== undefined && meta !== null) base = Number(meta.points) || 0
    }
  }
  const mult = Number(hit.multiplier)
  return Math.round(base * (Number.isFinite(mult) && mult > 0 ? mult : 1))
}

/**
 * 这个 target 的主机部分是 IPv6 字面量吗（http://[2001:db8::1]:8080/x、2001:db8::1、[::1]:22）。
 *
 * 不能用一条粗糙的字符类正则代替：IPv6 里混着十六进制字母（a-f），
 * 写成 /^\[[0-9a-f:]+\]/ 这类"只看冒号和十六进制"的写法会把带字母的地址漏判
 * （实测 2001:db8::1 里的 db8 就被漏掉，G6 的 ×3 完全不生效）。
 * 所以把主机部分交给 isIpv6() 判定 —— 与 cidrOf / scopeOfIp 用同一份实现。
 */
function targetHasIpv6Host(target) {
  const text = String(target || "").trim()
  if (text === "") return false
  const bracket = /^[a-z][a-z0-9+.-]*:\/\/(\[[^\]]+\])/i.exec(text)
  if (bracket !== null) return isIpv6(bracket[1].replace(/^\[|\]$/g, ""))
  const url = /^[a-z][a-z0-9+.-]*:\/\/([^/?#\s]+)/i.exec(text)
  const authority = url !== null ? url[1] : (/^([^\s/?#]+)/.exec(text) || [])[1]
  if (!authority) return false
  /* 裸写 IPv6 想带端口必须加方括号，所以这里去掉方括号后再尝试剥端口 */
  const host = authority.replace(/^\[|\]$/g, "").replace(/:\d{1,5}$/, "")
  return isIpv6(host)
}

/**
 * 把 G5 / G6 的倍率规则算成倍率值（只对权限分生效，且不突破原上限 —— 由 cap 兜住）。
 *   · `ip_version === 6` 或 target 是 IPv6 字面量 → ×3（G6）；
 *   · `data_scale === "large"` → ×2（G5：超 1 亿条 或 10TB）；
 *   · `data_scale === "knowledge-base"` → ×2（G5：控制知识库相关系统）；
 *   · 两者都命中 → 相乘。文档没写禁止叠加，取对演练方有利的解释并**如实标注原因**。
 * @param hit - 命中参数（ip_version / data_scale / target）。
 * @returns `{ multiplier, reasons }`
 */
function scoreMultiplierOf(hit = {}) {
  const reasons = []
  let multiplier = 1
  const target = String(hit.target || "")
  const ipv6 = Number(hit.ip_version) === 6 || targetHasIpv6Host(target)
    /* 裸写 IPv6 兜底的正则必须含 ≥2 个冒号：dc01:389 / ad01:8080 这类内网主机名:端口
       只有一个冒号，旧正则会把它们误判成 IPv6 让成果静默 ×3 */
    || /(^|\/\/)(?:\[[0-9a-f:]+\]|[0-9a-f]*(?::[0-9a-f]*){2,})/i.test(target)
  if (ipv6) { multiplier *= 3; reasons.push("G6 IPv6 result ×3") }
  const scale = String(hit.data_scale || "").trim().toLowerCase()
  if (scale === "large") { multiplier *= 2; reasons.push("G5 data volume over 100 million rows / 10 TB ×2") }
  else if (scale === "knowledge-base" || scale === "kb") { multiplier *= 2; reasons.push("G5 controls a knowledge-base-related system ×2") }
  return { multiplier, reasons }
}

/**
 * **统一的计分评估**：面板 / 报告 / 攻击链都调这一个函数算出"哪条计分、哪条被封顶"。
 *
 * 输入为一组"命中行"，输出它们的计分标记。调用方只需保证每行带
 * `{ id, code, points, asset_id, port, target, self_created }` 与**本条命中的实际分值**
 * （`points` 字段；不要传得分点默认值 —— 合并版里同一条含多档，传默认值会把哪条计分判反）。
 *
 * @param db - 靶标库句柄。
 * @param rows - 命中行数组。
 * @param options - `{ meta?, names?, enabledOnly? }`：可复用已读好的元数据；`enabledOnly` 为 true
 *                  时"停用得分点"的命中直接标为不计分（报告与面板口径必须一致）。
 * @returns `{ byId, items, caps, meta, names, disabledIds }`
 */
function evaluateScoreBoard(db, rows = [], options = {}) {
  const meta = options.meta || loadScoreMeta(db)
  const names = options.names || loadAssetNames(db)
  const prepared = (rows || []).map((h) => {
    const code = h.code === null || h.code === undefined ? null : String(h.code)
    const m = code === null ? undefined : meta.get(code)
    const nm = h.asset_id === null || h.asset_id === undefined ? null : names.get(Number(h.asset_id))
    return Object.assign({}, h, {
      code,
      /* points 必须是"本条命中的实际分值"（见上方说明） */
      points: hitPointsOf(h, meta),
      rule: m === undefined || m.rule === undefined ? null : m.rule,
      cap: m === undefined ? 0 : m.cap,
      dedup_scope: m === undefined ? 'service' : m.dedup_scope,
      cap_group: m === undefined || m.rule === null || m.rule === undefined ? 'code:' + String(code) : 'rule:' + m.rule,
      rule_cap: m === undefined ? 0 : m.cap,
      system_key: [nm || '', normalizePort(h.port) ?? parseTargetPort(h.target) ?? ''].join('|'),
    })
  })
  const evaluated = applyScoreCaps(prepared, meta, names)
  const byId = new Map(evaluated.items.map((x) => [x.id, x]))
  const disabledIds = new Set()
  if (options.enabledOnly === true) {
    for (const h of prepared) {
      const m = h.code === null ? undefined : meta.get(h.code)
      if (m !== undefined && Number(m.enabled) !== 1) disabledIds.add(h.id)
    }
  }
  return { byId, items: evaluated.items, caps: evaluated.caps, meta, names, disabledIds }
}

/**
 * 这条命中为什么不计分（告警 / 界面 / 报告共用一句话，避免三处口径写歪）。
 * @param hit - 命中行（带 code / target / port / rule / rule_cap / capped_reason_kind）
 * @param bestPoints - 去重时被哪条压住（该条的分值）
 */
export function scoreCapReasonText(hit = {}, bestPoints) {
  const label = serviceLabel(hit)
  if (hit.capped_reason_kind === 'cap') {
    return '"' + label + "\" is not scored: "
      + (hit.rule === null || hit.rule === undefined ? '' : "rule " + hit.rule + ' ')
      + "**has cumulatively reached its cap (" + (Number(hit.rule_cap) || 0) + " pts)** — anything above that cap for the same rule is not accumulated. "
      + "Spend your effort on other rules or other assets instead of farming results in a rule that has already reached its cap."
  }
  return '"' + label + "\" target access is already maxed out (scoring rule: only the highest-scoring hit per target counts"
    + (bestPoints === undefined || bestPoints === null ? '' : ', +' + bestPoints + " pts")
    + ") — this hit does not score under the rule and is kept only as a process trace; **move on to another target or another rule — do not farm similar results on the same target**."
}

/** 兼容旧名（v0.10 及以前叫 serviceCapReason）。 */
export const serviceCapReason = scoreCapReasonText


/**
 * 数据规模的**粗判门槛**：100 万条/行。
 * 用途已经从「大量敏感信息得分项」改成 G5 翻倍的量级自检 —— 见 addScoreHit 里的警告。
 * 文档里 G5 的正式门槛是「超 1 亿条 或 10TB」；这里用更低的一档做"有没有写量级"的粗筛，
 * 低于它会提示核对，但不阻断记分。
 */
export const SENSITIVE_DATA_MIN_ROWS = 1000000

/**
 * 从证据文本里解析数据量（行/条/记录数）。
 * 支持「120 万条」「1300万行」「1,200,000 条记录」「2.5万行」「1200000 records」。
 * **只认带量词（条/行/记录/records/rows）或中文量级（亿/万…）的写法**——
 * 裸数字不认，否则会把口令里的 `123456`、端口号当成数据量。
 * 解析不出来返回 null（由调用方提示补齐量级，不猜、不编数）。
 */
export function parseRowCount(evidence) {
  const text = String(evidence || '')
  if (text.trim() === '') return null
  const units = { 亿: 1e8, 千万: 1e7, 百万: 1e6, 十万: 1e5, 万: 1e4, 千: 1e3 }
  const nums = []
  /* 「数字 + 单位 + 条/行/记录」：单位是中文量词，或英文 records/rows/entries */
  const cn = /(\d[\d,]*(?:\.\d+)?)\s*(亿|千万|百万|十万|万|千)?\s*(条|行|记录|数据|records?|rows?|entries)/gi
  for (const m of text.matchAll(cn)) {
    const base = Number(String(m[1]).replace(/,/g, ''))
    if (!Number.isFinite(base)) continue
    const mult = m[2] === undefined ? 1 : units[m[2]]
    nums.push(Math.round(base * mult))
  }
  if (nums.length > 0) return Math.max(...nums)
  /* 只写了「导出 120 万」这类（没写条/行）也认，但必须带中文量级 */
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(亿|千万|百万|十万|万|千)/g)) {
    const base = Number(String(m[1]).replace(/,/g, ''))
    if (Number.isFinite(base)) nums.push(Math.round(base * units[m[2]]))
  }
  return nums.length === 0 ? null : Math.max(...nums)
}

/** 千分位展示，告警里读数更直观。 */
export function formatRows(n) {
  return Number(n).toLocaleString('en-US')
}


/* ------------------------------------------------------------------ 默认得分点 */

/**
 * 得分点 → 交付口径（怎么算拿到、拿什么自证、怎么复现）。
 *
 * 为什么单独一张表而不是塞进 `score_point.description`：
 * 描述是"规则文档的条款"（给智能体判档位用），这张表是"给验收人看的复现口径"，
 * 两者受众不同、详略也不同。报告与界面按 code 取这里的说明，
 * 规则文档更新时不必动这张表，反之亦然。
 *
 * 字段：
 *   · need   —— 判定标准：满足什么才算拿到这一项（给验收人对账用）
 *   · proof  —— 自证材料：该附什么证据（G7 的证明材料要求）
 *   · replay —— 复现入口：用哪条请求 / 哪条命令重放（"可复现"最直接的答案）
 *   · script —— 一线可直接照做的动作（尽量是可复制执行的）
 */
export const SCORE_CONFIRM = {
  'domain-control': {
    need: "The target domain's DNS records are changed to something we control (NS/A records live), or the domain admin console can be operated",
    proof: "Admin console screenshot + dig/nslookup comparison before and after the record change",
    replay: "nslookup <host> <our-ns>; or the raw request of the console action",
    script: "dig NS <host> @8.8.8.8\ndig <host> @<our-ns>",
  },
  'terminal-access': {
    need: "Can push a command to the endpoint and get the execution result back (not just 'a device was found')",
    proof: "Echo of id/hostname run on the compromised endpoint + proof of its relation to the target organization (G7)",
    replay: "Run id in the remote-control session; or the agent check-in record of the trojan/RAT",
    script: 'id; whoami; hostname',
  },
  'server-host': {
    need: "A command was executed on the host and its output returned (WebShell / reverse shell / RAT all count)",
    proof: "Command output (id / hostname) + WebShell connection details or the session record",
    replay: "Raw WebShell request (directly replayable); or the listener record of the reverse shell",
    script: 'id; uname -a; cat /etc/passwd | head',
  },
  'db-credential': {
    need: "Connected to the database with an account and ran a query (unauthorized access counts too: being able to connect is enough)",
    proof: "Query output after a successful login (select user(), version()) + the account's privilege level",
    replay: 'mysql -h <host> -P <port> -u <user> -p\'<pass>\' -e "select user(),version()"',
    script: 'mysql -h <host> -u <user> -p -e "select user(),version(),current_user()"',
  },
  'web-app': {
    need: "Logged into the system with an account that already existed on the target (ordinary or admin) and reached a protected page",
    proof: "Page content/output after login + the session Cookie or Token (proof that it is not just the password)",
    replay: "Raw login request (with the Cookie/Token that proves it) + one request to a protected page carrying that session",
    script: "curl -i -s -X POST <url> -d \"username=<u>&password=<p>\" -c cookie.txt\ncurl -s -b cookie.txt <protected-page>",
  },
  'central-system': {
    need: "Logged into a centralized system (jump server / domain controller / SSO / endpoint management console) and obtained admin privileges",
    proof: "Admin console page screenshot + an action showing control over subordinate nodes (log in to 20% of managed nodes, or 20 nodes)",
    replay: "Raw login request + the request and response of one management action (e.g. listing managed hosts)",
    script: "curl -s -b cookie.txt \"<console-api>\"",
  },
  'bigdata-system': {
    need: "Obtained admin or ordinary privileges on a big-data platform (Hadoop/Spark/ES, etc.)",
    proof: "Platform admin page/API output + the volume of data accessible (row count or capacity)",
    replay: "Raw platform API request (e.g. ES _cat/indices, YARN /ws/v1/cluster/apps)",
    script: "curl -s \"<platform-api>\" | head -50",
  },
  netdev: {
    need: "Logged into a network device (firewall/router/switch/VPN/gap device) and obtained privileges",
    proof: "Device admin page screenshot + routing table or connection-count screenshot (explicitly required by G7)",
    replay: "Raw device login request + the command output that reads the routing table",
    script: "show ip route    # or display ip routing-table",
  },
  'netdev-redirect': {
    need: "The device was actually used to change traffic flow (policy/routing/DNS change took effect)",
    proof: "Routing table or policy comparison before and after the change + evidence that our node received the traffic",
    replay: "Raw policy-configuration request + packet capture/access logs on our controlled node",
    script: "tcpdump -ni any port <port> -c 10",
  },
  'netdev-implant': {
    need: "A runnable remote-control/persistence implant was placed on the device, **and** it was used to carry out follow-up attacks",
    proof: "Evidence of the RAT process or persistence item + records of the follow-up results obtained through that device",
    replay: "Raw request/command of the implant action + access logs of the follow-up traffic through that device",
    script: '',
  },
  iiot: {
    need: "Obtained admin privileges on an industrial internet system, or batch-controlled its interconnected devices",
    proof: "Admin console screenshot + list and count of controlled devices",
    replay: "Raw login request + response of the device-list API",
    script: '',
  },
  'cloud-platform': {
    need: "Cloud management platform admin privileges; or batch control of cloud nodes via AK/SK (node points only count for ≥100 nodes)",
    proof: "Platform admin page screenshot; for AK/SK, list and count of controlled nodes, or proof of admin rights (creating nodes/changing permissions)",
    replay: "Raw platform API request (list instances, create users, etc.)",
    script: "curl -s -H \"Authorization: Bearer <token>\" \"<instance-list-api>\"",
  },
  'iot-platform': {
    need: "Obtained privileges on an IoT management platform, or batch-controlled devices through its connection points",
    proof: "Platform admin page screenshot + connection point/device count",
    replay: "Raw platform login and device-list API requests",
    script: '',
  },
  'iot-corenet': {
    need: "Moved laterally from an IoT endpoint device into the core network and took control of important systems such as business production",
    proof: "Path description (which endpoint → core network → which system) + control evidence for that system",
    replay: "Lateral-movement command issued from the endpoint + login/operation requests against the core-network system",
    script: '',
  },
  secdev: {
    need: "Obtained admin privileges on a non-centralized security device (IPS/IDS/audit appliance/WAF)",
    proof: "Device admin page screenshot + an action showing policy control",
    replay: "Raw login request + response of one policy-read API",
    script: '',
  },
  'file-storage': {
    need: "Obtained backend privileges on a file storage system (FTP/NAS/cloud drive/object storage), or an ordinary account on it",
    proof: "Directory-listing screenshot + list of readable files (data results score separately, see G2)",
    replay: "Raw directory-listing request (FTP LIST / S3 ListObjects / WebDAV PROPFIND)",
    script: "curl -s \"<storage-api>\" | head -50",
  },
  'ai-agent': {
    need: "Controlled a model agent, skill, or other agent tool, and **actually drove it to perform actions**",
    proof: "Conversation or invocation record + the actions it was driven to perform and their results (graded by control depth for the range score)",
    replay: "Raw request that drives the agent + the output of the action it performed",
    script: '',
  },
  'model-compute': {
    need: "Obtained system admin privileges on a compute management platform, training-data system, or knowledge-base system",
    proof: "Admin console screenshot + an action showing compute scheduling or data read/write",
    replay: "Raw platform login and scheduling/data API requests",
    script: '',
  },
  'model-data': {
    need: "Obtained admin privileges on a model-related data system (able to affect training/inference/operations, or steal or tamper with weights)",
    proof: "Admin console screenshot + list of models/datasets that can be read/written",
    replay: "Raw platform API requests (list models, download weights)",
    script: '',
  },
  'computepower-admin': {
    need: "Obtained admin privileges on compute infrastructure",
    proof: "Admin console screenshot + proof of resources that can be scheduled",
    replay: "Raw platform login and resource-list API requests",
    script: '',
  },
  'computepower-cards': {
    need: "Actually obtained compute card resources (10 pts/card) or control of a card-pooling platform",
    proof: "Card resource list (with counts) + evidence of submitting jobs or exclusive card use",
    replay: "nvidia-smi output / platform card-list API",
    script: 'nvidia-smi -L',
  },
  'boundary-logical': {
    need: "Established a channel from the target side into the intranet and can **actually reach intranet targets through it**",
    proof: "Tunnel registration (the entry must be on the target side) + output/screenshot of reaching an intranet target through the tunnel (G7)",
    replay: "The command that reached the intranet target through the tunnel and its output; the tunnel setup command",
    script: "curl --socks5-hostname 127.0.0.1:<port> http://<host>/ -i",
  },
  'boundary-strong': {
    need: "Broke through gap-type strong isolation into the strongly isolated business intranet and actually reached an intranet target",
    proof: "Control screenshot of the gap-type isolation device + screenshot proving intranet access (G7)",
    replay: "Command and output of reaching the intranet target through the strong-isolation channel",
    script: '',
  },
  'boundary-physical': {
    need: "Broke through physical isolation / entered the core production network and actually reached the target",
    proof: "Control screenshots of the firewall/VPN/multi-NIC host/gap device + screenshot proving intranet access (G7)",
    replay: "Command and output of reaching the target after entering the core network",
    script: '',
  },
  'boundary-supply': {
    need: "Entered a primary defending unit's intranet through a supply-chain O&M channel or a cloud service (scored by scenario)",
    proof: "Control evidence on the supply-chain/cloud side + proof of entering the primary defending unit's intranet; state which scenario applies",
    replay: "Command and output of entering the intranet through the supply-chain channel",
    script: '',
  },
}

/** 取某个得分点的交付口径；没有专门条目时返回 null（报告会退回只显示 evidence）。 */
export function scoreConfirmOf(code) {
  const key = String(code || '').trim()
  return SCORE_CONFIRM[key] === undefined ? null : SCORE_CONFIRM[key]
}

export const DEDUP_SCOPES = ['service', 'system', 'target', 'none']

/**
 * 一条得分点的完整定义（工厂函数，避免 22 个对象重复字段）。
 *
 * 两个编号各司其职，**不要混用**：
 *   · `src`  —— 《突破入侵类得分规则（合并版）》里的"原序号"（合并行写首个原序号），
 *               只用于与原表逐条对账，出现在文档与代码注释里；
 *   · `rule` —— 本实现内部的**上限分组键**（`applyScoreCaps` 按它累计 cap）。
 *               它必须**唯一**：历史上曾直接用原序号当分组键，导致 16/17 合并行与
 *               19 的两个子项共用同一个键 —— 一条命中会把另一条的上限吃掉，
 *               而且 `rule` 编号出现重复（两个 19）与空号（6/17/20/21），
 *               模型读到"规则 19 已达上限"时分不清是哪一条。
 *               现在统一为 1..N 连续唯一，与数组顺序一一对应。
 */
const sp = (src, rule, tier, code, name, category, points, cap, dedup_scope, description) => ({
  src, rule, tier, code, name, category, points, cap, dedup_scope, description,
})

/* ── 通用规则（G1–G8，横切全部条目；不单独计分，写进说明与提示词）────────────
   G1 权限取高只计一次 ｜ G2 数据成果另行计分 ｜ G3 上限针对单个防守单位 ｜
   G4 设备按台（个）计分 ｜ G5 数据规模翻倍 ｜ G6 IPv6 ×3（不突破原上限）｜
   G7 证明材料要求 ｜ G8 兜底：其他系统由专项组研判后给分。
   完整原文见 docs/得分规则-合并版.md。 */
export const SCORE_GENERAL_RULES = [
  { code: 'G1', name: "Highest privilege only, counted once", detail: "When multiple privileges are obtained on the same system, host, or database, only the highest privilege scores once (if you get both admin and ordinary access, only the admin points are awarded)." },
  { code: 'G2', name: "Data results score separately", detail: "Mail data, business data, data assets, and similar results score separately by data importance and are not mixed with privilege points." },
  { code: 'G3', name: "Cap basis", detail: "Each item's cap applies to a single defending unit and all its subordinate organizations; once the cap is reached, nothing more accumulates." },
  { code: 'G4', name: "Devices/endpoints score per unit", detail: "Printers and wifi routers score 5 pts per unit; PCs, tablets, phones, cameras, and electronic displays score 10 pts per unit; cloud hosts, containers, hosted interconnected devices, and IoT connection points score 10 pts per unit. Batch control is converted per \"controlled node\"." },
  { code: 'G5', name: "Data-volume doubling", detail: "Systems containing large data volumes (important data over 100 million rows or 10 TB) score double; control of a knowledge-base-related system scores double. Ordinary log data generated by the system does not count." },
  { code: 'G6', name: "IPv6 multiplier", detail: "Results obtained over IPv6 score ×3, but the cap is still the original cap for that system type; the multiplier does not raise the cap." },
  { code: 'G7', name: "Proof material", detail: "A boundary breach requires control screenshots of the isolation device and a screenshot proving intranet access; controlled phones, tablets, and other endpoints must prove their relation to the target organization; network-device privileges require routing-table evidence or connection-count screenshots." },
  { code: 'G8', name: "Catch-all clause", detail: "Privileges on other systems, servers, devices, etc. have no preset points; the special review group determines the score." },
]

/**
 * 默认得分点 —— **严格对齐《突破入侵类得分规则（合并版）》，共 25 项**
 * （一、获取权限 21 条 + 二、突破网络边界 4 条，共 8 个类别；其中"同一行的不同计费单位"拆为独立得分点，如算力基础设施的管理员权限与算力卡）。
 *
 * 与上一版的区别：不再按"同一规则内的权限档位"拆条 —— 一条 = 合并版里的一行
 * （`tier` 字段写清该条的档位/子项），只有**计费单位不同**的多档才保留子项
 * （如算力基础设施的"管理员权限"与"算力卡 10 分/卡"）。
 *
 * 字段含义：
 *   · src    合并版里的"原序号"（用于与原表逐条对账）；
 *   · group  界面分组：GENERAL = 控制一般系统，WEB = 控制 Web 应用系统，
 *            CENTRAL = 控制集权系统，BIGDATA = 控制大数据系统，
 *            NETINFRA = 控制网络基础设施，STORAGE = 文件存储类系统，
 *            MODEL = 控制模型相关系统，BOUNDARY = 突破网络边界；
 *   · points 单次分值（一条内多档时取该条的主档，说明里写清各档）；
 *   · cap    该条上限（0 = 不设上限）；dedup_scope 计分口径。
 */
export const SCORE_GROUPS = [
  { code: 'GENERAL', name: "General systems" },
  { code: 'WEB', name: "Web application systems" },
  { code: 'CENTRAL', name: "Centralized systems" },
  { code: 'BIGDATA', name: "Big-data systems" },
  { code: 'NETINFRA', name: "Network infrastructure" },
  { code: 'STORAGE', name: "File storage systems" },
  { code: 'MODEL', name: "Model-related systems" },
  { code: 'BOUNDARY', name: "Boundary breach" },
]

export const DEFAULT_SCORE_POINTS = [
  /* ══ 一、获取权限（18 条）══════════════════════════════════════════════ */

  /* 1 域名控制权限 */
  sp(1, 1, "50 pts per primary domain / 20 pts per secondary domain", 'domain-control', "Domain control privilege", 'GENERAL', 50, 400, 'system',
    "**Primary domains score 50 pts each, secondary domains 20 pts each**, graded by domain type; this item is capped at 400 pts (G3).\n"
    + "When recording, state the domain and its type in `evidence`; for a secondary domain set the per-hit points to 20."),

  /* 2 终端权限 */
  sp(2, 2, "5 / 10 pts per unit", 'terminal-access', "Endpoint privilege (phones, tablets, PCs, printers, cameras, wifi routers, etc.)", 'GENERAL', 10, 600, 'system',
    "**Printers and wifi routers score 5 pts per unit; PCs, tablets, phones, cameras, and electronic displays score 10 pts per unit** (G4), accumulating per unit; this item is capped at 600 pts (G3).\n"
    + "Controlled endpoint devices must prove their relation to the target organization (G7); for a 5-pt device set the per-hit points to 5.\n"
    + "Endpoints obtained via phishing also score under this item; state the target person role in `evidence` (general office / IT operations / business operations)."),

  /* 3 服务器主机权限 */
  sp(3, 3, "10 pts per ordinary privilege / 50 pts per admin privilege", 'server-host', "Server host privilege (including WebShell access)", 'GENERAL', 50, 600, 'system',
    "**Ordinary privileges score 10 pts each, admin privileges 50 pts each**; this item is capped at 600 pts (G3).\n"
    + "The same host counts only once at its highest privilege (G1) — after root/SYSTEM, ordinary privileges on that host no longer accumulate.\n"
    + "Taking one server host does not deduct points; for an ordinary privilege set the per-hit points to 10."),

  /* 4 数据库连接账号密码 */
  sp(4, 4, "10 pts ordinary / 50 pts admin / 10 pts unauthorized, each", 'db-credential', "Database account credentials (including SQL injection)", 'GENERAL', 50, 400, 'system',
    "**Ordinary user privileges score 10 pts each, admin privileges 50 pts each; redis and other empty-password or unauthorized-access results score a flat 10 pts each**; this item is capped at 400 pts (G3).\n"
    + "Equivalent privileges on the same database (including admin) score only once; system, application, and database privileges on the same host score only once at the highest privilege (G1).\n"
    + "Data results score separately (G2); for an ordinary privilege or unauthorized access set the per-hit points to 10."),

  /* 5、6 邮箱与业务生产系统（原表两项共用规则与上限） */
  sp(5, 5, "100 pts per admin privilege / 50 pts per ordinary privilege", 'web-app', "Mail system / office-automation and business-production systems / other web application privileges", 'WEB', 100, 2000, 'system',
    "**Admin privileges score 100 pts each, ordinary user privileges 50 pts each; each system counts only once at its highest privilege** (G1); this item is capped at 2000 pts (G3).\n"
    + "This item merges items 5 and 6 of the original table (identical rules and caps), **i.e. the \"web application systems\" category**; when recording, state in `evidence` which kind of system it is:\n"
    + "· **Mail system**;\n"
    + "· **Office-automation and business-production systems** (office OA, ERP, direct-report instant messaging, finance systems, business-production systems, data warehouses — systems whose compromise or outage affects industry or unit production, operations management, or daily office work);\n"
    + "· **Other web application systems (catch-all)**: HTTP/HTTPS sites you have **actually verified you can log in to** with an account from the credential list, "
    + "that do not fall into a more specific score point category (centralized systems go to item 7, big-data systems to item 8, cloud management platforms to item 11, IoT management platforms to item 12, security devices to item 13, etc.); "
    + "all of them score under this item (admin 100 / ordinary 50). **Web logins where the credential list only records `host:port` with no system name or business owner (back offices, admin consoles, operations platforms, in-house business systems, etc.) also fall here** — "
    + "first check whether a more fitting category applies; if not, file it under \"web application systems\" rather than skipping it because you cannot tell whether it is mail/OA. "
    + "When recording, put the actual login URL (with port) in `target` and state \"which site + which account + admin/ordinary tier\" in `evidence`; verify the login live first per red line 1.\n"
    + "Mail data additionally scores separately by importance (G2); for an ordinary user privilege set the per-hit points to 50."),

  /* 7 集权系统 */
  sp(7, 6, "500 pts per admin privilege / 50 pts per ordinary privilege", 'central-system', "Centralized system privilege (O&M / identity / networking / endpoint management consoles)", 'CENTRAL', 500, 4000, 'system',
    "**System admin privileges score 500 pts each, ordinary privileges 50 pts each**; each privilege scores only once, so holding both admin and ordinary access awards only the admin points (G1); this item is capped at 4000 pts (G3).\n"
    + "Centralized systems cover four kinds:\n"
    + "· **O&M centralization**: jump servers, centralized monitoring, unified resource publishing, etc.;\n"
    + "· **Identity and privilege management**: SSO, 4A, IAM, etc.;\n"
    + "· **Network centralization**: domain controllers, certificate authorities, SD-WAN unified controllers, etc.;\n"
    + "· **Endpoint/host management consoles**: endpoint management software backends, zero-trust control centers, etc.\n"
    + "⚠️ **Hosts and endpoints managed by a centralized system are scored under the \"general systems\" points instead** (e.g. PCs and mobile endpoints at 10 pts per unit, G4) —"
    + "**do not apply the centralized system's top tier of 500 pts**, which would grossly overstate it; batch control must be proven with logins to at least 20% of the managed nodes, and 20 nodes at most is enough."),

  /* 8 大数据系统 */
  sp(8, 7, "1000 pts per admin privilege / 100 pts per ordinary privilege", 'bigdata-system', "Big-data system privilege", 'BIGDATA', 1000, 4000, 'system',
    "**Admin privileges are worth 1000 pts, ordinary privileges 100 pts each**; each privilege scores only once, so holding both admin and ordinary access awards only the admin points (G1); this item is capped at 4000 pts (G3).\n"
    + "Data scores separately (G2); **systems with effective data volume below 500 million rows or 1 TB are treated as ordinary databases** (i.e. use the item 4 points)."),

  /* 9 网络设备权限 */
  sp(9, 8, "100 pts ordinary / 200 pts admin / +200 or +1000 pts bonus", 'netdev', "Network device privilege (firewalls, routers, switches, gap devices, optical gap devices, ferry machines, VPNs, etc.)", 'NETINFRA', 200, 2000, 'service',
    "**Ordinary user privileges are worth 100 pts, admin privileges 200 pts**; this item is capped at 2000 pts (G3). Routing-table evidence or connection-count screenshots are required (G7).\n"
    + "Achieving the following on the same device **earns bonus points** (scored at the tier achieved):\n"
    + "· **Network redirection or service hijacking** through the device: +200 pts;\n"
    + "· **Implanting a remote-control program on the device and successfully carrying out follow-up attacks**: 1000 pts.\n"
    + "For an ordinary privilege or a bonus tier, set the per-hit points to the actual tier."),

  /* 10 工业互联网系统 */
  sp(10, 9, "200 pts admin / 10 pts per device", 'iiot', "Industrial internet system privilege", 'NETINFRA', 200, 2000, 'system',
    "**Admin privileges on the management console are worth 200 pts; hosted interconnected devices score 10 pts each** (G4); this item is capped at 2000 pts (G3).\n"
    + "Covers connected vehicles, smart manufacturing, remote diagnostics, intelligent transport, etc. To accumulate devices per unit, use separate score hits (with points set to 10)."),

  /* 11 云管理平台 */
  sp(11, 10, "500 pts admin / 10 pts per node", 'cloud-platform', "Cloud management platform control (including PaaS platforms such as Kubernetes, Red Hat OpenShift, etc.)", 'NETINFRA', 500, 2000, 'system',
    "**Admin privileges are worth 500 pts; cloud hosts and containers score 10 pts per unit** (G4); this item is capped at 2000 pts (G3). Cloud business systems score separately under the important-system rules.\n"
    + "Batch control via AK/SK by default **scores only the controlled nodes, not the admin privilege**, unless admin rights are proven (e.g. creating cloud nodes, managing user permissions).\n"
    + "⚠️ **With fewer than 100 nodes, score it as an ordinary web application and give no node points** (i.e. use the item 5/6 basis)."),

  /* 12 物联网设备管控平台 */
  sp(12, 11, "200 pts platform / 10 pts per connection point / +5000 pts core network", 'iot-platform', "IoT device management platform privilege", 'NETINFRA', 200, 2000, 'system',
    "**An IoT platform with control capability is worth 200 pts; connection points on the platform score 10 pts per unit** (G4); this item is capped at 2000 pts (G3).\n"
    + "**Entering the core network through an IoT endpoint device and controlling important systems such as business production earns a separate +5000 pts** (not bound by this item's 2000-pt cap; record it as a separate hit)."),

  /* 13 安全设备 */
  sp(13, 12, "200 pts admin", 'secdev', "Security device privilege (IPS, IDS, audit appliances, WAF, and other non-centralized security devices)", 'NETINFRA', 200, 1000, 'service',
    "**Admin privileges are worth 200 pts**; this item is capped at 1000 pts (G3). Limited to non-centralized security devices (centralized ones go to item 7)."),

  /* 14 文件存储类系统 */
  sp(14, 13, "50 pts admin / 10 pts per ordinary privilege", 'file-storage', "File storage system privilege (FTP, object storage, enterprise NAS, enterprise cloud drives, etc.)", 'STORAGE', 50, 500, 'system',
    "**Admin privileges score 50 pts each; ordinary user privileges, empty systems, or systems holding only test data score 10 pts each**; this item is capped at 500 pts (G3).\n"
    + "Covers FTP, object storage (scored per system), enterprise NAS, enterprise cloud drives, etc.; data scores separately (G2). For an ordinary privilege set the per-hit points to 10."),

  /* 15 模型智能体 / agent 工具 */
  sp(15, 14, "100–500 pts each", 'ai-agent', "Model agents, skills, and other agent tools (with the ability to drive an agent to attack)", 'MODEL', 100, 4000, 'service',
    "**100–500 pts each**, a range graded by control and operation depth; this item is capped at 4000 pts (G3).\n"
    + "Covers model agents, skills, and other agent tools; when recording, state the control/operation depth in `evidence` and set the per-hit points to the assessed tier."),

  /* 16、17 算力管理平台 + 训练数据/知识库系统（原表两项规则逐字相同） */
  sp(16, 15, "500 pts per system admin privilege", 'model-compute', "Compute management platform privilege / training-data and knowledge-base system privilege", 'MODEL', 500, 4000, 'system',
    "**Obtaining system admin privileges scores 500 pts each**; this item is capped at 4000 pts (G3).\n"
    + "This item merges items 16 and 17 of the original table (identical wording); when recording, state in `evidence` which kind of system it is:\n"
    + "· **Compute management platform** (able to manage and schedule compute resources, etc.);\n"
    + "· **Training-data, knowledge-base, and related systems** (able to steal or tamper with training data or knowledge bases, plant poisoned data, etc.).\n"
    + "Systems with large data volumes (over 100 million rows or 10 TB) **score double**; controlling a knowledge-base-related system **scores double** (G5)."),

  /* 18 模型相关数据系统 */
  sp(18, 16, "500 pts per system admin privilege", 'model-data', "Model-related data system privilege", 'MODEL', 500, 4000, 'system',
    "**Obtaining system admin privileges scores 500 pts each**; this item is capped at 4000 pts (G3).\n"
    + "Allows interference with model training, inference, and operations services, and theft or tampering with model weight files, etc.\n"
    + "⚠️ The difference from items 16 and 17 **must not be flattened**: this item **does not include \"controlling a knowledge-base-related system doubles the score\"**, but it does include \"data-asset results are scored by the data rules\" (G2); "
    + "Systems with very large data volumes (over 100 million rows or over 10 TB) score double (G5)."),

  /* 19 算力基础设施（权限与算力卡两种计费单位，保留两条） */
  sp(19, 17, "500 pts per admin privilege", 'computepower-admin', "Compute infrastructure · admin privilege", 'MODEL', 500, 2000, 'system',
    "**Admin privileges score 500 pts each**; this item is capped at 2000 pts (including path points, G3).\n"
    + "This item and \"Compute infrastructure · compute card resources\" both belong to item 19 and share the 2000-pt cap; the three (admin privilege / large compute-card resources / compute-card pooling platform) can each score but are subject to this item's overall cap."),
  sp(19, 18, "10 pts per card", 'computepower-cards', "Compute infrastructure · compute card resources / compute-card pooling platform", 'MODEL', 10, 2000, 'none',
    "**10 pts per card**, accumulating per card (G4); obtaining large compute-card resources and obtaining a compute-card pooling platform each score directly, each capped at 2000 pts, and sharing item 19's overall 2000-pt cap with \"admin privilege\".\n"
    + "When recording, state the card count or platform name in `evidence`."),

  /* ══ 二、突破网络边界（4 项，整个目标单位同一类边界只给一次分）══════════ */

  sp(22, 19, "1000 pts", 'boundary-logical', "Enter a logically isolated business intranet", 'BOUNDARY', 1000, 0, 'target',
    "**1000 pts**. Scope: breaking the same kind of network boundary scores only once for the entire target unit.\n"
    + "Proof material (G7): control screenshots of the firewall isolation device, a screenshot proving intranet access, etc."),
  sp(23, 20, "10000 pts", 'boundary-strong', "Enter a logically strongly isolated business intranet", 'BOUNDARY', 10000, 0, 'target',
    "**10000 pts**. Scope: breaking the same kind of network boundary scores only once for the entire target unit.\n"
    + "Proof material (G7): control screenshots of the gap-type isolation device, a screenshot proving intranet access, etc."),
  sp(24, 21, "30000 pts", 'boundary-physical', "Enter a physically isolated intranet / core production network", 'BOUNDARY', 30000, 0, 'target',
    "**30000 pts**. Scope: breaking the same kind of network boundary scores only once for the entire target unit.\n"
    + "Proof material (G7): control screenshots of firewalls, VPNs, multi-NIC hosts, network devices, and gap-type isolation devices, plus a screenshot proving intranet access, etc.\n"
    + "Examples: railway dispatch private networks, bank core accounting networks, power production control zones, carrier signaling networks, energy production IoT networks, etc."),
  sp(25, 22, "1000 pts (max 3000)", 'boundary-supply', "Enter an intranet via a supply-chain O&M channel or cloud service", 'BOUNDARY', 1000, 3000, 'service',
    "Scored under three scenarios:\n"
    + "· Entering **the same primary defending unit's intranet**: 1000 pts;\n"
    + "· Using **one** supply-chain entity or cloud service to enter **multiple** primary defending units' intranets: 1000 pts per primary defending unit;\n"
    + "· Using **multiple** supply-chain entities or cloud services to enter different network zones of **one** primary defending unit's intranet: 1000 pts per zone, up to 3000 pts.\n"
    + "When recording, state in `evidence` which scenario applies and which primary defending unit / network zone is involved."),

  /* ══ 附加成果加成（依附于上面某条权限，但**独立计分、独立上限**）══════════
     这些条目不是「再拿一个系统权限」，而是「在已拿到的权限上又做到了某件事」（文档里的 +N 分）。
     压在基础条目里会共用它的 rule 上限、被基础分吃掉，所以拆成独立得分点。 */

  /* 9 网络设备加成：能够借助该设备进行网络重定向或业务劫持 +200 分 */
  sp(9, 23, "Redirection / service hijacking +200 pts", 'netdev-redirect', "Network device · Network redirection or service hijacking via the device", 'NETINFRA', 200, 2000, 'none',
    "**Adds 200 pts on top of the \"network device privilege\" score** (item 9 of the rules document).\n"
    + "Applies to: changing routes/policies to steer traffic to our controlled node, DNS hijacking, business-traffic hijacking — redirection that actually took effect.\n"
    + "Evidence required (G7): routing table, policy configuration, or connection-count screenshot; state the redirection direction and how it was verified in `evidence`."),

  /* 9 网络设备加成：能在设备上植入远控程序并成功进行后续攻击 1000 分 */
  sp(9, 24, "Remote-control implant + follow-up attack 1000 pts", 'netdev-implant', "Network device · Implant a remote-control program and successfully carry out follow-up attacks", 'NETINFRA', 1000, 2000, 'none',
    "**Adds 1000 pts on top of the \"network device privilege\" score** (item 9 of the rules document).\n"
    + "Both must be proven: \"the implant succeeded **and** was used to complete follow-up attacks\" — evidence of the remote-control process/persistence plus follow-up results obtained through that device."),

  /* 12 物联网：通过端点设备打入核心网并控制业务生产等重要系统，单独加 5000 分 */
  sp(12, 25, "Core network +5000 pts", 'iot-corenet', "IoT · Enter the core network via an endpoint device and control important systems", 'NETINFRA', 5000, 5000, 'none',
    "**Item 12 of the rules document explicitly says \"add 5000 pts separately\"**, which does not count against that item's 2000-pt cap.\n"
    + "Applies to: moving laterally from an IoT endpoint device into the core network and controlling important systems such as business production;\n"
    + "in `evidence`, state: which endpoint was used, which core-network systems were controlled, and what privileges were obtained."),
]

/* ------------------------------------------------------------------ 内部辅助的导出 */

/**
 * 下面这些原本是 core.js 里的模块级函数（不对外导出），拆出来之后 core.js 需要用到，
 * 所以显式导出。它们不属于"给别人用的 API"，改签名前先看 core.js 的用法。
 */
export {
  normalizePort, targetAuthority, systemKeyOf, pickBestHit, legacyCapGroup,
  targetHasIpv6Host, evaluateScoreBoard, loadScoreMeta, loadAssetNames, hitPointsOf,
  scoreMultiplierOf,
}
