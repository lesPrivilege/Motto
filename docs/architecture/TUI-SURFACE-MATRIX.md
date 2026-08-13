# TUI Surface Matrix — Extension 与 Core 的归属划分

> MOTTO-TUI-0 产出。对每个 TUI 表面逐项判定：当前实现路径、ExtensionAPI 是否足够、
> 是否需要覆盖内置工具、是否改变模型/session 语义、是否影响 streaming/copy、
> 是否存在 renderer ownership 冲突、推荐归属、理由、最小验收用例。
>
> 版本锚点：pi `v0.84.1`（commit `53fa77ccd8a279eb87e92294ef3687b03ff80112`），
> 源码证据均为本地 dist 逐行核实（`dist/modes/interactive/interactive-mode.js`、
> `dist/modes/interactive/components/*.js`、`pi-tui dist/tui-alt-screen.js` 等）。
>
> 归属分类：
> - **EXTENSION_NATIVE** — 当前 ExtensionAPI 可完整、干净实现（不重注册内置工具、
>   不改写 tool result、不写装饰字符进 copy、不污染 context）。
> - **GENERIC_CORE_SEAM** — 需要 pi 上游加一个通用接缝；接缝对所有 extension 有利，
>   可 upstreamable，Motto 只消费公开能力。
> - **MOTTO_TUI_CORE** — 必须留在 Motto 产品层（Motto 自有布局文法/策略），
>   且当前只能以扩展近似实现、或以核心接缝 + Motto 策略组合实现。
> - **OUT_OF_SCOPE** — 本轮不做或已裁定不做。

## 判定硬标准

凡属以下任一情形即**不得**判为 EXTENSION_NATIVE：
1. 需要重复渲染 user message 才能改变其呈现；
2. 需要改写 tool result 才能改变呈现；
3. 实现会向剪贴板/复制路径写入装饰字符；
4. 实现会破坏 copy 保真（视觉行 join 进入复制文本）；
5. 需要改变模型上下文或 session 语义才能呈现。

---

## S1 · user message

- 当前实现：`interactive-mode.js` `message_start(role=user)` → `addMessageToChat` →
  `UserMessageComponent`（pi-tui Markdown 渲染 user 文本）。
- ExtensionAPI 足够：**否**（无 `registerUserMessageRenderer`；`registerMessageRenderer`
  只对 custom role）。
- 需覆盖内置工具：否（无工具）。
- 改变模型/session 语义：不改变。若用 `sendMessage` 冒充则改变——禁止路径。
- 影响 streaming：不适用（user 消息瞬时）。
- 影响 copy：命令复制（`/copy-answer`、`/copy-code`）读语义源，不受本面影响；拖选按
  I6-3 视觉行 join，S1 短横衬线 `───` 为显示投影、会进入拖选剪贴板，侧车落地前不宣称
  保真（I6-4 就地界定）。
- Ownership 冲突：`UserMessageComponent` 为内置，无 extension 出口。
- **归属：GENERIC_CORE_SEAM**（`registerMessageRenderer` 扩展至 user role，或
  transcript projector 覆盖内置消息）。
- 理由：MOTTO-TUI-1（Transcript Visual Composition，用户指令裁定）已将
  user message 列为首轮视觉表面——去整宽气泡卡 → 左上方短横衬线(脚注分隔线风格)+ 悬挂正文；
  本接缝由此进入待改面，不再属「无需改动」观察项。「长 paste 分层
  （超长折叠）」仍为后续面，不随首单扩张。
- 最小验收用例：长 paste（`paste-long.txt`）渲染不超宽、不闪烁；复制命令保真。

## S2 · 长文本 paste

- 当前实现：与 S1 同路径；paste 即一条长 user message，走 Markdown 折行。
- ExtensionAPI 足够：否（同 S1）。
- **归属：GENERIC_CORE_SEAM**（随 S1；Motto 侧仅在 copy 命令面已覆盖：`/copy-answer`
  按逻辑段复制）。
- 最小验收用例：fixture T3 + `/copy-answer` 输出为原逻辑段落（canonical-copy 测试 +
  Ghostty 捕获第 4 节）。

## S3 · assistant Markdown（heading/list/table/blockquote/code）

- 当前实现：`AssistantMessageComponent` → pi-tui `Markdown` 组件 + `getMarkdownTheme`
  （`assistant-message.js:82`）；`registerMarkdownTransformer` 提供显示层文本变换
  （motto headings 投影）。
