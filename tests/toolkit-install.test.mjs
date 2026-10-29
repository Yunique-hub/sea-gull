import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { installToolkit, toolkitDirectory } from '../vendor/dsh-purge/lib/redteam/tool-installer.js';
import { TOOL_CATALOG, savePlatformConfig, loadPlatformConfig } from '../vendor/dsh-purge/lib/redteam/platform-config.js';
import { resolvePython } from './python-exec.mjs';
const python = resolvePython();
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-toolkit-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'config'), dir = path.join(base, 'chosen tools');
  fs.mkdirSync(dir);
  const tools = {};
  for (const tool of TOOL_CATALOG.filter(t => t.id !== 'gogo')) {
    const entry = path.join(dir, tool.names[0]); fs.writeFileSync(entry, 'existing tool'); fs.chmodSync(entry, 0o755); tools[tool.id] = entry;
  }
  savePlatformConfig({ tools, notes: 'preserve notes', env: { FOFA_KEY: 'fixture' } }, root);
  const body = Buffer.from('fixture binary'), sha256 = createHash('sha256').update(body).digest('hex');
  const releases = { gogo: { version: 'v2.15.0', assets: { 'win32-x64': { url: 'https://github.com/chainreactors/gogo/releases/download/v2.15.0/gogo_windows_amd64.exe', sha256, size: body.length } } } };
  return { root, dir, body, releases };
}
test('toolkit installs into selected directory, preserves settings and retries without downloading again', async t => {
  const f = fixture(t); let calls = 0;
  const options = { releases: f.releases, platform: 'win32', arch: 'x64', fetch: async () => { calls++; return new Response(f.body); } };
  const result = await installToolkit(f.dir, f.root, options);
  assert.equal(result.state, 'complete', JSON.stringify(result)); assert.equal(calls, 1);
  const cfg = loadPlatformConfig(f.root); assert.equal(cfg.toolkitDir, f.dir); assert.equal(cfg.notes, 'preserve notes'); assert.equal(cfg.env.FOFA_KEY, 'fixture');
  assert.ok(cfg.tools.gogo.startsWith(f.dir)); assert.deepEqual(fs.readFileSync(cfg.tools.gogo), f.body);
  await installToolkit(f.dir, f.root, options); assert.equal(calls, 1);
  assert.ok(fs.readdirSync(f.root).some(n => n.startsWith('config.json.bak-')));
});
test('corrupt official download is rejected, leaves existing files and cleans only its own staging', async t => {
  const f = fixture(t);
  const r = await installToolkit(f.dir, f.root, { releases: f.releases, platform: 'win32', arch: 'x64', fetch: async () => new Response(Buffer.alloc(f.body.length)) });
  assert.equal(r.tools.find(t => t.id === 'gogo').state, 'failed');
  assert.match(r.tools.find(t => t.id === 'gogo').message, /SHA-256/);
  assert.ok(fs.existsSync(path.join(f.dir, 'nmap.exe'))); assert.ok(!fs.existsSync(path.join(f.dir, 'gogo-2.15.0')));
  assert.ok(!fs.readdirSync(f.dir).some(n => n.startsWith('.seagull-install-')));
});
test('directory validation rejects relative paths and drive roots', () => {
  assert.throws(() => toolkitDirectory('relative')); assert.throws(() => toolkitDirectory(path.parse(process.cwd()).root));
});
test('archive extraction rejects traversal and links before writing outside staging', t => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-archive-')); t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const archive = path.join(base, 'bad.zip'), destination = path.join(base, 'content'); fs.mkdirSync(destination);
  const make = spawnSync(python.command, [...python.args, '-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr("../escape.exe",b"bad"); z.close()', archive]); assert.equal(make.status, 0);
  const run = spawnSync(python.command, [...python.args, fileURLToPath(new URL('../vendor/dsh-purge/lib/redteam/extract-tools.py', import.meta.url)), archive, destination], { encoding: 'utf8' });
  assert.notEqual(run.status, 0); assert.ok(!fs.existsSync(path.join(base, 'escape.exe')));
});
