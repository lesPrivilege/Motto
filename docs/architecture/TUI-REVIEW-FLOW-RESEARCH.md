# TUI REVIEW FLOW 调研笔记 — chat flow / review flow 中工具/命令块的呈现取舍

> 性质：**调研笔记**（只读），供 motto TUI 的 review flow 设计决策使用。本文件不构成
> 任何已批准的实施方案；候选方案见 §3，均待用户裁定。
>
> - 日期：2026-08-12
> - 范围：chat flow / review flow 中工具/命令块（tool command blocks）的呈现取舍
> - 方法：本地源码逐行核实 + GitHub 上游源码核实；所有引用标注出处；读不到的标注「未核验」
> - 约束：全程只读 + 仅写本文件；未改任何产品代码
> - 关联正典：`docs/MOTTO.md`（凡例正典）、`docs/TUI-THESIS.md`（可测试不变量）、
>   `docs/decisions/2026-08-11-motto-tui-1.md`（TUI-1 工单，S1–S4）、
>   `docs/decisions/review-flow-eval.md`（review-flow 评估 + 二轮开源调研）

---

## 一页纸摘要

**问题**：motto chat flow 中工具/命令块（bash/read/edit 等）以「命令原文 + 输出全文 + 耗时统计」
完整展示，用户反馈已失去「人类可 review」特性（冗长、机械、重复）。正在考虑是否折叠、或只展示 diff。

**现状（源码核实）**：命令块**不是 Markdown**，是组件级渲染（`ToolExecutionComponent` /
`BashExecutionComponent` / 各工具 `renderCall`/`renderResult`）。motto 已有的 S3 patch
（tui-1-s3-tool-index-line）已把**成功的内置工具**压缩为单行低对比目行；失败/流式/展开/自定义
工具仍整卡。review recap（著录层，motto-review-flow 扩展）每 turn 落一行汇总 + 逐工具行。
「重复」的感知主要来自：S3 目行 与 recap 行都展示 tool+target，且流式期/失败/展开态仍铺满整卡。

**开源取舍结论（7 家核实）**：
- **Grok Build**（xai-org/grok-build）：三态 DisplayMode = **Collapsed（单行标题，agent 工具默认）
  / Truncated（头+`… +N lines`+尾）/ Expanded（全量）**，chevron 折叠循环；用户 `!` bash 流式
  用 Truncated、收尾 Expanded。与 motto「字大行疏」最契合的模型。
- **Codex CLI**：命令单行标题 `• Ran <cmd>`，输出固定 5 行上限（用户 shell 50 行），**中部截断**
  `… +N lines (ctrl+t to view transcript)`；连续 read 归并为 **`Explored` 组**；diff 独立成
  `• Edited <file> (+N −M)` 摘要卡。
- **opencode**：成功工具 = 单行 InlineTool（`→ Read <path>` 等）；有输出的工具才成块
  （Shell 输出 ≤10 行 + Click to expand；Edit/ApplyPatch 全 diff 块）；`showDetails` 关闭时
  成功工具**整体隐藏**。
- **Claude Code**：本地无源码（277MB 二进制），标注「未核验」；仅记录文档化行为
  （工具行紧凑化、outputStyle compact 等，未从代码核实）。
- **DeepSeek-TUI**：工具卡 = 动词字形 + 家族标签（`▶ run`/`◆ patch`/`▷ read`…）+ 左 rail
  `╭ │ ╰` 把连续工具卡**连成一组**；Live/Transcript 双渲染面，输出 ≤6 行 + `Alt+V for details`。
- **DeepSeek-Reasonix**：ToolCard 头（状态字形 + 工具名 + 参数摘要 + 耗时/exit 元数据）；
  **按工具类型分 tail 预算**（read 2 行 / 其他 5 行）；失败 shell **钉住失败行**
  （AssertionError/Error:/FAIL…≤3 行）；**Ctrl+R 全局 verbose** 解除省略。
- **hermes-agent**：thinking/tools/subagents/activity **四节各自 hidden/collapsed/expanded**；
  工具行 chevron 逐行折叠。
- **openclaw / taucode**：openclaw 是 pi 0.75.3 fork（输出 ≤12 行 + `…`，全局展开）；taucode
  无独立工具渲染（= pi 原生 + 压缩/裁剪扩展）。

**推荐方向**：以 **Grok Build 三态 + 类型化预算（Reasonix 风格）+ 失败强制显露（motto I1-3 已有）**
为骨干，走**组件级渲染接缝**（S3 同款，非 markdown transformer——命令块不经过 markdown）。
首选 **方案 B（三态折叠 + 类型化预算）**；**方案 A（著录唯一面）** 作为最小实现先行；
**方案 C（diff-only 改笔面）** 作为 review-flow v2 扩展（extension-native），与事件回顾分面。

**主要风险**：
1. **功能语不可侵**：全部方案只允许改渲染输入/组件呈现；不得写 session、不入模型上下文、
   不改工具语义、不写装饰字符进剪贴板（I5/I6/I10 不变量）。组件级 patch 须登记 PATCHES.json。
