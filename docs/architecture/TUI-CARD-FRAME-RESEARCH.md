# TUI 对 fenced 内容块 / 带标注卡片帧的呈现方式 — 调研笔记

> 性质：**调研笔记**（只读），供 motto TUI 的 `、、、` 三顿号卡片适配设计决策使用。
> 本文件不构成任何已批准的实施方案；候选设计见 §4，均待用户裁定。
>
> - 日期：2026-08-14
> - 范围：开源 TUI agent 对 fenced 内容块（```lang）与带标注卡片帧（Bash/txt 等）的
>   呈现方式；motto 现有 `、、、` 投影的差距；2–3 个候选设计。
> - 方法：本地源码逐行核实 + GitHub 上游源码核实（clone 到 /tmp 只读查看，未写任何 repo）；
>   所有引用标注出处；读不到的标注「未核验」。
> - 约束：全程只读 + 仅写本文件；未改任何产品代码。
> - 关联正典：`docs/decisions/2026-08-12-motto-tui-4-dunhao-cards.md`（顿号卡片工单，本调研
>   是其层二候选的摸排）、`docs/architecture/TUI-REVIEW-FLOW-RESEARCH.md`（命令块折叠调研，
>   本调研不重复其结论）、`docs/MOTTO.md`、`docs/TUI-THESIS.md`、`docs/maintenance/PATCHES.json`。
> - 前提（沿用既有裁定）：**先消费开源方案，不另造轮子**——markdown 表格已定为「普遍通行
>   方案」，不自定义新语法；`、、、` 卡片目前落在 display-only 表格投影上（cards.ts）。

---

## 一页纸摘要

**问题**：模型回报文本（人类最需 review 的部分）会自然输出 `、、、` 三顿号围栏卡片——GUI 里
渲染为独立卡片框（带 Bash/txt 标注、内容可整体复制）。motto 现有投影（`cards.ts`：`、、、`
→ 单列 markdown 表格 → box-drawing 盒）有两个缺陷：**多行内容单空格连接、破坏代码/多行结构**；
**带语言标注（`、、、 bash`）的形态完全没接住**（`DUNHAO_FENCE_RE` 只认裸 `、、、`，带标注
fail-open 逐字原样）。目标：让 `、、、` 卡片所有语法都被 motto TUI 接住。

**开源对比结论（7 家核实）**：
- **「卡片」= 表格盒框是普世做法**：Grok Build、Codex CLI、opencode（opentui）、DeepSeek-TUI、
  pi/motto 全部把 markdown 表格渲染为 box-drawing 盒（`┌┬┐├┼┤└┴┘`）。「带标注的框」在开源侧
  没有专有语法——标注要么隐藏（grok/codex/opencode 全都不显示语言标签，只靠背景+语法高亮），
  要么退化为代码块内的标签行（hermes `─ lang` / DeepSeek-Reasonix ` lang`）。
- **多行保真**：grok/codex/opencode/reasonix/hermes 的 fenced 代码块全部**逐行逐字保留**（只有
  宽折行，无内容压缩）；DeepSeek-TUI 甚至用**字符宽折行**保住前导缩进（`wrap_code_line`）。
  Codex 明确**不对代码行折行**（"preserve whitespace for copy/paste"）。**pi/motto 是例外**：
  pi 的 code fence 行会走 word-wrap，且 motto 卡片内容被 `.trim()` + 单空格连接。
- **语言标注**：hermes / DeepSeek-Reasonix 是仅有的两个把语言标签画出来的 TUI（muted `─ lang` /
  ` lang` 头行），其余三家隐藏标签。**没有一家把标注画成盒框标题**。
- **整体复制**：grok 有**装饰字符排除**（blockquote `│` rail 不进选区，`quote_bar.rs`）；
  codex/opencode/pi 是终端原生选区复制（盒框字符会进剪贴板）。**未核验**：pi 的选区复制对
  表格盒框是否进剪贴板（未从代码核实到消息面选区实现，见 §5）。

**motto 现状差距**：① `、、、 bash` 带标注 → 未识别、fail-open 逐字；② 内容行 `.trim()` +
单空格连接 → 多行结构丢失；③ 行内 Markdown 会被解析（代码内容里的 `#`/`|` 有风险，`|` 已转义）；
④ pi 原生 code fence（```lang）本身就有：语言标签内嵌 ``` 行、语法高亮（cli-highlight）、但
**代码行会 word-wrap**（与 Codex 的不折行纪律相反）。

