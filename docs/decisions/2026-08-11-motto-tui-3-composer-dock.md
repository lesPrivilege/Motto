# 工单：MOTTO-TUI-3 — Alternate-Screen 固定底栏（composer 行固定在下方）

- 日期：2026-08-11
- 类型：工单登记（TUI 续行；调研前置，不急于实现）
- 状态：REGISTERED → 调研完成（P3-0 已达成：功能已在 fork 内，属上游 v0.84.1）
- 定调（2026-08-11 侦察结论）：**不实现**——composer 固定底栏已由上游实现并入 fork 基线；本单转为
  「验证 + 受控升级」
- 执行者认领：（未认领；写者与验收者分离，同仓同时至多一个写者）
- 依据：用户指令（2026-08-11，TUI 增加一笔：composer 行固定在下方）；旧 session 提点
  `~/Projects/pi/tui-plan.md`（Alternate-Screen Layout System Plan，实现交接稿）；
  `docs/architecture/TUI-SURFACE-MATRIX.md` S15（input composer 现属 EXTENSION_NATIVE，零需求）

## 0. 定名与范围

**目标**：alt-screen 下 transcript 可滚动，而 **pending/status/widgets/editor(composer)/footer
组成的底栏固定在下缘**——composer 行不再随 transcript 一起滚出屏幕。

- 依赖面在 `packages/tui` 的**约束布局原语**（VStack / HStack / ScrollView + 内部布局引擎），
  再以薄接缝接入 `interactive-mode.ts`（documentContainer 滚动区 + footerContainer 固定 dock）。
- 完整设计见 `~/Projects/pi/tui-plan.md`（旧 session 的实现交接稿，本单以它为范围真源；
  实施中如与实现发现冲突，回仓修订该稿而非另起炉灶）。

**明确不做（本单）**：main-screen 改造（终端 scrollback 语义不动）；CSS 兼容 flexbox / grid /
虚拟化 transcript / 布局树增量变更 / 自定义组件布局 API；不重做既有 overlay、选区、IME、
hyperlink、Kitty image 子系统（只保证不回归）。

## 1. 前置 P3-0：消费 + 摸到其源码（✅ 已完成，2026-08-11）

旧 session 已提点，此处只消费并摸源码，不施工：

- 消费：`~/Projects/pi/tui-plan.md` 全文（Purpose / Core decisions / Public API / Internal layout /
  painting / input routing / focus / selection / images / overlays / interactive-mode changes /
  test plan / acceptance criteria / 实施顺序）。
- 摸源码（只读）：`packages/tui/src/tui-alt-screen.ts`（scrollTop/stickToBottom/overlays/selection/
  cursor/差分写）、`packages/tui/src/tui.ts`（TUI 接口）、`interactive-mode.ts` 各 container
  组合与 editor 放置、`packages/tui/src/components/` 是否有现成 stack/scroll 原语、上游
  `upstream/main` 是否已有等价布局能力或 PR。
- 产出：源码地图 + 上游评估（存在/缺失/是否 upstream-first 立项）。

**做法取向（用户指令）**：不必急于实现；**可以借助开源 TUI 项目实现**——即上游优先：
布局原语属可上游化通用能力，先对 `earendil-works/pi` 提 issue/PR；确需入下游的部分按
PATCHES.json 制度登记（removalCondition = 上游吸收后删除）。

**P3-0 侦察结论（关键）**：
- 该功能即上游 commit `ea1e77e2d` feat(tui): add alternate-screen viewport layouts（Mario
  Zechner，2026-07-31），位于 v0.84.1（`53fa77ccd`）之前——**fork 基线已完整包含**。
- 源码地图（逐行验证）：`packages/tui/src/tui-alt-screen.ts`（`ViewportTUI`/`setLayoutRoot`/
  `layoutRoot`/`currentLayout`/`implicitScrollView`/`routeWheel` 链式路由/`doRender` 原子提交）、
  `tui.ts`（`VIEWPORT_TUI` 符号/`isViewportTUI`）、`layout.ts`/`layout-node.ts`/
  `components/{stack,v-stack,h-stack,scroll-view}.ts`（与上游逐字节一致，fork 零布局改动）；
  `interactive-mode.ts`：`documentContainer`(header+loaded+chat)→`transcriptScrollView`、
  dock `VStack`(pending/status/widgets±/editor/footer)→`fullscreenLayoutRoot`，
  `mountInteractiveTui` 在 `isViewportTUI` 时 `setLayoutRoot`，`setExtensionFooter` 已容器内替换。
