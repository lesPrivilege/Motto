# TUI 相关 GPT 5.6 Pro 补充 session 消费记录（参考）

- 日期：2026-08-11
- 性质：**参考 / 索引**，不是新裁定。来源 = GPT 5.6 Pro 手动补充的多段关联 session
  （2026-08-07 ~ 08-11：标题投影、fenced 块区分、paste card、chat-flow 三块、渐进展开、
  选区复制、页面鉴赏）。
- 范围：**仅 TUI 相关**。Gemini 视觉（Antigravity/API key 合规、motto-gemini-vision）、
  canonical-copy、review-flow 等非 TUI 讨论已实现或另有文档，不在此列。
- 用法：新 session 遇到上述 TUI 主题时，以此索引为准，**勿重复调研**；未落盘裁定见 §3，
  已落仓的交叉引用见 §2。

## 0. 总述

补充 session 覆盖 7 个 TUI 主题。其中「标题投影」「fenced caption 回退」「渐进展开」
「选区复制命令」已落仓并有验收记录；「rail 结构性否决」「paste card 三段式」「三块分类
与 Card 方向」「页面鉴赏」未落盘，本文档备忘为参考。

## 1. 主题索引

| # | 主题 | 结论一句话 | 落点 | 状态 |
|---|---|---|---|---|
| 1 | 六级标题投影 | H3–H6 → `## › 标题`，三层视觉 | `extensions/motto/headings.ts`；PACK-MOTTO-3；commit `da54471` | ✅ 已落仓 ACCEPTED |
| 2 | fenced 块区分 | rail 结构性否决；caption 目验否决 | rail 无落点（§3.1）；caption 见 motto README §48 / REGISTRY | ⚠️ 部分落仓（rail 未落） |
| 3 | Paste card | 三段式：原生折叠 / 静态投影 / 上游 hook | §3.3（未落盘） | 📝 备忘 |
| 4 | chat-flow 三块 + Card 方向 | Markdown fence ≠ Bash tool ≠ paste；Card Shell 方向 | §3.4（未落盘） | 📝 备忘 |
| 5 | 渐进展开 | 三层阅读面：ledger / bounded preview / canonical | `docs/decisions/review-flow-eval.md` §7–9 + motto-review-flow | ✅ 已落仓 |
| 6 | 选区复制 | 命令复制保真；拖选归上游 #7721 | motto-canonical-copy + `UPSTREAM-SELECTION-PROJECTION` + TUI-THESIS I6 | ✅ 已落仓 |
| 7 | 页面鉴赏 | 启动铭牌 9/10，持续控制台 7.5/10；建议未决 | §3.7（未落盘） | 📝 备忘 |

## 2. 已落仓（交叉引用，不重复详录）

- **标题投影**：`extensions/motto/headings.ts`（纯函数，H3–H6 → `## ›`，仅 assistant final；
  fenced/缩进代码守卫；幂等；fail-open）。`PACK-MOTTO-3-acceptance.md` 记录首版纠偏
  （H4–H6 错钳 H3 → 修正为 `## ›`）。目验口径见 REGISTRY。
- **fenced caption 回退**：`extensions/motto/README.md` §48「fenced 块牌记（已回退）」+
  REGISTRY。allowlist 映射（text/txt/plaintext→文本块，log→日志，bash/sh/shell/zsh→命令片段）
  与回退原因（目验未形成 card affordance）均已记录。
- **渐进展开**：`docs/decisions/review-flow-eval.md` §7（Qwen/Gemini/Kimi/Aider/Codex/Grok 调研）
  §8（API 映射）§9（候选与裁决）；motto-review-flow SHIPPED。
- **选区复制**：motto-canonical-copy（`/copy-answer` `/copy-code`）+ `UPSTREAM-SELECTION-PROJECTION.md`
  + TUI-THESIS I6-1~I6-4。

## 3. 未落盘裁定（本文件备忘）

### 3.1 代码块 rail 结构性否决（ROUND1_REJECTED_FOR_COPY_POLLUTION）

- 方案：`markdown.codeBlockIndent: "┊ "`（Pi 公开配置，渲染器给代码正文每行加字面前缀）。
- 隔离 dogfood（scratch 项目级 `.pi/settings.json`，未碰 live）：视觉自然、窄窗无退化；
  但真实 Ghostty 鼠标线性选择必夹带 rail——
  `'alpha\n ┊\n ┊ gamma'`（从 rail 后起选）/ `' ┊ alpha\n ┊\n ┊ gamma'`（从 rail 左侧框选）。
  `/copy-code` 干净（`'alpha\n\ngamma'`）、session 中 `┊` 0 次。