2. **调试出路**：折叠后开发者仍需看完整输出——必须有显式展开（键/点击）、或独立 transcript/pager
   面（Codex ctrl+t / DeepSeek-TUI Alt+V / Reasonix Ctrl+R 的既有先例）。
3. **流式稳定性**（I7-1）：折叠预算不得在流式期改变结构/闪烁；运行中与收尾后状态要分清
   （Grok 对 running/finished 分别定义 mode）。
4. **重复消除**：S3 目行 与 recap 行的职责须划清（避免「既折叠又重复」）。

---

## 0. 调研范围与口径

- **「工具/命令块」定义**：一条工具调用（bash/read/edit/write/grep 等）在 chat flow 中渲染出的
  呈现单元——命令原文、输出、diff、耗时、退出状态及其折叠/摘要/隐藏策略。
- **「review flow」口径**：motto 语境中指 turn 级 recap（著录层，motto-review-flow）+ chat flow
  中工具块的呈现共同构成的人类可审查叙事线。
- **来源分级**：本地源码（`~/Projects/...`）标注文件路径+行号；GitHub 上游标注仓库+分支+路径
  （remote 源码，行号以抓取时为准）；二进制/不可读标注「未核验」。
- **设计理念落点**（用户裁定，非本调研发明）：「辨章学术、考镜源流」= 可追溯、可审查的叙事线；
  「字大行疏」= 大字疏行、疏朗留白、利落。

---

## 1. 开源方案取舍对比

### 1.0 总表

| 方案 | 呈现方式 | 折叠/截断预算 | 折叠交互 | 失败处理 | diff 呈现 | 信息密度 vs 可 review | 风格 |
|---|---|---|---|---|---|---|---|
| **Grok Build**（xai-org/grok-build） | 三态块：Collapsed(单行标题) / Truncated(头+尾) / Expanded(全量)；agent 工具**默认 Collapsed** | first_lines + `… +N lines` + last_lines（值可配置） | chevron 循环折叠；viewer 全量 | accent_error 标题/整块、错误行红 | 语法高亮 diff hunk、双行号列 | 极高可 review、默认疏朗；展开在 viewer | 左栏 bullet + 圆角边框块；collapsed 可 muted |
| **Codex CLI**（本地 codex-main） | 命令单行标题 `• Ran <cmd>` + 输出块；连续 read 归并 **Explored** 组 | agent 5 行 / 用户 shell 50 行，**中部截断** + `… +N lines (ctrl+t)` | 固定预算无逐块交互；全量走 transcript（ctrl+t） | bullet 红、exit code | 独立 patch 摘要卡 `• Edited <file> (+N −M)` + 高亮 diff | 高密度但命令行收敛；transcript 兜底全量 | 左 rail `└`、输出 dim、命令语法高亮 |
| **opencode**（sst/opencode） | 成功 = 单行 InlineTool（icon+label）；有输出才成 BlockTool（左边框块） | Shell ≤10 行、Generic ≤3 行，头截断 + `…` | 点击展开/收起（鼠标）；`showDetails` 关闭则成功工具整体隐藏 | 失败行内红、点击展开 error body | Edit/ApplyPatch 全 diff（split/unified 按宽度、行号、高亮） | 密度最高（成功即一行/隐藏）；review 靠主动展开 | 左边框块、muted 单行、无重边框 |
| **Claude Code**（npm 2.1.224） | **未核验**（二进制无源码）；文档化：工具调用渲染为紧凑行 + 可展开，`outputStyle: "compact"` | 未核验 | 未核验 | 未核验 | 未核验 | 未核验 | 未核验 |
| **DeepSeek-TUI**（本地） | 工具卡：动词字形+家族标签 + 左 rail 连组；Live/Transcript 双渲染面 | TOOL_OUTPUT_LINE_LIMIT=6，头尾选择 + `N lines omitted; Alt+V` | Alt+V 看全量；rail 分组无逐块折叠 | 失败字形/标红 | DiffPreviewCell 独立预览卡 | 卡片分组降低碎片感；双面分离 | 字形 + 家族标签 + `╭ │ ╰` rail |
| **DeepSeek-Reasonix**（本地） | ToolCard（Card+Header：状态字形+工具名+参数摘要+meta） | **按类型 tail**：read 2 行 / 其他 5 行；失败 shell 钉住失败行 ≤3 | **Ctrl+R 全局 verbose** 解除省略 | exit code 标红、`✗` 字形 | SplitDiff 独立应用 | 参数摘要头 = 高信息密度 | 边框 Card、状态字形 ✓/✗/⊘ |
| **hermes-agent**（本地） | 四节（thinking/tools/subagents/activity）各 hidden/collapsed/expanded；工具行逐行 chevron | compactPreview 字符截断 | 逐行 chevron + `/details <节> <态>` | `✗` 错误行标红 | diff 段内联（msg.kind=diff） | 密度可调、默认 tools=expanded（live 感） | tree rail + chevron |
| **openclaw**（本地，pi fork） | Box 卡：emoji+label 头 + args dim + 输出 Markdown | PREVIEW_LINES=12 + `…` | 全局 toolsExpanded 切换（类 Ctrl+O） | toolErrorBg 整卡 | 无专门 diff（pi 原生） | 中密度 | 整宽 Box 卡 + 状态底色 |
| **taucode**（本地，pi fork） | 无独立工具渲染（= pi 原生）；关注 context 压缩/裁剪 | 不适用 | 不适用 | 不适用 | 不适用 | 不适用 | 不适用 |

