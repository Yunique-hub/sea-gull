const DRAFT_TTL_MS = 10 * 60 * 1000;
const pendingDrafts = new Map();
let lastPending = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ignoreSettled(value) {
  Promise.resolve(value).catch(() => {});
}

function errorText(err) {
  if (!err) return "回退失败";
  if (typeof err === "string") return err;
  return err.message || err.code || String(err);
}

function asEventList(events) {
  if (Array.isArray(events)) return events;
  if (events && typeof events[Symbol.iterator] === "function") {
    try {
      return [...events];
    } catch {
      return [];
    }
  }
  return [];
}

function service(ctx, name) {
  if (!ctx || typeof ctx.get !== "function") return undefined;
  try {
    return ctx.get(name);
  } catch {
    return undefined;
  }
}

function userTextFromEvent(event) {
  const data = event?.data;
  const content = data?.content ?? data?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (!block) continue;
    if (typeof block === "string") {
      parts.push(block);
      continue;
    }
    if (block.type === "text" || typeof block.text === "string") {
      parts.push(String(block.text ?? ""));
    }
  }
  return parts.join("").trim();
}

function isPluginDraft(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return /^\[MNEMON\]/i.test(value)
    || /MNEMON RUNTIME MEMORY SNAPSHOT/i.test(value)
    || /^MNEMON VIEW TOOLS/im.test(value);
}

function isRewindMarkerEvent(event) {
  if (!event || event.type !== "user/message") return false;
  const id = event.data?.id;
  return typeof id === "string" && id.startsWith("rewind-");
}

function isHumanUserEvent(event) {
  if (event?.type !== "user/message") return false;
  const source = event.data?.source;
  if (source?.kind === "plugin") return false;
  if (source?.kind && source.kind !== "user") return false;
  const text = userTextFromEvent(event);
  if (!text || isPluginDraft(text)) return false;
  return true;
}

/** 这一轮真正发出去的那句。手打是 user；goal 各轮也算（含 round 0 的首轮 goal）。 */
function isRoundPromptEvent(event) {
  if (!event || event.type !== "user/message" || isRewindMarkerEvent(event)) return false;
  const source = event.data?.source;
  const kind = source?.kind;
  if (kind === "plugin") return false;
  const text = userTextFromEvent(event);
  if (!text || isPluginDraft(text)) return false;
  if (!kind || kind === "user") return true;
  if (kind === "goal") return Number.isFinite(Number(source.round)) && Number(source.round) >= 0;
  return false;
}

/** 最近一轮已经 turn/end 的边界。用 turn 窗口找提示，避免第二轮完成却退回第一句。 */
function eventsInOrder(events) {
  return asEventList(events)
    .map((event, index) => ({ event, seq: Number.isFinite(Number(event?.seq)) ? Number(event.seq) : index }))
    .sort((left, right) => left.seq - right.seq);
}

function lastOpenTurn(events) {
  const list = asEventList(events);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const type = list[i]?.type;
    if (type === "turn/start") return list[i];
    if (type === "turn/end") return null;
  }
  return null;
}

function isSubagentHeader(header) {
  if (!header) return false;
  return header.origin === "subagent" || (header.delegationDepth ?? 0) > 0;
}

export function pendingInboxInserts(events) {
  const list = Array.isArray(events) ? events : [];
  let lastEnd = -1;
  let lastStart = -1;
  for (const event of list) {
    if (event?.type === "turn/end") lastEnd = event.seq;
    if (event?.type === "turn/start") lastStart = event.seq;
  }
  const after = lastEnd >= 0 ? lastEnd : -1;
  const ids = [];
  const seen = new Set();
  for (const event of list) {
    if (!event || event.seq <= after) continue;
    if (lastStart > after && event.seq >= lastStart) continue;
    if (event.type !== "agent/inbox/spliced") continue;
    if (event.data?.target && event.data.target !== "next-turn") continue;
    for (const message of event.data?.inserted || []) {
      const id = message?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function lastTurnSubagentIds(events, fromSeq = -1) {
  const list = Array.isArray(events) ? events : [];
  let floor = Number(fromSeq);
  if (!Number.isFinite(floor) || floor < 0) {
    floor = -1;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i]?.type === "turn/start") {
        floor = list[i].seq;
        break;
      }
    }
  }
  if (floor < 0) return [];
  const ids = [];
  const seen = new Set();
  for (const event of list) {
    if (!event || event.seq < floor) continue;
    if (event.type !== "subagent/catalog" && event.type !== "subagent/descriptor") continue;
    const id = event.data?.childId || event.data?.sessionId || event.data?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function seqBefore(events, cutSeq) {
  const floor = Number(cutSeq);
  let prev = null;
  for (const row of eventsInOrder(events)) {
    if (!Number.isFinite(row.seq)) continue;
    if (Number.isFinite(floor) && row.seq >= floor) break;
    prev = row;
  }
  return prev && Number.isFinite(prev.seq) ? prev.seq : null;
}

function lastEventOfType(events, type) {
  const list = asEventList(events);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.type === type) return list[i];
  }
  return null;
}

