import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PATCHES,
  applyReplacementsToText,
  filePatchOutcome,
} from "../lib/core.js";

const patch = (id) => ALL_PATCHES.find((item) => item.id === id);

function apply(id, text, file = "index.js") {
  const result = applyReplacementsToText(text, patch(id), file);
  assert.equal(result.changed, true, `patch #${id} should change the 0.2.2 fixture`);
  assert.equal(filePatchOutcome(result.text, patch(id), file), "applied");
  return result.text;
}

test("0.2.2 typed sandbox escalation still settles the three bypass patches", () => {
  let source = [
    'if (!(WIDER_MODES[effectiveMode] ?? []).includes(mode)) throw new SandboxEscalationError(`sandbox escalation to "${mode}" is not strictly wider than this call\'s current "${effectiveMode}" mode`, "SANDBOX_ESCALATION_INVALID_ARGUMENT");',
    '\tif (approval.approver === void 0) throw new SandboxEscalationError(`sandbox escalation to "${mode}" requires approval, but no approval service is composed`, "SANDBOX_ESCALATION_UNAVAILABLE");',
    '\tif (approval.agent === void 0) throw new SandboxEscalationError(`sandbox escalation to "${mode}" requires approval, but the call has no agent to route it through`, "SANDBOX_ESCALATION_UNAVAILABLE");',
    'const outcome = await approval.approver.request({',
    '\t\tagent: approval.agent,',
    '\t\ttoolName: approval.toolName,',
    '\t\tcallId: approval.callId,',
    '\t\treason: `escalate sandbox to ${mode}: ${justification}`,',
    '\t\tdisplayReason: escalationDisplayReason(mode, justification),',
    '\t\t...approval.signal ? { signal: approval.signal } : {}',
    '\t});',
    'switch (outcome) {',
    '\t\tcase "allowed-once": return mode;',
    '\t\tcase "rejected": throw new SandboxEscalationError(`the user rejected escalating this ${subject} to "${mode}"; it stays denied, so stop and explain instead of working around it`, "SANDBOX_ESCALATION_REJECTED");',
    '\t\tcase "cancelled":',
    '\t\t\tapproval.signal?.throwIfAborted();',
    '\t\t\tthrow new SandboxEscalationError(`approval for escalating to "${mode}" was cancelled`, "SANDBOX_ESCALATION_CANCELLED");',
    '\t\tcase "unavailable": throw new SandboxEscalationError(`sandbox escalation to "${mode}" requires approval, but no approval channel is available`, "SANDBOX_ESCALATION_UNAVAILABLE");',
    '\t\tdefault: return assertNever(outcome, "EscalationOutcome");',
    '\t}',
  ].join("\n");
  for (const id of [13, 14, 35]) source = apply(id, source);
  assert.match(source, /escalationDisplayReason/);
  assert.match(source, /escalation never rejected/);
});
test("0.2.2 prompt and agent-loop layouts preserve tools and prepare before assemble", () => {
  const prompt = [
    '\t\tconst transformed = await this.ctx.waterfall(scopeTarget(this, scope), "system-prompt/assemble", assembly, context, () => Promise.resolve(assembly));',
    '\t\tif (completeSection === void 0 && !runtimeContextSuppressed) return {',
    '\t\t\t...transformed,',
    '\t\t\ttools',
    '\t\t};',
    '\t\tconst requiredContexts = new Set([...contextByName.values()].filter((entry) => entry.required === true).map((entry) => entry.name));',
    '\t\treturn {',
    '\t\t\t...transformed,',
    '\t\t\ttools,',
    '\t\t\tsections: completeSection === void 0 ? transformed.sections : [completeSection],',
    '\t\t\tcontexts: runtimeContextSuppressed ? transformed.contexts.filter((entry) => requiredContexts.has(entry.name)) : transformed.contexts',
    '\t\t};',
  ].join("\n");
  const promptOut = apply(40, prompt);
  assert.match(promptOut, /\.\.\.transformed,\n\t\t\ttools,/);
  assert.match(promptOut, /fold-complete inject first/);

  let loop = [
    '\t\ttry {',
    '\t\t\tconst assembly = await this.loopCtx.systemPrompt.assemble({',
    '\t\t\t\t...assembleContextFor(this, signal),',
    '\t\t\t\tmodelSelection: selection,',
    '\t\t\t\ttoolSet',
    '\t\t\t});',
    '\t\t\t\tif (turnEnds && decision.messages.length === 0) break;',
    '\t\t\t\t\tif (phase.step === 0 && decision.messages.length === 0) {',
    '\t\t\t\t\t\tturnEnds = { kind: "completed" };',
  ].join("\n");
  loop = apply(74, loop);
  loop = apply(67, loop);
  assert.match(loop, /prepare assemble before this step/);
  assert.match(loop, /decision\.messages\?\.length/);
});

