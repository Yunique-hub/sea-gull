import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isInactiveContextError, settleDelayMs, settleMayRestart, settleMayReapply, applyShouldRestart,
} from "../lib/settle-policy.js";

test("isInactiveContextError 识别失效上下文错误", () => {
  assert.equal(isInactiveContextError({ code: "INACTIVE_EFFECT" }), true);
  assert.equal(isInactiveContextError(new Error("inactive context")), true);
  assert.equal(isInactiveContextError(null), false);
  assert.equal(isInactiveContextError({}), false);
});

test("settleDelayMs 桌面有延迟、网页无", () => {
  assert.equal(settleDelayMs("desktop"), 4000);
  assert.equal(settleDelayMs("web"), 0);
});

test("settleMayRestart 桌面或密封包不重启", () => {
  assert.equal(settleMayRestart({ surface: "desktop" }), false);
  assert.equal(settleMayRestart({ surface: "web" }), true);
  assert.equal(settleMayRestart({ surface: "web", sealed: true }), false);
});

test("settleMayReapply 只有桌面密封包禁止", () => {
  assert.equal(settleMayReapply({ surface: "desktop", sealed: true }), false);
  assert.equal(settleMayReapply({ surface: "desktop" }), true);
  assert.equal(settleMayReapply({ surface: "web" }), true);
});

test("applyShouldRestart 应用后重启判定", () => {
  assert.equal(applyShouldRestart({ sealed: true }), true);
  assert.equal(applyShouldRestart({ complete: true }), true);
  assert.equal(applyShouldRestart({ promptReady: true }), true);
  assert.equal(applyShouldRestart({ appliedCount: 2 }), true);
  assert.equal(applyShouldRestart({}), false);
});
