#!/usr/bin/env bash
# 海鸥一键更新：获取最新源码，保留现有提示词与配置。
# curl -fsSL https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/update.sh | bash
set -euo pipefail
update_repo="${SEAGULL_REPO:-Yunique-hub/sea-gull}"
update_branch="${SEAGULL_BRANCH:-main}"
update_stage="$(mktemp -d)"
trap 'rm -rf -- "$update_stage"' EXIT
update_archive="$update_stage/repo.tar.gz"
if command -v cygpath >/dev/null 2>&1; then update_archive="$(cygpath -w "$update_archive")"; fi
curl -fsSL "https://codeload.github.com/$update_repo/tar.gz/refs/heads/$update_branch" -o "$update_archive"
(cd "$update_stage" && tar xzf ./repo.tar.gz)
update_payload=""
for candidate in "$update_stage"/*/; do
  if [ -f "$candidate/VERSION" ]; then
    [ -z "$update_payload" ] || { printf '下载内容结构异常\n' >&2; exit 1; }
    update_payload="$candidate"
  fi
done
[ -n "$update_payload" ] || { printf '下载内容缺少安装器\n' >&2; exit 1; }
bash "$update_payload/install.sh" --update "$@"
