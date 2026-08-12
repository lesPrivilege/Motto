# Motto 宣言级 Handoff — 2026-08-12

> 供**独立验收**提交用。本文件不是会话续行笔记，是从项目立言之初到当前落位的
> **宣言与理念设计**handoff：先立言，再落四层验收阶梯，再逐层自评与待验清单。
> 正文一律锚定既有正典（`docs/MOTTO-PHILOSOPHY.md` / `docs/AGENTS-MOTTO.md` /
> `docs/decisions/*`）；四层验收阶梯（L1–L4）为本 handoff **自立的验收框架**
> （结论体例沿用 `docs/templates/ACCEPTANCE.md` 三类判定），已在 §七 勘误登记为新立框架。

---

## 〇、验收总纲：四层阶梯不等价

> **build 全通 ≠ 功能实现 ≠ 架构实现 ≠ 理念实现。**

独立验收按四层分别判定，任何一层全绿不自动推出上一层成立；每层有各自的证据类型：

| 层 | 命题 | 证据类型 | 反例（判不达） |
|---|---|---|---|
| **L1 Build** | 产物可构建、测试全绿、基线逐字节一致 | 命令 + 输出：`npm run build`、各 pack 全量测试、`render-baseline.mjs --check`、`drift-check.sh`、`downstream-drill.sh` | 构建通过但功能未在真实运行中目验 |
| **L2 Feature** | 用户可见行为在真实运行中符合预期 | 真实 TUI 目验（`cu_see`/截图/人工）、dogfood 记录 | 功能演示成立，但承载它的结构不可拆、不可回退 |
| **L3 Architecture** | 功能由正确架构承担：可拆、可回退、不吞 Core、单一真源 | 结构审计：薄接缝边界、patchset 单点可删、removalCondition、投影只读（不入模型上下文）、部署位镜像+drift | 架构成立，但取舍与立言背离（言行不一） |
| **L4 Philosophy** | 实现与取舍忠实于立言：每一个「为什么」有落点 | 逐条对照宣言（§二 8 取舍 + §三 吸纳理念） | — |

验收结论沿用 `docs/templates/ACCEPTANCE.md` 三类：**ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED**；
未覆盖项标 **NOT TESTED**，不得记为 PASS。

---

## 一、立言（项目之初的宣言与理念设计）

> 正典：`docs/MOTTO-PHILOSOPHY.md`（合并时代宣言，2026-08-12 立场修订）。

### 1.1 定位一句话

Motto 不是又一个 agent，是**骑在极简 harness 上的一套版式**：耳目一新的 TUI、简明的 harness（pi）、
快而廉的模型三者相配，从内而外利落疏朗。模型的 agentic 能力越强，为约束而生的 harness 理应越薄；
Motto 站在两线收束处——既是对 model 的选择，也是对 harness 的态度，因此自足。〔R〕

### 1.2 施工立场（立场修订，2026-08-12 用户校准）

施工不是为 fork Pi 做微调，而是**实践本理念**——在极简 harness 之上以发行/版式/取舍立自己的层。
长期姿态是**持续吸纳上游与生态**（上游 remote + patch 逐条登记重放 + EXTENSIONS.lock 生态钉版），
凡不能保持吸纳通道的结构**勿增实体**——删结构优于加兼容面，不保留会阻碍吸收的中间件。

### 1.3 立言时间线（制度先于施工，施工先于功能）

| 日期 | 事件 | 意义 |
|---|---|---|
| 2026-08-08 | computer-use spike、markdown heading 调研、peer 调研 | 理念从调研生长：先看行规，再立取舍 |
| 2026-08-11 | **MOTTO-DOWNSTREAM-0 受控下游立制** | 顺序铁律：先立发行/版本/升级/回退主权，再改 TUI |
| 2026-08-11 | **fork-consolidation 裁定：单仓自足终局** | 双仓是过渡，终局是单仓即足量 agent |
| 2026-08-11 | TUI-0 边界裁定（12 扩展 + 9 接缝 + 1 策略层） | 第一项 core 能力必须动 Core 时才动，且只动薄接缝 |
| 2026-08-11 | TUI-1 / TUI-2 工单、review-flow 评估 | 调研只形成候选，触发立单 |
| 2026-08-12 | **单仓终局落实**（README/AGENTS-MOTTO 改写） | 本仓即唯一产品仓 |
| 2026-08-12 | **UPGRADE-1 受控上游升级**（v0.84.1→534bcbf，109 commits ACCEPTED） | 升级走拉模式：fetch→range-diff→candidate→dogfood→接受/拒绝 |
| 2026-08-12 | TUI-4 顿号卡片系列（s1 轻帧、s2 标签） | 功能落地，走 dogfood→验收→进 repo |