- ExtensionAPI 足够：**部分**。文本级变换（heading 投影）足够；
  逐级 heading 取色不够（`mdHeading` 单槽，见 MOTTO-MARKDOWN-HEADING 调研档二）。
- 需覆盖内置工具：否。
- 改变模型/session 语义：否（变换仅渲染输入）。
- 影响 streaming：是——变换在流式期也会执行；Motto 已按 `isStreaming` 跳过以避闪烁。
- 影响 copy：否（变换不进入复制路径；`/copy-code` 取 canonical）。
- Ownership 冲突：`registerMarkdownTransformer` 是全局单点，多个扩展注册会串联
  （`markdown-transform.js`），存在隐性所有权冲突（顺序耦合）。
- **归属：EXTENSION_NATIVE**（heading 投影已验收）+ **GENERIC_CORE_SEAM**（逐级槽）。
- 理由：文本级显示变换是干净的扩展面；逐级 heading 色槽是上游主题 schema 缺口
  （已挂 ROADMAP 档二跟踪）。
- 最小验收用例：`md-multilevel.md` raw vs projected 基线 diff；三主题 × 5 宽度零超宽。

## S4 · thinking

- 当前实现：`assistant-message.js:86-117`——`hideThinkingBlock` 全有全无：
  显示 = 整段 thinking 渲染为 Markdown；隐藏 = 单个 `Thinking...` 标签（无展开入口）。
  由 settings + `Ctrl+T` 控制。
- ExtensionAPI 足够：**否**。无 per-entry thinking 折叠、无 preview、不与 Ctrl+O 关联。
- 需覆盖内置工具：否。
- 改变模型/session 语义：否。
- 影响 streaming：是（thinking 流式渲染）。
- 影响 copy：是（thinking 全显时进入拖选范围；无独立选区控制）。
- Ownership 冲突：`hideThinkingBlock` 是全局开关，`Thinking...` 标签文案不可经
  extension 定制。
- **归属：GENERIC_CORE_SEAM**（per-entry thinking 折叠：label→preview→full，
  独立于全局开关；即 UPSTREAM-PROPOSAL.md 的 thinking 行）。
- 理由：真实摩擦已记录（2026-08-08 usage-log：thinking 洪流淹没 recap，纲要体不成立），
  当前以 `hideThinkingBlock: true` 全隐缓解，但「默认收纳、可按需展开」是目录体例
  的明确需求，只能靠核心接缝。
- 最小验收用例：thinking 块在默认态显示单行标签、可展开至全文、展开态不影响
  assistant 正文折叠；fixture T1 thinking 块。

## S5 · tool call（卡片/调用参数）

- 当前实现：`ToolExecutionComponent`——经 `toolDefinition.renderCall/renderResult/
  renderShell`（extension 注册的自定义工具可完全自绘）；无 renderer 时 fallback
  `toolTitle + args JSON + output`。
- ExtensionAPI 足够：**是（对自定义工具）**；内置工具渲染由
  `createAllToolDefinitions` 提供，extension **不能**干净覆盖内置工具卡（重注册 =
  shadow 执行定义，已裁定不做）。
- 需覆盖内置工具：否（Motto 不重注册内置工具；review-flow 裁定边界）。
- 改变模型/session 语义：否。
- 影响 streaming：是（流式参数渲染由 `message_update` 驱动 `updateArgs`）。
- 影响 copy：拖选含卡片文本（core 行为）。
- Ownership 冲突：自定义工具的 renderer 所有权清晰（extension 注册）；
  内置工具卡无 extension 出口。
- **归属：EXTENSION_NATIVE**（自定义工具）+ **GENERIC_CORE_SEAM**（内置工具卡
  projector 出口，供未来 recap 复用）。
- 最小验收用例：`cu_see`/`motto_vision` 工具卡在 fixture T7 渲染正确、门禁 fail-closed
  文案机械投影。

## S6 · streaming tool output

- 当前实现：`message_update`（toolCall 参数流式）+ `tool_execution_update`
  （部分结果 `updateResult(partial, true)`）→ 组件原位更新。
- ExtensionAPI 足够：**是**（事件订阅 + 自定义工具 renderer 收到 `isPartial`）。
- 需覆盖内置工具：否。
- 改变模型/session 语义：否。
- 影响 streaming：这是 streaming 本身。
- 影响 copy：否（渲染期）。
- **归属：EXTENSION_NATIVE**（订阅事件做派生指标，如 TPS；渲染由 tool renderer 原生）。
- 最小验收用例：TPS 流式滚动速率 + 工具期分母冻结（tps 测试）。