**推荐方向**：以**候选 A（表格路径保真演进，零 core）**为主——`、、、` 仍投影为单列表格（既定
通行方案不动），但把「多行单空格连接」改为「每行一个表格 body 行」（行结构保真、超宽才折行），
并让 `、、、 bash` 标注成为卡片标题（标签）。改动面仅 `cards.ts` + 测试，index.ts 不变，零 core、
零 PATCHES.json。若日后要**语法高亮 + 与 ``` 代码块统一帧**，再走**候选 C（组件级薄接缝）**：
把 pi markdown.ts 的 code fence 升级为「带语言标签的盒框」（hermes/Reasonix 先例），`、、、`
与 ``` 统一成同一种帧，登记 PATCHES.json。**候选 B（带标注卡片直接投影为 ``` 代码围栏）**
不推荐单独用——视觉与「卡片」语义冲突，且 pi 代码行折行问题未解决时保真仍破。

**主要风险**：
1. **功能语不可侵**：全部候选只改渲染输入（display-only transformer / 组件渲染分支），
   不写 session、不入模型上下文；组件级 patch 须登记 PATCHES.json 并定 removalCondition。
2. **保真 vs 盒框不可兼得（零 core 前提）**：标准 markdown 里表格是唯一盒框构造，但表格单元格
   不能含换行——多行保真只能靠「每行一个 body 行」（候选 A），行内仍走 inline markdown 解析。
3. **语法高亮要动 core**：表格单元格非代码路径，无高亮；要高亮必须走 code fence（候选 B）
   或组件 seam（候选 C）。
4. **复制**：盒框装饰字符进剪贴板的问题与既有表格同源（非本方案新增）；grok 的装饰排除是
   core 级能力，motto 短期不可得。
5. **流式**：现有守卫已是「仅 assistant 完成态、非流式」投影，流式不涉及（cards.ts/index.ts
   守卫不变）。

---

## 0. 调研范围与口径

- **「fenced 内容块 / 带标注卡片帧」定义**：模型回报文本中由围栏（```lang 或 motto 的
  `、、、`）界定的呈现单元——语言/标注如何标、边框如何画、多行内容是否保真、有无语法高亮、
  能否整体复制、与普通 markdown 表格的渲染差异。
- **来源分级**：本地源码（`~/Projects/...`）标注文件路径+行号；GitHub 上游（grok-build /
  opencode / opentui）标注仓库+分支+路径（remote 源码，行号以 2026-08-14 抓取时为准）；
  二进制/不可读标注「未核验」。
- **与 TUI-REVIEW-FLOW-RESEARCH.md 的分工**：那份调研管「工具/命令块」的折叠与摘要（组件级
  渲染，不走 markdown）；本调研管「模型回报文本里的 fenced 内容块 / 卡片帧」（走 markdown
  渲染面）。命令块折叠结论直接消费，不重复调研。

---

## 1. 开源方案取舍对比

### 1.0 总表

| 方案 | fenced 代码块形态 | 语言标注样式 | 多行保真 | 语法高亮 | 整体复制 | 与表格渲染差异 |
|---|---|---|---|---|---|---|
| **Grok Build**（GitHub，main@be71313） | pretty 模式**隐藏围栏**，代码行加 `code_background` 背景色 | **不显示**（info 只进 metadata，供复制/选区与 mermaid 检测） | 逐字保留（仅 word-wrap，表格行才不折行） | syntect（流式增量） | **装饰排除**：blockquote `│` rail 不进选区；盒框字符会进 | 表格=盒框（`TableBorders::BOX`，ASCII 兜底）；blockquote=`│` rail；代码=背景块 |
| **opencode**（sst/opencode main@1f94d8a + @opentui/core 0.4.5） | `CodeRenderable`：围栏**隐藏**（conceal），无框、无标签 | **不显示**（lang 只映射 filetype 供 tree-sitter 高亮） | 逐字（text buffer，`token.text` 原样） | tree-sitter | 选区复制 | 表格=grid 盒框；blockquote=左边框 Box（`border:["left"]`）；代码=无框高亮块 |
| **Codex CLI**（本地 codex-main） | **不显示围栏**，批量语法高亮；**代码行不折行**（保复制空格） | **不显示**（lang 取 info 首 token，仅供高亮） | 逐字（body buffer 原样拼接，CRLF 测试） | syntect（`highlight_code_to_lines`） | 选区复制（装饰无排除） | 表格=盒框（dim 边框，pipe 兜底）；blockquote=`> ` 绿色前缀（非 rail 字形）；代码=高亮裸行 |
| **DeepSeek-TUI**（本地，v0.8.39） | **丢弃围栏**，代码行 `DEEPSEEK_SKY`+斜体+2 空格缩进 | **不显示** | 逐字 + **字符宽折行保前导缩进**（`wrap_code_line`） | 无 | 选区复制；Transcript 面可全量导出 | 表格=盒框（`render_table_border`）；代码行 `is_code` 元数据→**不加对话 rail**；工具卡=`╭│╰` rail 连组 |
| **DeepSeek-Reasonix**（本地，v0.49.0） | 代码块=` lang` 标签头 + 每行背景色 + 空格衬 | **显示**：` ${lang}`（FG.meta 头行） | 逐字（每行独立 Text） | cli-highlight | 选区复制 | 表格走自身 Markdown；代码块=标签+背景（非盒框）；ToolCard=Card+Header 帧 |
| **hermes-agent**（本地） | 代码块=`─ {lang}` muted 标签头 + 逐行高亮 + 左缩进 2 | **显示**：`─ {lang}`（muted） | 逐字（`block[]` 逐行收集渲染） | 自有 `highlightLine`（diff +/−/@@ 特殊着色） | 选区复制 | 表格=MarkdownTable 列宽计算；代码块=标签+高亮（非盒框）；四节三态折叠 |
| **pi / motto（本地）现状** | ``` 字面行（dim）+ lang 内嵌 + cli-highlight 高亮；**代码行 word-wrap** | 内嵌在 ``` 行 | 逐行（但会被 word-wrap 折行） | cli-highlight（`supportsLanguage` 门控） | 选区复制（消息面实现**未核验**） | 表格=盒框（粗体表头）；blockquote=`│ ` rail；`、、、`卡片=单列表格盒 |

