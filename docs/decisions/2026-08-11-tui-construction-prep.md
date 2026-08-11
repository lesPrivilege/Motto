# TUI 施工准备 — 旧 chat 裁定召回与分单规划（TUI-PREP-1）

- 日期：2026-08-11
- 类型：准备 / 召回记录（**不授权施工**；供 MOTTO-DOWNSTREAM-0 merge 验收后消费）
- 时效锚点：以当前状态（阶段一 MOTTO-DOWNSTREAM-0 未收口）为锚；全部施工等待其验收
- 来源：旧 chat sessions（Codex, 2026-08-09 / 08-11）+ 仓库既有裁定（TUI-THESIS /
  TUI-SURFACE-MATRIX / TRANSCRIPT-PROJECTION / UPSTREAM-CONTRACT / tui-0-boundary）

## 0. 时效铁律（新时效，用户指令）

1. **排序**：立制（发行/版本/升级/回退主权）先于任何 Core patch；第一项 TUI Core
   修改只能等 MOTTO-DOWNSTREAM-0 全部验收态通过后开始。
2. 本文件只做召回与准备；**施工开关 = 阶段一 merge 验收通过 + 收口文档落地**。
3. 阶段一由另一 Pi session 施工（`lesPrivilege/pi` 下游仓，零 patch 基线已锚
   v0.84.1/53fa77ccd）；本分支不触碰其文档（AGENTS.md 宪制、UPSTREAM-CONTRACT、
   PI-BASE、decision §6、downstream-0.md 工单）。
4. merge 验收通过后按 §3 分单，可并行派发。

## 1. 召回清单（旧 chat 裁定 → 现状 → 消费去向）

### 1.1 TUI-0 架构审计（08-11 评估 session）

- 拆解：**12 EXTENSION_NATIVE + 9 GENERIC_CORE_SEAM + 1 Motto 策略层**；第一项必须改
  Core 的能力是 per-entry transcript projection（coding-agent interactive 层拼装，
  只换 pi-tui 不够）。
- 审计结论 ACCEPTED WITH LIMITATIONS；三处遗留：
  1. Ghostty 用户侧基线 DRAFT —— **现状未变**，用户侧填表（B1）；
  2. #7721 状态被误判为「暂缓而非拒绝」——维护者关闭时明言 too risky，对交付而言是
     **未接纳 / 不可依赖** —— **已修**（A2 收口：tui-0-boundary §4/§5 编者注 + §附注、
     ROADMAP 档二跟踪方式）；
  3. render-baseline.mjs 只查 `>200` 不逐宽度 —— **已修**（本分支 4931e8e，I9-1 门禁）。

### 1.2 MOTTO-DOWNSTREAM-0 立制（08-11 评估 session 终裁）

- 受控薄叉 GO（extension-only 路线 NO_GO）；双仓拓扑（`lesPrivilege/pi` 下游 +
  `lesPrivilege/Motto` 正典）；PATCHES.json / EXTENSIONS.lock / RELEASES.json 装置；
  `motto`/`motto-dev` 双轨 launcher；patch 单点可删、range-diff 审查、dogfood 终验收。
- **现状**：`stash@{0}`（e8faa93）已有 AGENTS.md 宪制 / ROADMAP / decision §6 /
  UPSTREAM-CONTRACT / PI-BASE schema v2 的雏形（PACK-VISION-2 merge 前暂存、收口漏恢复）；
  `downstream-0.md` 工单未建；阶段一 session 施工中 —— 应**直接消费 stash，不重写**。

### 1.3 TUI-1 定名修正（08-11 用户指令）

- 首单**不是** Per-entry Thinking Disclosure（reducer/折叠），而是
  **Transcript Visual Composition**——纯视觉：user 去整宽气泡卡→中灰左界栏+悬挂正文、
  assistant 无框正文、tool 成功调用压成低对比目行、review recap 著录化缩进、失败朱红强显。
- thinking disclosure 后移 **TUI-2**。
- 勘误三处：TUI-THESIS 三档（**已修**，688863e）/ SURFACE-MATRIX S1 user 表面
  （**已修**，9c7c61f）/ 定名（**已修**，A2 收口：AGENTS.md 第 7 条 + downstream-0.md §7/§8
  + tui-0-boundary 附注）。
- 明确不做（首单范围外）：per-entry 三态、Ctrl+O 重构、选区 sidecar、turn reducer、
  footer/composer、新语义色、仿古元素、动画。旧账本召回：一红五灰、左锚、界栏非装饰框、
  套印用色、成功静默失败强显。

