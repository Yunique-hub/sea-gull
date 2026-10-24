#!/usr/bin/env bash
# 海鸥 · DeepSeek Harness 全破 harness —— 通用一键安装
#
#   本地:   bash install.sh [--profile desktop|web] [--dry-run]
#   远程:   curl -fsSL https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/install.sh | bash
#   卸载:   bash install.sh --uninstall
#
# 设计原则：不硬编码盘符 / 用户名；已装的 DSH 自动探测；重复执行幂等。
set -euo pipefail

VERSION="1.0.7"
REPO="${SEAGULL_REPO:-Yunique-hub/sea-gull}"
BRANCH="${SEAGULL_BRANCH:-main}"
TARBALL="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz"
PLUGIN_ID="dsh-purge"          # 沿用上游包名（插件内部段名前缀依赖它）
STAGE=""

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_R=$'\033[31m'; C_G=$'\033[32m'; C_Y=$'\033[33m'; C_B=$'\033[36m'; C_D=$'\033[2m'; C_0=$'\033[0m'
else
  C_R=""; C_G=""; C_Y=""; C_B=""; C_D=""; C_0=""
fi
QUIET=0
# 交给原生程序（mingw64 curl / node / python）的路径必须是 Windows 形态：
# MSYS 的 /tmp、/c/... 它们认不出来（实测 curl -o /tmp/x 会 http=200 size=0）
winpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
say()  { [ "$QUIET" = 1 ] || printf '%s\n' "$*"; }
step() { [ "$QUIET" = 1 ] || printf '%s▸%s %s\n' "$C_B" "$C_0" "$*"; }
ok()   { [ "$QUIET" = 1 ] || printf '%s✓%s %s\n' "$C_G" "$C_0" "$*"; }
warn() { printf '%s!%s %s\n' "$C_Y" "$C_0" "$*" >&2; }
die()  { printf '%s✗%s %s\n' "$C_R" "$C_0" "$*" >&2; exit 1; }

cleanup() { [ -n "$STAGE" ] && [ -d "$STAGE" ] && rm -rf "$STAGE" 2>/dev/null || true; }
trap cleanup EXIT

usage() {
  cat <<'EOF'
海鸥 · DeepSeek Harness 全破 harness —— 安装器

用法:
  bash install.sh [选项]

选项:
  --profile <desktop|web>   目标宿主 profile（默认自动：有 desktop 用 desktop）
  --dsh-home <路径>         DSH 主目录（默认 $DSH_HOME 或 ~/.dsh）
  --app-root <路径>         DSH 安装目录（默认自动探测）
  --apply                  装完立刻尝试 Apply（desktop 会解 asar，需宿主已退出）
  --no-pnpm                跳过 pnpm install（离线/已装过时用）
  --dry-run                只打印计划，不落盘
  --uninstall              卸载（还原 profile、删插件与注入文件，保留技能）
  --update                 更新已安装海鸥，保留现有提示词及配置
  -q, --quiet              安静模式
  -h, --help               显示帮助
  -V, --version            显示版本
EOF
}

PROFILE=""; DSH_HOME_ARG=""; APP_ROOT=""; DRY=0; NO_PNPM=0; APPLY=0; UNINSTALL=0; UPDATE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --profile)     PROFILE="${2:-}"; shift 2 ;;
    --dsh-home)    DSH_HOME_ARG="${2:-}"; shift 2 ;;
    --app-root)    APP_ROOT="${2:-}"; shift 2 ;;
    --apply)       APPLY=1; shift ;;
    --no-pnpm)     NO_PNPM=1; shift ;;
    --dry-run)     DRY=1; shift ;;
    --uninstall)   UNINSTALL=1; shift ;;
    --update)      UPDATE=1; shift ;;
    -q|--quiet)    QUIET=1; shift ;;
    -h|--help)     usage; exit 0 ;;
    -V|--version)  printf 'seagull-harness %s\n' "$VERSION"; exit 0 ;;
    *) die "未知参数: $1（-h 看帮助）" ;;
  esac
done
[ "$UPDATE" = 0 ] || [ "$UNINSTALL" = 0 ] || die "--update 和 --uninstall 不能同时使用"

# ── 定位仓库内容（本地 checkout / pipe 模式自取 tarball）─────────────
SELF="${BASH_SOURCE[0]:-}"
ROOT=""
if [ -n "$SELF" ] && [ -f "$SELF" ]; then
  ROOT="$(cd "$(dirname "$SELF")" && pwd)"
