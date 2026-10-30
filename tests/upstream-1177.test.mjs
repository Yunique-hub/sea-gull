// 上游回归 + 范围闸移除回归。
//
// 2026-10-30 按用户要求移除上游的「本地靶场范围闸」：
//   - 插件不再注册 agent/pre-step / tools/pre-execute 拦截钩子；
//   - 不再按目标地址、任务类别（渗透 / 外挂）或边界措辞拦任何请求；
//   - net-scope.js 只保留自有服务器白名单的存储层。
// 这里锁住「移除后仍然是移除状态」，避免后续合并上游时把闸门悄悄带回来。

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import * as netScope from '../vendor/dsh-purge/lib/net-scope.js';
import { EvidenceLedger, UnknownRegistry } from '../vendor/dsh-purge/lib/redteam/evidence-ledger.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const pluginIndex = fs.readFileSync(path.join(root, 'vendor/dsh-purge/lib/index.js'), 'utf8');

test('范围闸已移除：插件不再挂载任何目标判定钩子', () => {
  assert.ok(!pluginIndex.includes('installRegionGate'), 'index.js 不应再引用 installRegionGate');
  assert.ok(!pluginIndex.includes('regionGate'), 'index.js 不应再保留 regionGate 旧配置键');
  assert.ok(!pluginIndex.includes('tools/pre-execute'), 'index.js 不应再注册工具执行前拦截');
});

test('net-scope 只剩白名单存储层，不导出判定 API', () => {
  const removed = [
    'installRegionGate',
    'publicHostHit',
    'taskTargetHit',
    'isAttackTask',
    'isCheatTask',
    'isBenignNetworkTopic',
    'isLocalLabAddress',
    'latestToolText',
    'execArgText',
    'currentTaskText',
    'setScopeResolver',
  ];
  for (const name of removed) assert.equal(netScope[name], undefined, `${name} 不应再导出`);
  for (const kept of ['allowFilePath', 'entryHost', 'normalizeAllowText', 'readAllowText', 'writeAllowText', 'ownServerNote']) {
    assert.equal(typeof netScope[kept], 'function', `${kept} 应保留`);
  }
});

test('白名单面板的提交会真实落盘，归一后丢弃非法条目', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-allow-'));
  try {
    const saved = await netScope.writeAllowText(home, [
      '# 自有服务器',
      'user@10.0.0.5',
      '203.0.113.9',
      'not a host',
      '10.0.0.5',
    ].join('\n'));
    assert.equal(saved.dropped, 1);
    assert.deepEqual(saved.hosts, ['10.0.0.5', '203.0.113.9']);
    assert.equal(netScope.readAllowText(home), '# 自有服务器\nuser@10.0.0.5\n203.0.113.9\n');
    await netScope.writeAllowText(home, '');
    assert.equal(netScope.readAllowText(home), '');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('ownServerNote 恒为空，不往人格里追加禁令', () => {
  assert.equal(netScope.ownServerNote(), '');
});

test('evidence ledger deduplicates semantic records, verifies results and upgrades claims', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const ledger = new EvidenceLedger(db);
    const record = { operation: 'local-fixture', parameters: { b: 2, a: 1 }, result: { value: 'checked' }, confidence: 'claimed', authority: 'subagent-report' };
    const first = ledger.record(record);
    assert.equal(first.ok, true);
    assert.equal(ledger.record({ ...record, parameters: { a: 1, b: 2 } }).duplicate, true);
    assert.equal(ledger.verify(record).matched, true);
    assert.equal(ledger.verify({ ...record, result: { value: 'different' } }).matched, false);
    const verified = ledger.upgrade({ claimed_ev_id: first.ev_id, verified_by: 'local-test', verified_result: { value: 'observed' } });
    assert.equal(verified.ok, true);
    assert.equal(ledger.get(verified.ev_id).confidence, 'observed');
    assert.equal(ledger.get(first.ev_id).confidence, 'claimed');
    const unknowns = new UnknownRegistry(db);
    const unknown = unknowns.record({ question: 'Local fixture verified?', domain: 'unit-test' });
    assert.equal(unknown.ok, true);
    assert.equal(unknowns.resolve(unknown.unk_id, 'resolved', 'Verified by local test').ok, true);
  } finally { db.close(); }
});