function userTextFromRange(events, fromSeq) {
  const list = asEventList(events);
  const floor = Number(fromSeq);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const event = list[i];
    const seq = Number(event?.seq);
    if (Number.isFinite(floor) && Number.isFinite(seq) && seq < floor) break;
    if (isRoundPromptEvent(event)) return userTextFromEvent(event);
  }
  return "";
}

function isFirstStepOfTurn(events, start) {
  if (!start) return true;
  const turn = start.data?.turn;
  const startSeq = Number(start.seq);
  return !asEventList(events).some((event) => (
    event?.type === "step/start"
    && event !== start
    && Number(event.seq) < startSeq
    && (turn == null || event.data?.turn === turn)
  ));
}

function turnStartFor(events, turn, beforeSeq) {
  const limit = Number(beforeSeq);
  let found = null;
  for (const event of asEventList(events)) {
    const seq = Number(event?.seq);
    if (Number.isFinite(limit) && Number.isFinite(seq) && seq > limit) break;
    if (event?.type === "turn/start" && (turn == null || event.data?.turn === turn)) found = event;
  }
  return found;
}

/** once = 撤最后一步；round = 撤最后一整轮。fork 的 atSeq 含这一条，之后的消息都不要。 */
export function planRewind(events, mode = "once") {
  return mode === "round" ? planRewindTurn(events) : planRewindStep(events);
}

function planRewindStep(events) {
  const start = lastEventOfType(events, "step/start");
  if (!start) return planRewindTurn(events);
  const turn = start.data?.turn;
  const step = start.data?.step;
  let cutSeq = Number(start.seq);
  if (isFirstStepOfTurn(events, start)) {
    const turnStart = turnStartFor(events, turn, start.seq);
    if (turnStart && Number.isFinite(Number(turnStart.seq))) cutSeq = Number(turnStart.seq);
  }
  const text = userTextFromRange(events, cutSeq);
  const atSeq = seqBefore(events, cutSeq);
  if (atSeq == null) {
    if (!text) return { ok: false, error: "没有可回退的上一句" };
    return { ok: true, mode: "blank", text, unit: "step", turn, step, fromSeq: cutSeq };
  }
  return { ok: true, mode: "fork", atSeq, text, unit: "step", turn, step, fromSeq: cutSeq };
}

function planRewindTurn(events) {
  const list = asEventList(events);
  const open = lastOpenTurn(list);
  let turnStart = open;
  if (!turnStart) {
    const ended = lastEventOfType(list, "turn/end");
    if (ended) turnStart = turnStartFor(list, ended.data?.turn, ended.seq) || ended;
  }
  if (!turnStart) {
    const lastUser = [...list].reverse().find((event) => isRoundPromptEvent(event));
    if (!lastUser) return { ok: false, error: "没有可回退的上一句" };
    const cutSeq = Number(lastUser.seq);
    const text = userTextFromEvent(lastUser);
    const atSeq = seqBefore(list, cutSeq);
    if (atSeq == null) return { ok: true, mode: "blank", text, unit: "turn", fromSeq: cutSeq };
    return { ok: true, mode: "fork", atSeq, text, unit: "turn", fromSeq: cutSeq };
  }
  const cutSeq = Number(turnStart.seq);
  const text = userTextFromRange(list, cutSeq);
  const atSeq = seqBefore(list, cutSeq);
  if (!text && atSeq == null) return { ok: false, error: "没有可回退的上一句" };
  if (atSeq == null) return { ok: true, mode: "blank", text, unit: "turn", fromSeq: cutSeq };
  return { ok: true, mode: "fork", atSeq, text, unit: "turn", fromSeq: cutSeq };
}