fi
if [ -z "$ROOT" ] || [ ! -f "$ROOT/VERSION" ]; then
  say "${C_D}未检测到本地仓库，拉取 $REPO@$BRANCH ...${C_0}"
  command -v curl >/dev/null 2>&1 || die "需要 curl 才能远程安装"
  # 临时目录：直接交给 mktemp 处理 TMPDIR；失败则退回 cwd 下的隐藏目录
  # （不做 ${var//\\//} 这类替换——在 MSYS 下会把前导 / 一起吃掉）
  STAGE="$(mktemp -d 2>/dev/null || true)"
  if [ -z "$STAGE" ] || [ ! -d "$STAGE" ]; then
    STAGE="$PWD/.seagull-stage.$$"
    mkdir -p "$STAGE" || die "无法创建临时目录"
  fi
  if ! curl -fsSL "$TARBALL" -o "$(winpath "$STAGE/repo.tar.gz")"; then
    die "下载失败: $TARBALL
  网络受限时先设代理再跑，例如：
    export https_proxy=http://127.0.0.1:7890   # 或 socks5h://127.0.0.1:1080
  或直接本地 clone 后跑 bash install.sh"
  fi
  # tar 会把 "C:\..." 当远程主机（host:path 语法）→ 进目录用相对名解包
  ( cd "$STAGE" && tar xzf ./repo.tar.gz ) || die "解包失败"
  ROOT="$(find "$STAGE" -maxdepth 1 -mindepth 1 -type d | head -1)"
  [ -f "$ROOT/VERSION" ] || die "下载内容结构异常，缺 VERSION"
fi
say "${C_B}海鸥 harness${C_0} v$VERSION  ${C_D}($ROOT)${C_0}"

# ── 定位 DSH_HOME ──────────────────────────────────────────────────
cand_home="${DSH_HOME_ARG:-${DSH_HOME:-}}"
if [ -n "$cand_home" ]; then
  [ -d "$cand_home/profiles" ] || die "指定的 DSH 主目录无效: $cand_home"
else
  for c in "$HOME/.dsh" "$HOME/dsh-home" \
           "${APPDATA:-}/DeepSeek Harness/dsh-home" "${LOCALAPPDATA:-}/DeepSeek Harness/dsh-home"; do
    [ -n "$c" ] && [ -d "$c/profiles" ] && { cand_home="$c"; break; }
  done
fi
[ -n "$cand_home" ] || die "找不到 DSH 主目录（含 profiles/ 的 .dsh）。用 --dsh-home 指定。"
DSH_HOME="$(cd "$cand_home" && pwd -P)"
ok "DSH_HOME = $DSH_HOME"

# ── 选择 profile ───────────────────────────────────────────────────
if [ -z "$PROFILE" ]; then
  for p in desktop web; do
    [ -f "$DSH_HOME/profiles/$p/package.json" ] && { PROFILE="$p"; break; }
  done
fi
[ -n "$PROFILE" ] || die "没有任何 profile（desktop/web）。先启动一次 DeepSeek Harness 生成 profile。"
case "$PROFILE" in desktop|web) ;; *) die "不支持的 profile: $PROFILE（desktop/web）" ;; esac
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
[ -f "$PROFILE_DIR/package.json" ] || die "profile 不存在: $PROFILE_DIR"
ok "profile   = $PROFILE"

# ── 定位 DSH 安装根（可选：缺了就走 files-only）────────────────────
if [ -z "$APP_ROOT" ]; then
  for c in "${SEAGULL_DSH_APP:-}" "${LOCALAPPDATA:-}/Programs/DeepSeek Harness" \
           "/opt/DeepSeek Harness" "/usr/lib/deepseek-harness" "$HOME/.local/share/deepseek-harness"; do
    [ -n "$c" ] && [ -d "$c" ] && { APP_ROOT="$c"; break; }
  done
fi
if [ -n "$APP_ROOT" ] && [ -d "$APP_ROOT" ]; then
  APP_ROOT="$(cd "$APP_ROOT" && pwd -P)"
  ok "安装根    = $APP_ROOT"
else
  APP_ROOT=""
  warn "未定位到 DSH 安装根：跳过 pnpm/Apply（files-only 模式）"
fi

