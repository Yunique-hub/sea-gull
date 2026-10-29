import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { resolvePython } from './python-exec.mjs';

const script = fileURLToPath(new URL('../src/tools/patch_profile.py', import.meta.url));
const python = resolvePython();

function fixture(t, data) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'seagull-profile-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const file = path.join(temp, 'package.json');
  fs.writeFileSync(file, data);
  return { file, temp, run: (...args) => spawnSync(python.command, [...python.args, script, ...args], { encoding: 'utf8' }) };
}

test('profile accepts UTF-8 BOM and preserves unrelated configuration on add/remove', (t) => {
  const original = '\ufeff' + JSON.stringify({ dependencies: { other: '1' }, dsh: { profile: { bundles: ['base'], custom: { retain: true } } }, custom: ['中文'] });
  const f = fixture(t, original);
  const result = f.run(f.file);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(f.file + '.bak-seagull', 'utf8'), original);
  const after = fs.readFileSync(f.file, 'utf8');
  assert.equal(f.run(f.file).status, 0);
  assert.equal(fs.readFileSync(f.file, 'utf8'), after);
  assert.equal(f.run('--remove', f.file, 'dsh-purge').status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.file, 'utf8')), JSON.parse(original.slice(1)));
});

test('profile rejects malformed field types without changing files or making backups', (t) => {
  for (const data of [{ dependencies: [] }, { dsh: [] }, { dsh: { profile: [] } }, { dsh: { profile: { bundles: {} } } }, [], { dependencies: null }]) {
    const text = JSON.stringify(data);
    const f = fixture(t, text);
    const result = f.run(f.file);
    assert.notEqual(result.status, 0, text);
    assert.equal(fs.readFileSync(f.file, 'utf8'), text);
    assert.deepEqual(fs.readdirSync(f.temp), ['package.json']);
  }
});

test('profile validation is read-only and allows missing optional fields', (t) => {
  const f = fixture(t, '{"name":"profile"}');
  const result = f.run('--validate', f.file);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(f.file, 'utf8'), '{"name":"profile"}');
  assert.deepEqual(fs.readdirSync(f.temp), ['package.json']);
});

test('failed atomic replacement leaves original JSON and removes the temporary file', (t) => {
  const f = fixture(t, '{"dependencies":{}}');
  const code = `import importlib.util, pathlib, sys\nfrom unittest.mock import patch\nspec = importlib.util.spec_from_file_location('profile_patch', sys.argv[1])\nm = importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\nwith patch('os.replace', side_effect=OSError('replace failed')):\n    try:\n        m.cmd_add(pathlib.Path(sys.argv[2]), 'file:plugin', 'dsh-purge')\n    except OSError:\n        sys.exit(17)\n`;
  const result = spawnSync(python.command, [...python.args, '-c', code, script, f.file], { encoding: 'utf8' });
  assert.equal(result.status, 17, result.stderr);
  assert.equal(fs.readFileSync(f.file, 'utf8'), '{"dependencies":{}}');
  assert.deepEqual(fs.readdirSync(f.temp).sort(), ['package.json', 'package.json.bak-seagull']);
});
