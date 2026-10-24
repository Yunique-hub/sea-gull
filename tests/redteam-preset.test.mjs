import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readPresetDefinition, preparePresetDefinitions } from '../vendor/dsh-purge/lib/redteam/preset-composition.js';
import { isRedteamPresetId } from '../vendor/dsh-purge/lib/identity.js';
import { apply as mountRedteam } from '../vendor/dsh-purge/lib/redteam/index.js';

const presetDir = fileURLToPath(new URL('./fixtures/redteam-legacy/', import.meta.url));
const flatten = (rows) => rows.flatMap((row) => row.group ? [row, ...flatten(row.config)] : [row]);

test('legacy redteam filtering becomes a separate executor preset without losing parent tools or custom content', () => {
  const original = readPresetDefinition('redteam', presetDir);
  original.plugins.find((row) => row.id === 'persona').config.personaPrefix = 'user customization';
  const before = JSON.stringify(original);
  const [executor, main] = preparePresetDefinitions(original);
  const parentRows = flatten(main.plugins), childRows = flatten(executor.plugins);
  assert.equal(main.id, 'redteam');
  assert.equal(executor.id, 'redteam-executor');
  assert.equal(JSON.stringify(original), before);
  for (const id of ['tool-subagent-fork', 'tool-workflow', 'tool-ralph']) {
    assert.ok(parentRows.some((row) => row.id === id));
    assert.ok(!childRows.some((row) => row.id === id));
  }
  for (const rows of [parentRows, childRows]) {
    const spawn = rows.find((row) => row.id === 'tool-subagent').config;
    assert.equal(spawn.agentPreset, 'redteam-executor');
    assert.equal(spawn.maxDepth, 1);
    assert.equal(spawn.toolFilter, undefined);
    assert.equal(rows.find((row) => row.id === 'persona').config.personaPrefix, 'user customization');
    for (const id of ['redteam-tools', 'anchor-gate', 'skill-filesystem', 'tool-fs', 'tool-bash', 'tool-subagent-control']) assert.ok(rows.some((row) => row.id === id));
  }
  assert.deepEqual(preparePresetDefinitions(main), [main]);
});

test('an unsupported custom filter reports a migration diagnostic instead of silently broadening child tools', () => {
  const definition = readPresetDefinition('redteam', presetDir);
  flatten(definition.plugins).find((row) => row.id === 'tool-subagent').config.toolFilter.deny.push('custom_tool');
  assert.throws(() => preparePresetDefinitions(definition), /custom toolFilter cannot be migrated/);
});

test('redteam executors retain role prompt identification', () => {
  assert.equal(isRedteamPresetId('redteam-executor'), true);
  assert.equal(isRedteamPresetId('standard'), false);
  assert.ok(path.isAbsolute(presetDir));
});

test('current upstream preset needs no legacy executor migration', () => {
  const current = fileURLToPath(new URL('../vendor/dsh-purge/presets/redteam/', import.meta.url));
  const definition = readPresetDefinition('redteam', current);
  assert.deepEqual(preparePresetDefinitions(definition), [definition]);
  assert.ok(flatten(definition.plugins).every(row => !row.config?.toolFilter));
});

for (const scenario of ['register-failed', 'executor-broken']) {
  test('preset declaration reports ' + scenario + ' and cleans up registered companions', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-preset-'));
    const previous = process.env.DSH_HOME;
    const released = [], registered = [];
    let cleanup;
    process.env.DSH_HOME = temp;
    try {
      const legacyDir = path.join(temp, '.agent-presets/redteam');
      fs.mkdirSync(legacyDir, { recursive: true });
      for (const name of ['agent.cordis.yml', 'preset.yml']) fs.copyFileSync(path.join(presetDir, name), path.join(legacyDir, name));
      const registry = {
        async register(definition) {
          registered.push(definition.id);
          if (scenario === 'register-failed' && definition.id === 'redteam') throw new Error('fixture registration failed');
          return async () => { released.push(definition.id); };
        },
        async list() { return [{ id: 'redteam' }, { id: 'redteam-executor', broken: 'fixture executor activation failed' }]; },
      };
      mountRedteam({ agentPresets: registry, effect: (fn) => { cleanup = fn(); }, provide() {} });
      const statusFile = path.join(temp, 'redteam/preset-declare.json');
      let status;
      for (let count = 0; count < 50; count++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
        if (['register-failed', 'registered-broken'].includes(status.phase)) break;
      }
      assert.equal(status.ok, false);
      assert.deepEqual(registered, ['redteam-executor', 'redteam']);
      if (scenario === 'register-failed') {
        assert.equal(status.phase, 'register-failed');
        assert.deepEqual(released, ['redteam-executor']);
      } else {
        assert.equal(status.phase, 'registered-broken');
        assert.match(status.broken, /executor activation failed/);
        cleanup();
        cleanup = undefined;
        await new Promise((resolve) => setTimeout(resolve, 10));
        assert.deepEqual(released, ['redteam', 'redteam-executor']);
      }
    } finally {
      cleanup?.();
      if (previous === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = previous;
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
}
