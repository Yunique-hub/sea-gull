import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  clearCommittedOverride,
  overrideStatus,
  rememberCommittedOverride,
} from "../vendor/dsh-purge/lib/core.js";
import { resolveInjectText } from "../vendor/dsh-purge/lib/rules.js";

function tempHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "seagull-prompt-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

test("外部替换 prompt-inject.md 后，磁盘正文优先于进程内旧 pin", (t) => {
  const home = tempHome(t);
  const file = path.join(home, "prompt-inject.md");
  fs.writeFileSync(file, "# v1\n", "utf8");
  rememberCommittedOverride(home, "# v1\n");

  fs.writeFileSync(file, "# v2\n", "utf8");
  const resolved = resolveInjectText(home);
  assert.match(resolved.text, /v2/);
  assert.equal(resolved.source, "prompt");
});

test("clearCommittedOverride 后仍从磁盘取正文", (t) => {
  const home = tempHome(t);
  const file = path.join(home, "prompt-inject.md");
  fs.writeFileSync(file, "# disk-only\n", "utf8");
  rememberCommittedOverride(home, "# stale-pin\n");
  clearCommittedOverride(home);
  assert.match(resolveInjectText(home).text, /disk-only/);
});

test("overrideStatus 读取磁盘：custom / missing", async (t) => {
  const home = tempHome(t);
  const file = path.join(home, "prompt-inject.md");
  fs.writeFileSync(file, "# custom persona\n", "utf8");
  assert.equal(await overrideStatus(home), "custom");

  fs.writeFileSync(file, "", "utf8");
  assert.equal(await overrideStatus(home), "missing");
});