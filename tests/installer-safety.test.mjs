import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { hashOverride, seedPromptInjectAtBoot } from '../vendor/dsh-purge/lib/core.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
const bash = windows ? path.join(process.env.ProgramFiles, 'Git/bin/bash.exe') : 'bash';
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

function fixture(t, shell) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-install-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'repo'), home = path.join(temp, 'selected home');
  const app = path.join(temp, 'Harness Space'), other = path.join(temp, 'other home');
  const profile = path.join(home, 'profiles/desktop/package.json');
  const original = JSON.stringify({ dependencies: { other: '1.0.0' }, dsh: { profile: { bundles: ['base'] } } });
  for (const file of ['install.sh', 'install.ps1', 'src/tools/patch_profile.py']) {
    write(path.join(repo, file), fs.readFileSync(path.join(root, file)));
  }
  write(path.join(repo, 'VERSION'), 'test');
  write(profile, original);
  write(path.join(other, 'profiles/desktop/package.json'), original);
  for (const file of ['src/prompt/prompt-inject.md', 'vendor/dsh-purge/lib/default-prompt-inject.md', 'src/skills/example/SKILL.md', 'src/skills/redteam/example.md']) {
    write(path.join(repo, file), 'fixture');
  }
  write(path.join(repo, 'vendor/dsh-purge/package.json'), '{"name":"dsh-purge","version":"1.1.71","type":"module"}');
  write(path.join(repo, 'vendor/dsh-purge/cordis.patch.yml'), '[]');
  write(path.join(repo, 'vendor/dsh-purge/lib/index.js'), 'export {};');
  const cli = `import fs from 'node:fs';
fs.appendFileSync(process.env.TEST_CLI_LOG, JSON.stringify({ args: process.argv.slice(2), home: process.env.DSH_HOME, profile: process.env.DSH_PROFILE, surface: process.env.DSH_SURFACE, app: process.env.DSH_DESKTOP_INSTALL, base: process.env.DSH_BASE }) + '\\n');
process.exit(Number(process.env.TEST_CLI_FAIL || 0));`;
  write(path.join(repo, 'vendor/dsh-purge/bin/dsh-purge.js'), cli);
  write(path.join(repo, 'vendor/dsh-purge/lib/reapply-cli.js'), cli);
  write(path.join(app, 'resources/app.asar'), 'fixture');
  write(path.join(app, 'resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs'), `import fs from 'node:fs';
process.exitCode = Number(process.env.TEST_PNPM_FAIL || 0);
if (!process.exitCode && !process.env.TEST_NO_LINK) {
  fs.mkdirSync('node_modules/dsh-purge', { recursive: true });
  fs.copyFileSync('../../plugins/dsh-purge/package.json', 'node_modules/dsh-purge/package.json');
}`);
  const log = path.join(temp, 'cli.jsonl');
  const run = (options = {}, env = {}) => {
    const values = { 'dsh-home': home, 'app-root': app, profile: 'desktop', ...options };
    const args = shell === 'bash' ? [path.join(repo, 'install.sh')] : ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(repo, 'install.ps1')];
    const psNames = { 'dsh-home': 'DshHome', 'app-root': 'AppRoot', profile: 'Profile', 'no-pnpm': 'NoPnpm', 'dry-run': 'DryRun', apply: 'Apply', uninstall: 'Uninstall', update: 'Update' };
    for (const [key, value] of Object.entries(values)) {
      if (value === false) continue;
      args.push(shell === 'bash' ? '--' + key : '-' + psNames[key]);
      if (value !== true) args.push(value);
    }
    return spawnSync(shell === 'bash' ? bash : 'powershell.exe', args, {
      cwd: repo, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, DSH_HOME: other, DSH_PROFILE: 'web', DSH_SURFACE: 'web', DSH_BASE: 'stale-base', DSH_DESKTOP_INSTALL: 'stale-app', TEST_CLI_LOG: log, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', ...env },
    });
  };
  return { temp, repo, home, app, other, profile, original, log, run };
}

