// 统一的 Python 解释器解析。
//
// 历史问题：多个测试硬编码 `process.platform === 'win32' ? 'python' : 'python3'`。
// Windows 官方安装方式只放 `py` 启动器，PATH 里没有 `python`，于是整批测试假失败
// （136 项直接红掉 30+），看起来像大面积回归，实际产品没有问题。
//
// 解析顺序：显式环境变量 > python > python3 > py -3 / py。
// 结果带 args 前缀，调用方用 [py.command, ...py.args, script, ...] 拼接。

import { spawnSync } from 'node:child_process';

const CANDIDATES = [
  { command: 'python', args: [], env: 'SEAGULL_PYTHON' },
  { command: 'python3', args: [], env: null },
  { command: 'py', args: ['-3'], env: null },
  { command: 'py', args: [], env: null },
];

function works(command, args) {
  const probe = spawnSync(command, [...args, '--version'], { encoding: 'utf8' });
  if (probe.error) return false;
  if (probe.status !== 0) return false;
  // 只认真 python，避免命中同名的无关程序。
  const out = `${probe.stdout || ''}${probe.stderr || ''}`;
  return /Python\s+\d+\.\d+/i.test(out);
}

let cached;

/**
 * 解析可用的 Python 解释器。
 * @returns {{command: string, args: string[], display: string}}
 * @throws 当没有任何可用解释器时抛出带排查指引的错误。
 */
export function resolvePython() {
  if (cached) return cached;

  const override = process.env.SEAGULL_PYTHON;
  if (override && works(override, [])) {
    cached = { command: override, args: [], display: override };
    return cached;
  }

  const tried = [];
  for (const candidate of CANDIDATES) {
    tried.push([candidate.command, ...candidate.args].join(' '));
    if (works(candidate.command, candidate.args)) {
      cached = {
        command: candidate.command,
        args: candidate.args,
        display: [candidate.command, ...candidate.args].join(' '),
      };
      return cached;
    }
  }

  throw new Error(
    `找不到可用的 Python 解释器。已尝试: ${tried.join(', ')}。\n` +
      '修复方式：安装 Python 3，或设置 SEAGULL_PYTHON 指向解释器绝对路径。',
  );
}

/**
 * 用解析出的解释器执行 Python 脚本，参数顺序为 [解释器参数..., 脚本, ...脚本参数]。
 * @param {string} script 脚本路径
 * @param {string[]} args 脚本参数
 * @param {import('node:child_process').SpawnSyncOptionsWithStringEncoding} [options]
 */
export function runPython(script, args = [], options = {}) {
  const py = resolvePython();
  return spawnSync(py.command, [...py.args, script, ...args], { encoding: 'utf8', ...options });
}

/** 仅供测试：清空解析缓存。 */
export function resetPythonCache() {
  cached = undefined;
}