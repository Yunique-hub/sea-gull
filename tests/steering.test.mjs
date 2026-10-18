import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_PATCHES, applyReplacementsToText } from '../vendor/dsh-purge/lib/core.js';

const apply = (id, text) => applyReplacementsToText(text, ALL_PATCHES.find((patch) => patch.id === id));
const nativePrompt = '\t\t\t\t\tif (request.mode === "steer") agent.steer(message);\n\t\t\t\t\telse agent.followup(message);';
const legacyPrompt = '\t\t\t\t\tagent.followup(message); // [dsh-purge-85] user prompt always next-turn (kill steer→next-step race)';
const queueCase = (delivery) => '\t\t\tcase "steer":\n\t\t\t\tagent.inbox.remove(request.itemId);\n\t\t\t\t' + delivery + '\n\t\t\t\tbreak;';

for (const [label, source] of [['stock', nativePrompt], ['previously patched', legacyPrompt]]) {
  test(label + ' prompt honors steer while ordinary messages retain FIFO delivery', () => {
    const result = apply(85, source);
    const deliver = new Function('request', 'agent', 'message', result.text);
    const calls = [];
    const agent = { steer: (message) => calls.push(['step', message]), followup: (message) => calls.push(['turn', message]) };
    deliver({ mode: 'steer' }, agent, 'correction');
    deliver({ mode: 'queue' }, agent, 'later');
    assert.deepEqual(calls, [['step', 'correction'], ['turn', 'later']]);
    assert.equal(apply(85, result.text).changed, false);
  });
}

for (const [label, source] of [
  ['stock', queueCase('agent.steer(message);')],
  ['previously patched', queueCase('agent.followup(message); // [dsh-purge-86] queue steer → next-turn')],
]) {
  test(label + ' queued steer removes the FIFO item and submits it to the nearest step', () => {
    const result = apply(86, source);
    const deliver = new Function('request', 'agent', 'message', 'switch (request.action) {\n' + result.text + '\n}');
    const calls = [];
    const agent = { inbox: { remove: (id) => calls.push(['remove', id]) }, steer: (message) => calls.push(['step', message]), followup: (message) => calls.push(['turn', message]) };
    deliver({ action: 'steer', itemId: 'pending-input' }, agent, 'correction');
    assert.deepEqual(calls, [['remove', 'pending-input'], ['step', 'correction']]);
    assert.equal(apply(86, result.text).changed, false);
  });
}

test('legacy public steer is restored without changing queue and injected-context delivery', () => {
  const source = '\tsteer(input) {\n\t\tthis.send(input, "next-turn", true); // [dsh-purge-86] user steer always next-turn\n\t}';
  const result = apply(86, source);
  const agent = new Function('return ({' + result.text + '});')();
  agent.send = (...args) => assert.deepEqual(args, ['correction', 'next-step', true]);
  agent.steer('correction');
  assert.equal(apply(86, result.text).changed, false);
});
