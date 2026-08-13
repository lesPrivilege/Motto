#!/usr/bin/env bash
# ghostty-capture.sh — MOTTO-TUI-0 在真实 Ghostty 中记录 TUI 基线(用户侧)。
#
# 背景:computer-use 门禁默认关闭,桌面驱动须用户显式 /computer-use approve;
# 本仓库惯例即「Ghostty 目视终验(用户侧)」。因此本脚本不自驱,而是:
#   1) 打开一个真实 Ghostty 窗口,resume MOTTO-TUI-0 fixture 会话;
#   2) 按指引逐项捕获(视觉/streaming/collapsed/拖选/pbpaste/三主题/版本);
#   3) 产出 fixtures/tui/baseline/GHOSTTY-BASELINE.md(填表即交付)。
#
# 用法:
#   ./fixtures/tui/ghostty-capture.sh [--auto-launch]
#     --auto-launch  自动打开 Ghostty 窗口(默认只打印命令,由用户自己开)
#
# 依赖: pi(0.84.1) + ghostty(1.3.1) + fixture 会话(先跑 build-fixture-session.mjs)

set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="$REPO_ROOT/fixtures/tui/sessions/motto-tui-baseline.jsonl"
OUT="$REPO_ROOT/fixtures/tui/baseline/GHOSTTY-BASELINE.md"

if [[ ! -f "$FIXTURE" ]]; then
  echo "fixture 缺失,先构建:" >&2
  echo "  node $REPO_ROOT/fixtures/tui/build-fixture-session.mjs" >&2
  exit 1
fi

PI_VER="$(pi --version 2>/dev/null || echo unknown)"
GH_VER="$(ghostty --version 2>/dev/null | head -1 || echo unknown)"

LAUNCH_CMD="cd '$REPO_ROOT' && pi --session '$FIXTURE'"
echo "== 版本 =="
echo "  pi      : $PI_VER"
echo "  ghostty : $GH_VER"
echo "  fixture : $FIXTURE"
echo

if [[ "${1:-}" == "--auto-launch" ]]; then
  echo "== 打开 Ghostty 窗口 =="
  ghostty -e zsh -lc "$LAUNCH_CMD" &
  echo "  (窗口已请求打开;若未出现请手动运行:)"
fi
echo "  手动打开命令:"
echo "    ghostty -e zsh -lc '$LAUNCH_CMD'"
echo

mkdir -p "$(dirname "$OUT")"
cat > "$OUT" <<EOF
# Ghostty TUI 基线记录(MOTTO-TUI-0,用户侧)

> 环境: pi $PI_VER · Ghostty $GH_VER · macOS
> fixture: $FIXTURE
> 记录日期: $(date '+%Y-%m-%d')
> 状态: DRAFT → 用户逐项填写后改 ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED

## 0. 启动与牌记
- 打开命令是否如上;牌记(启动画面)是否左锚、无装饰线、一处 accent:
- 格言疏排是否生效;天头两空行:
- facts(context/skills/extensions/themes)列宽 12、内容列 15:
- 窄窗口(40 列)下牌记折行悬挂是否仍左锚:

## 1. 当前视觉(三主题)
对 motto / motto-dark / motto-light 各做一次 \`/theme <名>\` 切换,记录:
| 主题 | 正文 | 标题层级(H1/H2/H3–H6 投影 ›) | 失败行 accent | 其它 |
|---|---|---|---|---|
| motto | | | | |
| motto-dark | | | | |
| motto-light | | | | |
- 双宗切换后版式逐字符一致、仅颜色不同:

## 2. streaming
在 fixture 会话内追加一条真实提问(如「再简述 TUI 层级」),观察:
- 文本流式逐 token 输出是否稳定无闪烁:
- tool call 参数流式期间的形态:
- thinking(若显示)在流式期的行为:
- 消息队列(Enter 打断 / Alt+Enter 追问)的表现:

## 3. collapsed / expanded(Ctrl+O)
- 全局展开态与折叠态下:tool 行、review-flow recap、超长输出各自的形态:
- 失败 bash 在折叠态是否强制显露(朱记/校记):
- assistant 最终回答是否永不折叠:

## 4. 鼠标拖选 + pbpaste
在下列位置分别拖选并 \`pbpaste\` 记录原始字节(逐字符,含换行):
- a) 一个软折行跨 2+ 视觉行的英文段落:
- b) 含 CJK 的长句(双列宽度折行):
- c) 一个跨视觉行折行的 shell 命令/URL:
- d) 一段 markdown 代码块(行首可能带 padding):
- e) 包含 tab 的行:
- 结论(是否符合「视觉行 join \\n」基线,即 copy 保真缺口是否复现):

## 5. 复制命令对照
- \`/copy-answer\` 与 \`/copy-code\` 的输出(应为逻辑原文,非视觉行):
- 与第 4 节鼠标拖选的差异:

## 6. 版本与终端行为
- pi 与 Ghostty 版本(上文已记):
- 窗口缩放到 200 列与 40 列:footer 两级退化、无超宽、无横向滚动:
- 退出后终端标题行为(ghostty 无标题栈 → 保持 pi 最后一次写入):

## 7. 结论
- 基线是否成立;有哪些与 MOTTO 凡例/上游基线不符的观察(逐条列出):
EOF

echo "== 指引已写入: $OUT =="
echo "请按上述 0–7 节逐项在真实 Ghostty 中记录,完成后将状态改为 ACCEPTED 类。"
