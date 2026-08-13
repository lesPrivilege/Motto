# AGENTS.md — Motto

本仓库是 Motto 系列 PI agent 发行（单仓自足 fork）的收容仓：扩展、主题、skill、文档与维护工具同仓。给在此工作的 agent 与人类维护者的规则。

## 与上游的关系（宪制）

1. **全兼容**：pi harness core 与社区扩展是生态伙伴，不是原料。Motto 件只经公开 API 与标准机制（extensions 自动发现、主题 JSON、skills）接入，与任意第三方扩展共存；命名空间前缀（`motto-*`、`cu_*`、`motto-review-flow.turn.v1` 式 entry type）保证互不侵扰；对上游注入的一切文本零改写权（凡例「功能语不可侵」）。
2. **自有域走 `.motto`，最小实现**：Motto 自有的持久状态或配置确有需要时落 `~/.motto/`（或本仓内），不得占用或改写 `.pi` 的语义；当前无此需要即不预建（不做投机式设施）。`.pi` 下属于 Motto 的只有部署位镜像，一律经 deploy.sh 产生。
3. **同步 pipeline 即现有治理，不设第二条路径**：仓库为单一真源；上游演进经 deploy.sh（仓→部署位）+ drift-check（防手改）+ MAINTENANCE 五步省视 + Pi 升级流程 + 第三方钉版核对消化。
4. **独立生长，上游优先**：Motto 的正典（docs/MOTTO.md 凡例、docs/ROADMAP.md 准入、本文件）自足于本仓，不从属 pi 的路线图；pi 是当前承载 harness，体例本身可迁移（见 ROADMAP「非项目化外溢」）。对上游的需求**优先以 issue/PR 提出**（upstream-first）；确需入下游的改动必须登记 PATCHES.json、有 removalCondition、可独立回退。
5. **单仓闭合（夺舍终局，2026-08-12 落实）**：本仓 `lesPrivilege/motto` 是 Motto 唯一产品仓——上游历史（`upstream` remote）+ patchset + Motto 系列 extensions/skills/themes/docs/fixtures 同仓，单仓即一个足量的 agent。上游 `earendil-works/pi` 与第三方生态**不入仓**，只作清单记录（EXTENSIONS.lock / PI-BASE）。不设第三仓，不存在「全套 motto agent repo」；任何要求第三仓的方案自动落入「已裁定不做」的审查程序。原双仓形态（`~/Projects/Motto` 独立仓）是到达终局的过渡形态，现已并入本仓（见 `docs/decisions/2026-08-11-motto-fork-consolidation.md`）。
6. **项目本地域**：`.motto/` 为 Motto 在各项目内的自有目录，`agent.md` 为其正文——项目的长期维护、生态拓展、dogfooding 皆从此始。`.motto/` 内容归项目所有，本仓不收容、不同步（区别于部署位镜像）。
7. **受控下游（宪制，MOTTO-DOWNSTREAM-0 立制，2026-08-11）**：Motto 拥有自己可发布、可升级、可回退的 Pi distribution——发行、版本、升级、回退主权归 Motto；agent loop、provider、session canonical schema、内置工具执行仍归上游，默认零修改。长期所有权划分与升级/回退机制见 `docs/decisions/2026-08-11-motto-downstream-0.md` 与 `docs/maintenance/UPSTREAM-CONTRACT.md`。**顺序铁律**：立制（发行/版本/升级/回退）先于任何 Core patch；第一项 TUI Core 修改（**MOTTO-TUI-1 Transcript Visual Composition**——纯视觉投影，不含 reducer 与折叠；per-entry thinking disclosure 后移 MOTTO-TUI-2）只能在 MOTTO-DOWNSTREAM-0 全部验收态通过后开始。不改 npm package 名称，内部保留 `@earendil-works/pi-*` identity，Motto 身份只放发行 manifest / launcher / 版本输出。**终局（单仓，2026-08-12 落实）**：发行/版本/升级/回退主权随单仓自足 fork 归 Motto——`scripts/maint/launchers/motto` 直接跑本仓构建产物（`packages/coding-agent/dist/cli.js`），deploy.sh 退化为仓→部署位（`~/.pi/agent`）镜像；升级/回退链路由 `scripts/maint/downstream-drill.sh`（11/11 机械门，含 `MOTTO_USE_OFFICIAL=1` 原子回退）与 `scripts/maint/upstream-check.sh` 驱动；上游演进仍经 PI-BASE/UPSTREAM-CONTRACT 清单消化。见 `docs/decisions/2026-08-11-motto-fork-consolidation.md`。
8. **实现顺序铁律(2026-08-13 厘清)**:功能实现优先 extensions(公开 API 自动发现),其次主题/皮肤层,最后才对 harness core 做最小改动——Core 改动仍守安全红线(PATCHES 登记 + removalCondition + 可独立回退)。**core 权限开放(2026-08-13)**:改动不再限于薄接缝,但解耦最小纪律不变,见 `docs/decisions/2026-08-13-motto-thin-harness.md`。上游 Pi harness core 与 Pi 生态 extensions 的更新照单吸收(upstream-check / UPSTREAM-CONTRACT 消化),不在期内维护:不 fork 上游或第三方生态代码,只作清单记录。本仓发行是全量 agent(效果接近 fork 后微调),但改动面坚持薄叉受控——发行形态全量,改动策略最小。

