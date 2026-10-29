// 版本号单一来源：VERSION 是唯一真源，两个安装器必须与它一致。
//
// 现在三处都是 1.0.10，靠人肉同步。这种"恰好一致"在下次发版时最容易漏一处，
// 表现是"更新后版本号没变"或"面板显示旧版本"，排查成本很高。这里直接锁死。

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('VERSION holds a plain semver string', () => {
  const version = read('VERSION').trim();
  assert.match(version, /^\d+\.\d+\.\d+$/, `VERSION 内容异常: ${JSON.stringify(version)}`);
});

test('install.ps1 declares the same version as VERSION', () => {
  const version = read('VERSION').trim();
  const match = read('install.ps1').match(/^\s*\$VERSION\s*=\s*"([^"]+)"/m);
  assert.ok(match, 'install.ps1 里找不到 $VERSION 定义');
  assert.equal(match[1], version, 'install.ps1 的 $VERSION 与 VERSION 文件不一致');
});

test('install.sh declares the same version as VERSION', () => {
  const version = read('VERSION').trim();
  const match = read('install.sh').match(/^\s*VERSION="([^"]+)"/m);
  assert.ok(match, 'install.sh 里找不到 VERSION 定义');
  assert.equal(match[1], version, 'install.sh 的 VERSION 与 VERSION 文件不一致');
});

test('the bundled plugin advertises the same seagull version', () => {
  const version = read('VERSION').trim();
  const pkg = JSON.parse(read('vendor/dsh-purge/package.json'));
  assert.equal(pkg.seagull?.version, version, 'vendor/dsh-purge 的 seagull.version 与 VERSION 文件不一致');
  assert.equal(pkg.seagull?.updateManaged, true, 'updateManaged 必须为 true，否则原版更新器会覆盖定制代码');
});