### 1.1 opencode（sst/opencode，dev 分支，本地安装 1.18.11 为二进制）

本地仅二进制（`/opt/homebrew/lib/node_modules/opencode-ai`），渲染源码自 GitHub 核实
（`packages/tui/src/routes/session/index.tsx`）。

- **按工具分派渲染**：`ToolPart` 按 `toolDisplay` 分派到 Shell / Glob / Read / Grep / WebFetch /
  WebSearch / Write / Edit / ApplyPatch / Task / TodoWrite / Question / Skill / GenericTool
  （`routes/session/index.tsx` `ToolPart`）。
- **InlineTool（单行，成功静默）**：`→ Read <path>`、`✱ Grep "pattern" (N matches)`、
  `← Write <path>`、`$ <command>`、`% WebFetch <url>`、`⚙ <tool> <args>`；完成态 muted 一行，
  运行中 spinner + pending 文案（`InlineTool`/`InlineToolRow`）。
- **BlockTool（左边框块，有输出才成块）**：Shell 有输出时成块，`collapseToolOutput(output, maxLines=10, maxChars)`
  头截断 + `…`，点击展开/收起（`Shell`）；Generic 上限 3 行（`GenericTool`）。
- **Edit/ApplyPatch**：完整 diff 块（`<diff>` 组件，语法高亮、行号、split/unified 按宽度
  `ctx.width > 120 ? "split" : "unified"`、word wrap 可切换）——**diff 是独立的块级呈现**。
- **隐藏成功工具**：`showDetails`（`tool_details_visibility`）为 false 且工具已 completed → 整体隐藏
  （`shouldHide`）。另 `generic_tool_output_visibility` 控制通用工具输出。
- **折叠交互**：鼠标点击展开/收起；键位 `session.toggle.generic_tool_output`、
  `session.toggle.tool_details`。
- **Reasoning**：`Thought: <title> · <duration>`，hide 模式下默认折叠、点击展开全文。
- **失败**：失败工具行内红，点击展开 error body（`InlineToolRow` `errorExpanded`）。

**对 motto 的可取处**：成功 = 单行/隐藏；有输出才成块；diff 独立成块；失败可展开 error body。

### 1.2 Grok Build（xai-org/grok-build，main 分支；本地仅 ~/.grok/bin 二进制）

源码自 GitHub 核实（`crates/codegen/xai-grok-pager/src/scrollback/blocks/tool/`）。
**与 motto 理念最契合的模型**。

- **三态 DisplayMode**：`Collapsed`（单行标题，密度优先）/ `Truncated`（头 first_lines + `… +N lines`
  + 尾 last_lines）/ `Expanded`（全量）。`execute.rs::output()` 三分支；
  `next_fold_mode`：agent 工具 `Collapsed → Truncated`，bash 工具 `Collapsed → Expanded`，
  `Truncated/Expanded → Collapsed`（`execute.rs::next_fold_mode`）。
- **默认态关键区分**：agent 工具**默认 Collapsed**（`default_display_mode`），收尾**不强制改态**
  （`finished_display_mode` = None，用户留哪就哪）；用户 `!` bash 运行中 Truncated（输出流式）、
  **收尾强制 Expanded**（像终端一样给全量，`finished_display_mode` = Some(Expanded)）。
  read 块则收尾强制 Collapsed（`read.rs::finished_display_mode` = Some(Collapsed)）。
- **折叠态可 muted**：`mute_when_collapsed` / `muted_command_collapsed` 配置——折叠态整体降为
  低对比（`execute.rs::output` 取 `muted`）。
- **状态色**：execute 错误 accent_error、运行中 animated accent、成功 accent_success（`accent`）；
  read/other 错误 bullet 红、其余无色。
- **diff**：`edit.rs` 语法高亮 diff hunk、**双行号列**（old+new）、hunk 分隔符 `…` 可配置。
- **全量出路**：viewer（pager）提供全量；每块有 selection range。

**对 motto 的可取处**：三态默认折叠 + 类型化收尾态 + 折叠 muted + viewer 兜底全量。

### 1.3 Codex CLI（openai/codex，本地 ~/Projects/codex-main）

本地源码核实（`codex-rs/tui/src/`）。

- **命令单元格**：`• Ran <command>`（bold 标题，`Running` 运行中）/ `• You ran <command>`（用户
  shell）；命令语法高亮（`exec_cell/render.rs::command_display_lines`）。
- **输出预算**：`TOOL_CALL_MAX_LINES = 5`（agent）、`USER_SHELL_TOOL_CALL_MAX_LINES = 50`（用户
  shell）；**中部截断**：头若干行 + `… +N lines (ctrl + t to view transcript)` + 尾若干行
  （`output_lines` + `truncate_lines_middle`，按视口行数计预算）。