**关键洞察**：
- 「带标注的框」在 7 家里**没有专有语法**——标注要么隐藏（grok/codex/opencode），要么
  降级为代码块内的标签行（hermes/Reasonix）。motto 的 `、、、` 卡片必须继续消费通用构造
  （表格 / 代码围栏），与既定「先消费开源方案」一致。
- 多行保真是所有家的默认纪律；**motto 是唯一把多行压成单空格连接的特例**（cards.ts 的取舍
  产物，非上游惯例）。

### 1.1 Grok Build（xai-org/grok-build，main @ be71313，clone /tmp 只读核实）

- **fenced 代码块（pretty 模式）**：围栏标记（``` / ~~~）在行首被隐藏（`render.rs` `is_hidden`
  + `is_code_fence` 判定，~639–670；开栏前插一空行分隔），代码行加 `code_bg_style`
  （`ms.code_background` 背景色，`render.rs:543, 735, 802`）；语法高亮走 syntect（流式尾部
  增量 `parse.rs:617–640` + `open_code_highlighter.rs`），无语言标签时用 `code_untagged` 样式
  也加背景（`parse.rs:640–646`）。
- **语言标注**：**不显示**。info 字符串只进 `CodeBlockSpan.info` 元数据（`output.rs:38–49,
  166–225`），用于选区/复制与 mermaid 检测（`mermaid_content.rs:100–105` 取 info 首 token）。
- **blockquote**：`>` 改写为 `│` bar，`blockquote_outer` dim muted 样式（`parse.rs:881–918`）；
  折行续行重复 bar（`wrapping.rs:404–409`）。
- **wrapping.rs 表格 vs blockquote rail 区分**（任务点名）：`is_table_line`（`wrapping.rs:312–350`）
  ——表格行（box-drawing 字符开头 / `│` 后还有内部 `│` 分隔 / ASCII `+` `|`）**永不 word-wrap**，
  clip+pad 到内容宽；blockquote 前缀（`│ ` 序列）用 `blockquote_prefix_len`（`wrapping.rs:356–365`）
  识别并折行续行。`│` 只在前缀区（`│ ` 或 `│ │ `）时才算 blockquote，出现内部 `│` 即判表格。
- **表格**：盒框字符集 `TableBorders::BOX = ─│┌┐└┘┬┴├┤┼`，ASCII `+|-` / DOUBLE `═║╔╗…` 变体
  （`style.rs:12–47`）。
- **工具块**：header 行 + `BlockLine::separator` 空行（`tool/execute.rs:541`），非盒框；三态
  DisplayMode 折叠见 TUI-REVIEW-FLOW-RESEARCH.md §1.2。
- **复制**：blockquote bar 通过 `quote_bar.rs::rendered_quote_prefix_len`（style-aware 扫描）排除
  出选区（`Selectable::Spans`，`quote_bar.rs:1–18, 97–135`）。
- **多行保真**：代码行走常规 word-wrap 路径（只有表格行不折行），无内容压缩。

### 1.2 opencode（sst/opencode，main @ 1f94d8a；渲染在 @opentui/core 0.4.5，npm 核实）

- **assistant 文本**：`<markdown internalBlockMode="top-level" tableOptions={{style:"grid"}}>`
  （`packages/tui/src/routes/session/index.tsx:1696–1706`）。
- **fenced 代码块** → `CodeRenderable`（`createCodeRenderable`，opentui `index.bun.js:9863–9876`）：
  `content = token.text` 逐字、`filetype = infoStringToFiletype(lang)`、tree-sitter 高亮、
  `conceal` 隐藏围栏标记、**无边框、无可见语言标签**。`markdown`/`diff` 等 lang 由
  `infoStringToFiletype` 分派（mermaid → 图，`index.bun.js:9292, 9867, 9910`）。
- **blockquote** → `BoxRenderable` 左边框 + paddingLeft 1（`createBlockquoteRenderable`，
  `index.bun.js:9646–9660`）——**左 rail 形态**。
- **表格**：`MarkdownTableStyle: "grid" | "columns"`（`renderables/Markdown.d.ts:19–24`），
  opencode 用 `grid`（盒框）。
- **折叠**：fenced 代码块本身无折叠；折叠在工具输出块（`collapseToolOutput` 头截断 + 点击展开，
  见 TUI-REVIEW-FLOW-RESEARCH.md §1.1）。
- **复制**：选区复制；无装饰排除（未从代码核实到排除机制）。

### 1.3 Codex CLI（openai/codex，本地 ~/Projects/codex-main）

- **fenced 代码块**（`markdown_render.rs::start_codeblock` 663–708）：lang 取 info 字符串首
  token（`rust,no_run` → `rust`）；body 缓冲**逐字拼接**（CRLF 测试 `crlf_code_block_no_extra_blank_lines`）；
  `end_codeblock`（708–735）批量语法高亮 `highlight_code_to_lines`。**不显示围栏、不显示语言标签**。
- **代码行不折行**：`flush_current_line`（1471–1497）对 `current_line_in_code_block` 跳过
  word-wrap——注释原文 "we don't wrap code in code blocks, in order to preserve whitespace for
  copy/paste"。
- **blockquote**：`> ` 绿色前缀（`MarkdownStyles.blockquote`，87–88；`start_blockquote` 323–331），
  **前缀样式而非 rail 字形**。
- **表格**：盒框 `┌┬┐└┴┘` + dim 边框（`render_table_lines` 667–723、`render_border_line`），
  列宽分配（Narrative/Structured 分类、迭代收缩），spillover 行提取，过窄 pipe 兜底
  （`render_table_pipe_fallback` 736–760）。
- **表格流式**：`streaming/table_holdback.rs` + `table_detect.rs`（流式期表格检测/滞留，防闪烁）；
  本调研按任务要求「table_detect.rs 之外」聚焦渲染，流式细节见出处。
- **复制**：选区复制；无装饰排除。

### 1.4 DeepSeek-TUI（本地 ~/Projects/DeepSeek-TUI，v0.8.39）

- **markdown_render.rs**：围栏**丢弃**（`parse.rs` 类扫描，`markdown_render.rs:73–74, 119–129`）；
  代码行 `Block::Code { line }` → `DEEPSEEK_SKY` fg + ITALIC + 2 空格缩进
  （`markdown_render.rs:270–276`）；**`wrap_code_line` 字符宽折行保前导缩进**
  （`render_wrapped_line_tagged` 368–400，注释 "Code blocks must preserve leading whitespace
  (indentation is semantic)"）；`is_code` 元数据 → transcript 面**不给代码行加对话 rail**
  （`markdown_render.rs:97–103`）。
- **表格**：盒框边框（`render_table_border` 834–909，分隔行作中边框）。
- **工具卡**：动词字形 + 家族标签 + `╭ │ ╰` 左 rail 连组（`widgets/tool_card.rs`、
  `history.rs::wrap_card_rail` 2292–2314）；输出 cap 6 行 + `N lines omitted; Alt+V for details`
  （`render_preserved_output_mode`）。
- **无语法高亮**；Live/Transcript 双面（Transcript 全量 + 剪贴板导出）。

### 1.5 DeepSeek-Reasonix（本地 ~/Projects/DeepSeek-Reasonix-main，v0.49.0）

- **代码块**（`src/cli/ui/markdown.ts:139–158`）：`lang` 标签头行 ` ${lang}`（FG.meta）；
  每行 `SURFACE.bgElev` 背景 + ` ${line} ` 空格衬；cli-highlight 语法高亮；逐字多行。
- **ToolCard**（`cards/ToolCard.tsx`）：Card + CardHeader 帧（状态字形 + 工具名 + 参数摘要 +
  meta 徽标）；**按类型 tail 预算**（read/search/list/grep…=2 行、其余 5 行，
  `READ_TAIL=2/OTHER_TAIL=5`）；**失败行钉住**（`tool-summary.ts::selectToolPreviewLines`，
  FAILURE_PINNED_LINES=3）；**Ctrl+R 全局 verbose**（`App.tsx`）。
- **复制**：选区复制；无装饰排除。

### 1.6 hermes-agent（本地 ~/Projects/hermes-agent-main，TS/Ink）

- **代码块**（`ui-tui/src/components/markdown.tsx:719–795`）：围栏逐行收集进 `block[]`（多行逐字）；
  **语言标签头行 `─ {lang}` muted**（754–756，`!isDiff` 时）；逐行 `highlightLine(l, lang, t)`
  语法高亮（或无高亮原样）；`diff` lang 特殊着色（`+`/`-`/`@@` 背景色）；`md`/`markdown` lang
  递归作 markdown 渲染；左缩进 paddingLeft 2；**无盒框**。
- **表格**：MarkdownTable（`markdown.tsx:212–492`，列宽计算、paddingLeft 2）。
- **三态折叠**：thinking/tools/subagents/activity 四节各 hidden/collapsed/expanded
  （`domain/details.ts`）；工具行逐行 chevron（`components/thinking.tsx`）。
- **复制**：选区复制；无装饰排除。

### 1.7 小结：对 motto 的可取处

1. **多行保真纪律**（全 7 家）：内容行逐行保留；DeepSeek-TUI 的字符宽折行保缩进、Codex 的不折行
   保复制空格，都是可借鉴的保真手段。
2. **标注样式先例**：hermes `─ lang` / Reasonix ` lang` 是仅有的「把标签画出来」的两种做法
   （muted/低对比头行）——若 motto 要显示标注，此为普遍可行形态。
3. **grok 的表格 vs blockquote rail 区分**（`wrapping.rs is_table_line`）说明：盒框行与 rail 行
   在折行/选区内必须分流——motto 若新增盒框形态，应复用既有表格渲染（已分流），不新增 rail。
4. **无一家把标注画成盒框标题**——motto 若做「标注=卡片标题」，是自选形态而非开源惯例（可接受，
   因为表格表头粗体是 pi 既有能力）。

---

## 2. motto 现状盘点（源码核实）

### 2.1 渲染链路

| 面 | 组件/定义 | 位置 |
|---|---|---|
| assistant 文本 Markdown | `Markdown` 组件（marked → tokens → 样式行） | `packages/tui/src/components/markdown.ts` |
| 展示投影接入 | `registerMarkdownTransformer`（每扩展单槽，后注册覆盖先注册） | `extensions/motto/index.ts:44–47`；`coding-agent/src/core/extensions/loader.ts:309` |
| 投影应用点 | `assistant-message.ts` / `user-message.ts` 内 `createMarkdownTransform` | `.../components/assistant-message.ts:139,201`；`.../user-message.ts:57` |
| 顿号卡片投影 | `projectDunhaoCards` → 单列表格 | `extensions/motto/cards.ts` |
| 标题投影 | `projectDeepHeadings`（H3–H6 → H2） | `extensions/motto/headings.ts` |
| 组合 | `projectDisplay = cards ∘ headings`（单槽组合） | `extensions/motto/index.ts:28–34` |

### 2.2 pi 原生 markdown 渲染（对照基线）

- **code fence（```lang）**：`markdown.ts:517–537` —— 开栏行 ` ```${lang} ` 以 `codeBlockBorder`
  （dim）渲染、lang 内嵌其中；代码行 `highlightCode`（cli-highlight，`theme.ts:1282–1305`，
  `supportsLanguage` 门控，无效 lang 走 `mdCodeBlock` 纯色）；闭栏 ` ``` ` dim。
