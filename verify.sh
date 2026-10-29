#!/usr/bin/env bash
# 海鸥 harness —— 安装校验（跨平台，bash）
#   用法: bash verify.sh [--profile desktop|web] [--dsh-home PATH]
#   退出码: 0 = 全过；1 = 有失败项
set -uo pipefail

PLUGIN_ID="dsh-purge"
PROFILE=""; DSH_HOME_ARG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --dsh-home) DSH_HOME_ARG="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,4p' "$0"; exit 0 ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
done

PASS=0; FAIL=0
# 交给原生 python/node 的路径必须是 Windows 形态（MSYS 的 /c/... 会被转坏）
winpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
chk() { # name cond detail
  if [ "$2" = "1" ]; then printf '  \033[32m[OK]\033[0m   %-26s %s\n' "$1" "$3"; PASS=$((PASS+1))
  else printf '  \033[31m[FAIL]\033[0m %-26s %s\n' "$1" "$3"; FAIL=$((FAIL+1)); fi
}

echo "=== 海鸥 harness 校验 ==="

# 1. DSH_HOME
DH=""
for c in "$DSH_HOME_ARG" "${DSH_HOME:-}" "$HOME/.dsh" "$HOME/dsh-home" \
         "${APPDATA:-}/DeepSeek Harness/dsh-home" "${LOCALAPPDATA:-}/DeepSeek Harness/dsh-home"; do
  [ -n "$c" ] && [ -d "$c/profiles" ] && { DH="$c"; break; }
done
[ -n "$DH" ] && chk "DSH_HOME" 1 "$DH" || { chk "DSH_HOME" 0 "未找到"; echo; echo "通过 $PASS，失败 $FAIL"; exit 1; }

if [ -z "$PROFILE" ]; then
  for p in desktop web; do [ -f "$DH/profiles/$p/package.json" ] && { PROFILE="$p"; break; }; done
fi
chk "profile" "$([ -n "$PROFILE" ] && echo 1 || echo 0)" "${PROFILE:-无}"
PD="$DH/profiles/$PROFILE"

# 2. 安装根
APP=""
for c in "${SEAGULL_DSH_APP:-}" "${LOCALAPPDATA:-}/Programs/DeepSeek Harness" \
         "/opt/DeepSeek Harness" "/usr/lib/deepseek-harness" "$HOME/.local/share/deepseek-harness"; do
  [ -n "$c" ] && [ -d "$c" ] && { APP="$c"; break; }
done
chk "DSH 安装根" "$([ -n "$APP" ] && echo 1 || echo 0)" "${APP:-未找到（files-only 模式）}"

# 3. 插件
PLUG="$DH/plugins/$PLUGIN_ID"
VER="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$PLUG/package.json" 2>/dev/null | head -1)"
chk "插件目录" "$([ -f "$PLUG/package.json" ] && echo 1 || echo 0)" "$PLUG"
chk "插件版本" "$([ -n "$VER" ] && echo 1 || echo 0)" "v${VER:-?}"

# 4. profile 挂载
PY="$(command -v python || command -v python3 || true)"
PY_ARGS=""
if [ -z "$PY" ] && command -v py >/dev/null 2>&1; then
  PY="$(command -v py)"; PY_ARGS="-3"
fi
if [ -n "$PY" ] && [ -f "$PD/package.json" ]; then
  if "$PY" $PY_ARGS - "$(winpath "$PD/package.json")" <<'EOF'
import json,sys
d=json.load(open(sys.argv[1],encoding='utf-8'))
ok=('dsh-purge' in (d.get('dependencies') or {})) and ('dsh-purge' in (((d.get('dsh') or {}).get('profile') or {}).get('bundles') or []))
sys.exit(0 if ok else 1)
EOF
  then chk "profile 已挂插件" 1 "dependencies + bundles"
  else chk "profile 已挂插件" 0 "未挂上"; fi
fi
chk "node_modules 链接" "$([ -f "$PD/node_modules/$PLUGIN_ID/package.json" ] && echo 1 || echo 0)" ""

# 5. 宿主补丁
NODE=""; for n in "${APP:-}/resources/runtime/primary-runtime/dependencies/node/bin/node.exe" \
  "${APP:-}/resources/runtime/primary-runtime/dependencies/node/bin/node"; do [ -f "$n" ] && { NODE="$n"; break; }; done