- **Explored 归并**：连续只读命令合并为 `Explored` 组，组内 `Read <f1>, <f2>` / `Search <q> in <p>` /
  `List <path>` 行（`exploring_display_lines`）——探索洪流在 reducer 层消解。
- **diff 摘要卡**：patch 独立 cell——`• Edited <file> (+N −M)` 头 + 语法高亮 diff 行；
  多文件 `Edited N files (+total −total)` + 每文件分块（`diff_render.rs::render_changes_block`）。
- **transcript（ctrl+t）**：全量输出 + 结果行 `✓ • 1.2s` / `✗ (exit 1) • 1.2s`（`transcript_lines`）。
- **风格**：bullet 绿/红按状态、输出 dim、左 rail `└`/缩进。

**对 motto 的可取处**：固定小预算 + transcript 兜底；Explored 归并（review-flow-eval §8 已列为
v2 候选）；diff 独立摘要卡（制品审查分面）。

### 1.4 Claude Code（@anthropic-ai/claude-code 2.1.224，npm 全局）

**未核验（源码不可读）**：包内 `bin/claude.exe` 为 277MB 打包二进制（
`/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/`），无可读 JS 源码。仅记录
**文档化行为**（未经本地代码核实）：工具调用通常渲染为紧凑行（工具名 + 摘要），可点击/键展开；
有 `outputStyle: "compact"` 类设置项压缩工具输出。**本调研不采信任何未核验细节**。

### 1.5 DeepSeek-TUI（本地 ~/Projects/DeepSeek-TUI，v0.8.39，Rust/ratatui）

本地源码核实（`crates/tui/src/tui/`）。

- **工具卡词汇**：动词字形 + 家族标签（`▷ read` / `◆ patch` / `▶ run` / `⌕ find` / `◐ delegate` /
  `⋮⋮ fanout` / `… think` / `• tool`）——`widgets/tool_card.rs::ToolFamily`；头部摘要从参数取
  家族偏好键（`tool_header_summary_for_name`）。
- **左 rail 连组**：连续工具卡共享 `╭ │ ╰` 左 rail，一列工具读作一个连续组
  （`transcript.rs::tool_group_rail`，`tool_groupable` 判定）。
- **Live/Transcript 双面**：Live（流内，cap 输出 + `Alt+V for details`）vs Transcript（pager/
  剪贴板/导出，无 cap）——`history.rs::RenderMode`。
- **输出预算**：`TOOL_OUTPUT_LINE_LIMIT = 6`，头尾选择 + `N lines omitted; Alt+V for details`
  （`render_preserved_output_mode`）。
- **ExecCell**：头 `▶ run <cmd>` + 状态 + 输出 cap + `time 1.23s` 紧凑 kv（`history.rs::ExecCell::render`）。
- **ExploringCell**：探索聚合卡 `Workspace done` + 每项 `done/live/issue <label>`
  （`history.rs::ExploringCell`）。
- **diff 预览卡**：`DiffPreviewCell`（`history.rs`）；`diff_render.rs` 有 summarize_diff → DiffFileSummary。
- **工具家族 glyph 是「一行一意」的极致**：动词字形即语义压缩。

### 1.6 DeepSeek-Reasonix（本地 ~/Projects/DeepSeek-Reasonix-main，v0.49.0，TS/Ink）

本地源码核实（`src/cli/ui/`）。

- **ToolCard**：Card + CardHeader = 状态字形（`●` running / `✓` ok / `✗` error·rejected / `⊘` aborted）
  + 工具名 + 参数摘要（`formatArgsSummary`）+ meta（`↻ n/m` 重试、rejected 徽标、bytes in、
  elapsed sec、exit code）——`cards/ToolCard.tsx`。
- **按类型 tail 预算**：`tailLinesFor`——read/search/list/tree/get/status/diff/fetch/grep → 2 行，
  其余 5 行（`READ_TAIL=2` / `OTHER_TAIL=5`）；head/tail 选择 + `N lines omitted` 标签
  （`tool-summary.ts::selectToolPreviewLines`）。
- **失败 shell 钉住失败行**：exit≠0 时扫描前 200 行，钉住 ≤3 行失败特征行
  （`AssertionError|Error:|FAIL|FAILED|expected|actual|✗`）——失败信息永不丢（
  `tool-summary.ts::selectToolPreviewLines` + `FAILURE_PINNED_LINES=3`）。
- **Ctrl+R 全局 verbose**：verbose 时跳过所有省略（`App.tsx:1652`）。
- **diff**：`SplitDiff.tsx` / `DiffApp.tsx` 独立应用面。
- **单行摘要**：非 verbose 的 ToolSummary 单行 ≤80 字符（`tool-summary.ts`）。

### 1.7 hermes-agent-main（本地 ~/Projects/hermes-agent-main，TS/Ink）

本地源码核实（`ui-tui/src/`）。

- **四节可见性**：thinking / tools / subagents / activity 各自 `hidden | collapsed | expanded`；
  tools 默认 **expanded**（live transcript 感）；运行时 `/details <节> <态>` 调整
  （`domain/details.ts`）。
- **工具行逐行 chevron**：ToolTrail 每工具行有本地 open 态（`setOpen`）、可单独折叠/展开；
  展开时显示 detail 行（`components/thinking.tsx`）。
