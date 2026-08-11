# 裁定：Motto 从扩展集合到受控下游的边界（MOTTO-TUI-0）

- 日期：2026-08-11
- 类型：决策记录（重开裁定）
- 援引锚点：ROADMAP「已裁定不做 · fork harness core」（2026-08-08）、
  `docs/decisions/review-flow-eval.md` 第八节（pi 0.84.1 公开 API 映射）、
  `docs/MAINTENANCE.md`（Pi 升级流程）
- 结论：**维持纯扩展层；不 fork、不建立 motto-pi；GENERIC_CORE_SEAM 走上游化路径。**

## 1. 为什么本轮重开「fork harness core」裁定

原裁定（2026-08-08）写死于「三态核实撤单」——当时确认 extension 无法自足实现
per-entry 三态投影，判定「projector 属一整层，补丁预算无此额度」。本轮
MOTTO-TUI-0 的职责正是把该「一整层」拆解为可判定的边界，回答：**哪些必须动 core、
哪些是通用接缝、哪些只是 Motto 策略**。拆解完成后，原裁定的前提（「一整层无法
预算」）被细化为「一整层 = 12 个 EXTENSION_NATIVE 表面 + 9 个 GENERIC_CORE_SEAM
接缝 + 1 层 Motto 策略」，fork 的经济性问题因此可以按新前提重判。

## 2. 拆解结论（依据 TUI-SURFACE-MATRIX）

- **12 个表面 EXTENSION_NATIVE**：工具三态、streaming 事件、custom tools、vision、
  computer-use、composer、header/footer/title、md transform、notify、review-flow v1。
- **9 个表面 GENERIC_CORE_SEAM**：user 消息出口、长 paste、thinking 折叠、
  内置工具卡投影出口、per-entry fold、选区侧车、逐级 heading 槽、compaction 卡出口。
- **MOTTO_TUI_CORE（策略层，不上游）**：两列悬挂/留白/朱墨三用的布局文法、
  recap 语义（成功静默/失败强显/stderr 尾部）、复制策略、宽度纪律。
- **OUT_OF_SCOPE**：session tree/selectors（pi 管理面）、subagent 收编（观察期）。

## 3. 第一项「必须改 Core」的能力是什么

**per-entry transcript projection**——稳定 entryId + 三态 fold + thinking 独立折叠
+ 选区侧车。这不是单点能力，是覆盖 S4/S5(部分)/S8/S16/S17 的**一整层通用接缝**
（TRANSCRIPT-PROJECTION 第十节已证：只换 pi-tui 不够，transcript 拼装在
coding-agent interactive 层）。

## 4. 它是否可改为通用、可上游化的接缝

**是，而且本来就是**。两份设计稿早已存在并已提交上游讨论：
- `docs/research/UPSTREAM-PROPOSAL.md`（transcript projector：per-entry fold/
  三态/thinking）——已作为 #7721 consolidated follow-up 材料 C 提交；
- `docs/research/UPSTREAM-SELECTION-PROJECTION.md`（selection sidecar）——#7721
  材料 B + 10 条回归用例；
- 主题逐级槽已挂 ROADMAP 档二（#7721 closed-unmerged，账已结，不催办）。

结论：**该接缝的首选路径是上游 PR，不是私有补丁**。Motto 不 fork 去实现一个
本可上游化的通用能力。

> **编者注（2026-08-11，A2 收口勘误）**：本节把 #7721 的 closed-unmerged 记为「材料已递、
> 账已结」，隐含它仍是一条可期待的上游路径。**重新定性**：维护者关闭该 PR 时明言 too
> risky，对 Motto 的交付而言其状态是**未接纳 / 不可依赖**——不是「暂缓」。上游优先仍然
> 成立（继续以 issue/PR 提出），但任何工单不得把 #7721 的合入列为前置或缓解依据。



## 5. 是否现在就建立 motto-pi

**否。** 依据 UPSTREAM-CONTRACT §10：触发条件（a）出现第一条 applied 的
Motto-specific 补丁、（b）上游明确拒绝且缺口阻塞产品——**均不成立**。registry
为空；上游对 #7721 的态度是「closed-unmerged（暂缓）」而非「拒绝」，且缺口的
产品侧缓解（hideThinkingBlock + recap + copy 命令）已可运行。

> **编者注（2026-08-11，A2 收口勘误）**：本节结论**已被 MOTTO-DOWNSTREAM-0 取代**。两处更正：
> （一）触发条件（b）的判断建立在「#7721 = 暂缓而非拒绝」之上，该前提据上条编者注更正为
> **未接纳 / 不可依赖**；（二）受控下游的成立依据不再是「上游拒绝」，而是发行/版本/升级/
> 回退主权本身（宪制第 7 条）。`lesPrivilege/pi` 已建，`motto/main` 锚 v0.84.1 零 patch。
> 本节的「否」仅作当时判断存档。

## 6. 下一张工单：MOTTO-DOWNSTREAM-0（顺序修正，2026-08-11）

