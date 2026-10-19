import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { RedteamStore, dispatch } from '../vendor/dsh-purge/lib/redteam/store-core.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-projects-'));
  const store = new RedteamStore(root);
  t.after(() => { store.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return store;
}

test('projects create, switch, and persist independently across store restarts', (t) => {
  const store = fixture(t);
  const first = dispatch(store, { op: 'openEngagement', name: '本地演练一', createOnly: true });
  const second = dispatch(store, { op: 'openEngagement', name: '本地演练二', createOnly: true });
  assert.ok(first.ok && second.ok);
  assert.equal(dispatch(store, { op: 'bootstrap' }).engagements.length, 2);
  assert.ok(dispatch(store, { op: 'activateEngagement', engagement: first.engagement.id }).ok);
  store.close();
  const reopened = new RedteamStore(store.root);
  try { assert.equal(dispatch(reopened, { op: 'bootstrap' }).current, first.engagement.id); }
  finally { reopened.close(); }
});

test('create-only rejects duplicates and invalid names without overwriting a project', (t) => {
  const store = fixture(t);
  const created = dispatch(store, { op: 'openEngagement', name: 'Demo Project', createOnly: true });
  assert.ok(created.ok);
  const meta = fs.readFileSync(store.metaPathOf(created.engagement.id), 'utf8');
  for (const name of ['Demo Project', 'demo-project', '', '   ', null, {}, 'x'.repeat(101)]) {
    assert.equal(dispatch(store, { op: 'openEngagement', name, createOnly: true }).ok, false, JSON.stringify(name));
  }
  assert.equal(fs.readFileSync(store.metaPathOf(created.engagement.id), 'utf8'), meta);
  assert.equal(store.listEngagements().length, 1);
});

test('bootstrap ignores a stale requested project after it has been removed', (t) => {
  const store = fixture(t);
  const first = store.openEngagement('保留项目');
  assert.equal(dispatch(store, { op: 'bootstrap', engagement: 'removed-project' }).current, first.id);
});

// Execute the actual Panel render and handlers with a small hook host; no browser or API dependency.
const source = fs.readFileSync(new URL('../vendor/dsh-purge/client.js', import.meta.url), 'utf8');
const start = source.indexOf('    function Panel(props) {');
const end = source.indexOf('    /* ---------------------------------------------------------- 入口按钮 */', start);
const panelSource = source.slice(start, end);
const flatten = node => node && typeof node === 'object' ? [node, ...(node.children || []).flatMap(flatten)] : [];

test('an existing project still exposes a creation form and submits a distinct project', async () => {
  const states = [[{ id: 'existing', name: '已有项目' }], 'existing'];
  let cursor = 0;
  const calls = [];
  const React = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(initial) { const [value] = this.useState({ current: initial }); return value; },
    useEffect() {}, useCallback(fn) { return fn; },
  };
  const context = { React, h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }), useUI: () => ({ open: true, tab: 'assets' }), loadRtGeom: () => ({}), isFullWindow: () => false, clickable: onClick => ({ onClick }), AssetsTab: 'AssetsTab', RtBoundary: 'Boundary', setUI() {},
    api: async request => { calls.push(request); if (request.op === 'openEngagement') return { ok: true, engagement: { id: 'new-project' } }; if (request.op === 'bootstrap') return { ok: true, engagements: [{ id: 'existing' }, { id: 'new-project' }], current: 'new-project' }; return { ok: true }; },
  };
  const Panel = vm.runInNewContext(panelSource + '\nPanel', context);
  const render = () => { cursor = 0; return flatten(Panel({ embedded: true })); };
  const create = render().find(node => node.type === 'button' && node.children.includes('新建项目'));
  assert.ok(create, 'creation must remain available after selecting an existing project');
  create.props.onClick();
  let nodes = render();
  const input = nodes.find(node => node.type === 'input' && node.props['aria-label'] === '项目名称');
  assert.ok(input);
  input.props.onChange({ target: { value: '新的本地项目' } });
  nodes = render();
  const submit = nodes.find(node => node.type === 'form');
  assert.ok(submit);
  await submit.props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  const request = calls.find(row => row.op === 'openEngagement');
  assert.equal(request.name, '新的本地项目');
  assert.equal(request.createOnly, true);
  assert.equal(render().find(node => node.type === 'select').props.value, 'new-project');
});


