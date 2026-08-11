#!/usr/bin/env bash
# gate-live.sh — 真实 pi 活体验收：默认加载（不带 -e）+ 会话级门禁闭环。
#
# PACK-COMPUTER-USE-2 acceptance #2:
#   默认加载(不带 -e) → cu_see 未批准被拒 → approve(含 preflight 报告) → cu_see 成功
#   → revoke 复禁 → 重启后回到未批准态。
#
# 前提:
#   - pack 已部署到 ~/.pi/agent/extensions/motto-computer-use(./scripts/deploy.sh motto-computer-use);
#   - Screen Recording + Accessibility 已授予承载进程(否则 success 步真实失败,记为环境未就绪);
#   - PEEKABOO_BIN 指向固定的 Peekaboo 二进制(默认仓库 bin)。
#
# 用法: bash test/gate-live.sh
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACK_DIR="$(dirname "$SCRIPT_DIR")"
BIN="${PEEKABOO_BIN:-$PACK_DIR/bin/peekaboo-macos-universal/peekaboo}"
AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
DEPLOYED="$AGENT_DIR/extensions/motto-computer-use"

PASS=0; FAIL=0
ok()  { echo "PASS  $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL  $1"; FAIL=$((FAIL+1)); }

if [[ ! -d "$DEPLOYED" ]]; then
  echo "FAIL  pack not deployed ($DEPLOYED) — run ./scripts/deploy.sh motto-computer-use first"
  exit 1
fi
if [[ ! -x "$BIN" ]]; then
  echo "FAIL  binary missing ($BIN) — run ./scripts/fetch-binaries.sh extensions/motto-computer-use"
  exit 1
fi

MARK="motto-gate-$(date +%s)"
DOC="/tmp/${MARK}.txt"
echo "motto gate scratch doc" > "$DOC"
open -a TextEdit "$DOC"
sleep 2
osascript -e 'tell application "Terminal" to activate' 2>/dev/null || true
sleep 1

export PEEKABOO_BIN="$BIN"

# 统一提示词模板: 尝试 cu_see 观察 TextEdit,原样报告工具返回/报错。
SEE_PROMPT="你是被测试的 computer use 门禁环境。请调用 cu_see 工具观察 TextEdit 应用(app_target 用 \"TextEdit\",max_elements 50)。如果工具调用报错,请把错误信息原样逐字报告(不要改写);如果成功,报告成功并给出元素数量。只报告结果,不要做其他动作。"
SEE_OK_PROMPT="你是被测试的 computer use 门禁环境。请调用 cu_see 工具观察 TextEdit 应用(app_target 用 \"TextEdit\",max_elements 50)。工具调用应该已经通过门禁。如果成功,报告成功并给出元素数量;如果报错,原样逐字报告错误。只报告结果,不要做其他动作。"

run_pi() { # $@ = -p messages...
  # 返回: stdout 与 stderr 合并文本
  pi "$@" 2>&1
}

echo "=== [1/4] 默认加载 + 未批准拒(新进程,不带 -e)==="
OUT="$(run_pi -p "$SEE_PROMPT")"
if grep -q "not approved" <<<"$OUT" && grep -q "computer-use approve" <<<"$OUT"; then
  ok "unarmed: cu_see rejected with gate guidance (default loading, no -e)"
else
  bad "unarmed: cu_see not rejected with gate guidance — output:"; sed 's/^/    /' <<<"$OUT" | tail -8
fi

echo "=== [2/4] approve(含 preflight 报告)+ 同会话 cu_see 成功 ==="
OUT="$(run_pi -p "/computer-use approve" -p "$SEE_OK_PROMPT")"
if grep -q "APPROVED" <<<"$OUT"; then
  ok "approve command dispatched, armed"
else
  bad "approve command did not dispatch — output:"; sed 's/^/    /' <<<"$OUT" | tail -8
fi
if grep -q "screenRecording=" <<<"$OUT"; then
  ok "approve preflight report present (screenRecording=…)"
else
  bad "approve preflight report missing — output:"; sed 's/^/    /' <<<"$OUT" | tail -8
fi
if grep -q "成功" <<<"$OUT" || grep -qi "element" <<<"$OUT"; then
  ok "approved session: cu_see succeeded (model reported success/elements)"
else
  bad "approved session: cu_see did not succeed — output:"; sed 's/^/    /' <<<"$OUT" | tail -8
fi

echo "=== [3/4] revoke 复禁(同会话)==="
OUT="$(run_pi -p "/computer-use revoke" -p "$SEE_PROMPT")"
if grep -q "REVOKED" <<<"$OUT"; then
  ok "revoke command dispatched, disarmed"
else
  bad "revoke command did not dispatch — output:"; sed 's/^/    /' <<<"$OUT" | tail -8
fi
if grep -q "not approved" <<<"$OUT"; then
  ok "after revoke: cu_see rejected with gate guidance"
else
  bad "after revoke: cu_see not rejected — output:"; sed 's/^/    /' <<<"$OUT" | tail -8
fi

echo "=== [4/4] 重启后回到未批准态(新进程)==="
OUT="$(run_pi -p "$SEE_PROMPT")"
if grep -q "not approved" <<<"$OUT" && ! grep -q "APPROVED" <<<"$OUT"; then
  ok "fresh process: unarmed again (approval not persisted)"
else
  bad "fresh process: not unarmed — output:"; sed 's/^/    /' <<<"$OUT" | tail -8
fi

# cleanup
osascript -e 'tell application "TextEdit" to close (every window whose name contains "motto-gate-") saving no' 2>/dev/null || true
rm -f "$DOC"

echo
echo "gate-live: $PASS passed, $FAIL failed"
exit $((FAIL > 0 ? 1 : 0))