- 判定：**结构性缺陷，不是字符问题**。渲染器写在每行上的字面前缀，线性选择必然进入剪贴板。
  永久不落地；不试 `│ / ╎ / ▏ / ┃` 字符轮盘；不改全局配置；不登记为 Motto 能力。
- 教训（过程性）：canonical/session clean ≠ 鼠标拖选 clean ≠ `/copy-code` clean，三证据不可互替；
  拖选证据必须真实剪贴板（pbpaste repr），不能用 session jsonl 代替。

### 3.2 fenced caption 目验否决（FLOW-FENCED-BLOCKS-1，已落仓）

- 过程：rail 否决后转「代码块外一行 caption」；首版普通正文 caption 目验 FAIL（与正文同层）；
  改单行 blockquote 牌记（`> 文本块 · N 行`）后，用户否决：**普通 fenced 文本本身已足够可辨，
  单行 caption 只是重复信息**；真正需要的是解耦的 Code Card，公开接缝做不到就不模拟。
- 完整回退（fenced-blocks.ts 已删、注册已撤、usage-log 记 ROLLED_BACK）。详见 §2 交叉引用。
- 推论（备忘）：**Code Card 是 NO_GO**，除非上游提供解耦 code-block renderer hook
  （与 `tui-construction-prep.md` §1.4 一致）；不得以 transformer 模拟独立 chrome/复制按钮。

### 3.3 Paste card 三段式结论（未落盘）

- 现状：Pi 原生 composer 已折叠大段 paste（>10 行或 >1000 字符 → `[paste #1 +N lines]`），
  但**提交后 paste 边界丢失**（session 只存展开全文，无 provenance）。
- 三段式：
  1. **原生**：composer 折叠已支持，无需实现。
  2. **纯 extension 静态投影**：`registerMarkdownTransformer` 对长 user message 静态压缩
     （如 `Long text · 84 行`）——能做，但**不能称「Paste」**（提交后无剪贴板来源证据，
     长文本也可能手打/模板/skill 注入）；不做独立展开（transformer 无交互状态）。
  3. **完整 paste card**：正确终局是给 Pi 上游加 **paste-span presentation hook**
     （Editor submit 导出 spans → session presentation metadata（不进 LLM）→ native
     user renderer hook），Motto 只提供 renderer。
- **不推荐**：劫持 `onTerminalInput` + `sendMessage(customType)` 伪 PasteCard——会把
  显示增强变成第二套 composer/session pipeline，与 Motto 解耦原则相悖。
- 落地次序：`motto-long-text-projection` 实验（静态投影验证 review 价值）→ 上游 hook → 正式 renderer。

### 3.4 Chat-flow 三块分类 + Card Shell 方向（未落盘）