- **代码行折行**：`Markdown.render()` 对所有渲染行统一走 `wrapTextWithAnsi`（`markdown.ts` render
  主体 + `utils.ts:832`）——**pi 的代码行会被 word-wrap**（与 Codex 不折行、DeepSeek-TUI 字符宽
  折行的纪律相反）。这是 `、、、` 保真议题的既有上游限制。
- **blockquote**：`│ ` rail（`markdown.ts:532–563`，quoteBorder + 斜体）。
- **表格**：盒框 `┌─┬─┐/├─┼─┤/└─┴─┘`、**粗体表头**、列宽分配、过窄 fallback 到 raw markdown
  （`renderTable` 566–716）。

### 2.3 `、、、` 卡片投影现状与缺陷（`cards.ts`）

- `DUNHAO_FENCE_RE = /^ {0,3}、、、[ \t]*$/`（cards.ts:32）——**只认裸 `、、、`**；
  `、、、 bash`（带标注）不匹配 → fail-open 逐字原样，**带标注卡片完全没被承载**。
- 内容处理（cards.ts:125–137）：标题 = 开栏后首个非空行（`.trim()`）；内容 = 其后非空行
  **`.trim()` 后 `.join(" ")` 单空格连接**（cards.ts:135–137）——**多行结构丢失**：
  - 代码/脚本类内容（bash 多行命令）被压成一行，行内缩进、换行全丢；
  - 行首缩进被 `.trim()` 吃掉；
  - 内容行内 Markdown 会被表格单元格 inline 解析（`#` 注释、`|` 等需转义——`|` 已转义，
    `#` 在单元格内不会成标题，风险低）。
