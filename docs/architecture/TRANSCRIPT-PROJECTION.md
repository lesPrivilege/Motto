# Transcript Projection Contract — 设计稿

> MOTTO-TUI-0 产出。基于本地 pi 0.84.1 源码（`interactive-mode.js` /
> `components/*.js` / pi-tui `tui-alt-screen.js`）先给出**最小架构**，
> 不预设 API 名称；文末映射到已提交上游的设计稿（UPSTREAM-PROPOSAL /
> UPSTREAM-SELECTION-PROJECTION）。
>
> 本文件回答十个问题，并给出一个数据流图与一个候选 view-node 模型。

---

## 0. 现状事实（0.84.1，源码级）

1. **两条路径汇聚到同一容器**：
   - 恢复路径：session entries → `buildContextEntries` → `sessionEntryToContextMessages`
     → `renderSessionItems` → `addMessageToChat` / `addCustomEntryToChat` → chatContainer。
   - 活体路径：事件（`message_start/update/end`、`tool_execution_start/update/end`）
     → 直接构造/更新 chatContainer 子组件。
2. **组件即投影单元**：`UserMessageComponent`、`AssistantMessageComponent`（streaming
   原位更新）、`ToolExecutionComponent`、`CustomEntryComponent`、`CustomMessageComponent`、
   `BashExecutionComponent`、`CompactionSummaryMessageComponent` 等，外加
   `Spacer`/`Text`/status 行。
3. **展开态是单一全局布尔** `toolOutputExpanded`（Ctrl+O），经 `setExpanded` 推给
   各组件；extension renderer 只收到 `{ expanded }`，无 per-entry fold、无 entryId。
4. **streaming 身份 = 组件实例**：`streamingComponent` 指针 + `pendingTools` map
   （key= toolCallId）。没有暴露给 extension 的稳定 entryId。
5. **复制 = 视觉行**：`TuiAltScreen.copySelectionToClipboard` 把选中视觉行
   `stripTerminalSequences().trimEnd()` 后 `join("\n")`（`tui-alt-screen.js:749`）；
   无 semantic sidecar、无 joiner。

---

## 一、semantic session record 如何投影为 TUI view

引入 **Projection Bus**：一个以 **stable entryId** 为键的投影注册表。每个 session
entry（或活体事件）在进入 chatContainer 前，先经 bus 解析为一个 **view-node**。

- **身份**：entryId 派生自 canonical entry 的 id（`renderSessionItems` 里每条 message
  entry 已有 id；活体事件里 toolCallId / message id 即身份源）。身份**不随内容变化**，
  streaming 只是同一身份的 revision 递增。
- **解析**：bus 按 entry kind（user/assistant/thinking/tool/custom/notice）与
  customType/toolName 选择 projector；未匹配 → **默认 projector**（即现行组件，
  fail-open，行为与现状逐字节一致）。
- **产出**：view-node 树（见第三节），由 pi-tui layout 渲染。

> 关键点：bus 是**纯投影**——它消费 canonical/事件，产出 view-node，零写回。
> bus 不持有会话状态，只持有投影注册表与 fold 状态（fold 是 UI 状态，不落 session）。

## 二、原生消息和 extension 消息如何进入同一投影层

统一入口：**所有** entry 都走 bus。原生与扩展的区别只在 projector 的注册来源：

- 原生 entry → 内置默认 projector（等价现行组件）。
- extension 注册的投影（recap、自定义工具卡、自定义消息）→ 扩展 projector。
- 两者在 bus 内**同构**：同一 view-node 模型、同一 fold/streaming/copy 语义。
  「扩展与内置同构」是 projection contract 的根不变量——不允许出现「扩展消息
  只能旁路渲染」的分叉。

custom 条目（`appendEntry`）与 custom_message（`sendMessage` + display）在语义上
都已是 display-only（已核实不入模型上下文），天然可进 bus；bus 只是给它们
补上 per-entry fold 与 copy sidecar。

## 三、display text 与 copy text 如何分离

view-node 的每个视觉行带**可选的 copy 投影**：

```ts
interface CopyProjection {
  // 该视觉行可被选中的语义文本
  text: string;
  // 与上一可投影行之间被省略的原文(硬换行 "\n" | 折行吞掉的一个空格 " " |
  // 词中/CJK 中折行 "" | 多个原空格逐字)
  joinerToPrevious?: string;
  // 可选中列范围;缺省 = 整行不可选(装饰行/UI 标签)
  selectableColumns?: { start: number; end: number };
}
```

规则：

1. **谁创建视觉行，谁提供该行的 copy 投影**——投影不得由下游猜测
   （对应 UPSTREAM-SELECTION-PROJECTION 的设计原则）。
