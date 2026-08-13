# Motto 文档主索引（INDEX）

按需召回入口。只列路径与一句话定位，正文在各文件。召回顺序见文末。

## 正典（消费）

| 文件 | 定位 |
|---|---|
| `docs/MOTTO-PHILOSOPHY.md` | 理念（为什么：薄叉受控、简约疏朗、单仓自足） |
| `docs/MOTTO.md` | 凡例（总纲；唯一文风正典） |
| `docs/TUI-THESIS.md` | 可测试不变量（TUI 红线） |
| `docs/AGENTS-MOTTO.md` | 宪制（与上游关系、工程原则、安全红线、工作流） |
| `docs/ROADMAP.md` | 长期打磨计划（候选/触发/否决边界） |
| `docs/MAINTENANCE.md` | 维护模型（三层 + 收官节奏 + Pi 升级流程） |
| `docs/MIGRATION.md` | 迁移记录 |
| `docs/CONTRIBUTING-PACKS.md` | pack 贡献规范 |
| `docs/NOTICE-MOTTO.txt` | 公告 |
| `docs/HANDOFF-DECLARATION-2026-08-12.md` | 宣言级 handoff：立言→四层验收阶梯（build/feature/architecture/philosophy），供独立验收 |

## 决策（`docs/decisions/`）

- `2026-08-08-motto-computer-use-spike.md` — computer-use spike（桌面操作能力评估，含修正结论）
- `2026-08-11-motto-downstream-0.md` — 受控下游立制（发行/版本/升级/回退主权归 Motto）
- `2026-08-11-motto-fork-consolidation.md` — 裁定：夺舍终局，Motto repo 并入 harness Core，单仓自足 Pi Fork
- `2026-08-11-motto-tui-0-boundary.md` — 裁定：从扩展集合到受控下游的边界（MOTTO-TUI-0）
- `2026-08-11-motto-tui-1.md` — 工单：MOTTO-TUI-1 Transcript Visual Composition
- `2026-08-11-motto-tui-2.md` — 工单：MOTTO-TUI-2 Per-entry Thinking Disclosure
- `2026-08-11-motto-tui-3-composer-dock.md` — 工单：MOTTO-TUI-3 固定底栏（定调：不实现，上游已合入基线）
- `2026-08-11-tui-construction-prep.md` — TUI 施工准备/旧裁定召回（TUI-PREP-1，不授权施工）
- `2026-08-12-motto-upgrade-1-absorb-upstream.md` — 工单：MOTTO-UPGRADE-1 受控上游升级（v0.84.1→534bcbffb 109 commits，ACCEPTED 落地）
- `2026-08-12-motto-tui-4-dunhao-cards.md` — 工单：MOTTO-TUI-4 顿号卡片投影（、、、围栏 → box-drawing 卡片，调研+实现逻辑 diff+最小实现）
- `2026-08-13-motto-thin-harness.md` — 裁定：薄而自足 harness（core 权限开放/折旧原则/coding is cheaper/版式学三不）
- `review-flow-eval.md` — review-flow 评估结论（API 核实 + 逐项裁决）

## 架构（`docs/architecture/`）

- `TUI-SURFACE-MATRIX.md` — TUI 表面矩阵（S 槽位 ↔ 渲染面映射）
- `TRANSCRIPT-PROJECTION.md` — transcript 投影（书目化呈现设计）
- `TUI-REVIEW-FLOW-RESEARCH.md` — 命令块折叠取舍调研（7 家开源核实；方案 A/B/C 候选，供 review-flow 决策）
- `TUI-CARD-FRAME-RESEARCH.md` — `、、、` 卡片帧调研（fenced 块/卡片帧开源实现对比；方案 A 零 core 保真演进裁定依据）

## 研究（`docs/research/`）

- peer 调研：`PEER-OPENCLAW-PEEKABOO-3.10.0.md`、`pi-peer-pi-rlm-survey-2026-08-08.md`、`pi-agent-community-research-2026-07-14.md`
- 上游提案：`UPSTREAM-PROPOSAL.md`、`UPSTREAM-SELECTION-PROJECTION.md`、`SUBMISSION-7721.md`
- 补充：`TUI-GPT-SESSION-SUPPLEMENT-2026-08-11.md`、`MOTTO-MARKDOWN-HEADING-2026-08-08.md`
- 全会话体例 dogfood（2026-08-13）：`2026-08-13-tui-full-session-composition-dogfood.md`（真实 Ghostty R0–R6 逐面证据 + 消费矩阵 + 下一张工单草案；发现 S3 目行实机失效）

## 维护登记册（`docs/maintenance/`）

- `PI-BASE.json` — 上游基线真源（版本/commit/patchset 范围）
- `PATCHES.json` — 登记 patchset（每条含 removalCondition）
- `RELEASES.json` — 发行登记
- `EXTENSIONS.lock.json` — 第三方扩展钉版清单
- `UPSTREAM-CONTRACT.md` — 上游契约（升级/回退机制）
- `USAGE.md` — 使用手册（三个命令：motto / pi / pi-official）
- `upstream-check.launchd.plist` — 上游检查 launchd 任务
- `skills/motto-maintenance/` — 维护技能（受控升级执行）

## 验收记录

- 省视：`docs/reviews/`（`2026-08-08-省并记录.md`、`2026-08-08-closing.md`、`2026-08-08-remote-ci.md`）
- 全会话体例 P0 handoff（2026-08-13）：`2026-08-13-handoff-tui-full-session-p0.md`（现状/新增意图/冲突/目验裁决项；READY_FOR_USER_REVIEW）
- 独立验收（2026-08-11~12 夺舍终局）：`docs/archive/reports/`
  - `acceptance-consolidation.md` — 单仓合并独立验收
  - `acceptance-report.md` — WO-1/3/4 独立验收
  - `acceptance-wo7.md` — WO-7（TUI-2 NO_SESSION_POLLUTION）验收
  - `acceptance-t2-3.md` — T2-3 thinking 交互键验收
  - `acceptance-t2-2.md` — T2-2 thinking 三态渲染验收
  - `maintenance-skill-test.md` — maintenance skill 端到端实测与受控升级评估
  - `clone-selfsufficiency.md` — clone 自足核验（结构已证；构建受离线环境阻断，如实）

## 施工计划（`docs/archive/plans/`）

- `consolidation-plan.md` — 单仓自足合并执行计划（READ-ONLY 审计产出）
- `t2-1-plan.md` — T2-1 thinking blocks 稳定 entryId 计划
- `tui-3-source-map.md` — MOTTO-TUI-3 源码地图 + 上游评估

## 归档仓（等待额外独立核验，可召回）

- `~/Archives/Motto-2026-08-11-single-repo/` — 原 Motto 仓全历史 `docs/`；
  GitHub `lesPrivilege/Motto` 只读。`.git` 完好、`origin` remote 保留（可查旧决策与过程）。

## 会话记录（原始过程文档）

- `~/.pi/agent/sessions/--Users-lesprivilege--/` — JSONL，按时间戳命名；只读召回，不归档、不搬移。

## 召回指引

按需搜索顺序：**正典 → 决策 → 研究 → archive → 归档仓 → 会话 JSONL**。