- 守卫：仅 assistant 完成态、非流式（index.ts 组合后仍走 `projectDunhaoCards` 自己的守卫，
  cards.ts:36）；fenced 代码块内跳过；幂等；fail-open。
- 已定边界（工单 MOTTO-TUI-4 §0）：core `markdown.ts` 零改动；不建第二套卡片管线；无嵌套卡片。

### 2.4 差距结论

1. **标注形态缺口**：`、、、 bash` / `、、、 txt` → 目前 fail-open 逐字（连表格投影都不走）。
2. **多行保真缺口**：单空格连接 + trim → 多行结构（缩进/换行）全丢；与全开源的多行保真纪律相悖。
3. **语法高亮缺口**：表格单元格非代码路径，无高亮；pi 原生 code fence 有高亮但会 word-wrap
   折行（且带标注卡片投影不过去）。
4. **复制**：盒框装饰进剪贴板与既有表格同源（非新增风险）；消息面选区复制的具体实现**未核验**
   （见 §5）。

---

## 3. 设计落点共同前提

> 三条候选都遵守：
> - **display-only**：只改 TUI 渲染输入（markdown transformer 或组件渲染分支）；canonical /
>   session / 模型上下文 / print·json / 复制命令零改动（I0/I5/I10）。
> - **功能语不可侵**：`、、、` 围栏只属渲染输入，不写回模型上下文；模型侧格式约定（何时输出
>   卡片）另立，不在本调研范围。
> - **先消费开源方案**：沿用表格 = 「普遍通行方案」；不自定义新语法/新构造。
> - **流式稳定**：现有守卫「仅 assistant 完成态、非流式」不变，候选不触碰流式路径。
> - **全量出路**：卡片内容不压缩、不截断（保真优先）；超宽靠渲染层折行兜底。