NODE_EMB=""; PNPM_EMB=""; SEALED=0
if [ -n "$APP_ROOT" ]; then
  for n in "$APP_ROOT/resources/runtime/primary-runtime/dependencies/node/bin/node.exe" \
           "$APP_ROOT/resources/runtime/primary-runtime/dependencies/node/bin/node" \
           "$APP_ROOT/resources/runtime/node/bin/node.exe"; do
    [ -f "$n" ] && { NODE_EMB="$n"; break; }
  done
  for p in "$APP_ROOT/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs" \
           "$APP_ROOT/resources/runtime/pnpm/bin/pnpm.mjs" "$APP_ROOT/resources/runtime/pnpm/bin/pnpm.cjs"; do
    [ -f "$p" ] && { PNPM_EMB="$p"; break; }
  done
  [ -f "$APP_ROOT/resources/app.asar" ] && SEALED=1
  # 已经 Apply 过的机器：app.asar 被挪成 .sealed.bak，也算密封桌面宿主
  [ -f "$APP_ROOT/resources/app.asar.sealed.bak" ] && SEALED=1
  [ -f "$APP_ROOT/DeepSeek Harness.exe" ] && SEALED=1
  [ -n "$NODE_EMB" ] || NODE_EMB="$(command -v node || true)"
  say "${C_D}node=${NODE_EMB:-none} pnpm=${PNPM_EMB:-none} sealed=$SEALED${C_0}"
fi

PLUGIN_DIR="$DSH_HOME/plugins/$PLUGIN_ID"
if [ "$UPDATE" = 1 ] && [ ! -f "$PLUGIN_DIR/package.json" ]; then
  die "尚未安装海鸥，请先运行 install.sh"
fi
SRC_PLUGIN="$ROOT/vendor/$PLUGIN_ID"

say ""
say "计划:"
say "  1. 插件      $SRC_PLUGIN → $PLUGIN_DIR"
say "  2. profile   $PROFILE_DIR/package.json  (+依赖 +bundle)"
if [ "$NO_PNPM" = 0 ] && [ -n "$NODE_EMB" ] && [ -n "$PNPM_EMB" ]; then
  say "  3. pnpm      install @ $PROFILE_DIR"
else
  say "  3. pnpm      ${C_D}跳过${C_0}"
fi
say "  4. 资产      prompt-inject.md / rules/ / skills/ → $DSH_HOME"
[ "$APPLY" = 1 ] && say "  5. Apply     ${C_Y}desktop 会解 asar 且需要宿主退出${C_0}"
if [ "$DRY" = 1 ]; then say ""; say "${C_Y}--dry-run：到此为止，未改动任何文件${C_0}"; exit 0; fi

PY=""
if [ -n "$APP_ROOT" ]; then
  for p in "$APP_ROOT/resources/runtime/primary-runtime/dependencies/python/python.exe" \
           "$APP_ROOT/resources/runtime/primary-runtime/dependencies/python/bin/python3"; do
    [ -f "$p" ] && { PY="$p"; break; }
  done
fi
[ -n "$PY" ] || PY="$(command -v python || command -v python3 || true)"
[ -n "$PY" ] || die "需要 python3（改 JSON 用）"

"$PY" "$(winpath "$ROOT/src/tools/patch_profile.py")" --validate "$(winpath "$PROFILE_DIR/package.json")" \
  || die "profile 校验失败，未修改安装文件"
if [ "$UNINSTALL" = 0 ]; then
  for required in vendor/dsh-purge/package.json vendor/dsh-purge/cordis.patch.yml \
      vendor/dsh-purge/lib/index.js vendor/dsh-purge/bin/dsh-purge.js vendor/dsh-purge/lib/reapply-cli.js \
      vendor/dsh-purge/lib/default-prompt-inject.md \
      src/prompt/prompt-inject.md; do
    [ -f "$ROOT/$required" ] || die "安装包缺少: $required"
  done
  [ -d "$ROOT/src/skills" ] || die "安装包缺少: src/skills"
  if [ "$APPLY" = 1 ]; then
    [ -n "$APP_ROOT" ] && [ -n "$NODE_EMB" ] || die "缺少安装根或 node，无法 Apply"
  fi
fi

# 子进程只操作本次选定的目标，不继承其他 profile 的定位变量。
run_dsh_cli() (
  export DSH_HOME="$(winpath "$DSH_HOME")" DSH_PROFILE="$PROFILE" DSH_SURFACE="$PROFILE"
  if [ "$PROFILE" = desktop ]; then
    export DSH_DESKTOP_INSTALL="$(winpath "$APP_ROOT")"
    unset DSH_BASE
  else
    unset DSH_DESKTOP_INSTALL
  fi
  "$NODE_EMB" "$@"
)