for (const shell of windows ? ['bash', 'powershell'] : ['bash']) {
  test(shell + ' update refreshes plugin files while preserving persona, preferences, projects and extra skills', t => {
    const f = fixture(t, shell);
    const installed = f.run();
    assert.equal(installed.status, 0, installed.stdout + installed.stderr);
    const persona = '用户定制海鸥人格\n';
    write(path.join(f.home, 'prompt-inject.md'), persona);
    write(path.join(f.home, 'dsh-purge/override-state.json'), JSON.stringify({ customized: false, hash: hashOverride(persona) }));
    const protectedFiles = {
      'profiles/desktop/cordis.patch.yml': '- id: ui-conversation\n  config:\n    busyEnter: steer\n',
      'redteam/engagements/local-project/meta.json': '{"name":"local-project"}',
      'skills/my-own-skill/SKILL.md': 'my own skill',
    };
    for (const [file, text] of Object.entries(protectedFiles)) write(path.join(f.home, file), text);
    write(path.join(f.repo, 'vendor/dsh-purge/lib/index.js'), '// updated plugin\nexport {};');
    for (let n = 0; n < 2; n++) {
      const updated = f.run({ update: true });
      assert.equal(updated.status, 0, updated.stdout + updated.stderr);
      assert.match(fs.readFileSync(path.join(f.home, 'plugins/dsh-purge/lib/index.js'), 'utf8'), /updated plugin/);
      assert.equal(seedPromptInjectAtBoot(f.home).action, 'kept_user_custom');
      assert.equal(fs.readFileSync(path.join(f.home, 'prompt-inject.md'), 'utf8'), persona);
      for (const [file, text] of Object.entries(protectedFiles)) assert.equal(fs.readFileSync(path.join(f.home, file), 'utf8'), text);
      const pkg = JSON.parse(fs.readFileSync(f.profile, 'utf8'));
      assert.equal(pkg.dsh.profile.bundles.filter(id => id === 'dsh-purge').length, 1);
    }
  });

  test(shell + ' update rejects an uninstalled home before writes', t => {
    const f = fixture(t, shell);
    const updated = f.run({ update: true });
    assert.notEqual(updated.status, 0);
    assert.equal(fs.readFileSync(f.profile, 'utf8'), f.original);
    assert.equal(fs.existsSync(path.join(f.home, 'plugins')), false);
  });

  test(shell + ' update rejects uninstall mode and reports dependency failures', t => {
    const f = fixture(t, shell);
    assert.equal(f.run().status, 0);
    const before = fs.readFileSync(f.profile, 'utf8');
    assert.notEqual(f.run({ update: true, uninstall: true }).status, 0);
    assert.equal(fs.readFileSync(f.profile, 'utf8'), before);
    write(path.join(f.home, 'prompt-inject.md'), 'preserve on failure');
    const failed = f.run({ update: true }, { TEST_PNPM_FAIL: '17' });
    assert.notEqual(failed.status, 0);
    assert.equal(fs.readFileSync(path.join(f.home, 'prompt-inject.md'), 'utf8'), 'preserve on failure');
  });

  test(shell + ' rejects a missing explicit home instead of using another profile', (t) => {
    const f = fixture(t, shell);
    const result = f.run({ 'dsh-home': path.join(f.temp, 'missing'), 'no-pnpm': true });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(fs.readFileSync(path.join(f.other, 'profiles/desktop/package.json'), 'utf8'), f.original);
    assert.equal(fs.existsSync(path.join(f.other, 'plugins')), false);
  });

  test(shell + ' validates profile before replacing an existing plugin', (t) => {
    const f = fixture(t, shell);
    write(f.profile, '{"dependencies":[],"dsh":{"profile":{"bundles":["base"]}}}');
    const old = path.join(f.home, 'plugins/dsh-purge/local.txt');
    write(old, 'keep existing plugin');
    const result = f.run({ 'no-pnpm': true });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(fs.readFileSync(old, 'utf8'), 'keep existing plugin');
    assert.equal(fs.existsSync(path.join(f.home, 'plugins/dsh-purge.bak')), false);
    assert.equal(fs.existsSync(path.join(f.home, 'prompt-inject.md')), false);
  });

  test(shell + ' rejects incomplete payload before touching the target', (t) => {
    const f = fixture(t, shell);
    fs.unlinkSync(path.join(f.repo, 'vendor/dsh-purge/lib/default-prompt-inject.md'));
    const result = f.run({ 'no-pnpm': true });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(fs.readFileSync(f.profile, 'utf8'), f.original);
    assert.equal(fs.existsSync(path.join(f.home, 'plugins')), false);
  });

  test(shell + ' stops on pnpm failure and leaves user prompt untouched', (t) => {
    const f = fixture(t, shell);
    const prompt = path.join(f.home, 'prompt-inject.md');
    write(prompt, 'user prompt');
    const result = f.run({}, { TEST_PNPM_FAIL: '17' });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout, /安装完成/);
    assert.equal(fs.readFileSync(prompt, 'utf8'), 'user prompt');
  });

  test(shell + ' rejects successful pnpm without the installed dependency', (t) => {
    const f = fixture(t, shell);
    const result = f.run({}, { TEST_NO_LINK: '1' });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout, /安装完成/);
  });

  test(shell + ' scopes Apply and revert to the selected home and surface', (t) => {
    const f = fixture(t, shell);
    const result = f.run({ apply: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const uninstall = f.run({ uninstall: true });
    assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
    const calls = fs.readFileSync(f.log, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(fs.realpathSync.native(call.home), fs.realpathSync.native(f.home));
      assert.equal(call.profile, 'desktop');
      assert.equal(call.surface, 'desktop');
      assert.equal(fs.realpathSync.native(call.app), fs.realpathSync.native(f.app));
      assert.ok(!call.base);
    }
    assert.deepEqual(calls[1].args, ['--revert']);
    assert.equal(fs.readFileSync(path.join(f.other, 'profiles/desktop/package.json'), 'utf8'), f.original);
  });

  test(shell + ' preserves plugin and profile if revert fails', (t) => {
    const f = fixture(t, shell);
    const installed = f.run();
    assert.equal(installed.status, 0, installed.stdout + installed.stderr);
    const before = fs.readFileSync(f.profile, 'utf8');
    const result = f.run({ uninstall: true }, { TEST_CLI_FAIL: '19' });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(fs.readFileSync(f.profile, 'utf8'), before);
    assert.ok(fs.existsSync(path.join(f.home, 'plugins/dsh-purge/bin/dsh-purge.js')));
  });

  test(shell + ' uses the Web Apply entry even when a desktop app is installed', (t) => {
    const f = fixture(t, shell);
    write(path.join(f.home, 'profiles/web/package.json'), f.original);
    const result = f.run({ profile: 'web', apply: true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const call = JSON.parse(fs.readFileSync(f.log, 'utf8').trim());
    assert.deepEqual(call.args, ['--apply']);
    assert.equal(call.profile, 'web');
    assert.equal(call.surface, 'web');
    assert.equal(call.base, 'stale-base'); // Web keeps an explicitly configured plugin root.
    assert.ok(!call.app);
    assert.equal(fs.readFileSync(f.profile, 'utf8'), f.original);
  });

  test(shell + ' refuses Apply without a located runtime before installing files', (t) => {
    const f = fixture(t, shell);
    const result = f.run({ 'app-root': path.join(f.temp, 'missing-app'), apply: true });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(fs.readFileSync(f.profile, 'utf8'), f.original);
    assert.equal(fs.existsSync(path.join(f.home, 'plugins')), false);
  });

  test(shell + ' distinguishes files-only deployment and preserves profile preferences', (t) => {
    const f = fixture(t, shell);
    const preferenceFile = path.join(f.home, 'profiles/desktop/cordis.patch.yml');
    const preference = '- id: ui-conversation\n  config:\n    busyEnter: steer\n# retain comment\n';
    write(preferenceFile, preference);
    const result = f.run({ 'no-pnpm': true });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(fs.readFileSync(preferenceFile, 'utf8'), preference);
    assert.equal(fs.existsSync(path.join(f.home, 'profiles/desktop/node_modules')), false);
    // PowerShell's console encoding depends on the caller; verify the state in both shells.
    if (shell === 'bash') {
      assert.match(result.stderr, /文件部署完成/);
      assert.doesNotMatch(result.stdout, /安装完成/);
    }
  });

  test(shell + ' stops if profile writing fails after validation', (t) => {
    const f = fixture(t, shell);
    write(path.join(f.repo, 'src/tools/patch_profile.py'), 'import sys\nsys.exit(0 if "--validate" in sys.argv else 23)\n');
    const result = f.run();
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(fs.readFileSync(f.profile, 'utf8'), f.original);
    assert.equal(fs.existsSync(path.join(f.home, 'prompt-inject.md')), false);
  });
}
