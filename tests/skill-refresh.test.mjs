import assert from 'node:assert/strict';
import test from 'node:test';
import {ALL_PATCHES, applyReplacementsToText} from '../vendor/dsh-purge/lib/core.js';
test('skill changes are forwarded without changing existing event permissions or modes', () => {
  const source = 'const events = [{\n\t\tevent: "commands/change",\n\t\tmode: "emit"\n\t}, {event:"other", mode:"waterfall"}];';
  const patch = ALL_PATCHES.find(p => p.id === 93), applied = applyReplacementsToText(source, patch);
  assert.equal(applied.changed, true);
  const events = new Function(applied.text + '; return events;')();
  assert.deepEqual(events, [{event:'commands/change',mode:'emit'},{event:'skills/change',mode:'emit'},{event:'other',mode:'waterfall'}]);
  assert.equal(applyReplacementsToText(applied.text, patch).changed, false);
});
test('native skill menu refresh subscribes to changes and clears the cached catalog', async () => {
  const source = '\t\t\tctx.remote.$on("plugin-manager/changed", clearAll);';
  const patch = ALL_PATCHES.find(p => p.id === 94), applied = applyReplacementsToText(source, patch);
  const handlers = new Map(), cache = new Map([['session', ['old-skill']]]);
  new Function('ctx', 'clearAll', applied.text)({remote:{$on:(name,fn)=>handlers.set(name,fn)}}, () => cache.clear());
  assert.ok(handlers.has('plugin-manager/changed')); assert.ok(handlers.has('skills/change'));
  handlers.get('skills/change')(); assert.equal(cache.size, 0);
  assert.equal(applyReplacementsToText(applied.text, patch).changed, false);
});