- **compactPreview 字符截断**（`lib/text.ts`）；`✗` 错误行标红。
- **diff 段内联**：`msg.kind === 'diff'` 独立渲染、两侧留白（`components/messageLine.tsx:171-180`）。

### 1.8 openclaw（本地 ~/Projects/openclaw，v2026.5.20，pi 0.75.3 fork）

本地源码核实（`src/tui/components/tool-execution.ts`）。

- `ToolExecutionComponent`：整宽 Box 卡 = header（emoji + label + `(running)`）+ args dim 行 +
  输出 Markdown；状态底色 toolPendingBg / toolErrorBg / toolSuccessBg。
- **PREVIEW_LINES = 12**：未展开时输出截断 12 行 + `…`。
- 全局 `toolsExpanded` 切换（类 Ctrl+O），所有工具同进退（`chat-log.ts::setToolsExpanded`）。
- 与 pi/motto 同构（pi 0.75.3 fork），其「整宽卡」正是 motto TUI-1 S1/S2/S3 已经去化的形态。

### 1.9 taucode（本地 ~/Projects/taucode，pi fork + 扩展）

- 根仓无独立 TUI 渲染代码；`pi/` 为完整 pi checkout（TUI = pi 原生，与 motto 基线同源）。
- 自有资产为 `packages/compaction-core`、`packages/context-pruning`、`extensions/deterministic-compaction`
  等——关注**上下文经济性**（压缩/裁剪），非工具块视觉。**工具块呈现 = pi 原生（未改）**。

---

## 2. motto 现状盘点（源码核实）

### 2.1 渲染链路

chat flow 中工具调用走**组件级渲染**，不是 Markdown（`registerMarkdownTransformer` 只作用于
assistant 文本的 Markdown 投影，触碰不到工具块）：

| 面 | 组件/定义 | 位置 |
|---|---|---|
| agent 工具调用 | `ToolExecutionComponent`（调用 renderCall/renderResult/renderShell） | `packages/coding-agent/src/modes/interactive/components/tool-execution.ts` |
| 用户 `!!` bash | `BashExecutionComponent` | `.../components/bash-execution.ts` |
| bash 工具定义 | `createBashToolDefinition`（renderCall `$ cmd` + renderResult 输出预览） | `.../core/tools/bash.ts`（BASH_PREVIEW_LINES=5、BASH_UPDATE_THROTTLE_MS=100） |
| read 工具 | renderResult：未展开 10 行 + `... (N more lines, to expand)` | `.../core/tools/read.ts` |
| edit 工具 | renderResult：`renderDiff` 全 diff（行内词级高亮） | `.../core/tools/edit.ts` + `components/diff.ts` |
| 组装 | `interactive-mode.ts`：message_update/tool_execution_* 事件 → 组件原位更新；renderSessionItems 重放 | `.../interactive/interactive-mode.ts`（~3192、3266、3633、6399） |

### 2.2 现状结构、体积、占用

1. **S3 压缩（已有）**：`tool-execution.ts::isSuccessIndexLine`——成功的内置工具（非流式/非失败/
   未展开）渲染为单行低对比目行 `toolName target`（dim，`renderSuccessIndexLine` + `toolIndexTarget`
   取 command/file_path/path/pattern 首行）。**成功静默已落地**（TUI-1 S3，PATCHES.json 已登记）。
2. **完整卡（仍存在）**：
   - **流式期**：工具执行中显示整卡（toolPendingBg，调用 renderCall + 部分结果 renderResult）
     ——bash 长输出流式期整卡铺屏。
   - **失败**：整卡 toolErrorBg + 错误文本（I3-2 强制强显，不回退）。
   - **自定义工具**：整卡（toolDefinition 存在即不走 S3 目行）。
   - **展开态（Ctrl+O）**：全部整卡。
   - **用户 `!!` bash**：`BashExecutionComponent` 完整边框卡（命令头 + 输出预览 20 行 +
     `... N more lines (to expand)` + 退出码/截断警告，`bash-execution.ts`）。
3. **review recap（著录层，已有）**：`motto-review-flow` 扩展每 turn 落一条 custom entry
   （`appendEntry`，不入模型上下文）——汇总行 `4 tools · explore 1 · run 3 · 4.6s` + 逐工具行
   `bash ls · 320ms`；collapsed 只显失败条目（I1-3），expanded 显全部
   （`extensions/motto-review-flow/core.ts::buildTurnLines`）。
4. **体积**：成功工具 = 1 行；turn recap = 1 汇总行 + N 工具行；「命令原文 + 输出全文 + 耗时」
   的完整卡只出现在流式/失败/自定义/展开/`!!` bash 路径。

### 2.3 失控（失控面）条件

- **长输出流式**：bash 长输出在流式期整卡铺屏（BASH_UPDATE_THROTTLE_MS=100 节流重绘，但体积
  不收敛），直到 `tool_execution_end` 才压缩为 S3 目行。
- **多工具连续调用**：每 turn 的 S3 目行 + recap 工具行**双份呈现 tool+target**（重复感来源）；
  若用户中途 Ctrl+O 展开，全部整卡铺屏。