test("0.2.2 compact conversation and skill clients accept their bundle variants", () => {
  let conversation = "var ConversationNodeAssembler=class{replaceWindow(entries,hasMore){this.contexts.clear()}append(record){const event=record.event;if(this.inputs.has(event.seq))return`none`;this.inputs.set(event.seq,record)}}";
  conversation = apply(56, conversation, "client.js");
  conversation = apply(77, conversation, "client.js");
  assert.match(conversation, /entries=rewindVisibleEntries\(entries\)/);
  assert.match(conversation, /rewind drops sent messages/);

  const skill = apply(94, 'ctx.remote.$on(`plugin-manager/changed`,clearAll);', "client.js");
  assert.match(skill, /skills\/change/);
});

test("0.2.2 split tool pipeline and PTC executor retain fail-open behavior", () => {
  const pipeline = [
    '\t\tif (approval === void 0) return {',
    '\t\t\tdecision: approvalDenial(ask.reason ?? `tool "${exec.name}" requires approval (not yet supported)`, APPROVAL_UNAVAILABLE),',
    '\t\t\tapprovalCancelled: false',
    '\t\t};',
    '\t\tif (exec.agent === void 0) return {',
    '\t\t\tdecision: approvalDenial(`tool "${exec.name}" requires approval, but the call has no agent to route it through`, APPROVAL_UNAVAILABLE),',
    '\t\t\tapprovalCancelled: false',
    '\t\t};',
    '\t\t\tcase "unavailable": return {',
    '\t\t\t\tdecision: approvalDenial(`tool "${exec.name}" requires approval, but no approval channel is available`, APPROVAL_UNAVAILABLE),',
    '\t\t\t\tapprovalCancelled: false',
    '\t\t\t};',
  ].join("\n");
  const pipelineOut = apply(62, pipeline, "pipeline.js");
  assert.match(pipelineOut, /no approval agent → allow/);

  const ptc = [
    "Wider sandbox mode for this complete program execution; requires justification and approval.",
    "Reason this complete program needs wider access, shown to the user for approval. Use the language of the user’s current request.",
    " A sandbox escalation approves this complete program for one execution only. Nested tools retain their own policies and approvals. Request wider access only after evidence of a denial. Earlier effects may already have completed: inspect them before explicitly retrying. Programs are never replayed automatically.",
  ].join("\n");
  const ptcOut = apply(60, ptc, "ptc.js");
  assert.doesNotMatch(ptcOut, /requires justification and approval/);
});

test("0.2.2 retired deliverable prompt and new shell/client anchors settle", () => {
  assert.equal(filePatchOutcome(
    'const CHANGED_FILES_PATH = "/api/changes.summary";',
    patch(54),
    "index.js",
  ), "applied");

  const shell = apply(82, [
    'import { REMOTE_STREAM_MUX_PATH, parseRemoteStreamServerMessage } from "@deepseek-ai/dsh-api-gateway/stream-protocol";',
    "//#region ../../node_modules/.pnpm/mime@4.1.1/node_modules/mime/dist/types/other.js",
  ].join("\n"), "main.js");
  assert.match(shell, /process\.env\.DSH_PROFILE = "desktop"/);
});
