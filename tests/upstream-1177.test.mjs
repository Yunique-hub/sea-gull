import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { isAttackTask, taskTargetHit, publicHostHit, installRegionGate } from '../vendor/dsh-purge/lib/net-scope.js';
import { EvidenceLedger, UnknownRegistry } from '../vendor/dsh-purge/lib/redteam/evidence-ledger.mjs';

test('upstream local-lab gate allows private targets and rejects public and metadata targets', async () => {
  for (const ip of ['127.0.0.1', '10.20.30.40', '172.16.0.2', '192.168.1.3']) assert.equal(await taskTargetHit('本地渗透测试 '+ip), null, ip);
  for (const ip of ['8.8.8.8', '169.254.169.254']) assert.ok(await taskTargetHit('渗透测试 '+ip), ip);
  assert.ok(await taskTargetHit('渗透测试，检查目标'));
  assert.equal(await publicHostHit('读取本地文件 ./report.txt'), null);
});

test('long red-team tasks retain the upstream late-target check without blocking the event loop', async () => {
  const text = '本地测试记录。'.repeat(12000) + '渗透测试 8.8.8.8';
  assert.equal(isAttackTask(text), true);
  assert.ok(await taskTargetHit(text));
});

test('tool pre-execution gate blocks public addresses before invoking the tool', async () => {
  const hooks = new Map();
  installRegionGate({ on(name, fn) { hooks.set(name, fn); } });
  assert.ok(hooks.has('agent/pre-step'));
  const hook = hooks.get('tools/pre-execute');
  let invoked = 0;
  const exec = { args: { command: 'curl http://8.8.8.8/' } };
  const denied = await hook(exec, () => { invoked++; return 'ran'; });
  assert.equal(denied.isError, true);
  assert.equal(exec.blocked, true);
  assert.equal(invoked, 0);
  assert.equal(await hook({ args: { command: 'curl http://127.0.0.1/' } }, () => 'local'), 'local');
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
