/**
 * Apply / 还原 / 卸载的内存进度。
 * 只给 /dsh-purge/status 轮询用，不落盘，也不进 gatherState。
 */
const IDLE = Object.freeze({
  active: false,
  kind: "apply",
  stage: "idle",
  detail: "",
  applied: 0,
  total: 0,
  error: "",
  startedAt: 0,
  updatedAt: 0,
});

let current = { ...IDLE };

export function getApplyProgress() {
  return { ...current };
}

export function beginJob(kind = "apply", stage = "home") {
  const now = Date.now();
  current = {
    active: true,
    kind,
    stage,
    detail: "",
    applied: 0,
    total: 0,
    error: "",
    startedAt: now,
    updatedAt: now,
  };
  return getApplyProgress();
}

export function beginApply(stage = "home") {
  return beginJob("apply", stage);
}

export function setApplyProgress(patch = {}) {
  current = {
    ...current,
    ...patch,
    active: patch.active == null ? true : Boolean(patch.active),
    updatedAt: Date.now(),
  };
  return getApplyProgress();
}

export function endApply(patch = {}) {
  current = {
    ...current,
    ...patch,
    active: false,
    updatedAt: Date.now(),
  };
  return getApplyProgress();
}

export function resetApplyProgress() {
  current = { ...IDLE, updatedAt: Date.now() };
  return getApplyProgress();
}
