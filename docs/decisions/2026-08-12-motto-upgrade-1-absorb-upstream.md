# 工单：MOTTO-UPGRADE-1 — 受控上游升级（吸纳 v0.84.1 → 当前，含 TUI-3 T3-1/T3-2）

- 日期：2026-08-12
- 类型：工单登记（受控上游升级；composer 行固定同步上日程）
- 状态：REGISTERED → 已派发
- 执行者认领：实施 subagent（写者与验收者分离；验收者=独立验收 subagent + 用户终裁）
- 依据：用户指令（2026-08-12「派新的正式工单，composer 行固定同步上日程，一切改动最小必要，
  优先消费开源方案调研结果」）；motto-maintenance skill §4；`docs/archive/plans/tui-3-source-map.md`
  （开源方案调研结果：composer 固定底栏=上游 ea1e77e2d 已入 fork；上游 v0.84.1 后的 alt-screen
  增量 #7913/#7903/#7892/18dee5f0a 为待消费对象）

## 0. 定名与范围

把 fork 锚点从 v0.84.1（`53fa77ccd`）受控升级到当前上游（`2a9b4ebc6`，108 commits），
**优先消费开源方案调研结果**——其中正含 TUI-3「composer 行固定」所需的 alt-screen 增量
（#7913 alt-screen-search / #7903 单行滚动 / #7892 失焦免重绘 / 18dee5f0a 全宽零重合成）。

**TUI-3 排程**（本单承载）：
- **T3-1**（最小必要，先落 motto/main）：`interactive-tui.test.ts` 补 dock 结构集成断言
  （transcriptScrollView + dock VStack 组合=composer/editor/footer 固定底栏），纯测试；
- **T3-2**（随本升级吸收）：上述 4 个 alt-screen 增量随 108 commits 一并消费，升级后验证
  composer 固定底栏不回归。

**一切改动以最小和必要为准**：不新增实体、不发明机制，全部走既有 motto-maintenance 流程
与既有 PATCHES 制度。

## 1. 前置（已具备）

- 维护 skill 实测通过：upstream ref 歧义已修（`refs/remotes/upstream/main`）、drill 11/11、
  ci-checks governance PASS、baseline --check PASS、7 patch 重放 dry-run 验证（7 CLEAN、
  T2-3 一处测试导入冲突可最小化解析）、support commits 已登记（`94a2d111d`/`025406274`/`2fecf1d22`）。
- 依赖面：升级需全新安装依赖（openai 6.26→6.40），models.dev 不可达（离线，沿用 offline-hydrate）。

## 2. 施工切片

- **S1（T3-1）**：dock 结构集成断言，落 motto/main（最小测试，独立 commit）。
- **S2（T3-2 前置）**：fetch + range-diff 分类（接缝/修复 / 无关基础 / 破坏注意），
  定位并优先核对 4 个 alt-screen 增量。
- **S3**：隔离 worktree candidate（上游 base）重放 7 patch + 3 support commit；构建 + 门禁
  （baseline --check / coding-agent 全量 / regression / drill / launch smoke）；
  验证 alt-screen 增量落地后 composer 固定底栏正常。
- **S4**：产出逐类 accept/reject 证据与建议（**不自动并入 motto/main**，accep 由用户终裁）。

## 3. 验收门

- 逐字节：baseline --check PASS + 零超宽。
- 全量：coding-agent 套件 0 失败；tui 套件 0 失败；regression 全 pack。
- 升级语义：7 patch 逐条重放结果（CLEAN/CONFLICT+解析）、support commits 携带；
  上游五元组更新、PI-BASE/RELEASES/PATCHES 落账（accep 后）。
- 交互面：alt-screen composer 固定底栏验证（T3-1 断言 + 升级后冒烟）；GHOSTTY 用户侧。
- 硬边界：不自动跟随 main；accept 前不并入 motto/main；patch 逐条登记、removalCondition 不废。

## 4. patch 制度与 dogfood

- 升级后 patch 仍在 PATCHES.json 登记（如上游已吸收某 patch 等价能力，验证后按 removal 流程删除）。
- dogfood：candidate 构建经 motto-dev 自用，摩擦写 usage-log；accept 决策留审计 commit。

## 5. 硬边界

- 不改 agent loop / provider / session canonical schema / 内置工具语义（上游默认零修改，按版本吸收）。
- 不自动跟随 main；不直接覆盖稳定环境；升级须走完整验收门。
- 一切改动最小必要；勿增实体；不能保持吸纳通道的结构不建。

## 6. 验收态

```
T3_1_DOCK_ASSERT        ⏳ dock 结构集成断言(最小测试)
RANGE_DIFF_CLASSIFIED   ⏳ 108 commits 分类 + alt-screen 4 增量定位
PATCH_REPLAY            ⏳ 7 patch + 3 support 重放
UPGRADE_GATES           ⏳ baseline/全量/regression/drill/launch smoke
ACCEPT_DECISION         ⏳ 用户终裁(证据已备,不自动并入)
```

终态只允许 ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED；未覆盖项标 NOT TESTED。

## 7. 修订

- 2026-08-12：工单登记（受控升级 + TUI-3 T3-1/T3-2 排程；消费开源调研结果）。
