import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ensureProfileBodyInsert, ensureAllProfileInstall } from '../vendor/dsh-purge/lib/profile-insert.js';

test('managed bundle body does not gain a second profile insert', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-1182-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const plugin = path.join(dir, 'node_modules/dsh-purge');
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(path.join(plugin, 'package.json'), JSON.stringify({ seagull: { updateManaged: true } }));
  fs.copyFileSync(new URL('../vendor/dsh-purge/cordis.patch.yml', import.meta.url), path.join(plugin, 'cordis.patch.yml'));
  const profile = path.join(dir, 'cordis.patch.yml');
  const original = '- id: ui-conversation\n  config:\n    busyEnter: steer\n';
  fs.writeFileSync(profile, original);
  assert.equal(ensureProfileBodyInsert(dir).wrote, false);
  assert.equal(fs.readFileSync(profile, 'utf8'), original);
  fs.writeFileSync(path.join(plugin, 'cordis.patch.yml'), '- id: dsh-purge\n');
  assert.equal(ensureProfileBodyInsert(dir).wrote, true);
  assert.equal(ensureProfileBodyInsert(dir).wrote, false);
});

test('startup healing with an explicit profile preserves other profiles', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-profiles-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  for (const name of ['desktop', 'other']) {
    const dir = path.join(home, 'profiles', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ dsh: { profile: { bundles: ['dsh-purge'] } } }));
  }
  const result = ensureAllProfileInstall(home, 'desktop');
  assert.equal(result.length, 1);
  assert.equal(fs.existsSync(path.join(home, 'profiles/desktop/cordis.patch.yml')), true);
  assert.equal(fs.existsSync(path.join(home, 'profiles/other/cordis.patch.yml')), false);
  assert.equal(fs.existsSync(path.join(home, 'profiles/other/pnpm-workspace.yaml')), false);
});