- 主屏 `tui-main-screen.ts` 无 layout/ViewportTUI——符合计划「main 不动」硬约束。
- 上游 v0.84.1 之后的 alt-screen 增量（受控升级候选，非新工单）：`alt-screen-search.ts`
  (#7913)、单行滚动 (#7903)、失焦免重绘 (#7892)、全宽行零重合成 (18dee5f0a)。

## 2. 施工切片（调研完成后的定稿——从「实现」改为「验证 + 受控升级」）

- **T3-1 验证**：确认 fork 产物在真实 Ghostty 下 composer 行固定在下方、transcript 滚动、
  流式 follow 末尾、滚轮按指针路由——补一条 `interactive-tui.test.ts` dock 结构集成断言
  （现有断言较薄），并记入 GHOSTTY-BASELINE 用户侧。
- **T3-2 受控升级**：按 motto-maintenance 流程拉取上游 v0.84.1 后的 alt-screen 增量
  （#7913 alt-screen-search / #7903 单行滚动 / #7892 失焦免重绘 / 18dee5f0a 全宽零重合成），
  与常规上游升级同门（升级验收门见 docs/maintenance）。
- （后续面）宽终端 sidebars、sticky top、布局感知 overlay、未读指示——见 tui-plan
  "Future uses"，非本单范围。

## 3. 验收门（拟议）

- main-screen：行为与输出顺序逐字节不变（terminal scrollback 语义）。
- alt-screen：transcript 滚动 + 底栏固定；流式只在 follow 态跟随末尾；手动滚动期间新输出不跳。
- 交互：滚轮按指针下区域路由并 chain；鼠标禁用时键盘滚动可用（pageUp/pageDown/top/bottom）。
- 焦点/IME：editor/selector 焦点与光标行含 stack/scroll 偏移后仍正确；被裁剪叶含
  CURSOR_MARKER 时不丢光标。
- 不回归：overlays、选区/复制、OSC8 点击、Kitty image 垂直滚动、退出 alt 打印完整终稿一次。
- 基线：40/60/80/120/200 列四主题零超宽；coding-agent 全量测试 + `npm run check` 绿。
- 交互面：Ghostty 用户侧记录（GHOSTTY-BASELINE，与 TUI-1/TUI-2 同表）。

## 4. patch 制度与 dogfood

- 布局原语与集成改动按 PATCHES.json 一 commit 一 patch、removalCondition、单点可回退；
  可上游化的通用能力先走上游。
- dogfood 经 `motto-dev` 候选构建自用，摩擦写 `docs/usage-log/`。

## 5. 硬边界

- 不改 agent loop / provider / session canonical schema / 内置工具语义。
- 不重注册内置工具、不 shadow transcript、不手改 node_modules。
- 投影零写回、不入模型上下文。
- 无 Motto 投影的组件逐字节回落原生；main-screen 输出顺序不变。
- 不建第二套 composer/session pipeline（Paste Card 等已裁定 NO_GO 的方向不因布局复活）。

## 6. 验收态

```
P3_0_CONSUME_SOURCE       ✅ 已完成(2026-08-11)——功能=上游 ea1e77e2d,已入 fork v0.84.1
T3_1_VERIFY_DOCK          ⏳ 真实 Ghostty 目验 + dock 集成断言补强
T3_2_CONTROLLED_UPGRADE   ⏳ 上游 v0.84.1 后 alt-screen 增量(随 motto-maintenance)
MAIN_SCREEN_UNCHANGED     ⏳ main 逐字节不变(上游已满足,验证确认)
BASELINE_GREEN            ⏳ render-baseline --check + 零超宽
GHOSTTY_INTERACTIVE_BASELINE ⏳ 用户侧
```

终态只允许 ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED；未覆盖项标 NOT TESTED，
不得记为 PASS。

## 7. 修订

- **2026-08-11 侦察定调**：本单从「待实现布局系统」改为「验证 + 受控升级」。功能已在上游
  `ea1e77e2d` 实现并随 v0.84.1 进入 fork；不建任何新布局代码、不登记布局 PATCHES。
  依据 `/tmp/tui-3-source-map.md`。
