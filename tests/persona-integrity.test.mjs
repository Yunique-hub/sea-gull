// 人格章节完整性。
//
// 背景：src/prompt/prompt-inject.md 的章号从 22 直接跳到 24，全文没有 `## 23`。
// 人格是三处同源的真源（用户 .dsh、源码、加密槽），所以这个缺口在三处同时存在。
// 既有单源测试只断言哈希一致，不断言章节完整，因此 136 项全绿也盖得住。
//
// 这里做两件事：
//   1. 章节号必须唯一、递增——防止以后重复或倒退。
//   2. §23 的缺口以「显式已知缺口」形式登记，缺口消失即提示删除豁免，
//      避免有人以为补齐了而实际只是改了个无关文件。

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const persona = fs.readFileSync(path.join(root, 'src/prompt/prompt-inject.md'), 'utf8');

// 已知缺口：等 YG 确认 §23 是「整节丢失」还是「纯跳号」后再修。修好后删掉这个常量。
const KNOWN_MISSING_SECTIONS = [23];

function sectionNumbers(text) {
  return [...text.matchAll(/^## (\d+)\.\s/gm)].map(match => Number(match[1]));
}

test('persona sections are unique', () => {
  const numbers = sectionNumbers(persona);
  assert.equal(new Set(numbers).size, numbers.length, `章节号有重复: ${numbers.join(', ')}`);
});

test('persona sections are strictly increasing', () => {
  const numbers = sectionNumbers(persona);
  for (let i = 1; i < numbers.length; i++) {
    assert.ok(numbers[i] > numbers[i - 1], `章节号未递增: ${numbers[i - 1]} → ${numbers[i]}`);
  }
});

test('persona starts at section 0 and has no empty titles', () => {
  const numbers = sectionNumbers(persona);
  assert.equal(numbers[0], 0, '人格应从 §0 开始');
  const emptyTitles = [...persona.matchAll(/^## (\d+)\.\s*$/gm)].map(match => match[1]);
  assert.deepEqual(emptyTitles, [], `存在空标题章节: ${emptyTitles.join(', ')}`);
});

test('section gaps match the registered known-missing list', () => {
  const numbers = sectionNumbers(persona);
  const gaps = [];
  for (let i = numbers[0]; i <= numbers[numbers.length - 1]; i++) {
    if (!numbers.includes(i)) gaps.push(i);
  }
  assert.deepEqual(
    gaps,
    KNOWN_MISSING_SECTIONS,
    gaps.length === 0
      ? '缺口已补齐，请删除 KNOWN_MISSING_SECTIONS 里的豁免声明'
      : `出现未登记的章节缺口: ${gaps.join(', ')}（已登记: ${KNOWN_MISSING_SECTIONS.join(', ') || '无'}）`,
  );
});