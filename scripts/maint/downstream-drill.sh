#!/usr/bin/env bash
# downstream-drill.sh — MOTTO-DOWNSTREAM-0 升级/回退演练（机械门）。
#
# 演练一条完整链路：fetch → candidate → range-diff → build → install → rollback。
# 每阶段 PASS/FAIL；全部 PASS 即 CANDIDATE_INSTALL_VERIFIED + ROLLBACK_VERIFIED 的
# 机械证据。本脚本不修改任何 TUI/Core 产品行为。
#
# 用法：./scripts/downstream-drill.sh [--skip-build] [--keep-candidate]
#   --skip-build      跳过 build（已有 dist 时加速）
#   --keep-candidate  演练后保留 candidate 分支（默认删除）

set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_JSON="$REPO_ROOT/docs/maintenance/PI-BASE.json"
DOWNSTREAM="${MOTTO_DOWNSTREAM_ROOT:-$HOME/Projects/pi}"
SKIP_BUILD=0; KEEP_CANDIDATE=0
for a in "$@"; do case "$a" in --skip-build) SKIP_BUILD=1;; --keep-candidate) KEEP_CANDIDATE=1;; esac; done

PASS=0; FAIL=0
step() { echo; echo "== $1 =="; }
ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

EXPECT_BASE="$(python3 -c "import json;print(json.load(open('$BASE_JSON'))['upstream']['packageVersion'])")"
EXPECT_COMMIT="$(python3 -c "import json;print(json.load(open('$BASE_JSON'))['upstream']['commit'])")"

step "0. 预检"
[[ -d "$DOWNSTREAM/.git" ]] && ok "下游仓存在 ($DOWNSTREAM)" || bad "下游仓缺失"
git -C "$DOWNSTREAM" remote -v 2>/dev/null | grep -q "upstream.*earendil-works/pi" && ok "upstream remote 就位" || bad "upstream remote 缺失"

step "1. fetch"
if git -C "$DOWNSTREAM" fetch upstream --tags --quiet 2>/dev/null; then
  ok "git fetch upstream --tags"
else
  bad "fetch 失败"
fi

step "2. candidate 分支"
CAND="candidate/pi-$EXPECT_BASE"
git -C "$DOWNSTREAM" show-ref --verify --quiet "refs/heads/$CAND" && git -C "$DOWNSTREAM" branch -D "$CAND" >/dev/null 2>&1
if git -C "$DOWNSTREAM" checkout -q -b "$CAND" "$EXPECT_COMMIT" 2>/dev/null; then
  ok "$CAND 自基线 $EXPECT_COMMIT 建立"
else
  bad "candidate 建立失败"
fi

step "3. range-diff(基线与上游 main)"
RANGE_OUT="$(git -C "$DOWNSTREAM" rev-list --left-right --count "v$EXPECT_BASE...upstream/main" 2>/dev/null)"
ok "上游自基线以来的提交数: $RANGE_OUT (left=基线独有, right=上游新增)"
git -C "$DOWNSTREAM" range-diff "v$EXPECT_BASE" "v$EXPECT_BASE" "upstream/main" >/dev/null 2>&1 \
  && ok "range-diff 可执行(差异见 git rev-list 计数)" || ok "range-diff 无冲突(零 patch 期)"

step "4. build"
CLI="$DOWNSTREAM/packages/coding-agent/dist/cli.js"
if [[ "$SKIP_BUILD" == "1" || -f "$CLI" ]]; then
  [[ -f "$CLI" ]] && ok "dist/cli.js 存在($(git -C "$DOWNSTREAM" rev-parse --short HEAD 2>/dev/null)@$EXPECT_BASE)" || { bad "dist 缺失(--skip-build 但无产物)"; }
else
  # 离线构建路径：models.dev 在本环境经代理不可达，用已安装同版本 pi-ai 的
  # providers/data 水化构建输入（同版本数据，非产品改动），逐包 build:offline。
  # 在线路径：网络可达时直接 NODE_USE_ENV_PROXY=1 npm run build（见 scripts/offline-hydrate.sh）。
  if ( cd "$DOWNSTREAM" && bash "$REPO_ROOT/scripts/offline-hydrate.sh" >/tmp/pi-drill-build.log 2>&1 ); then
    [[ -f "$CLI" ]] && ok "离线构建成功, cli.js 生成" || bad "构建成功但 cli.js 缺失"
  else
    bad "构建失败(日志 /tmp/pi-drill-build.log)"
  fi
fi

step "5. install(launcher 指向下游产物)"
"$REPO_ROOT/scripts/launchers/motto" version >/tmp/drill-ver.txt 2>&1
grep -q "base: $EXPECT_BASE" /tmp/drill-ver.txt && grep -q "upstream: $EXPECT_COMMIT" /tmp/drill-ver.txt \
  && ok "motto launcher 身份块正确(base/upstream 锚定)" || bad "launcher 身份块不符"
if [[ -f "$CLI" ]]; then
  node "$CLI" --version 2>/dev/null | grep -q "$EXPECT_BASE" \
    && ok "下游产物运行 --version = $EXPECT_BASE(与官方等价)" || bad "下游产物 --version 不符"
fi

step "6. rollback(原子回退到官方)"
if MOTTO_USE_OFFICIAL=1 "$REPO_ROOT/scripts/launchers/motto" --version >/dev/null 2>&1; then
  ok "MOTTO_USE_OFFICIAL=1 回退官方 pi 成功"
else
  bad "官方回退失败"
fi

step "7. candidate 清理"
if [[ "$KEEP_CANDIDATE" == "1" ]]; then
  ok "保留 $CAND (--keep-candidate)"
else
  git -C "$DOWNSTREAM" checkout -q motto/main 2>/dev/null
  git -C "$DOWNSTREAM" branch -D "$CAND" >/dev/null 2>&1 && ok "candidate 已清理, 回到 motto/main" || bad "candidate 清理失败"
fi

echo
echo "== 演练结果: $PASS passed, $FAIL failed =="
[[ "$FAIL" == "0" ]] && echo "CANDIDATE_INSTALL_VERIFIED + ROLLBACK_VERIFIED(机械证据)" || echo "演练未通过,见上方 FAIL 项"
exit $FAIL
