#!/usr/bin/env bash
# upstream-check.sh — 上游更新检查(只读,不应用,拉模式)。
#
# 只做两件事:git fetch upstream + 增量报告。不建分支、不改 PI-BASE、不升级。
# 应用升级必须走 upstream 升级流程(USAGE.md §2),由 motto/用户在检查报告基础上决策。
#
# 用法:
#   bash scripts/maint/upstream-check.sh                 # 检查并打印报告(含包级变更概览)
#   bash scripts/maint/upstream-check.sh --state <file>  # 额外写状态 JSON(时间+上游HEAD)供定期判断
#   bash scripts/maint/upstream-check.sh --quiet         # 只输出 NO_UPDATE/UPDATE_AVAILABLE/行(供 motto 摘要)
# 出口码:0=检查成功(无论有无更新);2=环境问题(无下游仓/无 remote/PI-BASE 缺失)

set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$REPO_ROOT/scripts/maint/maint-lib.sh"
maint_load_config
BASE_JSON="$REPO_ROOT/docs/maintenance/PI-BASE.json"
STATE=""; QUIET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --state) STATE="${2:-}"; shift ;;
    --quiet) QUIET=1 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

# ---- 读取锚点 ----
[[ -f "$BASE_JSON" ]] || { echo "FAIL: PI-BASE.json 缺失" >&2; exit 2; }
BASE_VER="$(python3 -c "import json;print(json.load(open('$BASE_JSON'))['upstream']['packageVersion'])")"
BASE_COMMIT="$(python3 -c "import json;print(json.load(open('$BASE_JSON'))['upstream']['commit'])")"

[[ -d "$HARNESS_REPO/.git" ]] || { echo "FAIL: harness 仓缺失 $HARNESS_REPO (config: $MAINT_CONFIG)" >&2; exit 2; }
cd "$HARNESS_REPO"
git remote | grep -q "^upstream$" || { echo "FAIL: 无 upstream remote" >&2; exit 2; }

# ---- fetch(拉模式:只取增量,不 merge) ----
git fetch upstream --tags --quiet 2>/dev/null || { echo "FAIL: git fetch upstream 失败" >&2; exit 2; }
UPSTREAM_HEAD="$(git rev-parse refs/remotes/upstream/main 2>/dev/null)"

# ---- 增量统计 ----
COUNT="$(git rev-list --left-right --count "v$BASE_VER...refs/remotes/upstream/main" 2>/dev/null)"
LEFT="$(echo "$COUNT" | awk '{print $1}')"
NEW="$(echo "$COUNT" | awk '{print $2}')"
NEW="${NEW:-0}"

# ---- 包级变更概览(仅影响 packages/ 的 diff,粗分类) ----
PKG_SUMMARY=""
if [[ "$NEW" -gt 0 ]]; then
  PKG_SUMMARY="$(git diff --name-only "v$BASE_VER..refs/remotes/upstream/main" -- packages/ 2>/dev/null \
    | awk -F/ 'NF>1{print $2}' | sort -u | tr '\n' ',' | sed 's/,$//')"
fi

# ---- 状态文件(定期判断用) ----
if [[ -n "$STATE" ]]; then
  mkdir -p "$(dirname "$STATE")"
  printf '{"checkedAt":"%s","upstreamHead":"%s","baseCommit":"%s","baseVersion":"%s","newCommits":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$UPSTREAM_HEAD" "$BASE_COMMIT" "$BASE_VER" "$NEW" > "$STATE"
else
  mkdir -p "$(dirname "$STATE_FILE")"
  printf '{"checkedAt":"%s","upstreamHead":"%s","baseCommit":"%s","baseVersion":"%s","newCommits":%s}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$UPSTREAM_HEAD" "$BASE_COMMIT" "$BASE_VER" "$NEW" > "$STATE_FILE"
fi

# ---- 报告 ----
if [[ "$NEW" == "0" ]]; then
  [[ "$QUIET" == "0" ]] && echo "NO_UPDATE: 上游 main == 基线 v$BASE_VER ($BASE_COMMIT)"
else
  if [[ "$QUIET" == "1" ]]; then
    echo "UPDATE_AVAILABLE: $NEW commits since v$BASE_VER"
  else
    echo "UPDATE_AVAILABLE: 上游自基线 v$BASE_VER ($BASE_COMMIT) 以来新增 $NEW 提交"
    echo "  上游 HEAD: $UPSTREAM_HEAD"
    [[ -n "$PKG_SUMMARY" ]] && echo "  受影响包: $PKG_SUMMARY"
    echo "  决策提示: 见 docs/maintenance/USAGE.md §2 升级流程(禁止自动跟随 main;"
    echo "            需 candidate 重放 + 回归 + dogfood 后才可接受)"
  fi
fi
exit 0
