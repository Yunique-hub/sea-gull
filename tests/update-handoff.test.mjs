import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { wshLiteral } from '../vendor/dsh-purge/lib/official-update.js';

const template = fs.readFileSync(new URL('../vendor/dsh-purge/lib/official-update.wscript', import.meta.url), 'utf8');

function simulate(outcomes, { blocked = false, legacyBackup = false, guardFails = false } = {}) {
  const exe = 'C:\\测试\\DeepSeek Harness\\DeepSeek Harness.exe';
  const resources = 'C:\\测试\\DeepSeek Harness\\resources';
  const installer = 'C:\\Cache\\deepseek-harness-0.2.1-rc.2-win-x64.exe';
  const logPath = 'C:\\Temp\\update.log';
  const norm = (value) => path.win32.normalize(value).toLowerCase();
  const asar = norm(resources + '\\app.asar');
  const app = norm(resources + '\\app');
  const backup = asar + (legacyBackup ? '.bak' : '.sealed.bak');
  const files = new Map([[norm(exe), { Size: 10, DateLastModified: 'old' }], [backup, { Size: 20, DateLastModified: 'old' }]]);
  files.set(norm('C:\\User\\.dsh\\profiles\\desktop\\node_modules\\dsh-purge\\lib\\official-update-runtime.ps1'), { Size: 1 });
  const folders = new Set([app]);
  const runs = [], logs = [], popups = [];
  let alive = true, clock = 0, installerCalls = 0, exitCode;
  const writer = { WriteLine: (text) => logs.push(text), Close() {} };
  const fso = {
    GetParentFolderName: path.win32.dirname,
    FileExists: (name) => files.has(norm(name)),
    FolderExists: (name) => folders.has(norm(name)),
    GetFile: (name) => files.get(norm(name)),
    OpenTextFile: () => writer,
    CreateTextFile: (name) => { files.set(norm(name), { Size: 1 }); return writer; },
    CopyFile: (src, dst) => files.set(norm(dst), { ...files.get(norm(src)) }),
    DeleteFile: (name) => files.delete(norm(name)),
    DeleteFolder: (name) => folders.delete(norm(name)),
    MoveFolder: (src, dst) => { assert.ok(folders.has(norm(src))); folders.delete(norm(src)); folders.add(norm(dst)); },
  };
  const shell = {
    Run(command, style, wait) {
      runs.push({ command, style, wait });
      if (command.startsWith('taskkill')) { if (!blocked) alive = false; return 0; }
      if (command.includes('official-update-runtime.ps1')) return guardFails && command.includes('-Action Detach') ? 1 : 0;
      if (!command.includes(installer)) return 0;
      const outcome = outcomes[installerCalls++] || { code: 2 };
      if (outcome.throws) throw new Error('cannot launch installer');
      if (outcome.changeExe) files.set(norm(exe), { Size: 11, DateLastModified: 'new' });
      if (outcome.changeAsar) files.set(asar, { Size: 21, DateLastModified: 'new' });
      return outcome.code;
    },
    Popup: (...args) => popups.push(args),
    ExpandEnvironmentStrings: (text) => ({ '%DSH_HOME%': 'C:\\User\\.dsh', '%SystemRoot%': 'C:\\Windows' })[text] || text,
    Environment: () => ({ Remove() {} }),
  };
  const stopped = new Error('WScript.Quit');
  const sandbox = {
    ActiveXObject: function (name) { return name === 'WScript.Shell' ? shell : fso; },
    GetObject: () => ({ ExecQuery: () => alive ? [{ ExecutablePath: exe, ProcessId: 123 }] : [] }),
    Enumerator: function (items) { let index = 0; return { atEnd: () => index >= items.length, moveNext: () => index++, item: () => items[index] }; },
    Date: class extends Date { constructor() { super(clock); } },
    WScript: { Sleep: (ms) => { clock += ms; }, Quit: (code) => { exitCode = code; throw stopped; } },
  };
  let source = template;
  for (const [key, value] of Object.entries({ EXE: exe, INSTALLER: installer, RESOURCES: resources, INSTALL_DIR: path.win32.dirname(exe), LOG: logPath })) source = source.split('__' + key + '_JSON__').join(wshLiteral(value));
  assert.doesNotMatch(source, /[^\x00-\x7f]/);
  try { vm.runInNewContext(source, sandbox); } catch (error) { if (error !== stopped) throw error; }
  return { files, folders, runs, logs, popups, installerCalls, exitCode, shell, asar, app, marker: norm(resources + '\\dsh-purge-reapply-asar') };
}

test('successful update restores the sealed archive, installs, and requests reapplication', () => {
  const result = simulate([{ code: 0, changeExe: true, changeAsar: true }]);
  assert.equal(result.installerCalls, 1);
  assert.ok(result.files.has(result.marker));
  assert.ok(result.logs.some((line) => line.includes('restored-asar')));
  assert.equal(result.shell.CurrentDirectory, 'C:\\Temp');
  const install = result.runs.find((run) => run.command.includes('--updated'));
  assert.match(install.command, /\/currentuser \/S \/D=C:\\测试\\DeepSeek Harness$/);
  assert.equal(result.popups.length, 0);
  assert.ok(result.runs.findIndex((run) => run.command.includes('-Action Detach')) < result.runs.findIndex((run) => run.command.includes('--updated')));
});

test('exit code 2 retries visibly, restores the prior app, and reports failure', () => {
  const result = simulate([{ code: 2 }, { code: 2 }]);
  assert.equal(result.installerCalls, 2);
  const retry = result.runs.filter((run) => run.command.includes('win-x64.exe'))[1];
  assert.equal(retry.style, 1);
  assert.doesNotMatch(retry.command, /\/S/);
  assert.match(retry.command, /\/currentuser/);
  assert.ok(result.folders.has(result.app));
  assert.equal(result.files.has(result.asar), false);
  assert.equal(result.files.has(result.marker), false);
  assert.match(result.popups[0][0], /exit code 2/);
  assert.ok(result.runs.some((run) => run.command.includes('-Action Restore')));
});

test('partial writes with a failing exit code never report update success', () => {
  const result = simulate([{ code: 2, changeAsar: true }, { code: 2 }]);
  assert.equal(result.files.has(result.marker), false);
  assert.ok(result.folders.has(result.app));
  assert.equal(result.popups.length, 1);
});

test('installer launch errors restore the app and remain visible', () => {
  const result = simulate([{ throws: true }, { throws: true }], { legacyBackup: true });
  assert.ok(result.folders.has(result.app));
  assert.equal(result.files.has(result.marker), false);
  assert.ok(result.logs.some((line) => line.includes('installer-error')));
  assert.equal(result.popups.length, 1);
});

test('a remaining app process cancels before moving any application files', () => {
  const result = simulate([], { blocked: true });
  assert.equal(result.exitCode, 2);
  assert.equal(result.installerCalls, 0);
  assert.ok(result.folders.has(result.app));
  assert.equal(result.files.has(result.marker), false);
});

test('a runtime guard failure cancels before moving files or launching the installer', () => {
  const result = simulate([], { guardFails: true });
  assert.equal(result.exitCode, 2);
  assert.equal(result.installerCalls, 0);
  assert.ok(result.folders.has(result.app));
  assert.ok(result.runs.some((run) => run.command.includes('-Action Restore')));
  assert.match(result.popups[0][0], /Runtime links/);
});
