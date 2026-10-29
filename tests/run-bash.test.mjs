// tests/run-bash.sh 的回归：它必须在"有真 bash"时透传执行，在"没有真 bash"时
// 明确跳过并退出 0（环境缺失不是回归失败）。
//
// Windows 上 C:\windows\system32\bash.exe 是 WSL 存根，脚本被解释前就已失败，
// 所以真正的判定点必须放在"选解释器"这一层——这就是包装器存在的原因。

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const wrapper = path.join(root, 'tests/run-bash.sh');

function realBash() {
  if (process.platform !== 'win32') return 'bash';
  const candidates = [
    path.join(process.env.ProgramFiles || '', 'Git/bin/bash.exe'),
    path.join(process.env.ProgramW6432 || '', 'Git/bin/bash.exe'),
  ].filter(p => p && fs.existsSync(p));
  return candidates[0] || null;
}

const bash = realBash();
const skip = bash ? false : '本机没有真 bash，无法驱动包装器测试';

test('passes through to the target script when a real bash exists', { skip }, () => {
  const out = spawnSync(bash, [wrapper, '-c', 'printf %s "$BASH_VERSION"'], {
    encoding: 'utf8',
    env: { ...process.env, SEAGULL_BASH: bash },
  });
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.match(out.stdout, /\d+\.\d+/);
});

test('skips with exit 0 instead of failing when no real bash can be found', { skip }, () => {
  // 只留一个空目录当候选：所有探测都失败。
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-nobash-'));
  try {
    const out = spawnSync(bash, [wrapper, 'tests/smoke.sh'], {
      encoding: 'utf8',
      // SEAGULL_BASH 指向不存在的路径；ProgramFiles 指到空目录，杜绝 Git 命中。
      env: { ...process.env, SEAGULL_BASH: path.join(empty, 'nope'), ProgramFiles: empty, ProgramW6432: empty },
    });
    assert.equal(out.status, 0, out.stdout + out.stderr);
    assert.match(out.stdout + out.stderr, /没有可用的真 bash|已跳过/);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});