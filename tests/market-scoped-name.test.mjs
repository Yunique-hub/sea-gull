import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('market verifies the actual scoped dependency and leaves ambiguous names unresolved', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-scoped-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const profile = path.join(home, 'profiles/desktop'), core = path.join(profile, 'node_modules/@dsh-market/core');
  fs.mkdirSync(path.join(core, 'dist'), { recursive: true });
  const pkg = path.join(profile, 'package.json');
  fs.writeFileSync(pkg, '{"dependencies":{"@dsh-market/plugin":"0.4.16"}}');
  fs.writeFileSync(path.join(core, 'package.json'), '{"version":"0.4.13"}');
  fs.writeFileSync(path.join(core, 'dist/installed.js'), `if (!profile.isDirectory()) {}
export function matchMarketPlugin(dep, byName, byFull) {
    const [scope, pkg] = dep.slice(1).toLowerCase().split('/');
    if (pkg) {
            const byRepo = byName.get(pkg);
            if (byRepo)
                return byRepo;
            const byScopedFull = byFull.get(\`\${scope}/\${pkg}\`);
            if (byScopedFull)
                return byScopedFull;
    }
    return null;
}`);
  fs.writeFileSync(path.join(core, 'dist/verify.js'), `// seagull: the host composes bundle patches
export function verifyAfterInstall(cfg, plugin, opts) {
  const name = resolveInstallName(plugin);
  return name;
}`);
  const script = fileURLToPath(new URL('../src/tools/patch_profile.py', import.meta.url));
  const run = () => spawnSync(process.platform === 'win32' ? 'python' : 'python3', [script, '--market-runtime', pkg], { encoding: 'utf8' });
  assert.equal(run().status, 0);
  const target = path.join(core, 'dist/verify.js'), source = fs.readFileSync(target, 'utf8');
  const resolve = new Function('resolveInstallName', 'readProfilePackage', 'readInstalledPackage', source.replace('export function', 'function') + ';return verifyAfterInstall;')(
    p => p.name, () => JSON.parse(fs.readFileSync(pkg, 'utf8')), (_, __, name) => ({ name }));
  assert.equal(resolve({}, { name: 'plugin' }, { profile: 'desktop' }), '@dsh-market/plugin');
  assert.equal(resolve({}, { name: 'dsh-market/plugin' }, { profile: 'desktop' }), '@dsh-market/plugin');
  const installed = fs.readFileSync(path.join(core, 'dist/installed.js'), 'utf8');
  const match = new Function(installed.slice(installed.indexOf('export function')).replace('export function', 'function') + ';return matchMarketPlugin;')();
  const canonical = {id:'NanmiCoder/dsh-agent-teams'}, fork = {id:'fork/dsh-agent-teams'};
  assert.equal(match('@nanmicoder/dsh-agent-teams', new Map([['dsh-agent-teams',fork]]), new Map([['nanmicoder/dsh-agent-teams',canonical]])), canonical);
  fs.writeFileSync(pkg, '{"dependencies":{"@dsh-market/plugin":"0.4.16","@other/plugin":"1"}}');
  assert.equal(resolve({}, { name: 'plugin' }, { profile: 'desktop' }), 'plugin');
  assert.equal(resolve({}, { name: '@dsh-market/plugin' }, { profile: 'desktop' }), '@dsh-market/plugin');
  assert.equal(run().status, 0);
  assert.equal(fs.readFileSync(target, 'utf8'), source);
});

test('market does not report an empty skill directory as live', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-skill-verify-')); t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const profile = path.join(home, 'profiles/desktop'), core = path.join(profile, 'node_modules/@dsh-market/core'); fs.mkdirSync(path.join(core, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'package.json'), '{"dependencies":{"@dsh-market/plugin":"0.4.16"}}');
  fs.writeFileSync(path.join(core, 'package.json'), '{"version":"0.4.13"}');
  fs.writeFileSync(path.join(core, 'dist/installed.js'), '// seagull: scan the selected profile only');
  const target = path.join(core, 'dist/verify.js'); fs.writeFileSync(target, `// seagull: the host composes bundle patches
export function verifyActivation(cfg, opts) {
  const dir = join(cfg.skillsDir, opts.name);
  if (existsSync(dir)) {
    return {state:'live'};
  }
  return {state:'broken'};
}`);
  const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [fileURLToPath(new URL('../src/tools/patch_profile.py', import.meta.url)), '--market-runtime', path.join(profile, 'package.json')], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr);
  const verify = new Function('join', 'existsSync', fs.readFileSync(target, 'utf8').replace('export function', 'function') + ';return verifyActivation;')(path.join, fs.existsSync);
  const dir = path.join(home, 'skills/example'); fs.mkdirSync(dir, { recursive: true }); assert.equal(verify({skillsDir:path.dirname(dir)}, {name:'example'}).state, 'broken');
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: example\ndescription: fixture\n---\nFixture'); assert.equal(verify({skillsDir:path.dirname(dir)}, {name:'example'}).state, 'live');
});