## 工程原则

- 不保留向后兼容。删除废弃路径，不加兼容层、fallback 或迁移逻辑。
- 选择最简单地满足当前需求的实现；避免投机式抽象、配置与间接层。
- 分层生长：先做最小可端到端工作的版本，再在能工作的产品上加能力；绝不为未完成的复杂度牺牲可用产品。
- 组件模块化、关注点分离。
- 优先使用成熟、维护良好的库；不重复造轮子；先查现有依赖的能力再自研或加包。
- 架构决策面向长期：不接受“只现在能用、以后要换掉”的临时方案。

## 安全红线（对所有 pack）

- **上游优先，解耦最小**：不改 agent loop / provider / session canonical schema / 内置工具语义（如有必要改动，须独立裁定，不随日常施工夹带）；对上游的需求先提 issue/PR（upstream-first）。**core 权限开放（2026-08-13 裁定）**：确需入 `lesPrivilege/motto` 的改动不再限于薄接缝，但每条必须解耦（组件级、可测试）、最小必要、登记 PATCHES.json、有 removalCondition、可独立回退；未登记的 Core 改动禁止。见 `docs/decisions/2026-08-13-motto-thin-harness.md`。
- 工具白名单只缩不扩（除非先验收）。
- 固定版本依赖必须同时固定 SHA-256；校验失败即 fail-closed。
- 权限缺失、服务端 isError、stale reference、越界坐标一律 fail-closed，不静默降级到更高风险路径。
- 不自动申请系统权限；不自动前台化/移动鼠标来掩盖“后台操作不成立”。
- 高风险应用与不可逆操作不进入默认可用范围；默认加载须以 fail-closed 门禁为前提，批准仅限用户显式动作，且门必须位于扩展自身执行路径内。

## 目录与职责

- `packages/motto/extensions/<pack>/`：每个 pack 自包含（代码 + checksums + test + reports + usage-log）；主题正典在 `packages/motto/extensions/motto-themes/`（motto / motto-dark / motto-light 三 JSON）。
- `docs/`：Motto 正典（`MOTTO.md` 凡例、`MOTTO-PHILOSOPHY.md` 理念、`TUI-THESIS.md` 可测试不变量、本文件宪制）+ 决策/架构/研究/评审记录 + `docs/maintenance/` 维护清单（PI-BASE / PATCHES / RELEASES / EXTENSIONS.lock）。
- `fixtures/tui/`：TUI 渲染基线与捕获场景。
- `scripts/maint/`：维护/构建/演练脚本（与上游根 `scripts/` 命名空间隔离，避免文件名冲突）。
- pack 内 `index.ts` 薄（pi 集成），核心逻辑放 `<core>.ts`，让测试跑与 pi 完全相同的边界。
- 二进制不入库，只用 checksums + fetch 脚本（见 README 体例）。
- 所有产物（报告、日志）留在仓库内固定路径；不写入 `~/`、`~/Downloads/`。

## 工作方式分层（2026-08-13 厘清）

1. **全局注入泛化最小**：部署位 `~/.motto/agent/AGENTS.md` 与系统注入内容只立风格与规则底线，不堆具体操作规范——约束类内容最小化是薄 harness 的一环，更多交给 agentic 能力提升后的模型发挥（「agent.md 作为 system prompt 本身是泛化、最小的」）。
2. **项目规范具体可操作**：Motto repo 的 AGENTS-MOTTO.md 与本仓 `.motto/agent.md` 承载项目本身的 work 与 dogfooding 规范——具体、可操作，随项目演进修订。
3. **规范路径**：先在元目录（部署位）dogfooding，验收通过后进入 motto repo 正典——试用态与正典态分离，正典不过度生长。
4. **推论**：motto agent 自身正在使用 → 它运行的 harness 依然是薄 harness；凡增约束类条文先问「折旧吗」。

## 工作流

1. 变更任何 pack：改代码 → 跑该 pack 全量测试 → 更新验收报告（新增/修订）→ 必要时更新 REGISTRY。
2. dogfooding 发现的问题 → 写 `docs/usage-log/` 条目 → 修 → 补测试 → 回归。
3. macOS 大版本升级 / 上游发版 → 环境驱动回归（见 docs/MAINTENANCE.md）。
4. 结论只能三类：ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED；未覆盖项必须标 NOT TESTED，不得记为 PASS。

## 新方向的工作方式（后端治理与 TUI 呈现同适用）

1. 调研先行：任何新方向先派发对开源成熟项目既有方案的调研，产出归 `docs/research/`；调研只形成候选与参照，不形成工单（见 docs/ROADMAP.md）。
2. 设计自生：实现不从调研方案移植，而从本仓设计理念（docs/MOTTO.md 凡例）生长出来——调研告知行规，体例决定取舍，包括有依据地违反行规（如语义色之于四槽）。
3. 触发立单：候选转工单的唯一途径是 ROADMAP 所列三类合法依据成立；每张工单须有执行者认领行，同仓同时至多一个写者，写者与验收者分离。
4. 已裁定不做的方向不得借新一轮调研复生；重开须先援引原裁定锚点。
