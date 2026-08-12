# 工单：MOTTO-TUI-4 — 顿号卡片展示投影（、、、 三顿号卡片）

- 日期：2026-08-12
- 类型：工单（TUI 续行；前 session 决定未实现，本次摸排最小实现并落地）
- 状态：REGISTERED → 调研完成 → 实现
- 依据：
  - 前 session 决定（2026-08-09，Codex 会话）：「三顿号卡片」——主流 chatbot 与模型行为
    都需要的**卡片输出**能力；裁定前提为**解耦实现，否则不做**（"如果不能按照解耦实现，
    则宁可先不做"）。此前 caption 实验（FLOW-FENCED-BLOCKS-1）因视觉冗余被用户目验否决
    并已回退，本单是其正确形态的落地。
  - MOTTO-TUI-2 范围外明列「不做：… **Code Card** …」（`2026-08-11-motto-tui-2.md` §0）——
    本单以解耦投影形态补足该空缺，不与任何已裁定项冲突。
  - 用户指令（2026-08-12）：摸排最小实现 → 召回/调研开源 TUI 方案 → 先出实现逻辑 diff
    → 以符合 Motto 理念的方式做最小实现。

## 0. 定名与范围

**目标**：让 TUI 把 `、、、`（三顿号）围栏卡片**消费**成真正的卡片视觉。

**cards md 格式**（前 session 与用户消息中多次出现的形态）：

```markdown
、、、
卡片标题
内容第一行
内容第二行
、、、
```

`、、、` 独占一行（前导空格 ≤3）为开/闭围栏；开栏后首个非空行 = 卡片标题，其后至闭栏
的非空行 = 卡片内容；内容可含行内 Markdown（加粗/代码/链接）。

**明确不做（本单）**：core TUI 的 `markdown.ts` 零改动（无 tokenizer 扩展、无新渲染分支）；
不建第二套卡片管线；不改 agent loop / provider / session schema；不写模型上下文；
无用户配置开关（加载扩展即生效）；不处理嵌套卡片、列表内卡片、blockquote 内卡片。

## 1. 开源 TUI 调研（召回 + 实测，2026-08-12）

结论先行：**三家主流 agent TUI 都没有发明新卡片语法**；"卡片"视觉全部落在标准 Markdown
（表格）或原生 box-drawing 原语上。`、、、` 是 Motto 自己的轻量约定，TUI 侧只需把它投影
到 TUI 已原生渲染的构造上即可，零 core 改动。

| 方案 | 技术栈 | 卡片/块渲染做法 | 对本案的可取处 |
|---|---|---|---|
| **opencode**（sst/opencode） | TS + 自研 openTUI（Solid） | 原生 box-drawing 原语：消息左 rail、工具输出带边框块 + `collapseToolOutput` 截断 | 卡片 = 边框块 + 头部；输出折叠 |
| **Grok Build**（xai-org/grok-build） | Rust + ratatui | 全屏自绘渲染器；`Block`/`BorderType::Rounded` 边框块（overlay/图片）；`wrapping.rs` 区分表格边框与 blockquote rail | 卡片 = 圆角边框块；表格/引用语义分流 |
| **Codex CLI**（openai/codex，本地 codex-main） | Rust + ratatui + pulldown-cmark | **markdown 驱动**：`table_detect.rs` 流式检测管道表格，`markdown_render.rs` 把 `Tag::Table` 事件聚为 `TableState` → `render_table_lines` 绘 box-drawing 表格；blockquote 为样式 rail | 与 pi 同构（markdown AST → 样式行）；表格即卡片 |

**对 pi/motto 的结论**：pi 的 `Markdown` 组件（marked → tokens → 样式行）与 Codex CLI 同构；
`、、、`-卡片无需也不可能"原生"渲染（无自定义语法层），**投影为单列 Markdown 表格**即得
TUI 原生 box-drawing 卡片（`┌─┬┐/├─┼┤/└─┴┘` + 粗体标题头），与用户仓库既有文档表格
（如 `.motto/agent.md` 验收表）视觉同源，见 §3 实测输出。

## 2. 实现逻辑 diff（核心决策）

### 2.1 接缝：`registerMarkdownTransformer`（解耦，零 core 改动）

沿用 `projectDeepHeadings`（headings.ts）同一公开接缝：display-only 字符串投影，只改
interactive 组件 Markdown 渲染输入；canonical 正文 / session / 模型上下文 / resume·fork /
print·json 均不经过（投影零写回、不入模型上下文，见 `docs/MOTTO.md` 总纲五）。