> 注：本时间线为**文档自陈**。原 Motto 仓经两仓合并整体拷入本仓（commit `cda0c3f2a`，
> 2026-08-12 01:00:11），原始提交历史未保留，日期为文本字符串，无法用本仓 git 独立核验；
> 可交叉核验的原始归档在 `~/Archives/Motto-2026-08-11-single-repo/`。

---

## 二、宣言的 8 大核心取舍（L4 对照纲）

> 每条 = 「选 X 而非 Y，理由」。独立验收时逐条核对实现是否有落点、是否言行一致。

1. **受控下游，而非自研 harness / 永久 extension-only** — 先立制再改 TUI；夺舍产品控制面
   （coding-agent interactive 集成层 + pi-tui 薄接缝 + Motto 策略层），不吞上游 Core；
   上游优先（issue/PR）。〔D0, T0〕
2. **单仓自足 fork，而非双仓 / 纯 extension-only** — 上游历史 + patchset + Motto 系列同仓；
   fork 纪律不因合并而松（patch 逐条登记、单点可删、removalCondition 不废）；上游与第三方
   生态**不进仓**，只作清单（EXTENSIONS.lock / PI-BASE）。〔F, T0〕
3. **产品呈现层 Motto / 平台契约层 Pi，而非全量替换** — 品牌化只做加法；「设计语不外泄」的
   对偶条款是「功能语不可侵」（路径/命令/包名/API 名不可被品牌化改写）。〔R, M〕
4. **自家件入仓、第三方只 lock** — 上游零入库；第三方仅 EXTENSIONS.lock（钉版 + integrity +
   兼容 base + 暴露面 + 回退版）；一次 release train 只含一类可归因升级。〔F, D0〕
5. **极简视觉**（无框/无竖线/无装饰/朱墨三用/灰阶/左锚），而非装饰堆叠 — 辨识度来自秩序；
   谱系词汇不得出现在渲染输出、代码标识符、用户可见文案。〔M, T〕
6. **成功静默、失败强显；thinking 不著录；投影零写回、不入模型上下文** — canonical 是唯一证据，
   投影随时可重建；review-safe 是著录学的不滥收。〔T, RF〕
7. **渐进展开三层阅读面**（ledger / preview / canonical），而非单一展开布尔 — 内容压缩、错误
   详细度、交互状态三根正交轴。〔T, RF, G〕
8. **工程纪律**（分层生长、最小实现、勿增实体、不保留向后兼容、上游优先、一 commit 一 patch），
   而非过度设计与兼容面 — 不留 context 税，不制造上游漂移面，不以研究代替使用。〔A, D0, G〕

---

## 三、四层落位自评（截至 2026-08-12，motto/main @ 26a7aff82）

### L1 Build — ✅ 全绿（必要非充分）

| 门 | 状态 |
|---|---|
| 各 pack 全量测试 | cards 32/32、tui markdown 79/79、coding-agent 全量通过 |
| `render-baseline.mjs --check` | 逐字节一致、零超宽 |
| `drift-check.sh` | PASS（部署位与仓库逐字节一致） |
| `downstream-drill.sh` | 11/11 机械门（含 `MOTTO_USE_OFFICIAL=1` 原子回退） |
| patchset | PATCHES.json **10 条全部 applied**，每条含 removalCondition |

### L2 Feature — ✅ 已目验（本轮 tui-4-s2 完整走通 dogfood→验收→进 repo）

| 能力 | 目验证据 |
|---|---|
| `、、、` 卡片（裸/带标注） | 真实 TUI：标注→盒顶 `[bash]` accent 标签（#c0453e 目验）、盒内仅内容无分隔线；长标注不撑宽 |
| 卡片轻帧（s1） | 投影卡片去行间分隔线；自然 markdown 表格不受影响（逐行分隔线保留） |
| review-flow A1 | 自定义工具成功→dim 目行；`!!` bash→整卡+5 行 tail 预览；失败整卡强显 |
| computer-use | 会话级门禁 fail-closed，approve 后 8 工具白名单可用，重启回未批准态 |
| 既有 | 牌记/footer/TPS、标题守护、多级标题投影、thinking 三态、S3 工具目行、S1/S2 布局、composer dock |

### L3 Architecture — ✅ 已按宪制落位（可拆、可回退、不吞 Core）

