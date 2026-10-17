import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
const bash = windows ? path.join(process.env.ProgramFiles, 'Git/bin/bash.exe') : 'bash';

for (const shell of windows ? ['bash', 'powershell'] : ['bash']) {
  test(shell + ' detects the 0.2.1 pnpm payload and retains the legacy fallback', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-runtime-'));
    try {
      const home = path.join(temp, 'dsh'), app = path.join(temp, 'Harness Space');
      const profile = path.join(home, 'profiles/desktop/package.json');
      fs.mkdirSync(path.dirname(profile), { recursive: true });
      fs.writeFileSync(profile, '{"dependencies":{},"dsh":{"profile":{"bundles":[]}}}');
      const primary = path.join(app, 'resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs');
      const legacy = path.join(app, 'resources/runtime/pnpm/bin/pnpm.mjs');
      fs.mkdirSync(path.dirname(primary), { recursive: true });
      fs.writeFileSync(primary, '');
      const run = () => {
        const command = shell === 'bash' ? bash : 'powershell.exe';
        const args = shell === 'bash' ? ['install.sh', '--dsh-home', home, '--app-root', app, '--dry-run'] : ['-NoProfile', '-File', 'install.ps1', '-DshHome', home, '-AppRoot', app, '-DryRun'];
        const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /pnpm\s+install @/);
        assert.equal(fs.readFileSync(profile, 'utf8'), '{"dependencies":{},"dsh":{"profile":{"bundles":[]}}}');
        assert.equal(fs.existsSync(path.join(home, 'plugins')), false);
        return result.stdout.replaceAll('\\', '/');
      };
      run();
      fs.unlinkSync(primary);
      fs.mkdirSync(path.dirname(legacy), { recursive: true });
      fs.writeFileSync(legacy, '');
      run();
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
}
