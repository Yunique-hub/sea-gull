// 人格章节完整性。
//
// 背景：src/prompt/prompt-inject.md 曾长期从 22 直接跳到 24，全文没有 `## 23`。
// 人格是三处同源的真源（用户 .dsh、源码、加密槽），所以缺口在三处同时存在。
// 既有单源测试只断言哈希一致，不断言章节完整，因此全绿也盖得住。
//
// 2026-10-29 已确认那只是编号跳号（`git log -S'## 23.'` 全历史零命中），
// 原 §24 顺延为 §23，并把 §22 仲裁表里指向不存在 §23 的悬空引用改到本节。
// 现在章节必须连续，不再有豁免。
//
// 这里做两件事：
//   1. 章节号必须唯一、递增、无空标题。
//   2. 章节号必须连续——一旦出现新缺口立即失败。

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const persona = fs.readFileSync(path.join(root, 'src/prompt/prompt-inject.md'), 'utf8');

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

test('persona sections are contiguous with no gaps', () => {
  const numbers = sectionNumbers(persona);
  const gaps = [];
  for (let i = numbers[0]; i <= numbers[numbers.length - 1]; i++) {
    if (!numbers.includes(i)) gaps.push(i);
  }
  assert.deepEqual(gaps, [], `章节号出现缺口: ${gaps.join(', ')}（§23 已于 2026-10-29 补齐，不应再有豁免）`);
});

test('no cross-reference points at a non-existent section', () => {
  const numbers = new Set(sectionNumbers(persona));
  const dangling = [];
  for (const match of persona.matchAll(/§(\d+)/g)) {
    const target = Number(match[1]);
    if (target > 8 && !numbers.has(target)) dangling.push(target);
  }
  // §8 指的是内核内部 A/B 分区编号，不是章节号，故排除在检查外。
  assert.deepEqual(dangling, [], `存在指向不存在章节的引用: ${dangling.join(', ')}`);
});