## S7 · success / failure / cancel（工具结果三态）

- 当前实现：`ToolExecutionComponent.updateResult(result, isError)` → bg 槽
  （toolSuccessBg / toolErrorBg / toolPendingBg）；aborted 时
  `interactive-mode.js message_end` 将 pendingTools 全部置 error。
- ExtensionAPI 足够：**是**（事件 `tool_execution_end` 带 `isError`；renderer 收到
  `isError` 上下文）。
- 需覆盖内置工具：否（Motto 不重画工具卡，只投影 recap 层）。
- 改变模型/session 语义：否。
- 影响 streaming：cancel 影响（aborted 路径）。
- 影响 copy：否。
- **归属：EXTENSION_NATIVE**（recap 层消费三态；原生卡三态由 core 管）。
- 最小验收用例：fixture T4（exit 1）与 T9（aborted）的 recap 投影。

## S8 · read / edit / write / bash 内置工具

- 当前实现：内置工具注册于 `createAllToolDefinitions`，各自 renderCall/renderResult
  （read 摘要卡、edit diff 卡、bash 输出卡等）。
- ExtensionAPI 足够：**否（覆盖渲染）**——extension 不能在不重注册的前提下替换
  内置工具卡的渲染。
- 需覆盖内置工具：否（Motto 不覆盖；recap 层另立）。
- 改变模型/session 语义：否。
- 影响 streaming：是（bash 输出流式）。
- 影响 copy：拖选含卡内文本。
- Ownership 冲突：若未来需要「内置工具卡 + Motto 投影」，需 core 提供
  tool projector 出口（当前只能靠 recap 层旁路）。
- **归属：GENERIC_CORE_SEAM**（内置工具卡 projector 出口；Motto 消费为 recap
  第二来源）。
- 最小验收用例：fixture T1/T6 的 recap 正确归类 explore/change/execute。

## S9 · custom tools（extension 注册工具）

- 当前实现：`pi.registerTool` + renderCall/renderResult/renderShell 完全自绘。
- ExtensionAPI 足够：**是**。
- 需覆盖内置工具：否。
- 改变模型/session 语义：否（工具执行与渲染分离）。
- 影响 streaming：是（参数/结果流式由执行语义驱动）。
- 影响 copy：renderer 自绘文本进入拖选（core 视觉行规则）。
- Ownership 冲突：无。
- **归属：EXTENSION_NATIVE**。
- 最小验收用例：motto-computer-use 8 工具 + motto_vision（已验收）。

## S10 · review flow（recap 著录层）

- 当前实现：`pi.appendEntry("motto-review-flow.turn.v1")` + `registerEntryRenderer`
  → `CustomEntryComponent`；renderer 收到 `{expanded}`（全局 Ctrl+O）与 theme。
- ExtensionAPI 足够：**部分**。可渲染两层（collapsed 汇总 / expanded 逐条），
  但**无 per-entry fold**、无 entryId、无局部 render scheduler（review-flow-eval
  第八节「仍不可由 ledger entry 自足实现」）。
- 需覆盖内置工具：否。
- 改变模型/session 语义：否（custom 条目不入上下文，已核实）。
- 影响 streaming：否（turn_end 才落条目）。
- 影响 copy：否（recap 是纯展示；拖选按视觉行）。
- Ownership 冲突：`registerEntryRenderer` 单点，多扩展 entry 类型独立（按 customType
  分派），无冲突。
- **归属：EXTENSION_NATIVE（v1 现状）+ 未来 MOTTO_TUI_CORE 策略层**。
- 理由：recap 的**文法**（两列悬挂、计数起始、失败强制显露、机械投影）是 Motto
  产品层；其**能力缺口**（per-entry 三态、稳定 entryId）属 GENERIC_CORE_SEAM。
- 最小验收用例：review-flow.txt 基线 + 折叠/展开双态测试。

## S11 · subagents（第三方 pack 输出）

- 当前实现：`@tintinweb/pi-subagents` 经 `custom_message`（`registerMessageRenderer`）
  渲染子代理卡片；Motto 无涉。
