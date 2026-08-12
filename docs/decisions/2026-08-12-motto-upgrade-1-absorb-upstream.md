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
T3_1_DOCK_ASSERT        ✅ 2026-08-12 commit 9e94f75e5(已 push origin motto/main)
                        dock 结构集成断言 2 条:transcriptScrollView+dock VStack+root VStack,
                        真实 mountInteractiveTui + 渲染冒烟(editor/footer 固定底栏,transcript 滚动);
                        coding-agent 全量 217 files/1943 tests 0 fail,tsgo/biome 全绿
RANGE_DIFF_CLASSIFIED   ✅ 108 commits 分类完成:接缝/修复 14(含 4 个 alt-screen 增量定位:
                        00121ed99/#7913、1279952de/#7903、4a879dd75/#7892、18dee5f0a),
                        无关/基础 ~84,破坏/注意 ~10(4 类);上游已漂移 +1(534bcbffb,LaTeX 修复)
                        → 证据 /tmp/upgrade-evidence.md
PATCH_REPLAY            ✅ 7 patch + 3 support 重放:10 CLEAN + 1 CONFLICT(T2-3 仅测试导入块,
                        两条 import 并存即解,语义零冲突);candidate: /tmp/upgrade-candidate
                        (branch candidate/pi-upgrade,基 2a9b4ebc6)
UPGRADE_GATES           ✅(candidate)npm install 成功(openai 6.40)、build:offline ALL_BUILD_OK、
                        npm run check PASS、coding-agent 218 files/1946 tests 0 fail、
                        tui 908/0、dist launch smoke PASS(motto 品牌);
                        NOT TESTED: baseline --check/drill/regression(需 motto 侧 harness,
                        candidate 无 scripts/maint,按预期跳过)、GHOSTTY 人工交互与真实 dogfood
ACCEPT_DECISION         ✅ 用户已接受(2026-08-12)
                        执行:merge 20d6909d9(base v0.84.1→534bcbffb, 109 commits 吸收,
                        含 4 alt-screen 增量 T3-2; 8 patch + 3 support 重放, 仅 1 处测试导入
                        冲突最小化解析——interactive-tui.test.ts 导入块, FullscreenExitOutput+
                        ThinkingFoldState 两 import 并存, 与 dry-run 一致); gates 全绿
                        (npm run check / baseline --check / coding-agent 1948·0 / tui 909·0 /
                        regression 11·0 / drill 11·11 / governance PASS, 见 RELEASES 2026-08-12.1);
                        records 落账:PI-BASE 五元组→534bcbffb(未发版,无 tag/tarball),
                        RELEASES 2026-08-12.1, PATCHES replay 注记(removalCondition 保留)
```

终态只允许 ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED；未覆盖项标 NOT TESTED。

## 7. 修订

- 2026-08-12：工单登记（受控升级 + TUI-3 T3-1/T3-2 排程；消费开源调研结果）。
- 2026-08-12：S1（T3-1）落账 commit 9e94f75e5；S2–S4 施工完成——candidate 重放/门禁/alt-screen 验证
  全过，证据 /tmp/upgrade-evidence.md；待用户 accept 终裁（未并入 motto/main）。
- 2026-08-12：ACCEPT 终裁——用户接受(MOTTO-UPGRADE-1)。merge 20d6909d9 落地
  (base v0.84.1→534bcbffb, 109 commits 吸收, 8 patch + 3 support 重放), gates 全绿,
  records 落账(PI-BASE/RELEASES 2026-08-12.1/PATCHES replay 注记); 上游未发版(无 tag/tarball),
  base 以 commit 534bcbffb 为真源。