---

## 4. 候选设计方案

### 方案 A —「表格路径保真演进」（display-only，零 core，**推荐骨干**）

**呈现什么**
- `、、、` 围栏仍投影为**单列表格**（既定通行方案不动），但：
  - **多行保真**：内容每个非空行 → **一个表格 body 行**（`| 行内容 |`），不再单空格连接；
    行首缩进保留（去掉 `.trim()`，只做 `|` 转义与行尾 trim）。超宽由表格 `wrapCellText` 折行。
  - **标注承载**：`、、、 bash` → **标题 = `bash`**（标注即卡片标签，表格头行粗体渲染）；
    其后所有非空行 = 内容行。无标注时维持「首非空行 = 标题」。
  - 与既有单列卡片投影**同一构造、同一渲染路径**，只是「内容行数 = N」而非「单行连接」。
- 渲染结果示例（`、、、 bash` + 两行命令）：

```
┌────────────────────────────────┐
│ bash                            │   ← 标注=标题（粗体）
├────────────────────────────────┤
│ npm run build --filter motto    │   ← 每行一个 body 行
│ && node scripts/verify.mjs      │
└────────────────────────────────┘
```

**保真度**：逐行保留（不再连接、不 trim 行首）；代价——行内仍走 inline markdown 解析
（`*`/`**`/`` ` `` 会被格式化），**无法语法高亮**（表格单元格非代码路径）。代码类内容若想
字面原样，需行内转义（成本高）或接受轻度解析。

**与 pi 原生 code fence 的关系**：保持区分——`、、、` 卡片 = 表格盒框（粗体标签头 + 逐行内容），
``` 代码块 = ``` 字面行 + 高亮。两套形态并存，语义清晰（卡片 ≠ 代码）。

**实现路径与改动面**
- `extensions/motto/cards.ts`：围栏正则扩为 `^ {0,3}、、、[ \t]*(.*)$`（捕获标注）；标题 =
  标注 ?? 首非空行；内容 = 标注存在时全部非空行，否则首行之后各行；输出每行一个
  `| … |` body 行。index.ts 组合不变（`projectDisplay` 顺序无关）。
- 测试：`extensions/motto/test/cards.test.mjs` 增补（带标注 / 多行 / 行首缩进 / 空行 / 幂等 /
  `|` 转义 / 端到端渲染）。index.ts **零改动**。
- **不登记 PATCHES.json**（extension 代码，非 core；core `packages/tui` 零改动——沿用
  MOTTO-TUI-4 §4 的定界）。

**风险**
- 多行卡片行间有 `├─┼─┤` 分隔线（表格行分隔）——视觉偏「表格」而非「卡片」；可接受
  （它本就是表格），或后续在表格渲染层做「无分隔行」变体（属 core 能力，另议）。
- 行内 Markdown 解析对代码内容有轻度干扰（`#` 注释在单元格内不成标题，`*` 会斜体）——
  需接受或对代码类标注（bash/txt）做行内转义（展示层可做，但增加变换复杂度）。
- 复制：盒框字符进剪贴板与既有表格同源（非新增）。
- 兼容：与既有单列投影**演进兼容**（旧输出是 1 body 行，新输出是 N body 行；同一构造，
  旧测试更新即可，无撤销/回退问题）。

### 方案 B —「带标注卡片走代码围栏路径」（display-only，零 core）

**呈现什么**
- `、、、 bash` / `、、、 txt` → 投影为 ```` ```bash ```` 代码围栏（多行逐字保真、行内**不解析**
  Markdown、语言标注由 pi 原生 code fence 的 ` ```lang ` 行承载、`supportsLanguage` 有效时
  cli-highlight 语法高亮）。
- `、、、`（无标注）→ 保持表格投影（标题 + 内容单行化，现行为）。

**保真度**：代码内容逐字（无 trim、无连接、无 inline 解析）；**但 pi 的 code fence 行会
word-wrap**（§2.2）——长行会被折行，保真仍破（除非同时解决 pi 代码折行）。

**与 code fence 的关系**：`、、、 bash` ≡ ```bash——统一成代码块形态；`、、、` 卡片仍区分。
**语义冲突**：卡片（人类 review 的框）与代码块（```）在视觉上割裂，带标注卡片不再是「盒框」。

