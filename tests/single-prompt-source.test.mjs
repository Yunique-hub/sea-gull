// 单源化回归（1.0.8）：人格只有一份 —— src/prompt/prompt-inject.md。
// 断言：
//   1) 人格源存在、非空、不含 ChatML 标签（CONTRIBUTING.md:16）
//   2) 加密槽源文件与人格源逐字节一致（同一份，不是两份）
//   3) 加密槽解包结果 == 人格源（「恢复默认」恢复的就是这一份）
//   4) 安装器不再投放 rules 人格副本，且带 1.0.7 → 1.0.8 迁移清理
//   5) 历史规则集已归档到 docs/archive/，且 src/rules 不再存在
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createDecipheriv, createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const norm = (s) => String(s).replace(/\r\n/g, "\n");
const solo = norm(read("src/prompt/prompt-inject.md"));

// 与 vendor/dsh-purge/lib/table-key.js 同一份配方
const MIX = ["cordis.slot.v2", "dsh-purge", "surface:web|desktop", "ov.table.1"];
const mixKey = (extra) => createHash("sha256").update(`${MIX.join("\x1e")}\x1e${String(extra || "")}`).digest();

test("人格源存在、非空、无 ChatML 标签", () => {
  assert.ok(solo.trim().length > 10000, `人格源过小: ${solo.length}`);
  for (const tag of ["<|im_start|>", "<project_instructions>", "</project_instructions>", "<|im_end|>"]) {
    assert.ok(!solo.includes(tag), `src/prompt/prompt-inject.md 不应含 ChatML 标签: ${tag}`);
  }
  assert.match(solo, /全破内核/, "人格源应含「全破内核」标题");
  assert.match(solo, /海鸥在线，你要整点薯条吗？/, "人格源应保留判定性问候句");
});

test("加密槽源文件与人格源逐字节一致（单源，不是两份）", () => {
  const slotSource = norm(read("vendor/dsh-purge/lib/default-prompt-inject.md"));
  assert.equal(slotSource, solo, "vendor 槽源必须与 src/prompt 人格源完全一致");
});

test("加密槽解包 == 人格源（恢复默认恢复的就是同一份）", async () => {
  const table = await import(pathToFileURL(path.join(root, "vendor/dsh-purge/lib/asset-table.js")).href);
  for (const key of ["SLOT", "MASK", "TAG", "IV"]) {
    assert.ok(typeof table[key] === "string" && table[key].length > 0, `asset-table 缺少 ${key}`);
  }
  const decipher = createDecipheriv("aes-256-gcm", mixKey(table.MASK), Buffer.from(table.IV, "base64"));
  decipher.setAuthTag(Buffer.from(table.TAG, "base64"));
  const plain = inflateSync(
    Buffer.concat([decipher.update(Buffer.from(table.SLOT, "base64")), decipher.final()]),
  ).toString("utf8");
  assert.equal(norm(plain), solo, "加密槽内容必须等于唯一真源");
});

test("安装器不再投放人格规则副本，且带迁移清理", () => {
  const ps = read("install.ps1");
  const sh = read("install.sh");
  assert.ok(!/Copy-Item[^\n]*src\\rules\\seagull-fullbreak/.test(ps), "install.ps1 不应再复制规则副本");
  assert.ok(!/cp\s+"\$ROOT\/src\/rules\/seagull-fullbreak/.test(sh), "install.sh 不应再复制规则副本");
  assert.match(ps, /rules\\seagull-fullbreak\.md/, "install.ps1 应清理 1.0.7 遗留副本");
  assert.match(sh, /rules\/seagull-fullbreak\.md/, "install.sh 应清理 1.0.7 遗留副本");
  assert.ok(ps.includes("vendor\\dsh-purge\\lib\\default-prompt-inject.md"), "install.ps1 应校验槽源文件");
  assert.ok(sh.includes("vendor/dsh-purge/lib/default-prompt-inject.md"), "install.sh 应校验槽源文件");
});

test("历史规则集已归档，src/rules 不再存在", () => {
  assert.ok(fs.existsSync(path.join(root, "docs/archive/seagull-fullbreak-1.0.7.md")), "旧规则集应归档");
  assert.ok(fs.existsSync(path.join(root, "docs/archive/seagull-fullbreak-1.0.7.json")), "旧规则集元数据应归档");
  assert.ok(!fs.existsSync(path.join(root, "src/rules")), "src/rules 应已移除");
});

test("冒烟与 CI 清单已改判单源", () => {
  assert.match(read("tests/smoke.sh"), /不应再落人格规则副本/, "smoke.sh 应断言规则副本不存在");
  assert.match(read(".github/workflows/ci.yml"), /vendor\/dsh-purge\/lib\/default-prompt-inject\.md/, "CI 资产清单应含槽源");
  assert.ok(!read(".github/workflows/ci.yml").includes("src/rules/seagull-fullbreak"), "CI 不应再引用 src/rules");
});