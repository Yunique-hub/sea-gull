#!/usr/bin/env node
/**
 * 装进 DSH profile 时补两笔（#154）：
 *   1. dsh.profile.bundles
 *   2. 用户层 cordis.patch.yml 的本体 insert
 * pnpm add / dsh plugin add 都不会自己写 insert；市场会写，已有则跳过。
 * 在插件仓库里跑 pnpm install 则整段跳过。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PURGE_NAME as NAME,
  ensureProfileBodyInsert,
  ensureProfileBundles,
  ensurePnpmAllowBuild,
  profileHasPurgeBodyInsert,
} from "../lib/profile-insert.js";

export { profileHasPurgeBodyInsert };

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

function isProfilePkg(pkg) {
  if (!pkg || typeof pkg !== "object") return false;
  if (typeof pkg.name === "string" && pkg.name.startsWith("dsh-profile-")) return true;
  return Array.isArray(pkg.dsh?.profile?.bundles);
}

function findProfileDir() {
  const seeds = [process.env.INIT_CWD, process.env.npm_config_local_prefix, process.cwd()].filter(Boolean);
  for (const seed of seeds) {
    let dir = path.resolve(seed);
    for (let i = 0; i < 8; i += 1) {
      if (isProfilePkg(readJson(path.join(dir, "package.json")))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return "";
}

function ensureProfileInsert(profileDir) {
  const result = ensureProfileBodyInsert(profileDir);
  if (result.wrote) {
    process.stdout.write(`dsh-purge: wrote body insert (${result.path})\n`);
  } else {
    process.stdout.write(`dsh-purge: insert already in ${result.path}\n`);
  }
  return result.wrote;
}

function main() {
  const profileDir = findProfileDir();
  if (!profileDir) return;

  const fp = path.join(profileDir, "package.json");
  const pkg = readJson(fp);
  if (!pkg) {
    process.stderr.write(`dsh-purge: cannot read ${fp}\n`);
    process.exit(1);
  }
  const bundles = ensureProfileBundles(profileDir);
  process.stdout.write(bundles.wrote
    ? `dsh-purge: appended to bundles (${profileDir})\n`
    : `dsh-purge: already in bundles (${profileDir})\n`);

  try {
    ensureProfileInsert(profileDir);
    const pnpm = ensurePnpmAllowBuild(profileDir);
    if (pnpm.wrote) process.stdout.write(`dsh-purge: allowed pnpm build for ${NAME}\n`);
  } catch (e) {
    process.stderr.write(`dsh-purge: insert failed: ${e && e.message ? e.message : e}\n`);
    process.exit(1);
  }
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) main();