# ── 卸载分支 ───────────────────────────────────────────────────────
if [ "$UNINSTALL" = 1 ]; then
  step "卸载"
  if [ -f "$PLUGIN_DIR/bin/dsh-purge.js" ] && [ -n "$NODE_EMB" ]; then
    run_dsh_cli "$PLUGIN_DIR/bin/dsh-purge.js" --revert || die "revert 失败，保留插件和配置以便重试"
    ok "宿主补丁已还原"
  fi
  "$PY" "$(winpath "$ROOT/src/tools/patch_profile.py")" --remove "$(winpath "$PROFILE_DIR/package.json")" "$PLUGIN_ID" \
    || die "profile 移除失败，保留插件文件"
  rm -rf "$PLUGIN_DIR" "$DSH_HOME/prompt-inject.md" \
         "$DSH_HOME/rules/seagull-fullbreak.md" "$DSH_HOME/rules/seagull-fullbreak.json" \
         "$DSH_HOME/rules/archived/seagull-fullbreak.md" "$DSH_HOME/rules/archived/seagull-fullbreak.json" \
         "$PROFILE_DIR/node_modules/$PLUGIN_ID"
  if [ -f "$DSH_HOME/rules/state.json" ] && grep -q 'seagull-fullbreak' "$DSH_HOME/rules/state.json"; then
    rm -f "$DSH_HOME/rules/state.json"
  fi
  ok "已删插件与注入文件（$DSH_HOME/skills 保留，不误删你自己的技能）"
  say ""
  say "重启 DeepSeek Harness 生效。若 app.asar 被挪走过，先放回去："
  say "  ${C_D}mv \"$APP_ROOT/resources/app.asar.sealed.bak\" \"$APP_ROOT/resources/app.asar\"${C_0}"
  exit 0
fi

# ── 1. 安装插件 ────────────────────────────────────────────────────
step "安装插件"
mkdir -p "$DSH_HOME/plugins"
if [ -d "$PLUGIN_DIR" ]; then
  SRC_REAL="$(cd "$SRC_PLUGIN" && pwd -P)"
  DST_REAL="$(cd "$PLUGIN_DIR" && pwd -P)"
  if [ "$SRC_REAL" != "$DST_REAL" ]; then
    rm -rf "$PLUGIN_DIR.bak"; mv "$PLUGIN_DIR" "$PLUGIN_DIR.bak"
    ok "旧插件已备份 → $PLUGIN_ID.bak"
  fi
fi
if [ ! -d "$PLUGIN_DIR" ] || [ "$(cd "$PLUGIN_DIR" 2>/dev/null && pwd -P || echo x)" != "$(cd "$SRC_PLUGIN" && pwd -P)" ]; then
  rm -rf "$PLUGIN_DIR"; cp -r "$SRC_PLUGIN" "$PLUGIN_DIR"
fi
ok "插件就位: $PLUGIN_DIR"

# ── 2. 改写 profile ────────────────────────────────────────────────
step "改写 profile"
"$PY" "$(winpath "$ROOT/src/tools/patch_profile.py")" "$(winpath "$PROFILE_DIR/package.json")" "file:../../plugins/$PLUGIN_ID" "$PLUGIN_ID"
if [ "$UPDATE" = 1 ]; then
  "$PY" "$(winpath "$ROOT/src/tools/patch_profile.py")" --repair-market "$(winpath "$PROFILE_DIR/package.json")" "0.4.16" \
    || die "插件市场配置修复失败，备份已保留"
fi

# ── 3. pnpm install ────────────────────────────────────────────────
DEPENDENCIES_READY=0
if [ "$NO_PNPM" = 0 ] && [ -n "$NODE_EMB" ] && [ -n "$PNPM_EMB" ]; then
  step "pnpm install"
  ( cd "$PROFILE_DIR" && "$NODE_EMB" "$PNPM_EMB" install --reporter=append-only ) \
    || die "pnpm install 失败：检查 registry / file: 路径后重试；备份已保留"
  [ -f "$PROFILE_DIR/node_modules/$PLUGIN_ID/package.json" ] || die "依赖未就位: node_modules/$PLUGIN_ID"
  "$PY" "$(winpath "$ROOT/src/tools/patch_profile.py")" --sync-plugin "$(winpath "$DSH_HOME")" "$PROFILE" \
    || die "插件运行副本校验失败，备份已保留"
  if [ "$UPDATE" = 1 ]; then
    "$PY" "$(winpath "$ROOT/src/tools/patch_profile.py")" --market-runtime "$(winpath "$PROFILE_DIR/package.json")" \
      || die "插件市场运行校验修复失败，备份已保留"
  fi
  DEPENDENCIES_READY=1
  ok "依赖已链接"
