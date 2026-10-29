#!/usr/bin/env bash
# 在 Windows 上挑一个"真 bash"再执行目标脚本。
#
# 背景：Windows 的 C:\windows\system32\bash.exe 是 WSL 存根。没装 WSL 发行版时，
# 它连 `bash -c 'exit 0'` 都会直接拒绝——脚本根本没机会运行，`set -euo pipefail`
# 和脚本内的任何探测都救不了。所以必须在"选择解释器"这一层解决。
#
# 用法：tests/run-bash.sh <脚本> [参数...]
# 找不到真 bash 时退出 0 并说明跳过（环境缺失 ≠ 回归失败）。

set -uo pipefail

candidate_list() {
  if [ -n "${SEAGULL_BASH:-}" ]; then printf '%s\n' "$SEAGULL_BASH"; fi
  # Git for Windows 的 bash 永远是真 bash
  if [ -n "${ProgramFiles:-}" ]; then printf '%s\n' "$ProgramFiles/Git/bin/bash.exe"; fi
  if [ -n "${ProgramW6432:-}" ]; then printf '%s\n' "$ProgramW6432/Git/bin/bash.exe"; fi
  printf '%s\n' /usr/bin/bash /bin/bash
}

is_real_bash() {
  local exe="$1"
  [ -n "$exe" ] && [ -x "$exe" ] 2>/dev/null || { [ -n "$exe" ] && [ -f "$exe" ]; } || return 1
  # 真 bash 对 --version 返回 0 且输出含 "bash"；WSL 存根返回非零。
  local out
  out="$("$exe" -c 'printf %s "$BASH_VERSION"' 2>/dev/null)" || return 1
  [ -n "$out" ]
}

pick_bash() {
  local exe
  while IFS= read -r exe; do
    [ -n "$exe" ] || continue
    if is_real_bash "$exe"; then printf '%s\n' "$exe"; return 0; fi
  done < <(candidate_list)
  return 1
}

if [ $# -lt 1 ]; then
  echo "用法: $0 <脚本> [参数...]" >&2
  exit 2
fi

if BASH_REAL="$(pick_bash)"; then
  exec "$BASH_REAL" "$@"
fi

echo "! 本机没有可用的真 bash（Windows WSL 存根不算）。"
echo "! 安装 Git for Windows 后重试，或设置 SEAGULL_BASH 指向 bash 可执行文件。"
echo "! 已跳过；CI 在 ubuntu/windows runner 的 bash 上执行同一脚本。"
exit 0