| 结构要求 | 落点 |
|---|---|
| 薄接缝边界 | 只动 coding-agent interactive 集成层 + pi-tui 薄接缝（TUI-0 的 12+9+1 拆解）；agent loop / provider / session canonical schema / 内置工具语义零修改 |
| 一 commit 一 patch | 每条 patch 单点可删、独立回退；removalCondition 不废 |
| 只读投影 | cards/headings 为 display-only 投影：不持有 canonical、不入模型上下文、不写回 session；review-flow 以 custom entry 追加 session 文件（I10-1 允许，不入模型上下文、不发 message）；canonical 是唯一语义证据 |
| 单一真源 + 部署位镜像 | 仓为唯一 canonical；扩展/主题经 `deploy.sh` → `~/.pi/agent`，`drift-check.sh` 防手改 |
| 受控升级链路 | `upstream-check.sh` 只读报告（仅 git fetch 更新远端引用，不建分支/不改 PI-BASE/不升级；当前：自 v0.84.1 共 112 commits，其中 109 已由 UPGRADE-1 吸纳至 base 534bcbffb，对当前 base 实际残余 3 commits——2026-08-12 检查时点读数，上游为持续更新的外部仓，数字以 `upstream-check.sh` 最近一次输出为准，**未自动升级**）；升级须 candidate 重放 + 回归 + dogfood |
| 分支卫生 | 产品线仅 `motto/main`；`main` 为上游镜像锚、`upstream/v0.84.1` 为基线；已 merge feature 分支已清，本地=远端一致 |

### L4 Philosophy — ⚠️ 主体已落实，留三条待独立验收细察

| 取舍 | 落位 | 待察点 |
|---|---|---|
| 1 受控下游 | ✅ 发行/版本/升级/回退主权归 Motto，UPGRADE-1 全程走拉模式 | 无 |
| 2 单仓自足 | ✅ 单仓即足量 agent，patch 逐条登记 | 无 |
| 3 呈现层/契约层分治 | ✅ 品牌化只做加法；`@earendil-works/pi-*`、`.pi`、`PI_*` 原名保留 | **功能语不可侵**：抽查品牌化是否误改路径/命令/API 名 |
| 4 第三方只 lock | ✅ EXTENSIONS.lock 钉版 | **禁浮动 main**：核对 lock 均钉版本+integrity |
| 5 极简视觉 | ✅ 朱墨三用（钤印/改笔/校记），Motto 新增投影层无第四种红/绿/✓/× | **谱系词汇不入输出**：抽查渲染输出与用户可见文案无古风术语 |
| 6 成功静默失败强显 / 投影只读 | ✅ 目行压缩、失败强显、投影不入模型上下文 | **投影只读**：核对投影层不改 canonical 语义、不入模型上下文（review-flow 的 custom entry 追加属 I10-1 允许） |
| 7 三层阅读面 | ✅ ledger/preview/canonical 渐进展开 | 无 |
| 8 工程纪律 | ✅ 最小实现、勿增实体、删结构优于兼容面 | **待察**：hideThinkingBlock 兼容路径与「不保留向后兼容」的取舍张力（上游原生特性，非 Motto 新增兼容层；保留理由与披露见 §六） |

---

## 四、独立验收清单（每层给验收者的问题）

### L1 Build
- [ ] `npm run build` / 各 pack 全量测试全绿，且**未**因「测试碰巧通过」替代功能证据？
- [ ] `render-baseline.mjs --check`、`drift-check.sh`、`downstream-drill.sh` 三者皆 PASS？

### L2 Feature
- [ ] 在**真实运行**（非测试 harness）中目验 `、、、 bash` → 盒顶 `[bash]` accent 标签、盒内无头行无分隔线？
- [ ] 裸卡标题仍在盒内（行为未回归）？自然 markdown 表格逐行分隔线保留？
- [ ] 长标注（`、、、 /computer-use approve`）标签不撑宽盒？
- [ ] computer-use 门禁：重启后 fail-closed、approve 后白名单可用、revoke 后立即失效？

### L3 Architecture
- [ ] 每一条 patch 都能单点 revert 而不连带破坏？（removalCondition 逐一有效）
- [ ] 投影层确实是只读：canonical session 数据 / 模型上下文 / 写回路径均未被触碰？
- [ ] 升级链路是拉模式：`upstream-check.sh` 只报告、绝不自动跟随 main？
- [ ] 部署位与仓库 drift 检查有效（防手改）？

### L4 Philosophy
- [ ] 8 大取舍逐条有实现落点，且无「为兼容而违背取舍」的例外？
- [ ] 「功能语不可侵」成立：品牌化未改写任何功能性 token？
- [ ] 极简视觉成立：Motto 新增投影层无第四种红、无装饰线堆叠、谱系词汇未入输出/文案？
- [ ] 成功静默 / 失败强显：正常轨迹压缩、失败绝不折叠隐藏？

---

## 五、出处索引（验收者按需召回）

