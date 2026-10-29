// AgentTeams 兼容声明必须与 dsh-purge 的 dshTarget 保持一致。
//
// 背景：compatibility.json 曾长期停在 0.2.1-rc.2，而实际宿主与 purge 的 dshTarget
// 都是 0.2.1-rc.3。rc.3 因此落在"未声明但能跑"的区间——宿主再漂一个小版本就会以
// 运行时异常暴露，而不是在安装期被拦住。这里锁死两处声明不能漂移。

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const teams = JSON.parse(fs.readFileSync(path.join(root, 'vendor/dsh-agent-teams/compatibility.json'), 'utf8'));
const purge = JSON.parse(fs.readFileSync(path.join(root, 'vendor/dsh-purge/package.json'), 'utf8'));

test('AgentTeams recommendedHost matches the purge dshTarget', () => {
  assert.ok(purge.dshTarget, 'vendor/dsh-purge/package.json 缺少 dshTarget');
  assert.equal(
    teams.recommendedHost,
    purge.dshTarget,
    `compatibility.json 的 recommendedHost(${teams.recommendedHost}) 与实际适配宿主(${purge.dshTarget}) 不一致`,
  );
});

test('the recommended host is actually listed as supported', () => {
  const declared = teams.supportedHosts.map(host => host.version);
  assert.ok(
    declared.includes(teams.recommendedHost),
    `recommendedHost(${teams.recommendedHost}) 不在 supportedHosts 列表中: ${declared.join(', ')}`,
  );
});

test('host entries are unique and carry a track', () => {
  const versions = teams.supportedHosts.map(host => host.version);
  assert.equal(new Set(versions).size, versions.length, `supportedHosts 有重复版本: ${versions.join(', ')}`);
  for (const host of teams.supportedHosts) {
    assert.ok(host.version, '每个 host 条目必须有 version');
    assert.ok(['recommended', 'legacy', 'preview'].includes(host.track), `未知 track: ${host.track}`);
  }
});