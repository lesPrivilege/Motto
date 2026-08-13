# Motto Roadmap —— 长期打磨计划

本文件登记 Motto 的远期候选、触发条件与否决边界，不是待执行清单，也不承担当前状态管理。

凡列为候选者均无日期、无承诺。候选进入裁定或工单的唯一途径，是其明示触发条件成立；调研完备度、方案吸引力与可用余力均不构成触发。触发成立也不自动意味着实施，仍须证明最小改动边界、兼容路径与退出证据。

凡例、术语与呈现规则以 docs/MOTTO.md 为唯一正典；维护节奏以 docs/MAINTENANCE.md 为准；本文件中的定位与现状文字仅作索引和立卷时路碑。

## 定位摘要（非规范）

Motto 不是又一个 agent，是骑在极简 harness 上的一套版式：耳目一新的 TUI、简明的 harness（pi）、快而廉的模型三者相配，从内而外利落疏朗。体例的学理来自目录版本之学的创造性转化——辨章学术、考镜源流：transcript 不作进程日志展示，作工作过程的书目呈现；recap 目行是著录，错误尾部是提要，朱记只落于失败，thinking 归不著录之列；review-safe 是著录学的不滥收，投影不入模型上下文是书目不混入正文，scrollback 刻成不改是刻本工艺的本分。体例的价值不依赖人工是否经常真实 review：一部好书目不据以查书翻着也舒服，因为每一行都承重。

名字本身承载一层宣言（2026-08-08 记）：能力阶梯自有其名，Motto 始终代表更简单。模型的 agentic 能力越强，为约束而生的 harness 理应越薄，回归核心定位——令 model 成为 agent，管控与 provider 的交互。pi 是极简 harness 而神态丰富，flash 级模型（小体量、后训练强化 agentic）是极简的 model 侧对应；Motto 站在两线收束处，既是对 model 的选择，也是对 harness 的态度，因此自足。日后任何官方 harness 出现、承载层如何更替，Motto 的简约疏朗不随之变；multi-provider 照常可引（主力或为更强档位）。

本节仅说明 Roadmap 的取舍依据；两者如有出入，以 docs/MOTTO.md 为准。

## 立卷时路碑

以下为 2026-08-08 建立本 Roadmap 时的仓库快照，不作为持续更新的状态真源：五 pack 归仓（motto / canonical-copy / review-flow / themes / computer-use），全门槛绿，运行行为静止（自 563be3a 后代码层无变更）。

## 动土的合法依据

只有三类：

1. 使用触发：真实使用中留下了可复现的摩擦记录；
2. 契约或环境触发：pi、终端、模型、仓库基础设施等外部前提发生变化；
3. 正典内容触发：格言或其他明确受管内容需要替换。

余力、调研完备度与方案诱人程度均不构成触发依据。触发成立只允许候选进入裁定或工单阶段，不自动意味着实施；仍须证明改动边界、兼容路径与退出证据。

## 候选登记簿

### 一、上游解锁触发

等的不是零散 API，是 projector 一整层（pi 的 scrollback 被动渲染模型下，可交互呈现属另一工艺）。上游触发以已发布、可依赖、可由 extension 正常消费的公开能力为准；issue 讨论、未合入补丁、内部接口与一次性探针均不构成解冻。

- transcript 投影钩子（per-entry 三态：目→提要→全文）→ recap 升级为真三层渐进展开。
- thinking 显示分级（活跃可见 / 收工收纳，替代现 hideThinkingBlock 的 hide-all）→ 纲要体在两种工作态下同时成立。
- 选区语义投影（joiner sidecar 一类）→ 鼠标拖选获得与 /copy-answer 同级的规范文本保真。
- **markdown heading 逐级槽**（`mdHeading1..6` 或渲染层按 depth 分级取色）→ theme 侧实现 h1→h4 逐级明度疏朗（当前 `mdHeading` 为单一槽，无法逐级）。依据：`docs/research/MOTTO-MARKDOWN-HEADING-2026-08-08.md`（使用触发候选，档二上游可提，量级小适合友好 PR）。

跟踪方式：pi 升级核对时顺看 release notes 与相关 issue，不主动催办（#7721 closed-unmerged，维护者明言 too risky——定性为**未接纳 / 不可依赖**，材料已递、账已结，不得列为任何工单的前置或缓解依据）。

### 二、使用摩擦触发（观察期条款）

- turn reducer（explore 洪流聚合，参照 Codex "Explored" / Kimi stack 聚合）：现有方案轮廓最清楚，但仍冻结；唯一触发器是 usage-log 中出现可复现的「目行粒度失准」记录。
- subagent 输出尚无独立著录类目：在真实使用证明来源、归属或责任边界发生混淆之前，该空白不视为缺陷。
- /review overlay（独立审查间）：需求存疑，须先有「流内回看不够用」的使用记录，方可立单。

### 三、裁定保留项（余力仅影响排期）

以下事项不因「有余力」自动解冻。它们只在前述三类合法依据之一成立时进入裁定；余力仅决定已触发事项是否排期。