function rememberDraft(sessionId, text, parentId) {
  const rec = {
    sessionId,
    parentId,
    text: text || "",
    at: Date.now(),
  };
  pendingDrafts.set(sessionId, rec);
  lastPending = rec;
  const now = Date.now();
  for (const [id, row] of pendingDrafts) {
    if (now - row.at > DRAFT_TTL_MS) pendingDrafts.delete(id);
  }
  return rec;
}

export function getDraft(sessionId) {
  if (!sessionId) return null;
  const rec = pendingDrafts.get(sessionId);
  if (!rec) return null;
  if (Date.now() - rec.at > DRAFT_TTL_MS) {
    pendingDrafts.delete(sessionId);
    return null;
  }
  return rec;
}

export function takeDraft(sessionId) {
  const rec = getDraft(sessionId);
  if (rec) pendingDrafts.delete(sessionId);
  return rec;
}

export function getPending() {
  if (!lastPending) return null;
  if (Date.now() - lastPending.at > DRAFT_TTL_MS) {
    lastPending = null;
    return null;
  }
  return lastPending;
}

export function lastHumanUserText(events) {
  const list = Array.isArray(events) ? events : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (isHumanUserEvent(list[i])) return userTextFromEvent(list[i]);
  }
  return "";
}

export async function readLastUserText(ctx, sessionId) {
  if (!sessionId) return { ok: false, text: "", error: "没有当前会话" };
  try {
    const log = await readSessionLog(ctx, sessionId);
    return { ok: true, text: lastHumanUserText(log.events) };
  } catch (err) {
    return { ok: false, text: "", error: errorText(err) };
  }
}

function disposeObservation(observed) {
  try {
    observed?.[Symbol.dispose]?.();
  } catch {
    /* ignore */
  }
}

async function readSessionLog(ctx, sessionId) {
  const store = service(ctx, "sessions");
  const live = store?.get?.(sessionId);
  if (live?.snapshotEvents) {
    return {
      events: asEventList(live.snapshotEvents()),
      header: live.header,
      cwd: live.header?.cwd,
    };
  }

  const controller = service(ctx, "sessionController");
  if (typeof controller?.inspect === "function") {
    const inspected = await controller.inspect(sessionId);
    return {
      events: asEventList(inspected?.events),
      header: inspected?.meta || inspected?.header,
      cwd: inspected?.meta?.cwd || inspected?.header?.cwd,
    };
  }

  const query = service(ctx, "sessionQuery");
  if (typeof query?.observeSession === "function") {
    const observed = await query.observeSession(sessionId, { projectionMode: "none" });
    try {
      return {
        events: asEventList(observed?.events),
        header: observed?.header,
        cwd: observed?.header?.cwd,
      };
    } finally {
      disposeObservation(observed);
    }
  }

  throw new Error("找不到当前会话");
}

async function waitTurnClosed(ctx, sessionId, timeoutMs = 8000) {
  const started = Date.now();
  let last = await readSessionLog(ctx, sessionId);
  while (lastOpenTurn(last.events)) {
    if (Date.now() - started >= timeoutMs) {
      throw new Error("回合还在进行，请先点停止再回退");
    }
    await sleep(80);
    last = await readSessionLog(ctx, sessionId);
  }
  return last;
}

function getAgent(ctx, sessionId) {
  const agents = service(ctx, "agents");
  try {
    return agents?.get?.(sessionId) || agents?.agent?.(sessionId) || undefined;
  } catch {
    return undefined;
  }
}

/** 回退后下一句按新请求开，不要接着上一轮的 request/header series。 */
function resetRequestSeries(ctx, sessionId) {
  const agent = getAgent(ctx, sessionId);
  if (!agent) return;
  try { agent.requestHeaderLogged = false; } catch { /* ignore */ }
  try { agent.requestSurfaceGeneration = -1; } catch { /* ignore */ }
  try { agent.frozenMessages?.clear?.(); } catch { /* ignore */ }
}

