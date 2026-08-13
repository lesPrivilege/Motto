# 2026-08-13 handoff —— 全会话 TUI 体例消费与真实 dogfood（P0）

> 施工方：Motto（agent）。验收方：用户（独立验收，写者与验收者分离）。
> 工单：MOTTO-TUI-FULL-SESSION-P0（消费校准 + 真实 dogfood + 参考系列；本轮不执行下一张施工单）。
> 研究记录：`docs/research/2026-08-13-tui-full-session-composition-dogfood.md`（R0–R6 逐面证据）。
> 范围：仅新增本文件 + 上列研究记录；**零产品代码改动、零基线改动**。

## 一、现状（本轮实测确认）

- composer 沉底 dock（pending/status/widgets/editor/footer）在真实 Ghostty 1.3.1 成立；
  属上游 v0.84.1 既有能力，不另造。
- 全会话三层成立：thinking 依 hideThinkingBlock 安静呈现、不入 recap；工具走组件渲染 +
  recap 机械投影（成功静默、失败 accent 强显 + stderr 尾部提要）；assistant 最终回报为正文、
  永不折叠，原生 Markdown 直出（H1/H2/H3› 三档、列表、代码围栏、表格、diff 实测成立）。
- footer 单行 + 折叠优先级（统计段→cwd 截断→最后才折模型信息）实机 60 列成立；/reload
  后 self-heal 仍单行。
- 窄宽：render-baseline --check 40–200 列逐字节零超宽 + 60 列实机无超宽。
- 机械门禁全绿：git diff --check / ci-checks.sh governance / render-baseline.mjs --check。

## 二、网页 session 新增意图（本轮消费口径）

- 屏幕骨架、全会话三面（thinking disclosure / tool·diff 工作轨迹 / final Markdown 正文）、
  Markdown 语义边界（```bash ≠ 执行、text fence ≠ paste、顿号卡片 ≠ Bash tool）——
  全部按「已有能力验证」处理，**不新增正典、不写新宣言**。
- 参考图与书目隐喻不构成工单（ROADMAP 四、三不原则）。

## 三、冲突与漂移

1. **S3 成功目行实机失效（唯一实质发现）**：`session.getToolDefinition` 含内置定义
   （source `<builtin:${name}>`），`isSuccessIndexLine` 的 `toolDefinition === undefined`
   条件对内置工具恒假 → 成功内置工具不收敛为目行，chat 流内与 recap 双份呈现
   tool+target。无头基线（`render-baseline.mjs` 以 `toolDefinition = undefined` 构造组件）
   记录的是组件语义，无法发现接线层失效——**基线绿 ≠ 实机绿**。
2. 两处旧措辞（MOTTO-PHILOSOPHY 旧边界、ROADMAP composer 条目位置）已按工单 §「消费前
   钉死」口径解释，本轮未改动原文（改动属工单级裁定，不在 P0 范围）。

## 四、已由上游/现有实现覆盖（无需施工）

composer dock（上游）、thinking 折叠、失败强显、diff 呈现、recap 折叠/展开、footer 退化、
resume/reload、顿号卡片（源已落地，实机 NOT TESTED）。

## 五、最多三项需用户目验裁决

1. **D1 是否立下一张最小工单**（TUI-1-S3-LIVE：恢复成功内置工具目行收敛）——
   是「真实 review 摩擦」，但改动触及 PATCHES 登记与接线语义，需裁定。
2. 顿号卡片（含标注小标签）实机渲染是否补一次目验（本轮模型未自然输出卡片）。
3. `fixtures/tui/baseline/GHOSTTY-BASELINE.md`（DRAFT 空表）是否用本轮 R0–R6 实机证据
   回填为用户侧记录（写者与验收者分离，由你决定由谁填）。

## 六、下一步

- 若 D1 裁定立单：下一张工单仅含该切片（组件级接缝、登记 PATCHES、removalCondition、
  自动门 + Ghostty 目验门），继续写者/验收者分离。
- 若裁定观察：D1 记入 usage-log，等待更多使用证据。
- 正典本轮零新增；网页 session 内容本轮不晋升正典。

## 七、状态

```text
MOTTO-TUI-FULL-SESSION-P0 — READY_FOR_USER_REVIEW

CANON_CONSUMED                 ✅
REAL_TUI_DOGFOODED             ✅ (Ghostty 1.3.1 alt-screen 实机, 后台按键驱动)
COMPOSER_DOCK_VERIFIED         ✅
REFERENCE_SERIES_PREPARED      ✅ (R0–R6)
SEMANTIC_BOUNDARIES_PRESERVED  ✅
PRODUCT_CODE_UNCHANGED         ✅ (仅新增 docs 两文件)
NEXT_TICKET_DRAFTED            ✅ (TUI-1-S3-LIVE, DRAFT)
USER_VISUAL_ACCEPTANCE         ⏳
```

局限（如实）：computer-use 门禁关闭 → 鼠标拖选与滚轮路由未实机驱动；80/100/120/200 列
以自动门覆盖；diff 配色沿用既有基线。证据链与研究记录同文件。