- ExtensionAPI 足够：是（第三方 pack 已实现）。
- 需覆盖内置工具：否。
- 改变模型/session 语义：custom_message 带 display 标记，语义面由 pack 自证。
- 影响 streaming：由 pack 管理。
- 影响 copy：由 pack 渲染。
- Ownership 冲突：**有观察项**——subagent 输出是否入 recap 著录类目是 ROADMAP
  已登记的待验空白（归属/责任边界未混淆前不视为缺陷）。
- **归属：EXTENSION_NATIVE（现状）+ OUT_OF_SCOPE（Motto recap 收编）**。
- 最小验收用例：无（观察期，不立单）。

## S12 · vision（图像结果）

- 当前实现：`ToolExecutionComponent.updateDisplay` 中 image content →
  `Image` 组件（kitty 图形协议），`images.autoResize`/`showImages` 由 settings 管。
- ExtensionAPI 足够：是（motto-gemini-vision 纯文本结果；图像显示是 core 原生）。
- 需覆盖内置工具：否。
- 改变模型/session 语义：否。
- 影响 streaming：否（结果后渲染）。
- 影响 copy：图像不可复制（core 行为）。
- **归属：EXTENSION_NATIVE**（motto_vision）+ core 原生图像显示（不动）。
- 最小验收用例：motto_vision 文本结果卡渲染（fixture T7）。

## S13 · computer-use

- 当前实现：motto-computer-use 8 工具，门禁 fail-closed，自定义 renderer 未注册
  （走 fallback 卡）。
- ExtensionAPI 足够：是。
- **归属：EXTENSION_NATIVE**。
- 最小验收用例：门禁 fail-closed 文案渲染（fixture T7 cu_see 卡）。

## S14 · compact / session notices

- 当前实现：compaction → `CompactionSummaryMessageComponent` +
  `Session compacted N times` 状态行（`renderInitialMessages`）；session 提示经
  `showStatus`（dim 行）。
- ExtensionAPI 足够：**部分**。`session_before_compact` 可注入自定义 summary；
  通知经 `ctx.ui.notify`；但 compaction 摘要卡与状态行的**呈现**无 extension 出口。
- 需覆盖内置工具：否。
- 改变模型/session 语义：否（compaction 本身是 session 语义）。
- 影响 streaming：否。
- 影响 copy：拖选含提示文本。
- **归属：EXTENSION_NATIVE（notify/自定义 summary）+ GENERIC_CORE_SEAM
  （提示卡渲染出口）**；现状保持不动。
- 最小验收用例：fixture compaction 条目渲染 + 状态行。

## S15 · input composer

- 当前实现：pi-tui `CustomEditor`/editor-component；extension 可经
  `ctx.ui.setEditorText/getEditorText/pasteToEditor`、`addAutocompleteProvider`、
  `setEditorComponent`、widgets（editor 上方/下方）。
- ExtensionAPI 足够：**是**（Motto 无需定制 composer）。
- 需覆盖内置工具：否。
- 改变模型/session 语义：否。
- 影响 streaming：否。
- **归属：EXTENSION_NATIVE（如需）**；Motto 当前零需求，保持不动。
- 最小验收用例：无（不立单）。

## S16 · collapsed / expanded（全局展开态）

- 当前实现：`toolOutputExpanded`（Ctrl+O）→ 传给 ToolExecutionComponent /
  CustomEntryComponent / CustomMessageComponent 的 `setExpanded`。
- ExtensionAPI 足够：**部分**。renderer 收到 `expanded` 布尔，但**无 per-entry fold**
  （所有 entry 同进退），无三态。
- 需覆盖内置工具：否。
- 改变模型/session 语义：否（纯 UI 状态）。
- 影响 streaming：否。
- 影响 copy：否。
- Ownership 冲突：无（单全局状态，extension 消费）。
- **归属：EXTENSION_NATIVE（消费全局展开）+ GENERIC_CORE_SEAM（per-entry
  fold/三态，transcript projector 核心）**。
- 最小验收用例：review-flow 折叠/展开双态基线；fixture T4 失败项折叠态仍显。

## S17 · mouse selection 与 clipboard

- 当前实现：`TuiAltScreen` 持有鼠标协议、拖选、自动复制；复制文本 =
  视觉行 `stripTerminalSequences().trimEnd()` 后 `join("\n")`
  （`tui-alt-screen.js:749`）——软折行被硬编码为换行，破坏保真。