- **失败洪流**：失败整卡（正确的强显），但多失败 turn 体积失控（I3-2 优先于密度）。
- **自定义工具**：无 S3 压缩路径，永远整卡（含大 JSON 参数）。
- **`!!` bash**：`BashExecutionComponent` 完整边框卡不随 Ctrl+O 收敛为目行（独立于 S3 路径）。

### 2.4 接缝盘点（关键结论）

- **命令块不走 markdown transformer**：`registerMarkdownTransformer`（motto headings/cards 所用）
  只改 `AssistantMessageComponent`/`UserMessageComponent` 里 `Markdown` 组件的渲染输入
  （`markdown-transform.ts`）；工具块由 `ToolExecutionComponent`/`BashExecutionComponent` 直接从
  工具事件渲染，**不经 markdown**。因此「折叠/摘要/diff-only 工具块」**不能**靠 display-only
  markdown transformer 实现。
- **可走的接缝有三条**：
  1. **组件级渲染接缝（S3 同款）**：改 `ToolExecutionComponent`/`BashExecutionComponent` 的
     渲染分支（如 S3 的 `isSuccessIndexLine`/`renderSuccessIndexLine`）。这是 motto 受控下游
     （pi fork）内已确立的 patch 模式，登记 PATCHES.json，可独立回退，removalCondition =
     上游吸收等价工具卡 projector 出口。**现状 S3 已证明可行**。
  2. **扩展原生接缝（recap 面）**：`appendEntry` + `registerEntryRenderer`（motto-review-flow
     已有）。可用于「制品审查」面（turn 级 diff 聚合、change 摘要），**不触碰**工具卡渲染。
  3. **上游 generic seam（未来）**：内置工具卡 projector 出口 / per-entry transcript projector
     （TUI-SURFACE-MATRIX S5/S8/S16，UPSTREAM-PROPOSAL.md）——上游内建后本地 patch 退役。
- **display-only 纪律**（I5/I6/I10）：任何方案只改渲染输入；session/canonical/模型上下文/
  print/json/复制命令零改动；不写装饰字符进剪贴板（I6-4）。

---

## 3. 理念落点与候选设计方案

> 共同前提（三条候选都遵守）：
> - **display-only**：只改渲染，零写回、不入模型上下文（I0/I5/I10）。
> - **失败永不静默折叠**（I1-3/I3-2）：折叠/摘要只作用于成功路径。
> - **全量出路必须保留**：折叠后开发者要能看到完整输出（展开键 / transcript 面 / canonical
>   session + bash fullOutputPath 临时文件）。
> - **流式稳定**（I7-1）：运行中与收尾后的折叠预算要分清，避免流式期结构闪烁。

### 方案 A —「著录唯一面」：命令块全程收敛为目行，recap 独挑 review

**呈现什么/隐藏什么**
- 默认态：所有工具调用（含流式收尾后、失败除外）收敛为**单行目行** `toolName target`（S3 扩展
  到自定义工具与 `!!` bash）；失败仍整卡强显。
- 展开态（Ctrl+O 或新键）：恢复整卡（现行为）。
- review 主面 = turn recap（著录层）：每 turn 汇总行 + 逐工具行（已有），必要时**补 diff 统计
  （`+N −M`，recap 已有 `toolMetric`）**。

**信息密度 vs 可 review**：密度最高（成功即一行）；「考镜源流」由 recap 的逐工具行 + 摘要承担；
正文留白最多（字大行疏）。代价：流式期用户看不到输出（长任务无感知）。

**实现路径**：组件级接缝（S3 同款，`tool-execution.ts`）——把 `isSuccessIndexLine` 的判定扩展到
自定义工具与 `!!` bash（`BashExecutionComponent` 增加成功目行分支）；加一个「运行中显示摘要而非
全文」的流式预算（可借鉴 Codex 5 行 / Reasonix tail）。recap 侧零改动或仅补 diff 统计。
登记 PATCHES.json（如 `review-flow-a1-tool-index-all`）。

**风险**：
- 流式长任务无感知（需要最小流式预算缓解，如运行中 3–5 行 tail）。
- 「既折叠又重复」未根治：S3 目行 与 recap 行仍双份；需明确分工（目行 = chat 流内就地参照，
  recap = turn 级汇总），或把 S3 目行并入 recap（移除 chat 内目行）。
- 功能语不可侵：仅渲染分支，不触工具语义/模型上下文，风险低；需守卫剪贴板（I6-4）。

### 方案 B —「三态折叠 + 类型化预算」（推荐骨干）

**呈现什么/隐藏什么**
- 三态（借鉴 Grok Build）：**Collapsed（单行目行）/ Truncated（有界预览）/ Expanded（全量）**。
- **类型化预算**（借鉴 Reasonix/Codex）：read/grep/find/ls 等探索型 → tail 2–3 行；bash 执行型 →
  head/tail 各 5 行（中部截断 `… +N lines`）；edit/write 改笔型 → **默认 Truncated 即 diff**
  （只展示 diff，输出/参数不展示）。