2. display 有样式（theme 槽位、折行、前缀）；copy 无样式，只有精确原文与 joiner。
3. 布局容器（Box/VStack/ScrollView/overlay）**透传并平移坐标**，不重解释原文。
4. 无 copy 投影的行（装饰、状态行、thinking 标签等）默认不可选或按策略暴露。

## 四、collapsed、expanded 和 streaming 如何共享稳定 identity

- **identity = entryId，独立于呈现**。fold 状态（collapsed/preview/full）以
  entryId 为键的 UI map 保存；streaming 期间同一 entryId 的 revision 递增，fold
  状态不丢。
- **三态是策略**：每个 entry kind 有默认模式（如 assistant 最终答案 = full；
  thinking = collapsed(label)；工具成功 = collapsed；失败 = 强制 full 或 preview）。
  全局 Ctrl+O 仍是「批量覆盖」的既有语义，但 per-entry 状态优先。
- **streaming 稳定**：投影器在 `isStreaming` 时输出同构 view-node（可标记
  revision + 占位），布局不重建结构、不闪烁；Motto 现有「流式期不变换」纪律
  升级为 bus 层的结构性保证。

## 五、tool renderer 如何在不覆盖 tool execution 的情况下参与

- 现状已具备关键前提：`registerTool` 的 `renderCall/renderResult/renderShell` 与
  执行分离（`ToolExecutionComponent` 分 call/result 两段渲染，`getRenderContext`
  提供 `expanded/isError/isPartial` 等）。
- 在 bus 中：tool projector = 默认组件 + 可选的 **card-level projector**。
  card-level projector 复用 renderer 的输出作为 view-node 的 `full` 面，由
  bus 层再补 `collapsed`（摘要）与 `preview`（提要）——即「工具执行语义归
  执行器，呈现分面归投影器」。
- **Motto 不重注册内置工具**（既有裁定）：内置工具卡的投影通过 bus 的
  tool-entry 出口消费，而非替换工具定义。

## 六、extension 如何为 custom tool 注册 projector

在 bus 上注册 **按 toolName / customType / entry kind 分派**的 projector：
一个 projector 返回 view-node 的三种呈现（collapsed/preview/full）+ 可选的
copy 规则。注册是声明式的：`bus.register(kind 或 tool 或 customType, projector)`。
渲染与执行解耦，extension 无需覆盖工具定义。

## 七、没有 Motto projector 的普通 Pi extension 如何 fallback

- **fail-open**：bus 解析不到 projector 时走默认投影器（= 现行渲染路径，
  逐字节同现状）。
- **不感知 bus 的 extension**（只 registerTool / appendEntry / sendMessage）：
  其产物仍以默认投影器呈现——bus 是**叠加层**，不是替换层；现有扩展行为零改变。
- 这条保证（现状字节兼容）是 bus 可接受性底线。

## 八、哪些接缝可以作为通用 Pi 上游改进

按 GENERIC_CORE_SEAM 归类（详见 TUI-SURFACE-MATRIX），可 upstreamable 的接缝：

1. **transcript projector 注册面**：per-entry 三态 fold + 稳定 entryId
   （= UPSTREAM-PROPOSAL 的 `registerTranscriptProjector` 材料）。
2. **thinking 独立折叠**：label→preview→full，独立于 `hideThinkingBlock`
   （UPSTREAM-PROPOSAL 的 thinking 行）。
3. **selection sidecar**：`SelectionLineProjection` + `RenderedLine.selection`
   （UPSTREAM-SELECTION-PROJECTION 完整设计，含 10 条回归用例）。
4. **主题逐级 heading 槽**：`mdHeading1..6` 或渲染层按 depth 分级
   （ROADMAP 档二）。
5. **内置消息/tool 卡的 projector 出口**：让 recap 类 extension 不必旁路
   （S1/S5/S8/S14 的观察项）。

## 九、哪些行为必须留在 Motto 产品层

MOTTO_TUI_CORE（Motto 自有，不上游）：

1. **布局文法**：两列悬挂、动词列定宽、` · ` 断点、CJK 双列、块间空行、留白比例。
2. **recap 语义策略**：成功静默、失败强制显露、stderr 尾部 ≤5 行原文、机械投影
   （无 LLM 摘要）、计数起始无标签。
3. **朱墨三用**：accent 仅钤印/改笔/校记三处，无第四种红、无绿。
4. **复制策略**：`/copy-answer`/`/copy-code` 的 canonical 语义 + copy 侧车策略
   （哪些行可选中、joiner 默认）。
5. **宽度纪律**：footer 两级退化链、折行悬挂、任何行 ≤ 终端宽。

这些是「同一批上游接缝上，Motto 与其它扩展不同的**策略选择**」；接缝通用，
策略归 Motto。

## 十、是否能够只替换 TUI package，还是必须修改 coding-agent 集成层

**结论：只替换 pi-tui 不够，必须动 coding-agent 的交互集成层。**

理由（0.84.1 源码）：

