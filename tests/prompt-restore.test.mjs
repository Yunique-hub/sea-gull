import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultOverrideText, installOverride } from '../vendor/dsh-purge/lib/core.js';

function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-restore-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const prompt = path.join(home, 'prompt-inject.md');
  fs.writeFileSync(prompt, 'user customized persona');
  return { home, prompt };
}

test('restore stops before replacing the persona if its backup fails', async (t) => {
  const { home, prompt } = fixture(t);
  t.mock.method(fs.promises, 'copyFile', async () => { throw new Error('backup unavailable'); });
  await assert.rejects(installOverride(home, true), /backup unavailable/);
  assert.equal(fs.readFileSync(prompt, 'utf8'), 'user customized persona');
  assert.equal(fs.existsSync(path.join(home, 'dsh-purge/override-state.json')), false);
});

test('repeated restores keep separate backups even within the same timestamp', async (t) => {
  const { home, prompt } = fixture(t);
  t.mock.timers.enable({ apis: ['Date'], now: 1792886400000 });
  await installOverride(home, true);
  fs.writeFileSync(prompt, 'second customized persona');
  await installOverride(home, true);
  const backups = fs.readdirSync(home).filter(name => name.startsWith('prompt-inject.md.bak-'));
  assert.equal(backups.length, 2);
  assert.deepEqual(backups.map(name => fs.readFileSync(path.join(home, name), 'utf8')).sort(),
    ['second customized persona', 'user customized persona']);
  assert.equal(fs.readFileSync(prompt, 'utf8'), defaultOverrideText());
});