- **默认态**：agent 工具成功收尾 → **Collapsed**（Grok agent 工具同款，成功静默 + I2 常事从简）；
  失败 → 整卡 + stderr 尾部（已有）；运行中 → 类型化 Truncated（有界流式预览）。
- **折叠交互**：沿用 T2-3 thinking 的交互范式（focus + fold 键）——新增 `app.tools.fold`
  （聚焦工具块循环三态）+ 复用全局展开（Ctrl+O）。折叠状态纯内存（同 T2-1 fold map），不写 session。
- **muted 折叠态**（Grok `mute_when_collapsed`）：Collapsed 目行 dim（S3 已有）；Truncated 预览
  dim 输出（bash 工具 renderResult 已 dim）。

**信息密度 vs 可 review**：密度可控（默认一行）、可 review 性最高（三态渐进披露 = 「辨章学术」的
层级：目 → 提要 → 全文）；字大行疏由默认折叠 + 留白达成。

**实现路径**：组件级接缝（`tool-execution.ts` + `bash-execution.ts` + `interactive-mode.ts`）——
把 S3 的 bool `expanded` 升级为三态 fold map（纯内存，同 thinking fold map 模式）；工具类型化
预算在 `tool-execution.ts`/`bash.ts` renderResult 内按 toolName 分派；键位在 `core/keybindings.ts`
登记。recap（著录层）不动或仅微调。

**风险**：
- 改动面最大（组件 + 键位 + 流式分支三处），须按 patch 切片（一条一 commit、逐片验收）。
- 三态状态生命周期（恢复/重建后的默认态）须明确——纯内存默认 Collapsed（同 thinking），
  与展开态共存策略要定（Ctrl+O 展开时三态如何叠加）。
- 调试出路：Truncated 中段被截，需保留「展开/transcript 看全量」提示（Codex `… +N lines
  (to view transcript)` 式 affordance 已现于 bash/read 卡）。
- 功能语不可侵：同 A；三态只属 UI 态，不写 session（T2-1 已立先例）。

### 方案 C —「diff-only 改笔面」：制品审查与事件回顾分面

**呈现什么/隐藏什么**
- chat 流内：改笔类（edit/write/apply_patch）**只展示 diff**（现状 edit 已 renderDiff；补
  write 的 diff、apply_patch 的 diff 汇总）；探索/执行类压缩为目行（A/B 的成果）。
- **新 review 面（制品审查）**：turn 级「改笔摘要」——按文件聚合本 turn 所有 edit/write 的 diff
  统计 `Edited 2 files (+12 −3)` + 逐文件 diff 块（借鉴 Codex `render_changes_block`、Kimi change
  chip、review-flow-eval §8「Change 制品摘要」候选）。与事件回顾（recap）分面：recap 回答
  「这轮发生了什么」，制品面回答「这轮总共改了什么」。

**信息密度 vs 可 review**：改笔（最需 review 的内容）以 diff 直陈，无输出噪声；执行/探索
疏朗收敛。「考镜源流」= 每步改笔的 diff 独立可溯。

**实现路径**：
- chat 内 diff-only：组件级接缝（edit 已 renderDiff；write/apply_patch 增 diff 分支）。
- 制品摘要面：**扩展原生接缝**——`appendEntry` 落 `motto-review-flow` v2（`turn.v2`），
  `registerEntryRenderer` 渲染（沿 review-flow-eval §8 候选，合法、有界、不入上下文）。可复用
  `core.ts` 的 `diffStats`/`toolMetric`。

**风险**：
- 「只展示 diff」会丢掉执行/探索的调试信息——必须以 B 的折叠 + 全量出路兜底，不单独立面。
- v2 entry 需与 v1 共存（v1 继续可渲染，新写入用 v2；review-flow-eval §9 已立纪律）。
- diff 数据进 session 文件须有界（KB 级，I2-2；不得落文件正文）。
- 功能语不可侵：制品面只读工具结果元数据（details.diff），不改工具语义；展示层零写回。

### 3.1 三案对比

| 维度 | A 著录唯一面 | B 三态折叠 + 类型化预算 | C diff-only 改笔面 |
|---|---|---|---|
| 默认呈现 | 成功=目行；失败整卡 | 成功收尾 Collapsed；运行中类型化预览 | 改笔=diff；其余目行/折叠 |
| 折叠交互 | 全局展开（现有） | 三态 fold 键 + 全局展开 | 同 A/B + 制品摘要卡 |
| diff | recap 仅统计 | 改笔 Truncated = diff | **全 diff 直陈 + turn 级聚合** |
| 实现路径 | 组件级（S3 扩展） | 组件级 + 键位 + 流式分支 | 组件级 + 扩展原生（recap v2） |
| 改动面 | 小 | 中（切片化） | 中（分两面） |
| 调试出路 | 展开态 | Truncated→Expanded | B 兜底 + 制品面 |
| 与理念契合 | 字大行疏 +++ | 辨章学术 + 字大行疏 +++ | 考镜源流（改笔溯源）+++ |
| 主要风险 | 流式无感知 / 重复未根治 | 改动面大 / 状态生命周期 | 丢调试信息 / v1v2 共存 |

### 3.2 建议路线