- pi-tui 只提供**组件与低层渲染**（Markdown/Box/layout/选区/剪贴板）；
- **transcript 的拼装**（哪条 entry → 哪个组件、streaming 指针、pendingTools、
  全局 expanded、fold 状态、custom entry 插入时机）全部在
  `coding-agent/dist/modes/interactive/interactive-mode.js`；
- 稳定 entryId 的来源（session entry id / toolCallId）与 fold 状态的归属都在这层；
- selection sidecar 需要 pi-tui（选区协议 + 渲染行）与 coding-agent（把 canonical
  文本绑定到视觉行）**两处**配合。

因此最小改动面是：
- **pi-tui**：`RenderedLine.selection` 侧车 + 选区重建走 `copyToClipboard`；
- **coding-agent interactive 层**：projector 注册面 + per-entry fold 状态 +
  稳定 entryId 贯穿两条路径（恢复 + 活体）。

这正是「GENERIC_CORE_SEAM 一整层」的结论：它不是 Motto 私有补丁，而是可
upstreamable 的通用接缝。**Motto 侧只需要在其上实现策略层（第九节），
不需要 fork pi。**

---

## 数据流图

```text
canonical session record (JSONL tree, 唯一证据, 零写回)
   │
   │  buildContextEntries / live events (message_*, tool_execution_*, turn_*)
   ▼
┌──────────────────────────────────────────────────────────┐
│  Projection Bus  (entryId 键)                             │
│   ├─ default projectors  (stock renderers, fail-open)    │
│   ├─ extension projectors (customType / toolName / kind) │
│   └─ Motto strategy layer (文法/朱墨/宽度/复制策略)         │
│   fold-state map (entryId → collapsed|preview|full)      │
└──────────────────────────────────────────────────────────┘
   │  view-node 树 (display + copy + streaming identity)
   ▼
pi-tui layout (render(width), differential)
   ├── ▶ terminal  (display: 样式化行)
   └── ▶ clipboard (copy: 语义原文 + joiner, 经 copyToClipboard)
```

## 候选 view-node 模型

```ts
type EntryKind =
  | "user" | "assistant" | "thinking" | "tool"
  | "custom" | "customMessage" | "notice" | "subagent";

type DisplayMode = "collapsed" | "preview" | "full";

interface CopyProjection {
  text: string;
  joinerToPrevious?: string;                       // "\n" | " " | "" | 逐字空格
  selectableColumns?: { start: number; end: number }; // 缺省 = 不可选
}

interface ViewNode {
  entryId: string;        // 稳定身份:跨 fold / streaming / rebuild 不变
  kind: EntryKind;
  revision: number;       // 内容版本;identity 不变,revision 递增
  isStreaming: boolean;
  isError: boolean;
  defaultMode: DisplayMode;      // 策略(per kind)
  display: string[];             // 当前模式的样式化行(theme 在 layout 层上色)
  copy?: CopyProjection[];       // 与 display 行一一对应的可选侧车
  children?: ViewNode[];         // 嵌套:turn > tools;message > thinking/text
}

interface Projector {
  (input: {
    entryId: string;
    kind: EntryKind;
    content: unknown;         // canonical 内容(工具结果 / message / custom data)
    mode: DisplayMode;
    isStreaming: boolean;
    isError: boolean;
    theme: ThemeLike;         // 语义槽,不含具体色
    width: number;
  }): ViewNode | undefined;   // undefined → 交给下一个/默认 projector
}
```

## 验收锚点（对接 TUI-THESIS）

- I0-2（投影可重建）、I4-1（heading 层级）、I5（display/source 分离）、
  I6（display/copy 分离）、I7（streaming 稳定）均由本契约的 view-node 模型
  结构性保证；fixtures/tui 无头基线为回归锚。
- bus 的 fallback 底线 = 「现行渲染逐字节同现状」，回归手段 = 现有 pack 全量测试
  + `render-baseline.mjs` 基线 diff。

## 与已提交上游材料的关系

| 本文件 | 上游材料 |
|---|---|
| projector 注册面 + per-entry fold | UPSTREAM-PROPOSAL.md（`registerTranscriptProjector`） |
| thinking 独立折叠 | UPSTREAM-PROPOSAL.md thinking 行 |
| selection sidecar | UPSTREAM-SELECTION-PROJECTION.md（`SelectionLineProjection`） |
| 主题逐级槽 | MOTTO-MARKDOWN-HEADING 调研档二 / ROADMAP 档二 |
| 内置消息/tool 卡投影出口 | #7721 consolidated follow-up 材料 C |

> 边界：本文件是**设计契约**，不是实现工单。实现须待：(a) 上游接缝落地，
> 或 (b) MOTTO-TUI-1 在**当前扩展面**上做可验证的最小切片（见 review 结论），
> 二者不可混为一谈。