- ExtensionAPI 足够：**否**。无选区侧车（selection sidecar）、无
  screen-to-source offset、无 joiner。canonical-copy 以命令面绕开（非选区面）。
- 需覆盖内置工具：否（选区是 core 协议面，不可扩展覆盖）。
- 改变模型/session 语义：否。
- 影响 streaming：否。
- 影响 copy：**这正是 copy 保真的核心缺口**。
- Ownership 冲突：TuiAltScreen 是 pi-tui 私有，extension 无法接入；
  改写 OSC52/拦截 stdout 均被裁定禁止（UPSTREAM-SELECTION-PROJECTION 已列拒绝策略）。
- **归属：GENERIC_CORE_SEAM**（selection sidecar——UPSTREAM-SELECTION-PROJECTION.md
  完整设计已备，系上游 #7721/#7757/#7761 跟踪项）。
- 理由：Motto 的复制体例（I6）要求语义复制；命令面已自足（EXTENSION_NATIVE），
  选区面只能靠上游接缝。
- 最小验收用例：软折行段落拖选 → 语义文本（上游侧车验收用例集已在
  UPSTREAM-SELECTION-PROJECTION 列出 10 条）。

## S18 · header / splash（牌记）

- 当前实现：`ctx.ui.setHeader(factory)` 替换 builtInHeader（motto pack）。
- ExtensionAPI 足够：**是**。
- **归属：EXTENSION_NATIVE**（已验收）。
- 最小验收用例：motto 测试（左锚/一红/零线/两空行/折行悬挂）。

## S19 · footer

- 当前实现：`ctx.ui.setFooter(factory)`；数据取自原生同源 + TPS 派生（motto pack）。
- ExtensionAPI 足够：**是**（footer-data-provider 无版本项是已核实事实，Motto 不遮蔽
  上游推送——MAINTENANCE 已载）。
- **归属：EXTENSION_NATIVE**（已验收）。
- 最小验收用例：footer-degrade 测试。

## S20 · terminal title

- 当前实现：`ctx.ui.setTitle("Motto")` + 周期守护（motto pack）。
- ExtensionAPI 足够：是。
- 影响 copy：否。
- **归属：EXTENSION_NATIVE**（已验收；ghostty 无标题栈为已知边界）。
- 最小验收用例：标题事件后 5s 内稳定为 Motto（motto 测试）。

## S21 · markdown transform（heading 投影等显示层文本变换）

- 当前实现：`registerMarkdownTransformer`（motto headings）。
- ExtensionAPI 足够：是（文本级）。
- 影响 streaming：是（已按 isStreaming 跳过）。
- Ownership 冲突：全局串联顺序耦合（多扩展注册时）。
- **归属：EXTENSION_NATIVE**（现状）+ 观察项（若未来多变换需结构化投影，转
  GENERIC_CORE_SEAM）。
- 最小验收用例：headings 测试 + 基线 diff。

## S22 · cache miss notice / status / notifications

- 当前实现：`showStatus`（dim 行）、`maybeShowCacheMissNotice`、`ctx.ui.notify`。
- ExtensionAPI 足够：是（notify/status 出口存在）。
- **归属：EXTENSION_NATIVE**。
- 最小验收用例：fixture T14 状态行 + notify 冒烟。

## S23 · session tree / resume / selectors（pi 自有管理面）

- 当前实现：core 组件（tree-selector、session-selector 等）。
- **归属：OUT_OF_SCOPE**（pi 管理面，Motto 不投影、不接管）。
- 理由：与工作过程呈现正交；Motto 宣称只覆盖 chat 区投影。

## S24 · 多级 heading 逐级取色

- 当前实现：`mdHeading` 单槽（主题 schema）。
- ExtensionAPI 足够：否（theme schema 缺口）。
- **归属：GENERIC_CORE_SEAM**（`mdHeading1..6` 或按 depth 分级；已挂 ROADMAP
  档二跟踪）。
- 最小验收用例：主题切换后 H1–H6 明度逐级可辨（用户侧终验）。

---

## 汇总表

