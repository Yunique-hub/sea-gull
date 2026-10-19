/**
 * 停用/卸载时清掉指向本插件预设的 selectedDefault。
 * 宿主 resolve() 对未知预设是硬抛，不回退 config.default（#108）。
 */
import fs from "node:fs";
import path from "node:path";
import { findDshHome } from "./core.js";

const OWNED_PRESET_IDS = ["redteam", "redteam-executor"];
const FALLBACK_PRESET = "standard";

function isOwnedPresetId(value) {
  const id = String(value || "").trim().toLowerCase();
  if (!id) return false;
  return OWNED_PRESET_IDS.some((own) => id === own || id.endsWith(`/${own}`));
}

function readText(fp) {
  try {
    return fs.readFileSync(fp, "utf8");
  } catch {
    return "";
  }
}

function writeText(fp, text) {
  fs.writeFileSync(fp, text, "utf8");
}

function listProfilePatchFiles(dshHome) {
  const root = path.join(dshHome, "profiles");
  const out = [];
  let names = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return out;
  }
  for (const name of names) {
    if (name === "node_modules") continue;
    const fp = path.join(root, name, "cordis.patch.yml");
    if (fs.existsSync(fp)) out.push(fp);
  }
  return out;
}

/** 只改 selectedDefault 指向本插件预设的值，不重排整份 YAML。 */
function repairSelectedDefaultInYaml(text, fallback = FALLBACK_PRESET) {
  const src = String(text || "");
  if (!/selectedDefault/.test(src)) return { text: src, changed: false };
  let scalarIndent = null;
  const next = src.split(/(?<=\n)/).map((line) => {
    const indent = (line.match(/^[ \t]*/) || [""])[0].length;
    if (scalarIndent !== null) {
      if (!line.trim() || indent > scalarIndent) return line;
      scalarIndent = null;
    }
    if (/^[ \t]*(?:- )?[^#\n]+:[ \t]*[|>][+\-]?[0-9]?[ \t]*(?:#.*)?\r?\n?$/.test(line)) scalarIndent = indent;
    return line.replace(/^([ \t]*(?:- )?(?:selectedDefault|"selectedDefault"|'selectedDefault'):[ \t]*)(["']?)([\w./-]+)\2([ \t]*(?:#.*)?\r?\n?)$/, (all, key, quote, id, tail) =>
      isOwnedPresetId(id) ? key + quote + fallback + quote + tail : all);
  }).join("");
  return { text: next, changed: next !== src };
}

function repairProfilePatchFile(fp, fallback = FALLBACK_PRESET) {
  const raw = readText(fp);
  if (!raw) return { path: fp, changed: false };
  const { text, changed } = repairSelectedDefaultInYaml(raw, fallback);
  if (!changed) return { path: fp, changed: false };
  writeText(fp, text);
  return { path: fp, changed: true };
}

function configValue(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  try {
    if (typeof node.get === "function") return String(node.get() ?? "");
  } catch {
    /* ignore */
  }
  try {
    if (typeof node.value !== "undefined") return String(node.value ?? "");
  } catch {
    /* ignore */
  }
  return "";
}

function configSet(node, value) {
  if (!node) return false;
  try {
    if (typeof node.set === "function") {
      node.set(value);
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    node.value = value;
    return true;
  } catch {
    /* ignore */
  }
  return false;
}

function clearLiveSelectedDefault(ctx) {
  if (!ctx) return false;
  let persisted = false;
  try {
    const settings = typeof ctx.get === "function" ? ctx.get("settings") : ctx.settings;
    const row = settings?.get?.("agent-preset-registry")
      || settings?.get?.("@deepseek-ai/dsh-agent-preset-registry");
    const selected = configValue(row?.config?.selectedDefault || row?.selectedDefault);
    if (isOwnedPresetId(selected) && typeof settings?.update === "function") {
      const fallback = configValue(row?.config?.default || row?.default) || FALLBACK_PRESET;
      if (fallback && !isOwnedPresetId(fallback)) {
        const ret = settings.update("agent-preset-registry", { selectedDefault: fallback });
        if (ret && typeof ret.then === "function") ret.catch(() => {});
        persisted = true;
      }
    }
  } catch {
    /* ignore */
  }
  const bags = [];
  try {
    const reg = (typeof ctx.get === "function" ? ctx.get("agentPresets") : null) || ctx.agentPresets;
    if (reg) bags.push(reg.config || reg);
  } catch {
    /* ignore */
  }
  try {
    const settings = typeof ctx.get === "function" ? ctx.get("settings") : ctx.settings;
    const row = settings?.get?.("agent-preset-registry") || settings?.get?.("@deepseek-ai/dsh-agent-preset-registry");
    if (row) bags.push(row.config || row);
  } catch {
    /* ignore */
  }
  for (const bag of bags) {
    if (!bag) continue;
    const selected = bag.selectedDefault;
    const current = configValue(selected);
    if (!isOwnedPresetId(current)) continue;
    const fallback = configValue(bag.default) || FALLBACK_PRESET;
    if (configSet(selected, fallback)) return true;
  }
  return persisted;
}

/**
 * 停用/卸载时调用。失败只记结果，不抛。
 * @returns {{ live: boolean, files: string[] }}
 */
export function clearOwnedSelectedDefault({ ctx = null, dshHome = "" } = {}) {
  const home = dshHome || findDshHome();
  const report = { live: false, files: [] };
  try {
    report.live = clearLiveSelectedDefault(ctx);
  } catch {
    report.live = false;
  }
  if (!home) return report;
  for (const fp of listProfilePatchFiles(home)) {
    try {
      const row = repairProfilePatchFile(fp);
      if (row.changed) report.files.push(fp);
    } catch {
      /* 单个 profile 写失败不挡停用 */
    }
  }
  return report;
}

export function removeStaleAgentPresetDir(dshHome, id = "redteam") {
  const home = dshHome || findDshHome();
  if (!home || !id) return false;
  const dir = path.join(home, ".agent-presets", id);
  try {
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
