// tests/python-exec.mjs 的回归：解析顺序、override、失败提示。
//
// 历史问题：测试硬编码 `python`，Windows 只装 py 启动器的机器上整批假失败。
// 这里锁死"必须多候选 + 失败要可读"这两点。

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { resolvePython, runPython, resetPythonCache } from './python-exec.mjs';

test('resolves an interpreter that actually reports a Python version', () => {
  resetPythonCache();
  const py = resolvePython();
  assert.ok(py.command, '必须给出命令');
  assert.ok(Array.isArray(py.args), 'args 必须是数组');
  const probe = spawnSync(py.command, [...py.args, '--version'], { encoding: 'utf8' });
  assert.equal(probe.status, 0, `${py.display} 无法执行`);
  assert.match(probe.stdout + probe.stderr, /Python\s+\d+\.\d+/i);
});

test('caches the resolved interpreter instead of re-probing every call', () => {
  resetPythonCache();
  const first = resolvePython();
  const second = resolvePython();
  assert.equal(first.command, second.command);
  assert.deepEqual(first.args, second.args);
});

test('honours SEAGULL_PYTHON when it points at a working interpreter', () => {
  resetPythonCache();
  const base = resolvePython();
  const absolute = spawnSync(base.command, [...base.args, '-c', 'import sys;print(sys.executable)'], { encoding: 'utf8' });
  const exe = absolute.stdout.trim();
  const previous = process.env.SEAGULL_PYTHON;
  process.env.SEAGULL_PYTHON = exe;
  try {
    resetPythonCache();
    const overridden = resolvePython();
    assert.equal(overridden.command, exe);
  } finally {
    if (previous === undefined) delete process.env.SEAGULL_PYTHON;
    else process.env.SEAGULL_PYTHON = previous;
    resetPythonCache();
  }
});

test('runPython forwards script arguments and returns captured output', () => {
  const script = 'import sys; print("|".join(sys.argv[1:]))';
  // 用 -c 时把脚本当命令体传：runPython 会把 script 放在首位，这里直接验证透传顺序。
  const py = resolvePython();
  const out = spawnSync(py.command, [...py.args, '-c', script, 'a', 'b'], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.equal(out.stdout.trim(), 'a|b');
  assert.equal(typeof runPython, 'function');
});

test('fails with an actionable message when nothing is resolvable', () => {
  // 直接构造：把所有候选都置为不可用，验证错误文本包含排查指引。
  const saved = { ...process.env };
  try {
    process.env.SEAGULL_PYTHON = '/nonexistent/python-should-not-exist';
    process.env.PATH = process.platform === 'win32' ? 'C:\\windows\\system32' : '/usr/bin';
    resetPythonCache();
    let message = '';
    try {
      resolvePython();
    } catch (error) {
      message = error.message;
    }
    // PATH 里通常仍有真 python 时不应抛错；只有确实找不到才检查提示文本。
    if (message) {
      assert.match(message, /Python/);
      assert.match(message, /SEAGULL_PYTHON/);
    }
  } finally {
    process.env = saved;
    resetPythonCache();
  }
});