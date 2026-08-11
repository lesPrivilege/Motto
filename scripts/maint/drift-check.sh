#!/usr/bin/env bash
# drift-check.sh — 部署位 vs 仓库(唯一 canonical source)diff 非空即报警。
#
# 只比对运行时文件(与 deploy.sh 同排除集);主题按文件比对。
# 用法:
#   ./scripts/drift-check.sh            # 全量
#   ./scripts/drift-check.sh motto      # 单 pack
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
TARGET="${1:-all}"
FAIL=0

EXCLUDES=(--exclude test --exclude reports --exclude docs --exclude checksums \
          --exclude node_modules --exclude package-lock.json --exclude .git)

check_pack() { # $1=pack
  local pack="$1"
  [[ "$TARGET" != "all" && "$TARGET" != "$pack" ]] && return
  local src="$REPO_ROOT/extensions/$pack" dst="$AGENT_DIR/extensions/$pack"
  if [[ ! -d "$dst" ]]; then
    echo "DRIFT $pack: 部署位缺失 $dst (先跑 ./scripts/deploy.sh)" >&2
    FAIL=1
    return
  fi
  local diff
  diff="$(diff -rq "${EXCLUDES[@]}" "$src" "$dst" 2>/dev/null)"
  if [[ -n "$diff" ]]; then
    echo "DRIFT $pack:" >&2
    echo "$diff" | sed 's/^/    /' >&2
    FAIL=1
  else
    echo "ok: $pack 部署位与仓库一致"
  fi
}

check_themes() {
  [[ "$TARGET" != "all" && "$TARGET" != "motto-themes" && "$TARGET" != "motto" ]] && return
  for f in motto.json motto-dark.json motto-light.json; do
    local src="$REPO_ROOT/extensions/motto-themes/$f" dst="$AGENT_DIR/themes/$f"
    if ! diff -q "$src" "$dst" >/dev/null 2>&1; then
      echo "DRIFT themes/$f: 部署位与仓库不一致 (先跑 ./scripts/deploy.sh)" >&2
      FAIL=1
    else
      echo "ok: themes/$f 一致"
    fi
  done
}

# 旧单文件遗留:若仍存在即报警(部署未清理)。
legacy_check() {
  for f in motto.ts motto-review-flow.ts; do
    if [[ -e "$AGENT_DIR/extensions/$f" ]]; then
      echo "DRIFT legacy: extensions/$f 仍存在(旧单文件形态,deploy.sh 应已清理)" >&2
      FAIL=1
    fi
  done
}

check_pack motto
check_pack motto-canonical-copy
check_pack motto-review-flow
check_pack motto-computer-use
check_pack motto-gemini-vision
check_themes
legacy_check

if [[ "$FAIL" == 0 ]]; then
  echo "DRIFT-CHECK: PASS"
else
  echo "DRIFT-CHECK: FAILED — 先跑 ./scripts/deploy.sh 收敛" >&2
fi
exit $FAIL
