# fixtures/tui — MOTTO-TUI-0 TUI 基线夹具

本目录为 Motto TUI 的**可重复运行 transcript fixture 套件**：把一张覆盖全部 TUI 表面的
会话固化为一套确定性 fixture，供无头渲染基线、Ghostty 真终端捕获、以及后续
MOTTO-TUI-1 的回归对照使用。

## 目录

```text
fixtures/tui/
├── scenarios/                 内容 fixture(纯文本/markdown,供 builder 与模型复用)
│   ├── md-multilevel.md       多级 markdown(h1–h6,验证 › 投影与层级)
│   ├── md-list-quote.md       嵌套列表 + blockquote + 任务列表
│   ├── md-code.md             围栏代码(ts/bash/无语言/波浪线)+ 行内 + 公式
│   ├── paste-long.txt         长 user paste(英文/中文/混合宽度/URL)
│   ├── bash-success.txt       成功 bash 输出
│   ├── bash-empty.txt         空输出(0 字节)
│   ├── bash-mixed.txt         stdout + stderr(成功带警告)
│   ├── bash-exit1.txt         exit 1 + stderr
│   ├── bash-huge.txt          超长输出(300 行,含 200 列超长行)
│   └── unicode-tabs-ansi.txt  Unicode/制表符/字面 ANSI/超长行/超长 URL
├── build-fixture-session.mjs  确定性 builder → sessions/motto-tui-baseline.jsonl
├── render-baseline.mjs        无头渲染基线(真实 pi-tui + 三主题 × 5 宽度)
├── ghostty-capture.sh         用户侧真实 Ghostty 捕获(指引 + 填表)
├── sessions/                  生成的会话(JSONL,git 提交)
└── baseline/                  基线产物(MANIFEST + 主题渲染 + review-flow + 指引)
```

## 会话覆盖面(26 条目)

| TUI 表面 | fixture 位置 |
|---|---|
| user message / 长文本 paste | T1 用户 / T3 长 paste |
| assistant markdown(多级/列表/引用/代码/表格/公式) | T1/T2/T8 |
| thinking | T1 assistant thinking 块 |
| tool call(read/edit/write/bash/custom) | T1–T8 |
| 成功 bash / 空输出 / stdout+stderr / exit 1 / 超长输出 | T1/T5/T3/T4/T8 |
| custom tools(computer-use 门禁 fail-closed / vision) | T7 |
| 中途取消(aborted) | T9 |
| compact notice / compaction summary | T9 后 compaction 条目 |
| review-flow recap(collapsed/expanded) | 两个 custom 条目 |
| Unicode/制表符/ANSI/长行 | T8 |
| 窄终端 | render-baseline 40/60 列 + ghostty 捕获 |

streaming、Ctrl+O 全局展开、鼠标拖选、pbpaste、composer 为**交互面**，只能由
`ghostty-capture.sh` 在真实 Ghostty 中记录(用户侧；computer-use 门禁默认关闭，
桌面驱动须用户 `/computer-use approve`)。

## 运行

```bash
# 1) 构建 fixture 会话(幂等)
node fixtures/tui/build-fixture-session.mjs

# 2) 无头渲染基线(需全局 pi 0.84.1)
#    → baseline/theme-{dark,motto,motto-dark,motto-light}.{txt,ansi.txt}
#    → baseline/review-flow.txt(槽位标注版)
#    → baseline/MANIFEST.txt(版本/宽度/超宽校验)
node --experimental-strip-types fixtures/tui/render-baseline.mjs --write   # 重生成基线(仅允许说明漂移理由时用)
node --experimental-strip-types fixtures/tui/render-baseline.mjs --check   # 与已提交基线逐字节比对(门禁,已接入 ci-checks.sh governance)

# 3) 用户侧 Ghostty 真终端捕获
./fixtures/tui/ghostty-capture.sh            # 打印指引 + 生成填表
./fixtures/tui/ghostty-capture.sh --auto-launch  # 同时自动开 Ghostty 窗口
```

## 约定

- 基线产物一律提交 git，作 MOTTO-TUI-1 的回归锚点；重新生成即视为「基线漂移」，须说明理由。
  注：`MANIFEST.txt` 含生成时间戳，不计入字节 diff（其余产物逐字节稳定，已验证）。
- **P0-2 归一（2026-08-11）**：渲染前强制 canonical capability（`TERM=screen` → hyperlinks off），
  输出不随宿主终端能力变化；`--check` 在 ghostty/wezterm/tmux 宿主下均与基线逐字节一致。
  链接统一呈现为 `text (url)`，无 OSC8 序列体残留。
- `render-baseline.mjs` 直连全局安装的 pi 包（绝对路径），不依赖本仓库 node_modules。
- 无头基线是**渲染层**记录；交互面（流式/选区/copy）以 GHOSTTY-BASELINE.md 为准。
- 本套件不修改任何产品行为代码；仅审计脚本 + fixture + 文档（MOTTO-TUI-0 边界）。