fi

# ── 4. 资产落地（幂等 + 备份）──────────────────────────────────────
step "落地提示词 / 技能（单源：人格只落 prompt-inject.md）"
STAMP="$(date +%Y%m%d-%H%M%S)"
put() { if [ -e "$2" ]; then cp -r "$2" "$2.bak-$STAMP"; fi; cp -r "$1" "$2"; }
if [ "$UPDATE" = 1 ] && [ -s "$DSH_HOME/prompt-inject.md" ]; then
  "$PY" "$(winpath "$ROOT/src/tools/patch_profile.py")" --protect-prompt "$(winpath "$DSH_HOME")" || die "提示词保护失败，已停止更新"
  ok "已保留现有提示词"
else
  put "$ROOT/src/prompt/prompt-inject.md" "$DSH_HOME/prompt-inject.md"
fi
# 单源化迁移：清掉 1.0.7 及更早版本的人格规则副本与激活状态（宿主会读 AGENTS.md）。
rm -f "$DSH_HOME/rules/seagull-fullbreak.md" "$DSH_HOME/rules/seagull-fullbreak.json" \
      "$DSH_HOME/rules/archived/seagull-fullbreak.md" "$DSH_HOME/rules/archived/seagull-fullbreak.json"
if [ -f "$DSH_HOME/rules/state.json" ] && grep -q 'seagull-fullbreak' "$DSH_HOME/rules/state.json"; then
  rm -f "$DSH_HOME/rules/state.json"
fi
mkdir -p "$DSH_HOME/skills"
for d in "$ROOT"/src/skills/*/; do
  id="$(basename "$d")"
  [ "$id" = "redteam" ] && continue
  mkdir -p "$DSH_HOME/skills/$id"; cp "$d/SKILL.md" "$DSH_HOME/skills/$id/SKILL.md"
done
# Historical redteam skills remain in source; preserve existing local copies.
ok "资产已落地"

# ── 5. 可选 Apply ──────────────────────────────────────────────────
if [ "$APPLY" = 1 ]; then
  [ -n "$NODE_EMB" ] || die "没有 node，无法 Apply"
  step "Apply"
  if [ "$PROFILE" = desktop ] && [ "$SEALED" = 1 ]; then
    ( cd "$PLUGIN_DIR" && run_dsh_cli lib/reapply-cli.js ) || die "reapply 失败"
    say ""
    warn "密封桌面宿主：请完全退出 DeepSeek Harness，再执行："
    say "    mv \"$APP_ROOT/resources/app.asar\" \"$APP_ROOT/resources/app.asar.sealed.bak\""
    say "    然后重新打开 DeepSeek Harness。"
  else
    run_dsh_cli "$PLUGIN_DIR/bin/dsh-purge.js" --apply || die "apply 失败"
    say ""; say "重启 DeepSeek Harness 生效。"
  fi
fi

say ""
if [ "$DEPENDENCIES_READY" = 1 ]; then
  ok "安装完成 ($PROFILE)"
else
  warn "文件部署完成 ($PROFILE)；已跳过依赖同步，需在该 profile 执行 pnpm install 后验证加载"
fi
say ""
say "${C_B}下一步${C_0}"
if [ "$APPLY" = 0 ]; then
  if [ "$SEALED" = 1 ]; then
    say "  密封桌面宿主（官方 EXE），三步："
    say "    1) 完全退出 DeepSeek Harness"
    say "    2) 重开 → 会话标题旁点 dsh-purge → Clean 页 → Apply"
    say "    （或 bash install.sh --apply，再按提示挪 asar）"
  else
    say "  重启 DeepSeek Harness → 会话标题旁点 dsh-purge → Apply"
  fi
fi
say "  校验:   bash verify.sh"
say "  端到端: bash verify-e2e.sh   （真跑模型，需已配置 API key）"
