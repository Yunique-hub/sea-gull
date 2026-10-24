import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as core from '../vendor/dsh-purge/lib/core.js';

const source = fs.readFileSync(new URL('../vendor/dsh-purge/lib/index.js', import.meta.url), 'utf8');
const start = source.lastIndexOf('registerPluginRoute({', source.indexOf('path: "/dsh-purge/override"'));
const end = source.indexOf('}, "dsh-purge: override");', start) + '}, "dsh-purge: override");'.length;
const register = new Function('registerPluginRoute', 'core', 'readJsonBody', 'sendJson', 'refreshHungOperator', 'injectSnapshot', 'rejectIfNeedPrompt', source.slice(start, end));

test('desktop reset request backs up the user persona through the registered HTTP handler', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-reset-route-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const prompt = path.join(home, 'prompt-inject.md');
  fs.writeFileSync(prompt, 'user persona before desktop reset');
  let handler, response;
  register(route => { handler = route.handler; }, { ...core, findDshHome: () => home, systemFieldExtracted: () => false },
    async () => ({ content: core.defaultOverrideText(), resetDefault: true }),
    (_, status, body) => { response = { status, body }; },
    () => ({ text: fs.readFileSync(prompt, 'utf8') }), () => ({}), () => null);
  await handler({ method: 'POST' }, {});
  assert.equal(response.status, 200);
  assert.equal(response.body.content, core.defaultOverrideText());
  assert.equal(response.body.defaultContent, core.defaultOverrideText());
  const backups = fs.readdirSync(home).filter(name => name.startsWith('prompt-inject.md.bak-'));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(home, backups[0]), 'utf8'), 'user persona before desktop reset');
});

for (const failBackup of [false, true]) {
  test(failBackup ? 'desktop reset reports backup failure without changing the user persona' : 'ordinary prompt saves keep custom content instead of resetting to the bundled persona', async (t) => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-override-route-'));
    t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const prompt = path.join(home, 'prompt-inject.md');
    fs.writeFileSync(prompt, 'original custom persona');
    if (failBackup) t.mock.method(fs.promises, 'copyFile', async () => { throw new Error('backup unavailable'); });
    let handler, response;
    register(route => { handler = route.handler; }, { ...core, findDshHome: () => home, systemFieldExtracted: () => false },
      async () => ({ content: 'edited custom persona', ...(failBackup ? { resetDefault: true } : {}) }),
      (_, status, body) => { response = { status, body }; },
      () => ({ text: fs.readFileSync(prompt, 'utf8') }), () => ({}), () => null);
    await handler({ method: 'POST' }, {});
    assert.equal(response.status, failBackup ? 500 : 200);
    assert.equal(fs.readFileSync(prompt, 'utf8'), failBackup ? 'original custom persona' : 'edited custom persona');
    assert.equal(fs.readdirSync(home).filter(name => name.startsWith('prompt-inject.md.bak-')).length, 0);
    if (failBackup) assert.match(response.body.error, /backup unavailable/);
    else assert.equal(response.body.customized, true);
  });
}