async function disarmRewoundSession(ctx, sessionId, options = {}) {
  if (!sessionId) return;
  const controller = service(ctx, "sessionController");
  const agent = getAgent(ctx, sessionId);
  // 只清 inbox。fork 出的新会话不要 cancel：abort 后再发会走官方 wakingAfterAbort，等于误唤醒。
  if (options.cancel !== false) {
    const runningAbort = agent?.phase?.kind && agent.phase.kind !== "idle" ? agent.phase.abort : null;
    if (runningAbort) {
      try { ignoreSettled(agent.cancel({ kind: "user" }, { keepInbox: true })); } catch { /* ignore */ }
    }
  }

  const ids = [];
  try {
    const log = await readSessionLog(ctx, sessionId);
    ids.push(...pendingInboxInserts(log.events));
  } catch { /* ignore */ }
  try {
    for (const message of [...(agent?.inbox?.nextTurn || []), ...(agent?.inbox?.nextStep || [])]) {
      if (message?.id) ids.push(message.id);
    }
  } catch { /* ignore */ }

  const seen = new Set();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    try {
      await controller?.updateQueue?.({
        sessionId,
        itemId: id,
        action: { kind: "remove" },
      });
    } catch { /* ignore */ }
  }
}

export function invocationSessionId(invocation) {
  return invocation?.agent?.session?.id
    || invocation?.agent?.sessionId
    || invocation?.agent?.session?.header?.id;
}

async function resolveMainSession(ctx, sessionId) {
  const headers = new Map();
  let currentId = sessionId;
  const seen = new Set();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const log = await readSessionLog(ctx, currentId);
    const header = log.header || {};
    headers.set(currentId, header);
    if (!isSubagentHeader(header) || !header.parentSession) {
      return { sessionId: currentId, log };
    }
    currentId = header.parentSession;
  }
  return { sessionId, log: await readSessionLog(ctx, sessionId) };
}

function liveSession(ctx, sessionId) {
  const store = service(ctx, "sessions");
  try {
    return store?.get?.(sessionId) || null;
  } catch {
    return null;
  }
}

async function createBlank(ctx, controller, sourceId, cwd) {
  const workspace = findWorkspace(ctx, sourceId, cwd);
  if (workspace?.id) return controller.create({ workspaceId: workspace.id });
  if (cwd) return controller.create({ cwd });
  return controller.create({});
}

function findWorkspace(ctx, sessionId, cwd) {
  const registry = service(ctx, "workspaceRegistry");
  const list = registry?.list?.() || [];
  return list.find((workspace) => (workspace?.sessionIds || []).includes(sessionId))
    || (cwd ? list.find((workspace) => workspace?.path === cwd) : undefined);
}

async function hideRewoundSource(ctx, sessionId) {
  if (!sessionId) return false;
  const registry = service(ctx, "workspaceRegistry");
  const workspaces = service(ctx, "workspaces");
  const target = typeof registry?.archiveSession === "function"
    ? registry
    : (typeof workspaces?.archiveSession === "function" ? workspaces : null);
  let hidden = false;
  if (target) {
    await target.archiveSession(sessionId, { stopActivity: true });
    hidden = true;
  }
  const listed = findWorkspace(ctx, sessionId);
  const entity = listed?.id && typeof registry?.get === "function" ? registry.get(listed.id) : null;
  if (entity && typeof entity.detachSession === "function") {
    await entity.detachSession(sessionId);
    hidden = true;
  }
  return hidden;
}

const rewindLocks = new Map();

/** 官方 fork 要求 events[atSeq].seq === atSeq（从 0 起连续）。 */
function officialForkBoundary(events, atSeq) {
  const list = asEventList(events);
  let n = Number(atSeq);
  if (!Number.isSafeInteger(n) || n < 0) return null;
  while (n >= 0) {
    if (list[n]?.seq === n) return n;
    n -= 1;
  }
  return null;
}

function prepareForkedChild(ctx, childId) {
  resetRequestSeries(ctx, childId);
  return liveSession(ctx, childId);
}

