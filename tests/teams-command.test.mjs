import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const base = new URL('../vendor/dsh-agent-teams/lib/', import.meta.url);
// Exercise the shipped command parser without requiring a Harness installation in CI.
const code = fs.readFileSync(new URL('command.js', base), 'utf8')
  .replace("import { createUserMessage } from '@deepseek-ai/dsh-llm';", 'const createUserMessage = value => value;')
  .replace('import { agentTeamsSource, observedSessionFormatVersion } from "./harness-compat.js";', 'const agentTeamsSource = value => value; const observedSessionFormatVersion = () => 1;')
  .replace('"./profiles.js"', JSON.stringify(new URL('profiles.js', base).href));
const { invokedAgentTeamsInvocation, installAgentTeamsGestureBoundary } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const user = text => [{ source: { kind: 'user' }, content: [{ type: 'text', text }] }];
test('team gesture accepts plain and slash commands while excluding unrelated words', () => {
  for (const text of ['agent-teams 创建两名成员', '/agent-teams 创建两名成员', '  AGENT-TEAMS\n创建两名成员']) assert.equal(invokedAgentTeamsInvocation(user(text)).goal, '创建两名成员');
  for (const text of ['agent-teamster', 'agent-teams-other', '请解释 agent-teams']) assert.equal(invokedAgentTeamsInvocation(user(text)), undefined);
});
test('team gesture preserves profile aliases and does not bypass a rejected pre-step', async () => {
  assert.deepEqual(invokedAgentTeamsInvocation(user('/agent-teams-review 审阅'), () => ({ review: {} })), { profile: 'review', goal: '审阅' });
  let hook; installAgentTeamsGestureBoundary({ on: (_name, fn) => { hook = fn; } });
  const decision = { kind: 'reject', reason: 'fixture' };
  assert.equal(await hook({ messages: user('agent-teams 测试') }, async () => decision), decision);
});