> **用户指令修正排序**：不能先做一块 Core patch 再倒推维护制度。真正的「夺舍」首先
> 是取得发行、版本、升级和回退主权；TUI 修改只是其后的第一组 patch。
> 因此**下一张工单不是 MOTTO-TUI-1，而是 MOTTO-DOWNSTREAM-0（Pi 受控下游立制）**，
> 完整规格见 `docs/decisions/2026-08-11-motto-downstream-0.md`。

MOTTO-DOWNSTREAM-0 只建立长期维护装置，不改变任何 Pi 产品行为；完成并验收后才允许
开始修改 Core。本节的旧内容（著录层深化切片）自 2026-08-11 起不再是下一张工单，
归档为该工单的备选切片（仅在下游制度成立后、且 usage-log 摩擦触发时方可重启评估）：

~~在**当前扩展面**（零 core 改动）上，做一条端到端可验收的垂直线：
**著录层深化切片 ——「探索洪流 reducer + 失败强显 + 复制保真命令」**。~~

- 范围：review-flow v2 候选——在 `turn_end` 前按 explore/change/execute 归并
  重复工具调用（Kimi stack / Codex `Explored` 参照），记录计数/累计耗时/最终状态/
  失败数；失败条目折叠态强制显露；错误提要仍 stderr 尾部 ≤5 行。
- 边界：不重注册内置工具、不入模型上下文、单 turn 投影有界、v1 entry 继续可渲染。
- 触发依据：ROADMAP 观察期条款——**须先有「目行粒度失准」的可复现 usage-log 记录**
  才立项；MOTTO-TUI-0 不预先实施，只在本 review 立切片的验收口径。

## 7. Bash 与 paste 作为该切片的验收用例

- **Bash**：fixture T3（stdout+stderr）/ T4（exit 1）/ T5（空输出）——reducer 后
  成功 bash 收敛为「命令首词 + exit 状态 + 计数」，失败 bash 强制显露出
  `exit 1` + stderr 尾部；对照 `baseline/review-flow.txt` 的 collapsed/expanded
  双态。
- **Paste**：fixture T3（`paste-long.txt`）——长 paste 渲染不超宽/不闪烁 +
  `/copy-answer` 返回原逻辑段落（非视觉行），Ghostty 捕获第 4 节记录拖选基线
  （视觉行 join `\n` 缺口如实记录，不宣称保真）。

## 8. 哪些现有实现保持不动

header/splash、footer（含 TPS）、terminal title（motto pack）；三主题 JSON；
`/copy-answer`/`/copy-code`（canonical-copy）；computer-use 门禁；motto_vision；
review-flow v1 渲染路径；branding 注入；`.motto/agent.md` 项目本地正文。
**本轮零产品行为代码改动**（已核实：git 仅新增 fixtures 与 docs）。

## 9. 哪些现有实现未来迁入统一 projection layer

- review-flow recap（v1 custom entry → bus 的 custom projector，获得 per-entry
  fold 与 copy sidecar）；
- headings 投影（文本级 registerMarkdownTransformer → bus 的 assistant 文本
  projector，摆脱多扩展串联的顺序耦合）；
- 内置工具卡的 recap 第二来源（消费 S8 的工具卡投影出口）；
- footer 数据（可选：随 bus 的 session-info 投影，非必须）；
- 自定义工具卡（vision/computer-use 的 renderer 保持，但可经 bus 补 collapsed 面）。

迁移一律以「上游接缝落地」或「策略层内可验证切片」为前置，不提前动手。

## 10. GO / NO_GO

**GO（本轮）**：TUI 宣称已形成可测试规范（36 条不变量，A/U/B 验收面标注）；
surface 矩阵、投影契约、上游契约三份架构文档齐备；fixtures/tui 基线可重复运行
（无头 + Ghostty 用户侧）；全量回归通过；零产品行为改动；不建立 fork。
**NO_GO（Core fork）**：第一项 core 能力是通用可上游化接缝，走上游 PR 路径；
motto-pi 薄叉装置就绪（UPSTREAM-CONTRACT）但触发条件不成立，不建立。

## 遗留 / 残余风险

- Ghostty 交互面基线（streaming/拖选/pbpaste/折叠）为**用户侧**记录，computer-use
  门禁默认关闭，本轮未自动驱动桌面（与仓库惯例一致）；`ghostty-capture.sh` 一键
  可跑。
- `#7721` 上游状态 closed-unmerged，定性为**未接纳 / 不可依赖**（维护者关闭时明言
  too risky）；per-entry 三态与选区保真以 hideThinkingBlock + recap + copy 命令缓解，
  不宣称达成，也不把该 PR 的合入列为任何工单的前置。
- turn reducer 切片（原挂 MOTTO-TUI-1，定名修正后不属 TUI-1 纯视觉范围）须先有
  usage-log 摩擦记录（ROADMAP 观察期条款）方可立项。
