#!/usr/bin/env bash
# deploy.sh — 把 pack 从本仓(唯一 canonical source)拷贝到部署位。
#
#   扩展部署位  = ~/.pi/agent/extensions/<pack>/
#   主题部署位  = ~/.pi/agent/themes/            (motto-themes 三 JSON,与扩展部署位分开)
#
# 选型:拷贝而非 symlink。理由:
#   1. 本仓部署契约含 diff 型 drift check(部署位 vs 仓库 diff 非空即报警),只有拷贝才有意义;
#   2. pi 的 jiti loader 在符号链接目录上解析多文件扩展有脆弱性,拷贝自包含、对仓库迁移免疫;
#   3. 部署位(~/.pi/agent)本身是 git 仓,拷贝镜像已由 .gitignore 排除跟踪,drift 由脚本守。
#
# 用法:
#   ./scripts/maint/deploy.sh            # 部署全部(五个新 pack + 三主题)
#   ./scripts/maint/deploy.sh motto      # 只部署指定 pack(或其主题)
# 部署后 /reload(pi 内)或重启 pi 生效。
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
TARGET="${1:-all}"

EXCLUDES=(--exclude test --exclude reports --exclude docs --exclude checksums \
          --exclude node_modules --exclude package-lock.json --exclude .git)

deploy_pack() { # $1=pack
  local pack="$1"
  [[ "$TARGET" != "all" && "$TARGET" != "$pack" ]] && return
  mkdir -p "$AGENT_DIR/extensions/$pack"
  rsync -a --delete "${EXCLUDES[@]}" "$REPO_ROOT/packages/motto/extensions/$pack/" "$AGENT_DIR/extensions/$pack/"
  echo "deployed: extensions/$pack -> $AGENT_DIR/extensions/$pack"
}

deploy_themes() {
  [[ "$TARGET" != "all" && "$TARGET" != "motto-themes" && "$TARGET" != "motto" ]] && return
  mkdir -p "$AGENT_DIR/themes"
  for f in motto.json motto-dark.json motto-light.json; do
    cp "$REPO_ROOT/packages/motto/extensions/motto-themes/$f" "$AGENT_DIR/themes/$f"
  done
  echo "deployed: themes/*.json -> $AGENT_DIR/themes/"
}

# 旧单文件扩展(迁 pack 前的遗留形态)一律移除,避免 pi 重复加载。
cleanup_legacy() {
  for f in motto.ts motto-review-flow.ts; do
    if [[ -e "$AGENT_DIR/extensions/$f" ]]; then
      rm -f "$AGENT_DIR/extensions/$f"
      echo "removed legacy single-file: extensions/$f"
    fi
  done
}

deploy_pack motto
deploy_pack motto-canonical-copy
deploy_pack motto-review-flow
deploy_pack motto-computer-use
deploy_pack motto-gemini-vision
deploy_themes
cleanup_legacy
echo "deploy: done (target=$TARGET)"
