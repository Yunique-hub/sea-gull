import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ALL_PATCHES } from "../vendor/dsh-purge/lib/core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const version = read("VERSION").trim();
const patchCount = ALL_PATCHES.length;

test("VERSION 与根 README / 英文 README 的当前版本一致", () => {
  assert.match(read("README.md"), new RegExp(`version-${version.replace(/\./g, "\\.")}`));
  assert.match(read("README.md"), new RegExp(`当前 \\*\\*v${version.replace(/\./g, "\\.")}\\*\\*`));
  assert.match(read("README.en.md"), new RegExp(`\\*\\*v${version.replace(/\./g, "\\.")}`));
});

test("补丁数量在 README / NOTICE / ARCHITECTURE 与 ALL_PATCHES 一致", () => {
  const re = new RegExp(`${patchCount} 条`);
  assert.match(read("README.md"), re);
  assert.match(read("NOTICE"), re);
  assert.match(read("docs/ARCHITECTURE.md"), re);
  assert.match(read("README.en.md"), new RegExp(`${patchCount} local patch`));
});

test("1.0.12 的范围闸归因已从当前文档移除", () => {
  for (const rel of ["README.md", "README.en.md", "NOTICE"]) {
    assert.doesNotMatch(read(rel), /1\.0\.12 起/, `${rel} 仍把范围闸归因到 1.0.12`);
  }
});

test("当前状态页存在且指向当前版本", () => {
  assert.match(read("docs/CURRENT.md"), new RegExp(version.replace(/\./g, "\\.")));
  assert.match(read("docs/CURRENT.md"), /profile/i);
});

test("面板文案与版本展示不再回退到旧的本地靶场说明", () => {
  const client = read("vendor/dsh-purge/client.js");
  assert.doesNotMatch(client, /开源版攻击任务只放行本机/);
  assert.match(client, /channel\.seagull/);
  assert.match(client, /seagull_version/);
  assert.match(read("vendor/dsh-purge/lib/index.js"), /海鸥版本 \/ seagull/);
  assert.match(read("vendor/dsh-purge/lib/core.js"), /export function seagullVersion/);
});