**实现路径与改动面**：cards.ts 演进（带标注围栏 → 代码围栏，无标注 → 表格）+ 测试；index.ts
不变；零 core；不登记 PATCHES.json。

**风险**
- 视觉与「卡片」语义冲突（表格盒框 ↔ 代码字面行），与 motto「不刻板」理念有张力。
- pi 代码折行未解决时保真仍破（需上游修或走候选 C）。
- 无标注/有标注两套形态（表格 vs 代码块）分裂，模型输出形态越多越难一致。

### 方案 C —「组件级薄接缝：code fence 升级为带标注盒框」（统一帧，登记 PATCHES.json）

**呈现什么**
- 把 pi `markdown.ts` 的 code fence 渲染升级为**带语言标签的盒框**（借鉴 hermes `─ lang` 头行
  或表格盒框标题）：开栏渲染 `┌─ {lang} ─┐`（或 `─ {lang}` 标签行 + 内容），代码行语法高亮
  （现已有 cli-highlight）+ 逐字保真（借鉴 Codex 不折行 / DeepSeek-TUI 字符宽折行，解决 pi
  代码 word-wrap）。
- `、、、` 卡片（含标注）统一投影为 ```` ```lang ```` 代码围栏 → 与 ``` 代码块**同一种帧**
  （带标注盒框 + 高亮 + 保真）。

**保真度**：最高——逐字 + 高亮 + 标注承载；多行、缩进、复制语义一致。

**与 code fence 的关系**：`、、、` 与 ``` **统一成同一种帧**（卡片 = 带标注的盒框代码块）。
放弃「卡片 ≠ 代码块」的区分，换取统一 + 高亮。

**实现路径与改动面**
- **组件级薄接缝**：`packages/tui/src/components/markdown.ts` code 分支加框/标签 + 代码行
  不折行（或字符宽折行）；`packages/coding-agent/src/modes/interactive/theme/theme.ts` 增
  codeBlockTitle / 边框配色槽。登记 `docs/maintenance/PATCHES.json`（如 `tui-4-code-card-frame`），
  removalCondition = 上游吸收等价 code fence 盒框渲染出口。
- cards.ts：`、、、`（含标注）→ 代码围栏投影（标注 → ` ```lang `）。测试双面补。
- **不是 markdown transformer 能单独完成的**（markdown.ts 渲染分支是 core），须组件 patch。

**风险**
- **core 改动**：受控下游制度允许但要登记 PATCHES.json、独立回退、上游升级重放成本
  （MOTTO-UPGRADE-1 已立先例）。
- 与既定「表格即卡片」决策冲突（MOTTO-TUI-4 §2.1 裁定表格是唯一盒框构造）——须用户重裁。
- 代码不折行会引入超宽横向溢出问题（Codex 靠 viewport 裁剪；pi 需同款兜底）。
- 改动面最大（markdown.ts + theme.ts + cards.ts + PATCHES.json + fixtures）。

### 4.1 三案对比

| 维度 | A 表格保真演进 | B 带标注走代码围栏 | C 组件盒框统一帧 |
|---|---|---|---|
| 默认呈现 | 卡片=单列表格盒框，标注=粗体表头，逐行内容 | 带标注=代码块；无标注=表格盒框 | 卡片与 ``` 统一为带标注盒框 |
| 多行保真 | 每行一个 body 行（不连接、保行首缩进） | 代码围栏逐字（但 pi 折行未解决） | 逐字 + 修 pi 代码折行（不折行/字符宽） |
| 语法高亮 | 无（表格单元格非代码路径） | cli-highlight（lang 有效时） | cli-highlight（全统一） |
| 语言标注 | 表格粗体表头 | ```lang 行内嵌 | 盒框标题（`─ lang` / `┌─ lang ─┐`） |
| 实现路径 | markdown transformer（cards.ts 演进） | markdown transformer（cards.ts 演进） | 组件级接缝（markdown.ts + theme.ts）+ cards.ts |
| 改动面 | 小（cards.ts + 测试，index.ts 零改） | 小（cards.ts + 测试） | 中（core 2 文件 + cards.ts + PATCHES.json + fixtures） |
| PATCHES.json | 不登记（extension） | 不登记（extension） | 登记（core patch） |
| 兼容既有单列投影 | 演进兼容（同构造，行数变化） | 带标注形态改道，无标注不动 | 全形态改道（撤销/重放成本） |
| 与理念契合 | 字大行疏 +++；可 review（逐行） | 保真 ++；卡片语义弱化 | 统一 + 高亮 +++；core 成本 + |
| 主要风险 | 行内 markdown 解析 / 行间分隔线 / 无高亮 | pi 折行未解决 / 视觉割裂 / 双形态分裂 | core 改动 / 既定决策冲突 / 超宽溢出 |

### 4.2 建议路线

1. **先行最小实现 = 方案 A**：零 core、沿用既定表格通行方案、一次修复两个缺陷（标注承载 +
   多行保真），改动收敛在 `cards.ts` + 测试。80% 收益、可独立回退、与既有投影演进兼容。
