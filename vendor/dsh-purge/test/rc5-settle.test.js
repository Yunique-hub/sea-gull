import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PATCHES,
  filePatchOutcome,
  rollupPatchStatus,
} from "../lib/core.js";

const patch = (id) => ALL_PATCHES.find((item) => item.id === id);

test("partial rc.5 layout files do not override a file where the patch applied", () => {
  assert.equal(rollupPatchStatus({
    applied: 1,
    already: 0,
    missing: 0,
    notFound: 0,
    drifted: 1,
    keyCount: 2,
    partialFiles: true,
  }), "applied");
  assert.equal(rollupPatchStatus({
    applied: 1,
    already: 0,
    missing: 0,
    notFound: 0,
    drifted: 1,
    keyCount: 2,
    partialFiles: false,
  }), "drifted");
});

test("rc.5 replacement markers settle fs schema and steer delivery", () => {
  assert.equal(filePatchOutcome(
    "one sentence describing why this file operation needs the wider access.",
    patch(36),
    "index.js",
  ), "applied");
  assert.equal(filePatchOutcome(
    "if (request.mode) {} // [dsh-purge-85] steer stays interrupt",
    patch(85),
    "index.js",
  ), "applied");
});

test("absence of the retired hung-prompt injection is settled", () => {
  assert.equal(filePatchOutcome(
    "const assembly = await prompt.assemble(context);",
    patch(88),
    "index.js",
  ), "applied");
});