async function doRewindOneSession(ctx, controller, sessionId, options = {}) {
  if (!controller || typeof controller.fork !== "function" || typeof controller.create !== "function") {
    return { ok: false, error: "当前 dsh 没有会话回退接口" };
  }
  let log = await readSessionLog(ctx, sessionId);
  if (lastOpenTurn(log.events)) {
    try { ignoreSettled(controller.cancel?.({ sessionId })); } catch { /* ignore */ }
    log = await waitTurnClosed(ctx, sessionId);
  }
  const plan = planRewind(log.events, options.mode === "round" ? "round" : "once");
  if (!plan.ok) return plan;

  let created;
  if (plan.mode === "fork") {
    const atSeq = officialForkBoundary(log.events, plan.atSeq);
    if (atSeq == null) return { ok: false, error: "没有可回退的上一句" };
    created = await controller.fork({ sessionId, atSeq });
  } else {
    created = await createBlank(ctx, controller, sessionId, log.cwd);
  }
  const childId = created?.sessionId || (typeof created === "string" ? created : "");
  if (!childId) return { ok: false, error: "回退会话创建失败" };

  prepareForkedChild(ctx, childId);
  await disarmRewoundSession(ctx, childId, { cancel: false });
  let archived = false;
  try {
    archived = await hideRewoundSource(ctx, sessionId);
  } catch { /* 旧会话没藏住也不挡新会话重发 */ }

  const rec = rememberDraft(childId, plan.text, sessionId);
  return {
    ok: true,
    sessionId: childId,
    parentId: sessionId,
    archived,
    cleared: true,
    text: rec.text,
    cut: plan.unit || plan.mode,
    at: rec.at,
  };
}

async function rewindOneSession(ctx, controller, sessionId, options = {}) {
  const key = String(sessionId || "");
  if (!key) return doRewindOneSession(ctx, controller, sessionId, options);
  const prev = rewindLocks.get(key) || Promise.resolve();
  const next = prev.then(async () => {
    try {
      return await doRewindOneSession(ctx, controller, sessionId, options);
    } finally {
      if (rewindLocks.get(key) === next) rewindLocks.delete(key);
    }
  }, async () => {
    try {
      return await doRewindOneSession(ctx, controller, sessionId, options);
    } finally {
      if (rewindLocks.get(key) === next) rewindLocks.delete(key);
    }
  });
  rewindLocks.set(key, next);
  return next;
}

export async function analyzeRewind(ctx, sessionId) {
  if (!sessionId) return { ok: false, error: "没有当前会话" };
  try {
    const log = await readSessionLog(ctx, sessionId);
    const kind = isSubagentHeader(log.header) ? "subagent" : "main";
    const subagentIds = kind === "main" ? lastTurnSubagentIds(log.events) : [];
    return {
      ok: true,
      kind,
      sessionId,
      hasSubagents: subagentIds.length > 0,
      subagentIds,
    };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function applyRewind(ctx, sessionId, mode) {
  if (!sessionId) return { ok: false, error: "没有当前会话" };
  const controller = service(ctx, "sessionController");

  const action = mode === "round" ? "round" : "once";
  try {
    if (action === "round") {
      const target = await resolveMainSession(ctx, sessionId);
      if (sessionId !== target.sessionId) {
        try { ignoreSettled(controller.cancel?.({ sessionId })); } catch { /* ignore */ }
      }
      const preview = planRewind(target.log?.events || [], "round");
      const children = preview.ok ? lastTurnSubagentIds(target.log.events, preview.fromSeq) : [];
      const result = await rewindOneSession(ctx, controller, target.sessionId, { mode: "round" });
      if (!result.ok) return result;
      for (const childId of children) {
        if (!childId || childId === target.sessionId) continue;
        try { ignoreSettled(controller.cancel?.({ sessionId: childId })); } catch { /* ignore */ }
        try { await hideRewoundSource(ctx, childId); } catch { /* ignore */ }
      }
      return { ...result, sourceId: sessionId, mode: "round" };
    }

    const result = await rewindOneSession(ctx, controller, sessionId, { mode: "once" });
    if (!result.ok) return result;
    return { ...result, sourceId: sessionId, mode: "once" };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
