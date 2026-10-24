#!/usr/bin/env node
/**
 * pnpm add 只写 dependencies，不会把插件写进 dsh.profile.bundles。
 * 装进 DSH profile 时补上这一笔；在插件仓库里跑 pnpm install 则跳过。
 */
import fs from "node:fs";
import path from "node:path";

const NAME = "dsh-purge";

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

const profileDir = findProfileDir();
if (!profileDir) process.exit(0);

const fp = path.join(profileDir, "package.json");
const pkg = readJson(fp);
if (!pkg) {
  process.stderr.write(`dsh-purge: cannot read ${fp}\n`);
  process.exit(1);
}
pkg.dsh = pkg.dsh && typeof pkg.dsh === "object" ? pkg.dsh : {};
pkg.dsh.profile = pkg.dsh.profile && typeof pkg.dsh.profile === "object" ? pkg.dsh.profile : {};
const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];
if (bundles.includes(NAME)) {
  process.stdout.write(`dsh-purge: already in bundles (${profileDir})\n`);
  process.exit(0);
}
pkg.dsh.profile.bundles = [...bundles, NAME];
fs.writeFileSync(fp, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
process.stdout.write(`dsh-purge: appended to bundles (${profileDir})\n`);