1. **先行最小实现 = 方案 A 的收敛化**：把 S3 目行推广到自定义工具与 `!!` bash（成功路径），
   并给流式加有界预览（3–5 行 tail）——即「命令块默认不再铺全文」的 80% 收益，改动集中在
   `tool-execution.ts`/`bash-execution.ts`，切片小、可独立回退。
2. **随后按摩擦升级为方案 B**：三态 + 类型化预算 + fold 键（复用 T2-3 thinking 交互范式），
   把「成功静默」升级为「渐进披露」。触发条件 = 使用中记录到「想看输出又要折叠」的真实摩擦
   （review-flow-eval §9 的观察期纪律：不以调研代替使用）。
3. **方案 C 作为 review-flow v2**：在 recap 观察期出现「改笔不可审」的真实摩擦时立项；先立
   制品摘要面（extension-native），chat 内 diff-only 随 B 一并落地。

---

## 4. 附：出处清单（供复核）

**本地可读**
- `~/Projects/pi/packages/coding-agent/src/modes/interactive/components/tool-execution.ts`
  （S3 isSuccessIndexLine / renderSuccessIndexLine / toolIndexTarget）
- `.../components/bash-execution.ts`（`!!` bash 卡，PREVIEW_LINES=20）
- `.../components/assistant-message.ts` / `user-message.ts` / `markdown-transform.ts` / `motto-layout.ts`
- `.../core/tools/bash.ts`（BASH_PREVIEW_LINES=5）/ `read.ts`（10 行预览）/ `edit.ts`（renderDiff）/
  `components/diff.ts`
- `.../modes/interactive/interactive-mode.ts`（工具事件组装，~3192/3266/3633/6399）
- `~/Projects/pi/packages/motto/extensions/motto-review-flow/{index,core}.ts`（著录层）
- `~/Projects/pi/packages/motto/extensions/motto/{index,headings,cards}.ts` + `README.md`（display-only 范式）
- `~/Projects/pi/docs/{MOTTO.md,TUI-THESIS.md}`、`docs/decisions/2026-08-11-motto-tui-1.md`、
  `docs/decisions/review-flow-eval.md`、`docs/decisions/2026-08-12-motto-tui-4-dunhao-cards.md`、
  `docs/architecture/TUI-SURFACE-MATRIX.md`、`docs/maintenance/PATCHES.json`
- `~/Projects/codex-main/codex-rs/tui/src/exec_cell/render.rs`（TOOL_CALL_MAX_LINES=5、
  USER_SHELL_TOOL_CALL_MAX_LINES=50、中部截断、Explored）、`history_cell/patches.rs`、
  `diff_render.rs`（diff 摘要卡）
- `~/Projects/DeepSeek-TUI/crates/tui/src/tui/widgets/tool_card.rs`（ToolFamily/字形/rail）、
  `history.rs`（RenderMode/TOOL_OUTPUT_LINE_LIMIT=6/ExecCell/ExploringCell）、`transcript.rs`
  （tool_group_rail）
- `~/Projects/DeepSeek-Reasonix-main/src/cli/ui/cards/ToolCard.tsx`（类型化 tail/状态字形）、
  `tool-summary.ts`（钉住失败行）、`App.tsx`（Ctrl+R verbose）、`state/verbose-context.ts`
- `~/Projects/hermes-agent-main/ui-tui/src/domain/details.ts`（四节三态）、`components/thinking.tsx`
  （ToolTrail 逐行 chevron）、`components/messageLine.tsx`（diff 段）、`lib/text.ts`（compactPreview）
- `~/Projects/openclaw/src/tui/components/tool-execution.ts`（PREVIEW_LINES=12、整宽 Box）、
  `src/agents/tool-display.ts`（emoji+label）
- `~/Projects/taucode`（pi fork：`pi/` 完整 checkout；扩展 `packages/{compaction-core,context-pruning}`）
- `~/Projects/hermes-agent-main` / `~/Projects/DeepSeek-Reasonix-main` / `~/Projects/DeepSeek-TUI`
  （版本见各仓 package.json/Cargo.toml）

**GitHub 上游（remote，行号以抓取时为准）**
- opencode（sst/opencode，`dev` 分支）：`packages/tui/src/routes/session/index.tsx`（ToolPart /
  InlineTool / BlockTool / Shell / Edit / ApplyPatch / ReasoningPart / showDetails）、
  `packages/tui/src/util/collapse-tool-output.ts`
- grok-build（xai-org/grok-build，`main` 分支）：
  `crates/codegen/xai-grok-pager/src/scrollback/blocks/tool/{execute,read,other,edit}.rs`
  （DisplayMode 三态 / 默认 Collapsed / fold 循环 / mute_when_collapsed / viewer 全量）

**未核验**
- Claude Code（`/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code` 为 277MB 二进制，
  无源码可读）；文档化行为未从代码核实，一律不采信细节。
- opencode / grok-build 本地仅有二进制（opencode-ai 1.18.11 npm、`~/.grok/bin/grok`），
  渲染逻辑以 GitHub 源码为准；grok-build `first_lines`/`last_lines` 的默认数值未核验
  （可配置项，`execute.rs::output` 引用 `config.first_lines/last_lines`）。