- hardWrap/truncateToWidth 跨件重复：升级冲突或真实维护摩擦出现时处理。
- dev 脚本 dist 内 theme 导入：构建或发布环境暴露问题时处理。
- Downloads 原始 GPT 包处置：形成实际维护、来源或分发风险时处理。
- 真实模型并行行为差异：真实模型运行留下证据时处理。
- 浅色态首帧 ~100ms 深色闪现：pi 设计固有，现判接受；上游改 COLORFGBG 时序时复审。
- CI 真实 runner：仓库上 remote（属基础设施变化，环境触发）时启用。

## 非项目化外溢

以下内容不是候选，不独立转为工单，也不因调研或余力开工：
- 体例外化：当日常产出中自然形成可跨场景复用的 presentation-layer 规格时，由 archive / paper-mill 收编；不得为了形成规格而预先造项目。
- 对外发布：属于仓库分发状态，不属于产品能力。只有出现明确分发需求，且 remote、CI、版本与来源链均已成立时，才作为发布收尾处理。

二者均不影响本仓自足。

## 已裁定不做

- fork harness core——projector 属一整层,补丁预算无此额度（裁定：fork 经济性评估随三态核实撤单更新,2026-08-08）。
  **MOTTO-TUI-0 重开（2026-08-11）**：整层已拆解为 12 EXTENSION_NATIVE + 9 GENERIC_CORE_SEAM +
  Motto 策略层；第一项 core 能力（per-entry transcript projection）为可上游化接缝。
  **排序修正（2026-08-11，用户指令）**：不 fork 的结论不变，但「受控下游」不是 fork——
  是先取得发行/版本/升级/回退主权再改 TUI。下一张工单为 **MOTTO-DOWNSTREAM-0（立制）**，
  见 `docs/decisions/2026-08-11-motto-downstream-0.md`；上游化路径与触发条件见
  `docs/decisions/2026-08-11-motto-tui-0-boundary.md` + `docs/maintenance/UPSTREAM-CONTRACT.md`。
- **MOTTO-TUI-3（登记，2026-08-11）**：alt-screen 固定底栏——composer 行固定在下方。
  调研前置，不急于实现；借助开源 TUI 项目（上游优先）实现。见
  `docs/decisions/2026-08-11-motto-tui-3-composer-dock.md` + `~/Projects/Motto/tui-plan.md`。
- live widget——运行中动态展示与收工 review 立意正交（裁定：二轮调研裁决，ea8f5cd，2026-08-08）。
- extension 层模拟三态——invalidate() 不触发渲染、shortcut 无 requestRender，旁路均寄生他人副作用（裁定：三态预览核实撤单，docs/decisions/review-flow-eval.md，2026-08-08）。
- 重注册内置工具——shadow 执行定义，制造上游漂移面（裁定：review-flow 初版边界条款，2026-08-07）。
- 名词语义色替代四槽体例——✓/× 与 success/error token 为体例明文禁用（裁定：体例勘误并入 MOTTO.md 朱记三用，2026-08-07）。

本列表记录已付过认知成本的方向；已否决方向不得借新一轮调研重新进入候选簿。若其裁定前提因外部变化失效，须先援引原裁定锚点重开裁定，方可移出本节。

### 四、薄而自足 harness 定调触发（2026-08-13）

依据 `docs/decisions/2026-08-13-motto-thin-harness.md`（core 权限开放 / 折旧原则 / coding is cheaper / 版式学方法论）。

- **TUI 范式升级候选**——review flow 陌生化 TUI 的下一版版式：以 ChatGPT image gen 参考图
  （投喂 repo 链接 + 基线截图 + 凡例要点）为参照做逆向修正。触发：正典内容触发（定调）+ 目验摩擦记录；
  参照图仅作候选，不直接成工单——调研先行，三不原则（不借词语/不借形体/不牵附）为红线，
  准绳是人类目验 clean and cool。
- **约束类 harness 清退候选**——因 agentic 能力不足而添加的 prompt 约束、防御性流程、
  行为矫正层逐项清退。触发：环境触发（模型 agentic 能力提升，V4 Flash/Pro 一代）。
  清退逐项列名、列理由、跑回归，不打包删除；不新增约束类代码。

## 终局裁定（2026-08-11，非候选）

- **夺舍终局 — 单仓自足 Pi Fork**：TUI 验收后，`~/Projects/Motto` 并入
  `lesPrivilege/motto`（harness Core），单仓即足量 agent（上游历史 + patchset +
  Motto 系列 extensions/skills/themes/docs/fixtures）；上游与生态不入仓，只作
  清单记录（EXTENSIONS.lock / PI-BASE）；维护/update skill 以泛化方式随仓。
- 触发条件（全部满足才执行）：MOTTO-TUI-1 全部切片 ACCEPTED +
  GHOSTTY-BASELINE ACCEPTED + 基线 --check 持续 PASS + 维护机制泛化完成（已达成）。
- 依据：`docs/decisions/2026-08-11-motto-fork-consolidation.md`；执行清单见其 §5。

## 修订

本文件的修订同样走变更规则：候选的增删须注明依据（摩擦记录 / 上游变化 / 裁定链接），不因调研完备度立单——调研形成候选，使用形成工单。