| 表面 | 当前实现 | API 足够 | 覆盖内置工具 | 改语义 | 影响 streaming | 影响 copy | Ownership 冲突 | 归属 |
|---|---|---|---|---|---|---|---|---|
| S1 user msg | 原生组件 | 否 | 否 | 否 | — | — | 无出口 | GENERIC_CORE_SEAM |
| S2 长 paste | S1 同路 | 否 | 否 | 否 | — | 是(拖选) | 无出口 | GENERIC_CORE_SEAM |
| S3 assistant md | 原生 Markdown | 部分 | 否 | 否 | 是 | 否 | 全局变换串联 | EXTENSION_NATIVE + SEAM(逐级槽) |
| S4 thinking | hideThinkingBlock | 否 | 否 | 否 | 是 | 是 | 全局开关无出口 | GENERIC_CORE_SEAM |
| S5 tool call | renderer 体系 | 是(自定义) | 否 | 否 | 是 | 是(拖选) | 内置卡无出口 | EXTENSION_NATIVE + SEAM(内置卡投影) |
| S6 streaming output | 事件驱动 | 是 | 否 | 否 | — | 否 | 无 | EXTENSION_NATIVE |
| S7 三态 | updateResult | 是 | 否 | 否 | 取消 | 否 | 无 | EXTENSION_NATIVE |
| S8 内置工具 | createAllToolDefinitions | 否(覆盖) | 否 | 否 | 是 | 是 | 内置卡无出口 | GENERIC_CORE_SEAM |
| S9 custom tools | registerTool+render | 是 | 否 | 否 | 是 | renderer 自绘 | 无 | EXTENSION_NATIVE |
| S10 review flow | appendEntry+renderer | 部分 | 否 | 否 | 否 | 否 | 无 | EXTENSION_NATIVE(v1) + CORE 策略 |
| S11 subagents | 第三方 custom_message | 是 | 否 | 由 pack | 由 pack | 由 pack | 观察项 | EXTENSION_NATIVE + OUT_OF_SCOPE |
| S12 vision | Image 组件 | 是 | 否 | 否 | 否 | 图像不可复制 | 无 | EXTENSION_NATIVE |
| S13 computer-use | 自定义工具 | 是 | 否 | 否 | 否 | 否 | 无 | EXTENSION_NATIVE |
| S14 compact/notice | 原生卡+状态行 | 部分 | 否 | 否(compaction 本身) | 否 | 是(拖选) | 无出口 | EXTENSION_NATIVE + SEAM |
| S15 composer | editor 体系 | 是 | 否 | 否 | 否 | 否 | 无 | EXTENSION_NATIVE(零需求) |
| S16 collapsed/expanded | toolOutputExpanded | 部分 | 否 | 否 | 否 | 否 | 无 | EXTENSION_NATIVE + SEAM(per-entry) |
| S17 selection/clipboard | TuiAltScreen | 否 | 否 | 否 | 否 | **核心缺口** | 私有协议 | GENERIC_CORE_SEAM |
| S18 header | setHeader | 是 | — | 否 | 否 | 否 | 无 | EXTENSION_NATIVE |
| S19 footer | setFooter | 是 | — | 否 | 否 | 否 | 无 | EXTENSION_NATIVE |
| S20 title | setTitle | 是 | — | 否 | 否 | 否 | 无 | EXTENSION_NATIVE |
| S21 md transform | registerMarkdownTransformer | 是 | — | 否 | 是(已跳过) | 否 | 串联顺序 | EXTENSION_NATIVE |
| S22 notice/status | showStatus/notify | 是 | — | 否 | 否 | 否 | 无 | EXTENSION_NATIVE |
| S23 session tree/selectors | 原生 | — | — | — | — | — | — | OUT_OF_SCOPE |
| S24 逐级 heading 槽 | mdHeading 单槽 | 否 | — | 否 | 否 | 否 | theme schema | GENERIC_CORE_SEAM |

## 结论

- **EXTENSION_NATIVE 12 项**：S6/S7/S9/S12/S13/S15/S18/S19/S20/S21/S22/S10(v1)。
- **GENERIC_CORE_SEAM 9 项**：S1/S2/S3(部分)/S4/S5(部分)/S8/S14(部分)/S16(部分)/S17/S24。
- **MOTTO_TUI_CORE**：recap 文法策略（S10 的策略层）+ 布局文法（两列悬挂/留白/朱墨三用）。
- **OUT_OF_SCOPE 2 项**：S11(收编)/S23。
- **当前必须改 Core 的能力**：per-entry transcript projection（稳定 entryId +
  三态 fold + thinking 折叠 + 选区侧车）——不是单个能力，是 **GENERIC_CORE_SEAM
  一整层**（对应 UPSTREAM-PROPOSAL / UPSTREAM-SELECTION-PROJECTION 两稿）。