- 宣言：`docs/MOTTO-PHILOSOPHY.md`（8 取舍 + 吸纳理念 + 出处编号 [R][M][T][D0][F][T0][RF][G][A][R2..R5][P]）
- 宪制：`docs/AGENTS-MOTTO.md`（与上游关系 / 工程原则 / 安全红线 / 工作流）
- 可测试不变量：`docs/TUI-THESIS.md`
- 决策：`docs/decisions/`（downstream-0、fork-consolidation、tui-0/1/2/4、upgrade-1、review-flow-eval）
- 架构/调研：`docs/architecture/`、`docs/research/`（INDEX 有召回顺序）
- 维护登记册：`docs/maintenance/`（PI-BASE / PATCHES / RELEASES / EXTENSIONS.lock / USAGE）
- 主索引：`docs/INDEX.md`

## 六、未达处与留白（诚实披露，验收者勿当作已闭合）

- **L4 待察三条**（§三）：功能语不可侵、第三方 lock 禁浮动 main、谱系词汇不入输出——均已有实现约束，但**未经独立抽查**。
- review-flow 方案 B/C（三态折叠 / diff-only 改笔面）：观察期触发，**未实现**（不以调研代替使用）。
- 卡片流式实时成卡、user 消息卡片：按使用摩擦触发，未实现。
- 主题外框粗细：用户曾提「边框线略微过重」，轻帧已缓解主体观感，外框粗细留待微调。
- 上游残余 3 commits 增量（2026-08-12 检查时点：自 v0.84.1 共 112，其中 109 已由 UPGRADE-1 吸纳至 base 534bcbffb；上游为外部仓，数字随时间移动，以 `upstream-check.sh` 最近输出为准）：已报告，**未应用**（铁律：只读检查≠升级；须用户决策走全流程）。
- **单仓合并前置门未全过即执行（2026-08-12，已发生，如实披露）**：fork-consolidation 自设四道验收门（decisions/2026-08-11-motto-fork-consolidation.md:56-61），其中 TUI-1 全切片终态 ACCEPTED 与 GHOSTTY-BASELINE（用户侧，从未落档）两项未满足即完成合并。TUI-1 终态验收与 GHOSTTY-BASELINE 留待用户侧补做。
- **hideThinkingBlock 兼容路径**（T2 三态并存、Ctrl+T 全隐保留）：为上游原生隐藏 thinking 特性，非 Motto 新增兼容层；与宪制「不保留向后兼容」存在取舍张力，保留理由在 decisions/2026-08-11-motto-tui-2.md:73 与 PATCHES.json 各 T2 条，如实披露。
- **四层验收阶梯为新立框架**：L1–L4 分层无正典先例（grep 唯一命中为本文档自引用）；结论体例沿用 ACCEPTANCE.md 三类。已在开篇与 §七 勘误中自认新造。

## 七、2026-08-12 返修勘误（独立验收 ACCEPTED WITH LIMITATIONS 后修订）

- 「只读投影零写回 / 不写回 session」措辞收窄：review-flow 以 custom entry 追加 session 文件（I10-1 允许，
  不入模型上下文、不发 message）；cards/headings 仍为纯 display-only 零写回。
- 「全系统无 ✓/×」措辞收窄为「Motto 新增投影层与主题无 ✓/× / success/error 语义色」——上游 legacy
  选中/成功标记为未改动原码，Motto 主题下渲染为 mid 灰，不构成语义色。
- 登记册修正：PATCHES.json / PI-BASE.json / RELEASES.json 的 patch commit 哈希更新为 MOTTO-UPGRADE-1
  重放后实际值，并补叠改注（removalOrder：后置先退，见 PATCHES.json discipline）。
- check-pinned-deps 补 git 依赖 commit SHA 钉版校验 + 单元测试；motto-ci 覆盖 motto/main 分支。
- I11-3 代码注释谱系词清理为现代 CS 用语（splash/gutter/recap/error tail/diff/index 等；含测试注释残留，`悬挂` 经 TUI-THESIS I11 边界裁定为现代排版术语，不计）。
- 「不自立新义」自认新造：四层验收阶梯为新立框架（结论体例沿用 ACCEPTANCE.md），开篇与结尾措辞已改。
- 单仓合并前置门未全过即执行（TUI-1 终态验收 + GHOSTTY-BASELINE 从未落档）：已在 §六 如实披露，补做留用户侧。
- hideThinkingBlock 兼容路径（上游原生特性）与「不保留向后兼容」张力：已在 §六 披露，取舍 8 待察点补注。
- 上游增量计数修正：112 系 2026-08-12 检查时点对旧基线 v0.84.1 的读数，109 已吸纳，对 base 534bcbffb 当时残余 3；上游为外部仓，后续提交会使残余数随时间移动，以 `upstream-check.sh` 最近输出为准。
- 立言时间线无法用本仓 git 核验（两仓合并丢失历史）：§1.3 已标注自陈性质与归档路径。

---

*本文件锚定既有正典；四层验收阶梯为本 handoff 自立的验收框架（§七 勘误登记）；四层判定以 §三自评为当前快照，以 §四清单为独立验收执行纲。*