### 1.4 FLOW-FENCED-BLOCKS 完整回退（08-09 两个 session）

- Round 1 普通正文 caption → `VISUAL_ACCEPTANCE_FAILED`（与正文同层，只加留白）；
- Round 2 单行 blockquote 牌记 `> 文本块 · N 行` → 用户否决（fenced 本身已可辨，
  caption 是重复信息）；**完整回退**（fenced-blocks.ts 已删、usage-log 记 ROLLED_BACK）。
- **NO_GO 裁定**：真正需要的是与 canonical 解耦的 **Code Card**（独立 chrome/复制按钮/
  无污染选择），现有 display-only transformer 只能改写展示文本，做不到就不模拟；
  未来只有出现解耦的 code-block renderer hook（上游或下游接缝）才重新评估。
- 消费：未来 Core 施工**不得**用 transformer 模拟 Code Card；本项列入观察（D3）。

### 1.5 MD-HEAD-3TIER-1（08-09）

- H3–H6 → `## › 标题`，仅 assistant final；已 ACCEPTED + 用户 Ghostty 目验。
- 与 TUI-1 不冲突：首轮保留三档，六级色槽属 S24 generic seam。

## 2. 现状盘点（时效兼容）

| 对象 | 状态 |
|---|---|
| Motto `main` | merge `19f3743`（TUI-0 定界 + PACK-VISION-2 双线收敛，FLOW 回退保留） |
| 本分支 `agent/tui-consumption-pre-downstream` | 3 commit：I9-1 逐宽度门禁 + 勘误×2；待 merge 验收时合入 |
| pi 下游 `motto/main` | 锚 v0.84.1/53fa77ccd，零 patch；`lesPrivilege/pi` origin 已建 |
| 阶段一文档 | `stash@{0}` 有雏形；`downstream-0.md` 未建；另一 session 施工中 |
| GHOSTTY-BASELINE | 仍 DRAFT（用户侧） |
| usage-log 摩擦 | 尚无「目行粒度失准」类记录（观察期条款未触发，turn reducer 冻结） |

## 3. 分单规划（阶段一 merge 验收后，可并行）

### 并行包 A — 收口勘误（纯文档，可最先派，不依赖 Core）
- **A1** ✅ AGENTS.md 宪制改写（消费 stash：第 7 条受控下游、§5 拓扑、安全红线）。
- **A2** ✅ decision §6 排序修正 + **#7721 重定性**（暂缓→未接纳/不可依赖）+ **TUI-1 定名**
  （Transcript Visual Composition）+ 勘误三处之一落地。
- **A3** ✅ `downstream-0.md` 工单 + PATCHES.json / EXTENSIONS.lock / RELEASES.json 模板
  （消费 stash 的 PI-BASE schema v2）。

### 并行包 B — 用户侧验收（独立于施工，可随时并行）
- **B1** GHOSTTY-BASELINE 填表 DRAFT→ACCEPTED（streaming/拖选/pbpaste/Ctrl+O/40 列）。
- **B2** usage-log 摩擦收集（观察期条款：reducer 立项的唯一触发器）。

### 并行包 C — 下游基建（pi 仓，零产品行为）
- **C1** motto/main 零 patch 与官方发行等价验证 + `motto`/`motto-dev` 双轨 launcher。
- **C2** 升级演练一次（fetch→candidate→range-diff→build→install→rollback）。

### 并行包 D — TUI Core（依赖 A+C 完成）
- **D1** TUI-1 Transcript Visual Composition（切片：user 左界栏/assistant 间距/tool 目行/
  recap 著录化；验收门见 tui-0-boundary 与 TUI-THESIS I 系列）。
- **D2** TUI-2 Per-entry Thinking Disclosure（identity 贯穿 streaming/resume、三态、fold
  不写 session）。

### 观察 / 不立项
- **D3** Code Card：等解耦 code-block renderer hook 出现（§1.4 NO_GO，不模拟）。
- turn reducer：观察期未触发前冻结（ROADMAP）。

## 4. 硬边界（施工时不可越）

- 不改 agent loop / provider / session canonical schema / 内置工具语义。
- 不重注册内置工具、不 shadow transcript、不手改 node_modules。
- 投影零写回、不入模型上下文；session/export 与官方基线逐字节等价（I5/I10）。
- fold 状态只属 UI；无 Motto 投影的组件逐字节回落原生。
- patch 单点可删、登记 PATCHES.json、有 removalCondition（阶段一后）。
- 40/60/80/120/200 逐宽度零超宽（I9-1，已由脚本锁定）。

## 5. 验收态（每包终态只允许 ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED）
