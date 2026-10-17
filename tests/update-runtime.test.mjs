import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const guard = fileURLToPath(new URL('../vendor/dsh-purge/lib/official-update-runtime.ps1', import.meta.url));
const windows = process.platform === 'win32';

function fixture(run) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-junction-'));
  try {
    const resources = path.join(temp, "中文 Harness's Space", 'resources');
    const runtime = path.join(resources, 'runtime');
    const manifest = path.join(temp, 'update.log.runtime-links.json');
    fs.mkdirSync(runtime, { recursive: true });
    fs.writeFileSync(path.join(runtime, 'sentinel'), 'shared runtime');
    const invoke = (action) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', guard, '-Action', action, '-Resources', resources, '-Manifest', manifest], { encoding: 'utf8', windowsHide: true });
    run({ temp, resources, runtime, manifest, invoke });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test('Windows updater detaches and restores runtime junctions without changing their target', { skip: !windows }, () => fixture(({ resources, runtime, invoke }) => {
  for (const name of ['app', 'app.dshpurge-prev', 'app.dshpurge-prev-123']) {
    fs.mkdirSync(path.join(resources, name));
    fs.symlinkSync(runtime, path.join(resources, name, 'runtime'), 'junction');
  }
  const detach = invoke('Detach');
  assert.equal(detach.status, 0, detach.stdout + detach.stderr);
  assert.equal(fs.existsSync(path.join(resources, 'app/runtime')), false);
  assert.equal(fs.readFileSync(path.join(runtime, 'sentinel'), 'utf8'), 'shared runtime');
  for (const action of ['Restore', 'Restore', 'Detach', 'Restore']) {
    const result = invoke(action);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  assert.ok(fs.lstatSync(path.join(resources, 'app/runtime')).isSymbolicLink());
  assert.equal(fs.readFileSync(path.join(runtime, 'sentinel'), 'utf8'), 'shared runtime');
}));

test('Windows updater rejects a foreign runtime target before removing any links', { skip: !windows }, () => fixture(({ temp, resources, runtime, invoke }) => {
  const external = path.join(temp, 'outside');
  fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, 'sentinel'), 'outside');
  for (const [name, target] of [['app', runtime], ['app.dshpurge-prev', external]]) {
    fs.mkdirSync(path.join(resources, name));
    fs.symlinkSync(target, path.join(resources, name, 'runtime'), 'junction');
  }
  assert.notEqual(invoke('Detach').status, 0);
  assert.ok(fs.lstatSync(path.join(resources, 'app/runtime')).isSymbolicLink());
  assert.equal(fs.readFileSync(path.join(external, 'sentinel'), 'utf8'), 'outside');
}));

test('Windows updater rejects a linked application directory', { skip: !windows }, () => fixture(({ temp, resources, invoke }) => {
  const external = path.join(temp, 'outside');
  fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, 'sentinel'), 'outside');
  fs.symlinkSync(external, path.join(resources, 'app'), 'junction');
  assert.notEqual(invoke('Detach').status, 0);
  assert.equal(fs.readFileSync(path.join(external, 'sentinel'), 'utf8'), 'outside');
}));
