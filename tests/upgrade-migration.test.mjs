import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ALL_PATCHES, applyReplacementsToText } from '../vendor/dsh-purge/lib/core.js';
import { clearOwnedSelectedDefault } from '../vendor/dsh-purge/lib/preset-default.js';

const patch = ALL_PATCHES.find(row => row.id === 40);
const legacy = fs.readFileSync(new URL('./fixtures/dsh-0.2.1-complete-legacy.txt', import.meta.url), 'utf8');

test('complete-prompt upgrade migrates the deployed 0.2.1 assembly and preserves waterfall persona changes', async () => {
  const result = applyReplacementsToText(legacy, patch);
  assert.equal(result.changed, true);
  assert.match(result.text, /fold-complete inject first/);
  assert.equal(applyReplacementsToText(result.text, patch).changed, false);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const assemble = new AsyncFunction('scopeTarget', 'scope', 'assembly', 'context', 'completeSection', 'runtimeContextSuppressed', 'contextByName', result.text);
  const before = { name: 'persona', text: 'old persona' };
  const after = { name: 'persona', text: 'custom persona after waterfall' };
  const instructions = { name: 'agent:instructions', text: 'workspace' };
  const assembly = { sections: [instructions, after], contexts: [{ name: 'required' }, { name: 'optional' }] };
  const value = await assemble.call({ ctx: { waterfall: async () => assembly } }, () => null, null, assembly, {}, before, true, new Map([['required', { name: 'required', required: true }]]));
  assert.deepEqual(value.sections, [after, instructions]);
  assert.deepEqual(value.contexts, [{ name: 'required' }]);
});

test('complete-prompt upgrade also migrates the previous four-argument required-contexts order', () => {
  const current = applyReplacementsToText(legacy, patch).text;
  const previous = current.replaceAll('[...dshPurgeSections, ...dshPurgeRest]', '[...dshPurgeRest, ...dshPurgeSections]').replaceAll('fold-complete inject first', 'inject last after closer').replace('[...purge, base, ...tail]', '[...tail, base, ...purge]');
  const result = applyReplacementsToText(previous, patch);
  assert.equal(result.changed, true);
  assert.equal(result.text, current);
});

test('uninstall only repairs exact owned preset values without editing comments or unrelated text', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-preset-cleanup-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const file = path.join(home, 'profiles/desktop/cordis.patch.yml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const unchanged = ['selectedDefault: redteam-custom', 'notes: "example selectedDefault: redteam"', '# selectedDefault: redteam', 'notes: |', '  selectedDefault: redteam', 'selectedDefault: custom-redteam'];
  const owned = ['selectedDefault: redteam', '  selectedDefault: "redteam" # owned', "  'selectedDefault': 'plugin/redteam-executor'"];
  fs.writeFileSync(file, [...unchanged, ...owned].join('\n') + '\n');
  assert.equal(clearOwnedSelectedDefault({ dshHome: home }).files.length, 1);
  const result = fs.readFileSync(file, 'utf8');
  assert.ok(result.startsWith(unchanged.join('\n') + '\n'));
  assert.ok(result.endsWith('selectedDefault: standard\n  selectedDefault: "standard" # owned\n  \'selectedDefault\': \'standard\'\n'));
  assert.equal(clearOwnedSelectedDefault({ dshHome: home }).files.length, 0);
});