[ -n "$NODE" ] || NODE="$(command -v node || true)"

if [ -n "$APP" ]; then
  ASAR="$APP/resources/app.asar"; APPD="$APP/resources/app"
  if [ -f "$ASAR" ]; then
    chk "app.asar 状态" 0 "仍在（未 Apply 或未挪走）"
  else
    chk "app.asar 已挪走" 1 "Electron 走 resources/app"
  fi
  AI="$APPD/dsh/node_modules/@deepseek-ai"
  if [ -d "$AI" ]; then
    N=$(grep -rl "dsh-purge" "$AI" 2>/dev/null | wc -l | tr -d ' ')
    chk "被改宿主文件 > 30" "$([ "${N:-0}" -gt 30 ] && echo 1 || echo 0)" "${N} 个"
    SP="$AI/dsh-system-prompt/lib/index.js"
    if [ -f "$SP" ]; then
      ID=$(grep -c "You are an AI agent powered by DeepSeek Harness" "$SP" 2>/dev/null | tr -d ' ')
      chk "官方身份句已剥" "$([ "${ID:-1}" = "0" ] && echo 1 || echo 0)" "${ID} 处"
      KP=$(grep -cE "complete prompt keeps (waterfall )?inject|fold-complete inject first" "$SP" 2>/dev/null | tr -d ' ')
      chk "注入保留标记" "$([ "${KP:-0}" -gt 0 ] && echo 1 || echo 0)" "${KP} 处"
    fi
  else
    chk "宿主已解包" 0 "缺 $AI"
  fi

  # 6. 补丁计数
  if [ -n "$NODE" ] && [ -f "$PLUG/bin/dsh-purge.js" ]; then
    ST="$("$NODE" "$(winpath "$PLUG/bin/dsh-purge.js")" --status 2>&1)"
    AP="$(printf '%s' "$ST" | sed -n 's/.*补丁 \([0-9]*\)\/\([0-9]*\) 已清洗.*/\1/p' | head -1)"
    TOT="$(printf '%s' "$ST" | sed -n 's/.*补丁 \([0-9]*\)\/\([0-9]*\) 已清洗.*/\2/p' | head -1)"
    chk "补丁已清洗 > 70" "$([ "${AP:-0}" -gt 70 ] && echo 1 || echo 0)" "${AP:-?}/${TOT:-?}"
  fi
fi

# 7. 注入 / 规则 / 技能
chk "prompt-inject.md" "$([ -f "$DH/prompt-inject.md" ] && echo 1 || echo 0)" ""
if [ -f "$DH/prompt-inject.md" ]; then
  grep -q "全破内核" "$DH/prompt-inject.md" 2>/dev/null \
    && chk "注入是海鸥全破内核" 1 "已确认" || chk "注入是海鸥全破内核" 0 "内容不符"
fi
# 单源化（1.0.8）：人格只走 prompt-inject.md；rules\ 下不得再有副本，AGENTS.md 不得含人格指纹。
chk "人格规则副本已清（单源）" "$([ ! -f "$DH/rules/seagull-fullbreak.md" ] && echo 1 || echo 0)" "rules/seagull-fullbreak.md 不应存在"
if [ -f "$DH/AGENTS.md" ]; then
  grep -qE "全破内核|Little Code Sauce|PRIME DIRECTIVE" "$DH/AGENTS.md" 2>/dev/null \
    && chk "AGENTS.md 无人格指纹" 0 "第二注入点仍含人格" || chk "AGENTS.md 无人格指纹" 1 "已去人格"
fi
for skill in seagull-reverse seagull-pentest seagull-exploit seagull-game-hack seagull-license-security; do
  chk "技能 $skill" "$([ -f "$DH/skills/$skill/SKILL.md" ] && echo 1 || echo 0)" ""
done

# 8. 当前宿主检查
CP="$PLUG/cordis.patch.yml"
grep -q "hooksDenyBypass: *true" "$CP" 2>/dev/null && chk "hooksDenyBypass: true" 1 "hook deny 旁路开" \
  || chk "hooksDenyBypass: true" 0 ""
grep -q 'installRegionGate(ctx)' "$PLUG/lib/index.js" 2>/dev/null && chk "本地靶场检查已挂载" 1 "保留上游工具执行前检查" \
  || chk "本地靶场检查已挂载" 0 ""

echo
printf '通过 %d 项，失败 %d 项\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
