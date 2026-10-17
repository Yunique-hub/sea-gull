import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const bash = process.platform === 'win32' ? path.join(process.env.ProgramFiles, 'Git/bin/bash.exe') : 'bash';
const root = new URL('..', import.meta.url);

for (const scenario of [
  { name: 'success with explicit stored credentials', greeting: true, canary: 0, task: 0, stored: true, ok: true },
  { name: 'failed canary even when the greeting is present', greeting: true, canary: 1, task: 0 },
  { name: 'successful call with no injected greeting', greeting: false, canary: 0, task: 0 },
  { name: 'failed task after a successful canary', greeting: true, canary: 0, task: 1, legacy: true },
]) {
  test('e2e runner reports ' + scenario.name, () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-e2e-'));
    try {
      const home = path.join(temp, 'dsh'), app = path.join(temp, 'Harness Space'), work = path.join(temp, 'checkout');
      const profile = path.join(home, 'profiles/verify-seagull/package.json');
      const node = path.join(app, 'resources/runtime/primary-runtime/dependencies/node/bin', process.platform === 'win32' ? 'node.exe' : 'node');
      const pnpm = path.join(app, 'resources/runtime', scenario.legacy ? 'pnpm/bin/pnpm.cjs' : 'primary-runtime/dependencies/pnpm/bin/pnpm.mjs');
      const cli = path.join(app, 'resources/app/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js');
      for (const file of [profile, node, pnpm, cli, path.join(work, 'src/tools/patch_profile.py')]) fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(profile, '{"dependencies":{},"dsh":{"profile":{"bundles":[]}}}');
      fs.copyFileSync(process.execPath, node);
      fs.writeFileSync(pnpm, '');
      fs.writeFileSync(cli, '');
      fs.copyFileSync(new URL('verify-e2e.sh', root), path.join(work, 'verify-e2e.sh'));
      fs.copyFileSync(new URL('src/tools/patch_profile.py', root), path.join(work, 'src/tools/patch_profile.py'));
      const exe = path.join(app, process.platform === 'win32' ? 'DeepSeek Harness.exe' : 'deepseek-harness');
      fs.writeFileSync(exe, '#!/usr/bin/env bash\nif [[ "$*" == *"在吗"* ]]; then\n' +
        `  printf '%s\\n' '${scenario.greeting ? '海鸥在线，你要整点薯条吗？' : 'other response'}'\n  exit ${scenario.canary}\n` +
        `fi\nprintf '%s\\n' 'fixture task output'\nexit ${scenario.task}\n`, { mode: 0o755 });
      const result = spawnSync(bash, ['verify-e2e.sh', '--skip-ab', ...(scenario.stored ? ['--stored-credentials'] : [])], { cwd: work, encoding: 'utf8', env: { ...process.env, DSH_HOME: home, SEAGULL_DSH_APP: app, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
      if (scenario.ok) assert.equal(result.status, 0, result.stdout + result.stderr);
      else assert.notEqual(result.status, 0, result.stdout + result.stderr);
      assert.equal(fs.existsSync(path.join(work, '_verify/stored-credentials.yml')), !!scenario.stored);
      assert.ok(fs.existsSync(path.join(work, '_verify/canary-greeting.txt')));
      if (scenario.greeting && scenario.canary === 0) assert.ok(fs.existsSync(path.join(work, '_verify/headless-run.txt')));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
}