### 2.2 变换规则：`、、、`围栏卡片 → 单列表格

```
、、、
验收结论
基线逐字节、tui 909/909 全绿
第二行内容
、、、
```
↓ 投影
```
| 验收结论 |
|---|
| 基线逐字节、tui 909/909 全绿 第二行内容 |
```
↓ TUI 原生渲染
```
┌──────────────────────────────────────────┐
│ 验收结论                                  │   ← 粗体标题头
├──────────────────────────────────────────┤
│ 基线逐字节、tui 909/909 全绿 第二行内容   │
└──────────────────────────────────────────┘
```

决策点：
- **目标构造选表格**：TUI 的 `Markdown` 组件中，表格是唯一能从 Markdown 原生渲染出完整
  边框盒（上下左右全边框）的构造；blockquote 只有左 rail，code fence 只有 ``` 行。
- **标题 = 首非空行**（表格头行，渲染粗体）；内容 = 其后非空行以单空格连接（表格单元格
  单行、自动折行；连接即保留段落感的最小面）。标题缺失/空卡片 → fail-open 原样。
- **内容/标题中的 `|` 转义为 `\|`**（防破坏表格列）。
- **fenced 代码块内一律跳过**（复用 headings.ts 的 `parseFence` 围栏跟踪，防误伤代码块，
  见 §3 实测 Sample 4 的反例）。
- **幂等**：输出为表格（无 `、、、` 行），重跑不变。
- **CRLF 保留**（复用 headings.ts 的 splitLines/joinLines 行尾原样纪律）。

### 2.3 守卫

- 仅 **assistant 完成态、非流式**（与 headings/caption 实验同守卫）；user/thinking/流式原样。
- `、、、` 行须独占（`/^ {0,3}、、、[ \t]*$/`）；带其他文本的顿号行不是围栏。
- 未闭合（有开无闭）/ 空卡片（开栏即闭）/ 缺标题 → fail-open 原样返回。
- 非字符串输入原样返回。

## 3. 端到端实测证据（实现前探针，2026-08-12）

用真实 `Markdown` 组件跑通变换链（探针脚本已删，逻辑见 §2.2）：

| 样例 | 结果 |
|---|---|
| 前后文 + 卡片 | `┌─┐` 卡片嵌于正文中，标题粗体、内容折行、80/40 宽均无超宽 |
| 单卡片（标题+内容） | 完整边框盒，窄宽正常换行 |
| 未闭合卡片 | fail-open，逐字原样 |
| 代码块内含 `、、、` | 必须跳过（naive 变换会把代码块撑坏）→ 围栏跟踪为硬要求 |

## 4. 最小实现（改动面）

| 文件 | 改动 |
|---|---|
| `extensions/motto/headings.ts` | 仅导出共享助手 `splitLines`/`joinLines`/`parseFence`（零行为变化） |
| `extensions/motto/cards.ts` | **新增** `projectDunhaoCards(markdown, context)`：行扫描 + 围栏跟踪 + `、、、`卡片 → 表格投影 |
| `extensions/motto/index.ts` | 注册 `pi.registerMarkdownTransformer(projectDunhaoCards)`（一行） |
| `extensions/motto/test/cards.test.mjs` | **新增**单测：基础/多卡/未闭合/空卡/缺标题/代码块跳过/`|`转义/CRLF/幂等/守卫/端到端渲染 |
| `extensions/motto/README.md` | 能力表 + 一节说明（含撤销边界） |

不在 PATCHES.json 登记（extension 代码，非 core；core `packages/tui` 零改动）。

## 5. 验收门

- 单测全绿（`cd extensions/motto && node --test test/cards.test.mjs`）+ 全 pack 测试不回归 +
  `tsc --noEmit` typecheck 绿。
- 端到端：真实 `Markdown` 组件渲染输出 box-drawing 卡片（80/40 宽无超宽）。
- display-only：变换只发生在交互投影，canonical/session/模型上下文零改动（单测断言）。
- 守卫：user/thinking/流式/未闭合/代码块内 `、、、` 一律原样。

## 6. 后续面（本单不做，层二候选）

- 模型侧指令：教模型何时输出 `、、、` 卡片（品牌身份段的格式约定，另立）。
- 流式期实时成卡、user 消息卡片、嵌套卡片、无标题卡片（视觉即内容盒）——按使用摩擦触发。
- 多列/字段卡片（`标题|字段` 形态）——上游解锁（表格已支持多列，届时零 core 改动）。

## 7. 修订

- **2026-08-12 立单**：调研 + 实现逻辑 diff 定稿；随后最小实现 + 独立验收。
