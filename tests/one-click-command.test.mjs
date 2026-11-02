import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('published Windows commands execute the remote scriptblock with Apply', () => {
  for (const file of ['README.md', 'README.en.md', 'docs/DEPLOY.md']) {
    const text = read(file);
    assert.match(text, /\& \(\[scriptblock\]::Create\(\(irm https:\/\/raw\.githubusercontent\.com\/Yunique-hub\/sea-gull\/main\/install\.ps1[^\n]+\)\) -Apply/);
    assert.match(text, /\& \(\[scriptblock\]::Create\(\(irm https:\/\/raw\.githubusercontent\.com\/Yunique-hub\/sea-gull\/main\/update\.ps1[^\n]+\)\) -Apply/);
  }
});

test('published Bash commands forward Apply through stdin execution', () => {
  for (const file of ['README.md', 'README.en.md', 'docs/DEPLOY.md']) {
    const text = read(file);
    assert.match(text, /install\.sh \| bash -s -- --apply/);
    assert.match(text, /update\.sh \| bash -s -- --apply/);
  }
});

test('first install has non-interactive toolkit defaults and Apply owns desktop restart', () => {
  const ps = read('install.ps1');
  const sh = read('install.sh');
  assert.doesNotMatch(ps, /Read-Host/);
  assert.doesNotMatch(sh, /read\s+-r/);
  assert.match(ps, /SeaGull\\toolkit/);
  assert.match(sh, /seagull\/toolkit/);
  assert.match(ps, /lib\\reapply-cli\.js/);
  assert.match(sh, /lib\/reapply-cli\.js/);
  assert.match(ps, /CI[\s\S]+--no-frozen-lockfile/);
  assert.match(sh, /CI=true[\s\S]+--no-frozen-lockfile/);
  assert.match(ps, /ensure-profile-bundle\.mjs/);
  assert.match(sh, /ensure-profile-bundle\.mjs/);
  assert.match(ps, /complete_desktop_apply\.ps1/);
  assert.match(sh, /complete_desktop_apply\.ps1/);
  const helper = read('src/tools/complete_desktop_apply.ps1');
  assert.equal(helper.charCodeAt(0), 0xfeff, 'Windows PowerShell 5.1 requires a UTF-8 BOM for localized helper output');
  assert.match(helper, /Get-CimInstance Win32_Process/);
  assert.match(helper, /resources\\app\\/);
  assert.match(helper, /已确认 DeepSeek Harness/);
  assert.match(ps, /-PrepareOnly/);
  assert.match(ps, /--fresh-extract/);
  assert.match(sh, /-PrepareOnly/);
  assert.match(sh, /--fresh-extract/);
});
