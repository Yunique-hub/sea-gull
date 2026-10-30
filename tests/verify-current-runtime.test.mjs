import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
for (const shell of windows ? ['bash', 'powershell'] : ['bash']) {
  test(shell + ' verification accepts the current runtime and detects a missing skill or a re-added scope gate', (t) => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-verify-'));
    t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
    const home = path.join(temp, 'home'), app = path.join(temp, 'app');
    function write(base, name, text) {
      const file = path.join(base, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
      return file;
    }
    write(home, 'profiles/desktop/package.json', JSON.stringify({ dependencies: { 'dsh-purge': 'file:../../plugins/dsh-purge' }, dsh: { profile: { bundles: ['dsh-purge'] } } }));
    for (const dir of ['plugins/dsh-purge', 'profiles/desktop/node_modules/dsh-purge']) {
      write(home, dir + '/package.json', '{"name":"dsh-purge","version":"1.1.78"}');
    }
    write(home, 'plugins/dsh-purge/bin/dsh-purge.js', 'console.log("补丁 77/86 已清洗");');
    write(home, 'plugins/dsh-purge/cordis.patch.yml', 'hooksDenyBypass: true\n');
    const gate = write(home, 'plugins/dsh-purge/lib/index.js', '// region gate removed\n');
    write(home, 'prompt-inject.md', '# 海鸥全破内核\n纯 Markdown 人格\n');
    write(home, 'AGENTS.md', '# Workspace conventions\n');
    for (const name of ['seagull-reverse', 'seagull-pentest', 'seagull-exploit', 'seagull-game-hack', 'seagull-license-security']) {
      write(home, 'skills/' + name + '/SKILL.md', '# ' + name);
    }
    const host = 'resources/app/dsh/node_modules/@deepseek-ai/';
    for (let i = 0; i < 31; i++) write(app, host + 'fixture/' + i + '.js', '// dsh-purge\n');
    write(app, host + 'dsh-system-prompt/lib/index.js', '// [dsh-purge] identity stripped\n// [dsh-purge] fold-complete inject first\n');
    const run = () => spawnSync(shell === 'bash' ? (windows ? path.join(process.env.ProgramFiles, 'Git/bin/bash.exe') : 'bash') : 'powershell.exe',
      shell === 'bash' ? ['verify.sh'] : ['-NoProfile', '-File', 'verify.ps1'],
      { cwd: root, encoding: 'utf8', env: { ...process.env, DSH_HOME: home, SEAGULL_DSH_APP: app, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
    let result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const skill = path.join(home, 'skills/seagull-reverse/SKILL.md');
    fs.unlinkSync(skill);
    result = run();
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /\[FAIL\].*(?:五个海鸥技能|技能 seagull-reverse)/);
    fs.writeFileSync(skill, '# restored');
    fs.writeFileSync(gate, 'installRegionGate(ctx);\n');
    result = run();
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /\[FAIL\].*范围闸已移除/);
  });
}