function panelHost(api) {
  const states = [[{ id: 'existing', name: '已有项目' }, { id: 'second' }, { id: 'third' }], 'existing'];
  let cursor = 0;
  let tab = 'assets';
  const React = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(initial) { const [value] = this.useState({ current: initial }); return value; },
    useEffect() {}, useCallback(fn) { return fn; },
  };
  const context = { React, h: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }), useUI: () => ({ open: true, tab }), loadRtGeom: () => ({}), isFullWindow: () => false, clickable: onClick => ({ onClick }), AssetsTab: 'AssetsTab', EnvTab: 'EnvTab', RtBoundary: 'Boundary', setUI() {}, api };
  const Panel = vm.runInNewContext(panelSource + '\nPanel', context);
  return {
    render() { cursor = 0; return flatten(Panel({ embedded: true })); },
    setTab(value) { tab = value; },
  };
}

test('project changes serialize rapid switching and refresh until activation finishes', async () => {
  const calls = [];
  let finishActivation;
  const host = panelHost(request => {
    calls.push(request);
    if (request.op === 'activateEngagement') return new Promise(resolve => { finishActivation = resolve; });
    return Promise.resolve({ ok: true });
  });
  const selector = host.render().find(node => node.type === 'select');
  const first = selector.props.onChange({ target: { value: 'second' } });
  const rapid = selector.props.onChange({ target: { value: 'third' } });
  let nodes = host.render();
  assert.equal(nodes.find(node => node.type === 'select').props.disabled, true);
  for (const label of ['新建项目', '刷新']) assert.equal(nodes.find(node => node.type === 'button' && node.children.includes(label)).props.disabled, true);
  await nodes.find(node => node.type === 'button' && node.children.includes('刷新')).props.onClick();
  assert.deepEqual(calls.map(row => row.op), ['activateEngagement']);
  finishActivation({ ok: true });
  await Promise.all([first, rapid]);
  nodes = host.render();
  assert.equal(nodes.find(node => node.type === 'select').props.value, 'second');
  assert.equal(nodes.find(node => node.type === 'select').props.disabled, false);
});

test('failed project activation reports the error and unlocks the next change', async () => {
  let attempts = 0;
  const host = panelHost(async request => {
    if (request.op !== 'activateEngagement') return { ok: true };
    return ++attempts === 1 ? { ok: false, error: '切换测试失败' } : { ok: true };
  });
  await host.render().find(node => node.type === 'select').props.onChange({ target: { value: 'second' } });
  let nodes = host.render();
  assert.ok(nodes.find(node => node.props.role === 'alert').children.includes('切换测试失败'));
  assert.equal(nodes.find(node => node.type === 'select').props.value, 'existing');
  assert.equal(nodes.find(node => node.type === 'select').props.disabled, false);
  await nodes.find(node => node.type === 'select').props.onChange({ target: { value: 'third' } });
  assert.equal(host.render().find(node => node.type === 'select').props.value, 'third');
});

test('project creation blocks repeated submit and competing switch until its list refresh completes', async () => {
  const calls = [];
  let finishCreate;
  const host = panelHost(request => {
    calls.push(request);
    if (request.op === 'openEngagement') return new Promise(resolve => { finishCreate = resolve; });
    if (request.op === 'bootstrap') return Promise.resolve({ ok: true, engagements: [{ id: 'existing' }, { id: 'created' }], current: 'created' });
    return Promise.resolve({ ok: true });
  });
  host.render().find(node => node.type === 'button' && node.children.includes('新建项目')).props.onClick();
  host.render().find(node => node.type === 'input' && node.props['aria-label'] === '项目名称').props.onChange({ target: { value: '新项目' } });
  const nodes = host.render();
  const form = nodes.find(node => node.type === 'form');
  const first = form.props.onSubmit({ preventDefault() {} });
  const duplicate = form.props.onSubmit({ preventDefault() {} });
  await nodes.find(node => node.type === 'select').props.onChange({ target: { value: 'second' } });
  assert.deepEqual(calls.map(row => row.op), ['openEngagement']);
  finishCreate({ ok: true, engagement: { id: 'created' } });
  await Promise.all([first, duplicate]);
  assert.equal(host.render().find(node => node.type === 'select').props.value, 'created');
  assert.equal(calls.filter(row => row.op === 'bootstrap').length, 1);
});

test('project pages reset their state on a change while global pages retain theirs', async () => {
  const host = panelHost(async () => ({ ok: true }));
  const pageKey = () => host.render().find(node => node.props.className === 'rt-body').props.key;
  const firstKey = pageKey();
  await host.render().find(node => node.type === 'select').props.onChange({ target: { value: 'second' } });
  assert.notEqual(pageKey(), firstKey);
  host.setTab('env');
  const globalKey = pageKey();
  await host.render().find(node => node.type === 'select').props.onChange({ target: { value: 'third' } });
  assert.equal(pageKey(), globalKey);
});
