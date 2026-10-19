import fs from "node:fs";
import path from "node:path";

const DEFAULT_SETTINGS = Object.freeze({ keepMnemon: false });
const SETTINGS_FILE = "mnemon.json";

function mnemonSettingsPath(dshHome) {
  return path.join(dshHome, "dsh-purge", SETTINGS_FILE);
}

export function loadMnemonSettings(dshHome, configValue) {
  let file = {};
  try {
    const fp = mnemonSettingsPath(dshHome);
    if (fs.existsSync(fp)) {
      const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (parsed && typeof parsed === "object") file = parsed;
    }
  } catch {
    file = {};
  }
  const pick = [file.keepMnemon, configValue, DEFAULT_SETTINGS.keepMnemon];
  const value = pick.find((v) => typeof v === "boolean");
  return { keepMnemon: value === undefined ? false : value };
}

function atomicWriteFileSync(fp, content, encoding = "utf8") {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, content, encoding);
    try { fs.fsyncSync(fd); } catch { /* FS 不支持 fsync 时忽略 */ }
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, fp);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw e;
  }
}

export function saveMnemonSettings(dshHome, patch) {
  const fp = mnemonSettingsPath(dshHome);
  const current = loadMnemonSettings(dshHome);
  const next = {
    keepMnemon: typeof patch?.keepMnemon === "boolean"
      ? patch.keepMnemon
      : current.keepMnemon,
  };
  atomicWriteFileSync(fp, `${JSON.stringify(next, null, 2)}\n`);
  return { ok: true, ...next, path: fp };
}
