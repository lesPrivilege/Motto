# Ghostty TUI 基线记录(MOTTO-TUI-0,用户侧)

> 环境: pi 0.84.1 · Ghostty Ghostty 1.3.1 · macOS
> fixture: /Users/lesprivilege/Projects/Motto/fixtures/tui/sessions/motto-tui-baseline.jsonl
> 记录日期: 2026-08-11
> 状态: DRAFT → 用户逐项填写后改 ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED

## 0. 启动与牌记
- 打开命令是否如上;牌记(启动画面)是否左锚、无装饰线、一处 accent:
- 格言疏排是否生效;天头两空行:
- facts(context/skills/extensions/themes)列宽 12、内容列 15:
- 窄窗口(40 列)下牌记折行悬挂是否仍左锚:

## 1. 当前视觉(三主题)
对 motto / motto-dark / motto-light 各做一次 `/theme <名>` 切换,记录:
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
在下列位置分别拖选并 `pbpaste` 记录原始字节(逐字符,含换行):
- a) 一个软折行跨 2+ 视觉行的英文段落:
- b) 含 CJK 的长句(双列宽度折行):
- c) 一个跨视觉行折行的 shell 命令/URL:
- d) 一段 markdown 代码块(行首可能带 padding):
- e) 包含 tab 的行:
- 结论(是否符合「视觉行 join \n」基线,即 copy 保真缺口是否复现):

## 5. 复制命令对照
- `/copy-answer` 与 `/copy-code` 的输出(应为逻辑原文,非视觉行):
- 与第 4 节鼠标拖选的差异:

## 6. 版本与终端行为
- pi 与 Ghostty 版本(上文已记):
- 窗口缩放到 200 列与 40 列:footer 两级退化、无超宽、无横向滚动:
- 退出后终端标题行为(ghostty 无标题栈 → 保持 pi 最后一次写入):

## 7. 结论
- 基线是否成立;有哪些与 MOTTO 凡例/上游基线不符的观察(逐条列出):
