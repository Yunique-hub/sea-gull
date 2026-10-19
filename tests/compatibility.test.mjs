import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { ALL_PATCHES, applyReplacementsToText, targetFiles } from '../vendor/dsh-purge/lib/core.js';
import { CWD_ONLY_SUFFIX, rewritePromptAssembly } from '../vendor/dsh-purge/lib/identity.js';
import { patchOfficialCliCmdText, repairOfficialCliAfterUnpack } from '../vendor/dsh-purge/lib/desktop.js';

const patch = (id, text, filename = 'index.js') =>
  applyReplacementsToText(text, ALL_PATCHES.find((entry) => entry.id === id), filename);

test('0.2.1 locates the extracted Web context package', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-compat-'));
  try {
    const base = path.join(temp, 'node_modules/@deepseek-ai');
    const filename = path.join(base, 'dsh-harness-dev-context/lib/index.js');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, 'export {};');
    assert.equal(targetFiles(base, temp)['harness-dev-context'], filename);
    assert.ok(ALL_PATCHES.find((entry) => entry.id === 32).file.includes('harness-dev-context'));
    assert.ok(ALL_PATCHES.find((entry) => entry.id === 53).file.includes('harness-dev-context'));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('0.2.1 Web guidance changes without rewriting the legacy Session matcher', () => {
  const guidance = 'Do not start a replacement server unless the user asks; if one is needed, use a managed background job and verify its exact URL.';
  const source = 'const WEB_SURFACE_PROMPT = `You are interacting with the user through the DeepSeek Harness Web GUI whose URL the runtime context names. ' + guidance + '`;\n' +
    'const LEGACY_WEB_SURFACE = { suffix: ' + JSON.stringify(guidance) + ' };';
  const identity = patch(32, source).text;
  const result = patch(53, identity);
  assert.ok(result.changed);
  assert.match(result.text, /Local web GUI: see the runtime context\./);
  assert.equal(result.text.split(guidance).length - 1, 1);
  assert.equal(patch(32, result.text).changed, false);
  assert.equal(patch(53, result.text).changed, false);
});

test('0.2.1 advertised Web URL keeps a neutral description', () => {
  const source = 'description: "Advertised URL of the DeepSeek Harness Web GUI serving this session."';
  const result = patch(32, source);
  assert.ok(result.changed);
  assert.doesNotMatch(result.text, /DeepSeek Harness/);
});

const assemblyTail = '\t\tconst transformed = await this.ctx.waterfall(scopeTarget(this, scope), "system-prompt/assemble", assembly, context, () => Promise.resolve(assembly));\n' +
  '\t\tif (completeSection === void 0 && !runtimeContextSuppressed) return transformed;\n' +
  '\t\tconst requiredContexts = new Set([...contextByName.values()].filter((entry) => entry.required === true).map((entry) => entry.name));\n' +
  '\t\treturn {\n' +
  '\t\t\t...transformed,\n' +
  '\t\t\tsections: completeSection === void 0 ? transformed.sections : [completeSection],\n' +
  '\t\t\tcontexts: runtimeContextSuppressed ? transformed.contexts.filter((entry) => requiredContexts.has(entry.name)) : transformed.contexts\n' +
  '\t\t};';

test('0.2.1 complete prompts retain custom sections and required runtime contexts', async () => {
  const result = patch(40, assemblyTail);
  assert.ok(result.changed);
  assert.equal(patch(40, result.text).changed, false);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const assemble = new AsyncFunction('scopeTarget', 'scope', 'assembly', 'context', 'completeSection', 'runtimeContextSuppressed', 'contextByName', result.text);
  const custom = { name: 'dsh-purge-test', text: 'custom section', interpolate: false };
  const instructions = { name: 'agent:instructions', text: 'workspace instructions' };
  const complete = { name: 'complete', text: 'agent preset' };
  const assembly = { sections: [complete, custom, instructions], contexts: [{ name: 'required' }, { name: 'optional' }], tools: ['tool'], variables: { cwd: '/workspace' } };
  const contextByName = new Map([['required', { name: 'required', required: true }], ['optional', { name: 'optional' }]]);
  const owner = { ctx: { waterfall: async () => assembly } };
  const suppressed = await assemble.call(owner, () => null, null, assembly, {}, complete, true, contextByName);
  assert.deepEqual(suppressed.sections, [custom, complete, instructions]);
  assert.deepEqual(suppressed.contexts, [{ name: 'required' }]);
  assert.deepEqual(suppressed.tools, assembly.tools);
  assert.deepEqual(suppressed.variables, assembly.variables);
  const ordinary = await assemble.call(owner, () => null, null, assembly, {}, undefined, false, contextByName);
  assert.deepEqual(ordinary.sections, [custom, complete, instructions]);
  assert.deepEqual(ordinary.contexts, assembly.contexts);
});

test('0.2.1 rewind rebuilds the visible conversation window', () => {
  const source = '\t\t\tappend(record) {\n' +
    '\t\t\t\tconst event = record.event;\n' +
    '\t\t\t\tif (this.inputs.has(event.seq)) return "none";\n' +
    '\t\t\t\tif (this.revised.size > 0) this.revised.clear();\n' +
    '\t\t\t\tthis.inputs.set(event.seq, record);\n' +
    '\t\t\t\treturn "normal";\n' +
    '\t\t\t}';
  const result = patch(77, source);
  assert.ok(result.changed);
  assert.equal(patch(77, result.text).changed, false);
  const append = new Function('isRewindMarker', 'return ({' + result.text + '}).append;')((event) => event.data?.id === 'rewind-test');
  const previous = { event: { seq: 1 } };
  const owner = { inputs: new Map([[1, previous]]), revised: new Set(), hasMore: true, replaceWindow: (entries, hasMore) => ({ entries, hasMore }) };
  const record = { event: { seq: 2, data: { id: 'rewind-test' } } };
  assert.deepEqual(append.call(owner, record), { entries: [previous, record], hasMore: true });
  assert.equal(append.call(owner, { event: { seq: 3 } }), 'normal');
  assert.equal(append.call(owner, previous), 'none');
});

test('0.2.1 working directory context does not require the removed cwd variable', () => {
  const context = { name: 'working-directory:current', text: 'Current working directory: "C:/workspace".' };
  const assembly = { sections: [], contexts: [context], tools: [], variables: { provider: 'example', model: 'example' } };
  const rewritten = rewritePromptAssembly(assembly, 'custom persona', { capabilityProtocol: false });
  assert.ok(rewritten.sections.every((section) => !section.text.includes('{{cwd}}')));
  assert.deepEqual(rewritten.contexts, [context]);
  assert.deepEqual(assembly.sections, []);
});

test('0.2.0 working directory interpolation remains available', () => {
  const rewritten = rewritePromptAssembly({ sections: [], contexts: [], tools: [], variables: { cwd: 'C:/workspace' } }, 'custom persona', { capabilityProtocol: false });
  assert.ok(rewritten.sections.some((section) => section.text === CWD_ONLY_SUFFIX));
});

const officialCmd = fs.readFileSync(new URL('./fixtures/dsh-0.2.1.cmd', import.meta.url), 'utf8');

test('Windows CLI repair recognizes ordinary backslashes and is idempotent', () => {
  const result = patchOfficialCliCmdText(officialCmd);
  assert.ok(result.changed);
  assert.ok(result.text.includes(path.win32.join('app', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')));
  assert.match(result.text, /--expose-internals "%entry%" %\*/);
  assert.equal(patchOfficialCliCmdText(result.text).changed, false);
});

test('Windows CLI repair completes its backup before replacing the launcher', { skip: process.platform !== 'win32' }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-cli-'));
  try {
    const app = path.join(temp, 'Harness Space');
    const shim = path.join(app, 'resources/runtime/cli/bin/dsh.cmd');
    const entry = path.join(app, 'resources/app/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js');
    fs.mkdirSync(path.dirname(shim), { recursive: true });
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.copyFileSync(process.execPath, path.join(app, 'DeepSeek Harness.exe'));
    fs.writeFileSync(entry, 'console.log("fixture-host-0.2.1", process.argv[2]);');
    fs.writeFileSync(shim, officialCmd);
    const report = repairOfficialCliAfterUnpack(path.join(app, 'DeepSeek Harness.exe'));
    assert.equal(report.shims.find((entry) => entry.path === shim).status, 'patched');
    assert.equal(fs.readFileSync(shim + '.dsh-purge.bak', 'utf8'), officialCmd);
    const result = spawnSync('call "' + shim + '" --version', { shell: process.env.ComSpec, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /fixture-host-0\.2\.1 --version/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
