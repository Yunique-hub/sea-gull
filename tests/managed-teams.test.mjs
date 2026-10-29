import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { resolvePython } from './python-exec.mjs';
const python = resolvePython();
const script = fileURLToPath(new URL('../src/tools/managed_teams.py', import.meta.url));
const vendor = fileURLToPath(new URL('../vendor/dsh-agent-teams', import.meta.url));
const name = '@nanmicoder/dsh-agent-teams';
for (const shell of process.platform === 'win32' ? ['bash', 'powershell'] : ['bash']) {
  test(shell + ' fresh installation without an explicit toolkit choice stops before deployment', t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-first-choice-')); t.after(() => fs.rmSync(home, { recursive: true, force: true }));
    const pkg = path.join(home, 'profiles/desktop/package.json'); fs.mkdirSync(path.dirname(pkg), { recursive: true });
    const original = '{"dependencies":{},"dsh":{"profile":{"bundles":[]}}}'; fs.writeFileSync(pkg, original);
    const repo = fileURLToPath(new URL('..', import.meta.url)), app = path.join(home, 'not-installed');
    const env = { ...process.env, SEAGULL_TOOLKIT_DIR: '', PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
    const args = shell === 'bash' ? [path.join(repo, 'install.sh'), '--dsh-home', home, '--app-root', app, '--profile', 'desktop', '--no-pnpm'] : ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(repo, 'install.ps1'), '-DshHome', home, '-AppRoot', app, '-Profile', 'desktop', '-NoPnpm'];
    const program = shell === 'powershell' ? 'powershell.exe' : process.platform === 'win32' ? path.join(process.env.ProgramFiles, 'Git/bin/bash.exe') : 'bash';
    const r = spawnSync(program, args, { env, encoding: 'utf8', timeout: 30000, input: '' });
    assert.notEqual(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout + r.stderr, /工具安装目录/); assert.equal(fs.readFileSync(pkg, 'utf8'), original); assert.ok(!fs.existsSync(path.join(home, 'plugins')));
  });
}
test('toolkit choice validation has no side effects and saving preserves existing settings', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-choice-')); t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const file = path.join(home, 'redteam/config.json'), chosen = path.join(home, 'chosen tools'); fs.mkdirSync(path.dirname(file));
  const original = JSON.stringify({ env: { FOFA_KEY: 'fixture' }, tools: { nmap: 'existing' }, notes: 'keep', custom: true }); fs.writeFileSync(file, original);
  const helper = fileURLToPath(new URL('../src/tools/configure_toolkit.py', import.meta.url));
  const run = (dir, ...extra) => spawnSync(python.command, [...python.args, helper, home, dir, ...extra], { encoding: 'utf8' });
  assert.equal(run(chosen, '--validate-only').status, 0); assert.equal(fs.readFileSync(file, 'utf8'), original); assert.ok(!fs.existsSync(chosen));
  assert.notEqual(run('relative').status, 0); assert.notEqual(run(file).status, 0); assert.equal(fs.readFileSync(file, 'utf8'), original);
  assert.equal(run(chosen).status, 0); const config = JSON.parse(fs.readFileSync(file)); assert.equal(config.toolkitDir, chosen); assert.equal(config.env.FOFA_KEY, 'fixture'); assert.equal(config.tools.nmap, 'existing'); assert.equal(config.custom, true);
});
test('managed teams stage, update and unmount preserve unrelated profile settings and workspace archives', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-teams-')); t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const pkg = path.join(home, 'profiles/desktop/package.json'); fs.mkdirSync(path.dirname(pkg), { recursive: true });
  fs.writeFileSync(pkg, JSON.stringify({ private: true, dependencies: { other: '1.0.0' }, dsh: { profile: { bundles: ['other'] } } }));
  const archive = path.join(home, 'work/.agent-teams/state.json'); fs.mkdirSync(path.dirname(archive), { recursive: true }); fs.writeFileSync(archive, 'existing archive');
  const run = action => spawnSync(python.command, [...python.args, script, action, home, 'desktop', vendor], { encoding: 'utf8' });
  for (let i = 0; i < 2; i++) { const r = run('stage'); assert.equal(r.status, 0, r.stderr); }
  const profile = JSON.parse(fs.readFileSync(pkg)); assert.equal(profile.dependencies.other, '1.0.0'); assert.equal(profile.dsh.profile.bundles.filter(x => x === name).length, 1);
  const deployed = path.join(home, 'plugins', name); assert.ok(fs.existsSync(path.join(deployed, 'LICENSE'))); assert.ok(!fs.existsSync(path.join(deployed, 'node_modules')));
  const r = run('remove'); assert.equal(r.status, 0, r.stderr); assert.equal(fs.readFileSync(archive, 'utf8'), 'existing archive');
  assert.ok(fs.existsSync(deployed)); assert.ok(!JSON.parse(fs.readFileSync(pkg)).dependencies[name]);
});