- **三块不可混**：assistant 输出的 Markdown ` ```bash `（代码片段）≠ 真实 Bash tool call
  （结构化 tool events）≠ clipboard paste。视觉上都像等宽文本，但语义来源与呈现不同。
- Card Shell 方向（Motto TUI core，非 extension）：
  - `Transcript Flow`：Pi session entries → `FlowBlock[]`（markdown/code/tool/paste）。
  - 共享 `CardModel`（id/title/meta/status/expanded/copyText）+ `getCopyText()` 语义复制面，
    防止从 rendered lines 反向剥离 UI。
  - 实施序：CodeCard（Markdown AST 可精确识别）→ ToolCard（真实 tool events）→ PasteCard（需上游 hook）。
- 边界：不 fork pi-tui Markdown（维护面：parser/streaming 半截 fence/LaTeX/table 全要跟随）；
  视觉取 **Codex 低 chrome**（无围栏重绘，靠空白+高亮）+ **Grok 小标签**（一侧 accent + 轻标题），
  不复制 Grok/OpenCode 的重卡片架构；Code Card 在公开 hook 前 NO_GO（§3.2）。

### 3.5 渐进展开三层阅读面（与 review-flow-eval 一致，此处立模型）

```
第 0 层  turn ledger      做了什么/是否成功/改了什么/耗时
第 1 层  bounded preview  错误摘要/diff 统计/命令尾部/关键诊断
第 2 层  canonical evidence  完整工具输出/完整 diff/完整 transcript
```
- 共同结论（Qwen/Gemini/Kimi/Aider/Codex/Grok）：正常流压缩；失败/审批/用户主动操作不随正常
  轨迹隐藏；explore/change/execute 用不同摘要器；完整证据另有去处；聚合单位从 tool 升到 turn。
- 已消费：motto-review-flow = 第 0 层（turn 级 recap）；失败 collapsed 强显 = 第 1 层边界；
  原生 tool rows 全文 = 第 2 层。per-entry 三态 / transcript projector 归上游（#7721 等）。

### 3.6 选区复制原则（已实现部分见 §2，此处立原则）

- Pi fullscreen 已「选中即复制」，但按视觉行 `join("\n")` —— 软折行进剪贴板是已知缺口（I6-3）。
- 借鉴：Grok `joiner_to_previous` + selectable_cols（语义重建）；OpenCode `getClipboardText`。
- Motto 原则：**命令复制保真**（`/copy-answer` `/copy-code` 读 canonical）；**拖选归上游**
  （#7721 等）；不 monkey-patch、不 stdout 拦截、不改写 OSC 52、不用正则/宽度猜测伪造 clean copy。
- S1 界栏 `│ ` 随拖选进剪贴板 → I6-4 就地界定（命令路径绝对保真，拖选侧车落地前不宣称保真）。

### 3.7 页面鉴赏（启动铭牌 vs 持续控制台，未落盘，未决）

- 评价：启动页 9/10（仪器感、铭文人格、配置即自我介绍、构图稳）；持续控制台 7.5/10。
- 建议（备忘，是否落地未决）：
  1. **可检查 → 可验证**：facts 只展示名称，不知 已装/启用/已加载/运行中；建议 `/env` 展开
     版本/来源/状态/权限。
  2. **工程状态进底栏**：`~/repo · branch* · workspace:rw · net:off`，而非只显示 cwd。
  3. **状态值语义明确**：`0.0%/1.0M (auto)`/`max`/日期 加字段名（`ctx`/`compact:auto`/
     `effort:max`）。
  4. **命名分层**：motto 同时是产品/扩展/主题基名，调试语境建议显式 `extension motto`/
     `theme motto-dark`。
  5. **长清单悬挂缩进** 或只显示 `skills 6 loaded` + `/env`。
  6. **灰阶可读性**：弱文字可升一档；**红双用风险**：错误不要沿用品牌红（后续如引入错误态
     需另定或限定浓度）。
  7. **启动 → 工作**：首条指令后把完整铭牌折叠成一行运行时摘要，底栏承载持续变化。

## 4. 过程性决策（工作方式，备忘）

1. **两阶段工作流**：Phase 1 = 只读核对 → 最小实现 → 测试 → 离线门禁 → 本地部署 →
   真实 TUI dogfood → 报告，**等用户目验**；禁止 commit/push/登记终态。Phase 2 = 用户目验
   通过后：文案收口 → 状态记录（区分 IMPLEMENTED / OFFLINE_VERIFIED / DOGFOOD_VISUALLY_VERIFIED
   / ACCEPTED）→ 单一可回退 commit → 普通 push。
2. **回退纪律**：回退只撤本功能（注册 + 模块 + 测试 + 本实验文档），**不得取消既有能力**
   （原生 H1–H6、三套主题 `mdHeading: "dim"`、PACK-THEMES-2、FLOW、并发 writer 改动）。
3. **目验是最终门**：隔离/离线/替身验证不能替代真实 Ghostty 目验与真实剪贴板对照
   （§3.1 rail 案例）；视觉通过 ≠ 复制干净，需逐字节 repr 证据。
4. **隔离验证纪律**：用 scratch 项目级 `.pi/settings.json` 覆写，不碰 live global settings；
   结束清理 scratch/进程/trust 条目；不打印含凭据的 settings 全文。
5. **不因调研完备度立单**：调研形成候选，usage-log 摩擦形成工单；「需求存疑」不因 API
   可行而立项（overlay）；「NO_GO」不因生态成熟而复活（Code Card / rail）。

## 5. 待办 / 未决

| 项 | 状态 |
|---|---|
| GHOSTTY-BASELINE 填表（DRAFT→ACCEPTED，S1 前置） | 用户侧 |
| gemini-vision 部署（PACK-VISION-2 DEPLOYMENT_PENDING） | 非 TUI，另跟踪 |
| Code Card | 等上游 code-block renderer hook（NO_GO 前不模拟） |
| Paste card | 等上游 paste-span hook；可先做 `motto-long-text-projection` 静态投影实验 |
| Card Shell（Transcript Flow / CardModel） | 方向备忘，无使用摩擦不立项 |
| 页面鉴赏建议（§3.7） | 未决，待使用反馈 |

## 6. 相关文档

- `docs/decisions/review-flow-eval.md`（渐进展开调研 + API 映射 + 候选裁决）
- `docs/decisions/2026-08-11-tui-construction-prep.md`（TUI-PREP-1：裁定召回 + 分单）
- `docs/decisions/2026-08-11-motto-tui-1.md`（Transcript Visual Composition 工单）
- `docs/architecture/TUI-SURFACE-MATRIX.md`、`docs/TUI-THESIS.md`、`docs/MOTTO.md`（凡例）
- `extensions/motto/README.md` §48（fenced caption 回退历史）、`extensions/REGISTRY.md`
