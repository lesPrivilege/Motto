#!/usr/bin/env bash
# Model-driven acceptance: a real pi session drives the wrapper tools on a
# low-risk TextEdit scratch doc (see -> set_value -> see), then we verify
# independently that the action took effect.
set -u

# Resolve paths relative to this pack (works from anywhere).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACK_DIR="$(dirname "$SCRIPT_DIR")"
EXT="$PACK_DIR/index.ts"
BIN="$PACK_DIR/bin/peekaboo-macos-universal/peekaboo"
MARK="motto-pi-$(date +%s)"
DOC="/tmp/motto-pi-${MARK}.txt"

echo "scratch doc: $DOC"
echo "motto scratch doc" > "$DOC"
open -a TextEdit "$DOC"
sleep 2
osascript -e 'tell application "Terminal" to activate'
sleep 1

PROMPT="你正在被测试 computer use 能力。任务：使用 cu_see 观察 TextEdit 应用（app_target 用 \"TextEdit\"），从输出的结构化 UI 树中找到一个 textField（文本域）元素的 ID——它通常是 identifier 为 'First Text View' 的 elem_2，值里带引号；不要选 scroll area（elem_1，不可写入）。然后用 cu_set_value 把该元素的 value 设置为 \"${MARK}\"。之后必须再用 cu_see 观察一次，独立确认 value 已包含 ${MARK}（不能只看 cu_set_value 的返回）。请严格按 观察->执行->再观察 的顺序。最后用一句话报告结果。"

echo "=== running pi session (approve gate first, then model drive) ==="
PEEKABOO_BIN="$BIN" pi -p "/computer-use approve" -e "$EXT" -p "$PROMPT" 2>&1 | grep -v '^\[motto-computer-use\]' | tail -30

echo
echo "=== independent verification ==="
sleep 1
python3 - "$MARK" <<'PY'
import sys, subprocess
mark = sys.argv[1]
# Independent check: query the TextEdit document text via AppleScript (no Peekaboo).
try:
    out = subprocess.run(["osascript", "-e", 'tell application "TextEdit" to get text of every document'], capture_output=True, text=True)
    found = mark in out.stdout
    print(("PASS" if found else "FAIL"), "TextEdit document text contains mark:", found)
    if not found:
        print("  doc text head:", out.stdout[:200].replace("\n", " | "))
except Exception as e:
    print("FAIL  verification crashed:", e)
PY

# cleanup
osascript -e 'tell application "TextEdit" to close (every window whose name contains "motto-pi-") saving no' 2>/dev/null
rm -f "$DOC"
