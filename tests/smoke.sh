#!/usr/bin/env bash
# CI 冒烟测试：不需要真装 DeepSeek Harness，用假 DSH_HOME 走完整安装/卸载闭环。
set -euo pipefail

# Windows 上 `bash` 常被解析到 C:\windows\system32\bash.exe —— 那是 WSL 存根，
# 没装 WSL 发行版时连 `bash --version` 都会报错并返回非零。这种情况不是产品失败，
# 而是本机没有可用 bash；跳过并说明原因，避免把环境缺失误报成回归。
if ! bash -c 'exit 0' >/dev/null 2>&1; then
  echo "! 本机 bash 不可用（疑似 Windows WSL 存根），跳过冒烟测试；CI 在真实 bash 上执行。"
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
TW="$TMP"; if command -v cygpath >/dev/null 2>&1; then TW="$(cygpath -w "$TMP")"; fi
export SEAGULL_TOOLKIT_DIR="$TW/toolkit"
trap 'rm -rf "$TMP"' EXIT

PY="$(command -v python3 || command -v python || true)"
PY_ARGS=""
if [ -z "$PY" ] && command -v py >/dev/null 2>&1; then
  PY="$(command -v py)"; PY_ARGS="-3"
fi
fail() { echo "✗ $*" >&2; exit 1; }
pass() { echo "✓ $*"; }

# ── 造一个假的 DSH_HOME ──────────────────────────────────────────
mkdir -p "$TMP/dsh/profiles/desktop"
cat > "$TMP/dsh/profiles/desktop/package.json" <<'JSON'
{
  "name": "dsh-profile-desktop",
  "private": true,
  "dependencies": {},
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"]
    }
  }
}
JSON

echo "── 1. dry-run 不应改动任何文件 ──"
before="$(sha256sum "$TMP/dsh/profiles/desktop/package.json" | cut -d' ' -f1)"
bash "$ROOT/install.sh" --dsh-home "$TMP/dsh" --app-root "$TMP/not-installed" --profile desktop --dry-run -q
after="$(sha256sum "$TMP/dsh/profiles/desktop/package.json" | cut -d' ' -f1)"
[ "$before" = "$after" ] || fail "dry-run 改了文件"
[ ! -d "$TMP/dsh/plugins" ] || fail "dry-run 创建了 plugins 目录"
pass "dry-run 无副作用"

echo "── 2. files-only 安装（跳过 pnpm）──"
bash "$ROOT/install.sh" --dsh-home "$TMP/dsh" --app-root "$TMP/not-installed" --profile desktop --no-pnpm -q
[ -f "$TMP/dsh/plugins/dsh-purge/package.json" ] || fail "插件未就位"
[ -f "$TMP/dsh/prompt-inject.md" ]               || fail "prompt-inject.md 未落地"
[ ! -e "$TMP/dsh/rules/seagull-fullbreak.md" ]   || fail "单源化后不应再落人格规则副本（会经 AGENTS.md 二次注入）"
[ ! -d "$TMP/dsh/skills/redteam" ]              || fail "新版不应重新分发已下架的旧技能库"
[ -d "$TMP/dsh/skills/seagull-reverse" ]         || fail "海鸥技能未落地"
pass "文件全部落地"

echo "── 3. profile JSON 正确挂载 ──"
"$PY" $PY_ARGS - "$TW/dsh/profiles/desktop/package.json" <<'PY' || fail "profile 挂载不正确"
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
assert d["dependencies"]["dsh-purge"] == "file:../../plugins/dsh-purge", d.get("dependencies")
assert "dsh-purge" in d["dsh"]["profile"]["bundles"], d["dsh"]["profile"]["bundles"]
assert d["dependencies"]["@nanmicoder/dsh-agent-teams"] == "file:../../plugins/@nanmicoder/dsh-agent-teams"
assert d["dsh"]["profile"]["bundles"][0] == "@deepseek-ai/dsh-base", "原有 bundle 被破坏"
print("   bundles =", d["dsh"]["profile"]["bundles"])
PY
pass "依赖 + bundle 正确，原有 bundle 未丢"

echo "── 4. 幂等：再装一次不出错、不重复 ──"
bash "$ROOT/install.sh" --dsh-home "$TMP/dsh" --app-root "$TMP/not-installed" --profile desktop --no-pnpm -q
"$PY" $PY_ARGS - "$TW/dsh/profiles/desktop/package.json" <<'PY' || fail "幂等性破坏"
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
b = d["dsh"]["profile"]["bundles"]
assert b.count("dsh-purge") == 1, b
print("   bundles =", b)
PY
pass "幂等"

echo "── 5. 启动配置在位，范围闸已移除 ──"
grep -q "autoApplyOnStart: *true" "$TMP/dsh/plugins/dsh-purge/cordis.patch.yml" || fail "自动应用未开"
grep -q "hooksDenyBypass: *true" "$TMP/dsh/plugins/dsh-purge/cordis.patch.yml" || fail "hooksDenyBypass 未开"
grep -q "installRegionGate" "$TMP/dsh/plugins/dsh-purge/lib/index.js" && fail "范围闸未移除"
pass "自动应用开启 / hooks 配置在位 / 范围闸已移除"

echo "── 6. 卸载闭环 ──"
bash "$ROOT/install.sh" --dsh-home "$TMP/dsh" --app-root "$TMP/not-installed" --profile desktop --uninstall -q
[ ! -d "$TMP/dsh/plugins/dsh-purge" ] || fail "插件未删除"
[ ! -f "$TMP/dsh/prompt-inject.md" ]  || fail "注入文件未删除"
"$PY" $PY_ARGS - "$TW/dsh/profiles/desktop/package.json" <<'PY' || fail "profile 未还原"
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
assert "dsh-purge" not in (d.get("dependencies") or {}), d.get("dependencies")
assert "dsh-purge" not in d["dsh"]["profile"]["bundles"], d["dsh"]["profile"]["bundles"]
print("   bundles =", d["dsh"]["profile"]["bundles"])
PY
pass "卸载干净，profile 已还原"

echo
echo "全部通过 ✓"
