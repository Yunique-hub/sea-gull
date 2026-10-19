import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ALL_PATCHES, applyReplacementsToText, commitOverrideOnApply, hashOverride, installOverride, overrideStatePath, saveOverrideContent, seedPromptInjectAtBoot, systemFieldExtracted } from '../vendor/dsh-purge/lib/core.js';

const nativeRequest = '\t\tconst boundaryMessages = session.deriveMessages();\n' +
  '\t\tfor (const message of boundaryMessages) {\n' +
  '\t\t\tif (this.frozenMessages.has(message)) continue;\n' +
  '\t\t\tdeepFreeze(message);\n' +
  '\t\t\tthis.frozenMessages.add(message);\n' +
  '\t\t}\n' +
  '\t\tObject.freeze(boundaryMessages);\n' +
  '\t\treturn markAgentLoopRequest(Object.freeze({\n' +
  '\t\t\t...header.config,\n' +
  '\t\t\tmessages: boundaryMessages,\n' +
  '\t\t\ttoolHistory: session.toolHistory(),\n' +
  '\t\t\t...header.tools !== void 0 ? { tools: header.tools } : {},\n' +
  '\t\t\tsessionId: this.session.id,\n' +
  '\t\t\tsignal\n' +
  '\t\t}));';

test('1.1.72 preserves system messages and their ordering in the native 0.2.1 request contract', () => {
  const definition = ALL_PATCHES.find(p => p.id === 89);
  const patched = applyReplacementsToText(nativeRequest, definition);
  const build = new Function('session', 'header', 'signal', 'deepFreeze', 'markAgentLoopRequest', patched.text);
  const messages = [{ role: 'system', content: [{ type: 'text', text: 'first instruction' }] }, { role: 'user', content: 'hello' }, { role: 'system', content: [{ type: 'text', text: 'updated instruction' }] }];
  const request = build.call({ frozenMessages: new WeakSet(), session: { id: 'fixture' } }, { deriveMessages: () => messages.slice(), toolHistory: () => [] }, { config: { model: 'fixture' }, tools: ['fixture-tool'] }, null, Object.freeze, x => x);
  assert.deepEqual(request.messages, messages);
  assert.ok(request.messages.every(Object.isFrozen));
  assert.ok(Object.isFrozen(request.messages));
  assert.deepEqual(request.tools, ['fixture-tool']);
  assert.equal(applyReplacementsToText(patched.text, definition).changed, false);
});

test('custom persona survives repeated install, Apply without editor content, and startup sync', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-persona-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const persona = '用户自己的海鸥人格\n保持完整内容 {{example}}\n';
  await saveOverrideContent(home, persona);
  for (let count = 0; count < 2; count++) {
    await installOverride(home);
    seedPromptInjectAtBoot(home);
    await commitOverrideOnApply(home, null);
    assert.equal(fs.readFileSync(path.join(home, 'prompt-inject.md'), 'utf8'), persona);
  }
});

test('legacy extraction is repaired and status follows the installed file', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-contract-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const file = path.join(temp, 'dsh-agent-loop/lib/index.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const legacy = fs.readFileSync(new URL('./fixtures/dsh-purge-1172-extracted-request.txt', import.meta.url), 'utf8');
  fs.writeFileSync(file, legacy);
  assert.equal(systemFieldExtracted(temp), true);
  const result = applyReplacementsToText(legacy, ALL_PATCHES.find(p => p.id === 89));
  assert.ok(result.changed);
  assert.match(result.text, /messages: boundaryMessages/);
  assert.doesNotMatch(result.text, /nonSystemMessages/);
  fs.writeFileSync(file, result.text);
  assert.equal(systemFieldExtracted(temp), false);
});

test('startup preserves a customized persona with the ownership hash written by older releases', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-old-persona-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const persona = '海鸥旧版定制人格\n';
  fs.writeFileSync(path.join(home, 'prompt-inject.md'), persona);
  fs.mkdirSync(path.dirname(overrideStatePath(home)), { recursive: true });
  fs.writeFileSync(overrideStatePath(home), JSON.stringify({ customized: true, hash: hashOverride(persona), seedHash: 'old-plugin-default' }));
  assert.equal(seedPromptInjectAtBoot(home).action, 'kept_user_custom');
  await installOverride(home);
  assert.equal(seedPromptInjectAtBoot(home).action, 'kept_user_custom');
  assert.equal(fs.readFileSync(path.join(home, 'prompt-inject.md'), 'utf8'), persona);
});