2. **若出现「要语法高亮 / 要卡片与代码块同帧」的真实摩擦** → 升**方案 C**（组件级接缝，
   登记 PATCHES.json，removalCondition 定死），并把「pi 代码折行」作为接缝的一部分一并修
   （借鉴 Codex 不折行 / DeepSeek-TUI 字符宽折行）。触发纪律同 review-flow：**不以调研代替使用**。
3. **方案 B 不单独采用**（视觉与卡片语义冲突、pi 折行未解决时保真仍破）；仅作为 C 的前置
   讨论素材（`、、、 bash` → ```bash 的映射规则可直接复用）。

---

## 5. 附：出处清单与未核验项

**本地可读**
- `~/Projects/pi/packages/tui/src/components/markdown.ts`（code fence 517–537、blockquote 532–563、
  表格 renderTable 566–716、render 全量折行 wrapTextWithAnsi）
- `~/Projects/pi/packages/tui/src/utils.ts:832`（wrapTextWithAnsi）
- `~/Projects/pi/packages/coding-agent/src/modes/interactive/theme/theme.ts:1278–1305`
  （codeBlockBorder / highlightCode + supportsLanguage 门控）
- `~/Projects/pi/packages/coding-agent/src/modes/interactive/components/markdown-transform.ts`
  （transformer 链）、`assistant-message.ts:139,201`、`user-message.ts:57`
- `~/Projects/pi/packages/coding-agent/src/core/extensions/loader.ts:309`（registerMarkdownTransformer 单槽）
- `~/Projects/pi/packages/motto/extensions/motto/cards.ts`（DUNHAO_FENCE_RE:32、内容连接 125–137）、
  `headings.ts`、`index.ts:28–47`
- `~/Projects/pi/packages/motto/extensions/motto/test/cards.test.mjs`（20 条用例）
- `~/Projects/pi/docs/decisions/2026-08-12-motto-tui-4-dunhao-cards.md`、`docs/maintenance/PATCHES.json`
- `~/Projects/codex-main/codex-rs/tui/src/markdown_render.rs`（start_codeblock 663–708 /
  end_codeblock 708–735 / flush_current_line 不折行 1471–1497 / render_table_lines 667–723 /
  pipe fallback 736–760 / blockquote 前缀 323–331）
- `~/Projects/DeepSeek-TUI/crates/tui/src/tui/markdown_render.rs`（围栏丢弃 73–74,119–129 /
  代码样式 270–276 / wrap_code_line 368–400 / is_code 不加 rail 97–103 / 表格 834–909）、
  `history.rs`（wrap_card_rail 2292–2314、输出 cap）
- `~/Projects/DeepSeek-Reasonix-main/src/cli/ui/markdown.ts:139–158`（CodeBlock 标签+背景+高亮）、
  `cards/ToolCard.tsx`、`tool-summary.ts`（失败钉住）
- `~/Projects/hermes-agent-main/ui-tui/src/components/markdown.tsx:719–795`（代码块 `─ lang` 标签）、
  `domain/details.ts`（三态折叠）

**GitHub / npm 上游（remote，行号以 2026-08-14 抓取时为准；clone /tmp 只读，未写 repo）**
- grok-build（xai-org/grok-build，main@be71313）：
  `crates/codegen/xai-grok-markdown/src/render.rs`（围栏隐藏 639–670 / code_bg 543,735,802 /
  table_replace 419–460）、`parse.rs`（syntect 高亮 617–640 / code_untagged 640–646 /
  blockquote `│` 改写 881–918 / TableBorders 引用 1556）、`output.rs`（CodeBlockSpan 38–49,166–225）、
  `style.rs:12–47`（TableBorders::BOX/ASCII/DOUBLE）、
  `crates/codegen/xai-grok-pager-render/src/render/wrapping.rs:312–409`（is_table_line /
  blockquote_prefix_len）、`crates/codegen/xai-grok-pager/src/scrollback/blocks/quote_bar.rs`
  （选区排除）、`tool/execute.rs:541`（separator）
- opencode（sst/opencode，main@1f94d8a）：`packages/tui/src/routes/session/index.tsx:1696–1706`
  （markdown internalBlockMode + tableOptions grid）
- opentui（@opentui/core@0.4.5，npm pack /tmp 只读）：`renderables/Markdown.d.ts`（表格 grid/columns）、
  `index.bun.js:9863–9876`（createCodeRenderable）、`9646–9660`（blockquote 左框）、
  `9292/9867/9910`（infoStringToFiletype）

**未核验**
- Claude Code：本地无源码（二进制），本调研未采信其任何细节（同 TUI-REVIEW-FLOW-RESEARCH.md）。
- pi 消息面选区复制是否把表格/盒框装饰字符写入剪贴板：未从代码核实到消息面选区实现
  （`tui.input.copy` 在 editor 组件 `packages/tui/src/components/editor.ts:654`，消息正文复制路径
  未追到）；标注「未核验」。
- grok-build `first_lines/last_lines` 默认数值等折叠配置细节：本调研不涉及（消费既有调研）。
