# 工单：MOTTO-TUI-3 — Alternate-Screen 固定底栏（composer 行固定在下方）

- 日期：2026-08-11
- 类型：工单登记（TUI 续行；调研前置，不急于实现）
- 状态：REGISTERED → 调研完成 → 结构验证完成 → REOPENED / P0 FRAME TRACE →
  **P1 ACCEPTED WITH LIMITATIONS**（2026-08-13）
- 原定调（2026-08-11）：**不实现**——composer 固定底栏结构已由上游实现并入 fork 基线；
  2026-08-13 因真实使用回报 composer 仍会上下跳跃、闪烁，原定调前提只对“分栏结构”成立，
  不足以证明“屏幕坐标稳定”，本单据此重开（见 §8）。
- 执行与验收：Motto 施工；Luna 视觉复验；独立定向测试复核
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

> ⚠️ 历史快照：本表为 2026-08-13 重开时的中间态（trace 尚未完成）；**最终状态以 §8.4/§8.5
> 为准**。保留本表只为记录重开时点的事实，不代现行结论。

```
P3_0_CONSUME_SOURCE       ✅ 已完成(2026-08-11)——功能=上游 ea1e77e2d,已入 fork v0.84.1
T3_1_VERIFY_DOCK          ⚠️ 结构断言已完成；动态高度/相邻 frame 坐标稳定未覆盖
T3_2_CONTROLLED_UPGRADE   ✅ MOTTO-UPGRADE-1 已吸收至 base 534bcbffb
T3_P0_FRAME_TRACE         ⏳ footer/status/pending/widget/editor/rebind 连续 frame 确定性复现
COMPOSER_COORD_STABILITY  NOT ESTABLISHED
MAIN_SCREEN_UNCHANGED     NOT TESTED（本次重开尚未施工）
BASELINE_GREEN            NOT TESTED（本次重开尚未施工）
GHOSTTY_INTERACTIVE_BASELINE ⏳ 需连续捕获，不以单张静态截图替代
```

终态只允许 ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED；未覆盖项标 NOT TESTED，
不得记为 PASS。

## 7. 修订

- **2026-08-11 侦察定调**：本单从「待实现布局系统」改为「验证 + 受控升级」。功能已在上游
  `ea1e77e2d` 实现并随 v0.84.1 进入 fork；不建任何新布局代码、不登记布局 PATCHES。
  依据 `/tmp/tui-3-source-map.md`。

## 8. 2026-08-13 重开：composer 坐标稳定性

### 8.1 重开依据

真实使用回报：composer 虽在底部 dock 内，仍会在运行中上下跳跃并出现闪烁。该观察使旧裁定
“结构已存在，所以不实现”的充分性失效：固定 dock 只保证 composer 不随 transcript 滚走，
不保证 dock 子项动态变高/变矮时 composer 的屏幕坐标稳定。

usage-log：`docs/usage-log/2026-08.md`「composer 固底结构存在但坐标仍跳跃/闪烁」。
开源调研：`docs/research/2026-08-13-tui-composer-dock-stability.md`。

### 8.2 本仓候选 trace（待 P0 机械证明；已被 §8.5 证实取代）

当前 dock 为 `basis: "auto"`，其高度由 pending/status/widgets/editor/footer 共同决定。
Motto footer 正常为单行；`resetExtensionUI()` 会先恢复原生 footer，而原生 footer 固定两行、
有 extension status 时可为三行，随后 Motto 在 extension bind 中再注册单行 footer。若中间态被
render，composer 会随 dock 高度先上移再下移。editor 多行化与 belowEditor widget 显隐也会
改变其 Y 坐标。

这是源码支持的 `CANDIDATE ROOT CAUSE`，尚无逐帧捕获，不能记为已证根因。
**2026-08-13 P0 逐帧 trace 后升级为 STRONGLY_SUPPORTED（接缝机制 PROVEN、端到端
NOT_TESTED，见 §8.5）；本段保留作重开历史脉络。**

### 8.3 P0（先复现，不施工；2026-08-13 只读复验完成，见 §8.5）

1. ✅ 以 VirtualTerminal/RecordingTerminal 捕获连续 frame，覆盖 footer 1→2/3→1、status、
   pending、belowEditor widget、editor 多行、reload/rebind、resize（80×24，含高度 resize）。
2. ✅ 每帧记录 composer/editor rect 与 footer 底边；明确区分“多行输入向上增长”的预期变化
   与无用户动作的非预期跳跃（editor 多行 top 上移、bottom 恒 23 = 预期；footer rebind 引起
   的 composer 先上移再回位 = 非预期跳跃，即用户回报现象）。
3. ✅ 证明一次 logical rebind 产生可见中间 frame——`tui3-p0-rebind-frame.test.ts`（2026-08-13
   返工新增）机械复现 **footer 替换接缝机制**（FOOTER_REPLACEMENT_SEAM_MECHANISM PROVEN）：
   驱动 `resetExtensionUI → 原生两行 footer → 单行 footer`（真实原型方法 + 真实
   `FooterComponent` + 真实 alt-screen 渲染管线 + RecordingTerminal 80×24），受控异步间隙
   捕获 footer 1→2→1、composer y20→y19→y20 中间可见帧；mutation proof：原子替换后中间帧
   消失、断言翻转（早期锚定 mutation 见 §8.5④，已被本测试取代）。**注意：非完整生产 rebind
   链**（END_TO_END_RUNTIME_REBIND NOT_TESTED，见 §8.5）——未驱动
   runtimeHost→rebindCurrentSession→bindExtensions→session_start，用测试内 dummy footer，
   未过完整 init() 布局，20ms 为 wall-clock 非严格 barrier。
4. ⏳ Ghostty 实机以连续捕获复核 60/80/120 列；单张最终截图不足以判 PASS。本轮 P0 为
   80×24 RecordingTerminal（临时 harness 已删），未覆盖实机多列；留待最小修复施工后的
   USER_ACCEPTANCE 阶段。

P0 只有在 trace 指向明确机制后才授权最小修复。优先候选是把 extension UI reset、footer
替换与最终 requestRender 合为一次可见 frame；不复制 Codex/OpenCode 框架，不建第二套
composer/session pipeline，不用 timer debounce 掩盖中间态。
**P0 后该候选已授权**（IMPLEMENTATION_AUTHORIZED，授权范围见 §8.5）。本段记录授权时点；
P1 后续已实施并验收，现状见 §9/§10。

### 8.4 重开验收态（2026-08-13 P0 trace 后更新；更新前中间态见下方注）

```text
OPEN_SOURCE_RESEARCH       ✅ Codex CLI / OpenCode 源码核实；Grok Build 仅行为参照
STATIC_DOCK_STRUCTURE      ✅ 既有能力，不撤销
DYNAMIC_FRAME_TRACE        ✅ 80×24 RecordingTerminal 逐帧 trace（2026-08-13）：
                           footer 1→2→3→1 ↔ composer y20→y19→y18→y20；flush 逐 logical
                           update +1（一次可见 frame）；fullRedraw 恒 2；reload/resume 与
                           first-turn 逐位一致；resize 跟随终端高（h20/h30 → y16/y26）
FOOTER_REPLACEMENT_SEAM_MECHANISM  PROVEN（`tui3-p0-rebind-frame.test.ts`：reset 恢复
                           原生多行 footer 在异步间隙以可见中间帧上屏、composer
                           y20→y19→y20；原子替换后中间帧消失）
END_TO_END_RUNTIME_REBIND          NOT_TESTED（未驱动 runtimeHost→rebindCurrentSession→
                           bindExtensions→session_start；手动 reset→waitForRender→
                           setExtensionFooter，测试内 dummy footer，未过完整 init() 布局）
ROOT_CAUSE                 STRONGLY_SUPPORTED（源码链 + 接缝机制复现 + 用户实机现象一致；
                           端到端链未机械复现，不足以 PROVEN；详见 §8.5）
IMPLEMENTATION             AUTHORIZED ✅（授权范围仅限 §8.5 候选最小修复：reset + footer
                           替换 + 最终 requestRender 合为一次可见 frame；不触碰
                           layout.ts/stack.ts/tui-alt-screen.ts 渲染差分、agent loop/
                           session/工具；不复制 Codex/OpenCode 框架、不建第二套 composer、
                           不用 timer debounce）
USER_ACCEPTANCE            ⏳（留待最小修复施工后的 Ghostty 实机复核 60/80/120 列）
```

> 更新前中间态（历史）：DYNAMIC_FRAME_TRACE ⏳；ROOT_CAUSE CANDIDATE（未逐帧证明）；
> IMPLEMENTATION NOT AUTHORIZED UNTIL P0 TRACE。

### 8.5 2026-08-13 P0 trace 结论（接缝机制 PROVEN / 端到端 NOT_TESTED / ROOT_CAUSE STRONGLY_SUPPORTED）

只读复验（RecordingTerminal 80×24 + `InteractiveMode.prototype.mountInteractiveTui` 真实
挂载 + `renderLayoutFrame` 逐帧记录 rect/scrollTop/flush/fullRedraw；临时 harness 已删，
权威报告 `/private/tmp/motto-tui4-s3-compact/TUI-3-P0-FRAME-STABILITY-report.md`）完成
§8.3 P0 主体，机制主张与源码互证（`packages/coding-agent/src/modes/interactive/` 的
resetExtensionUI→setExtensionFooter(undefined)→原生两行 footer→extension bind（异步）→
registerFooter 单行 footer 链路；`requestRender` 同 tick 合并；dock `basis:"auto"` +
transcript `grow:1`）。

**接缝机制机械复现（2026-08-13 返工新增）**：评审指出报告只展示了手动 footer 高度变化、
mutation proof 只验证 dock anchoring，未驱动真实 reset/rebind 链。返工新增确定性测试
`packages/coding-agent/test/tui3-p0-rebind-frame.test.ts`，机械复现 **footer 替换接缝
机制**（FOOTER_REPLACEMENT_SEAM_MECHANISM **PROVEN**），但**不构成完整生产 rebind 链**
（END_TO_END_RUNTIME_REBIND **NOT_TESTED**）：

- 驱动对象 = 真实 `InteractiveMode.prototype.resetExtensionUI` / `setExtensionFooter` +
  真实内置 `FooterComponent`（真实 `AgentSession` + `FooterDataProvider`）+ 真实
  `createInteractiveTui` alt-screen 渲染管线 + RecordingTerminal 80×24；`resetExtensionUI`
  非 footer 成员为惰性桩（不参与本机制）。
- 序列 = 手动 `resetExtensionUI()` → `waitForRender()`（受控异步间隙，渲染计时器
  MIN_RENDER_INTERVAL_MS=16 先落盘，re-register 尚未发生）→ `setExtensionFooter(custom)`
  re-register。
- 捕获 = footer 1→2→1 行、composer y20→y19→y20：原生两行 footer 以可见中间帧上屏、
  composer 先上移再回位——footer 替换接缝机制机械复现。
- mutation proof = 原子替换（改法 b 模拟：reset 时以高度恒定占位替代原生 footer）后中间帧
  消失、composer 恒 y20，原断言翻转——证明测试对该机制敏感、非空转；该测试即 §9 最小修复
  单的验收测试（修复落地后翻转断言为「rebind 期间 composer rect 不变」）。注：§9 的
  `MOTTO_CUSTOM_FOOTER_HEIGHT_CONTRACT = 1`（用户 2026-08-13 裁定）已把改法收紧为
  custom→custom 全程 1→1、不恢复原生多行 footer、不新增 placeholder row——上述占位仅作
  mutation 探针，非修复方案。

**未覆盖（END_TO_END_RUNTIME_REBIND NOT_TESTED，如实标注）**：测试手动执行
`resetExtensionUI → waitForRender → setExtensionFooter`，未驱动生产链
`runtimeHost → rebindCurrentSession → bindExtensions → session_start`；extension 为测试
内 dummy 单行 footer（非 Motto extension 本体）；未经过完整 `InteractiveMode.init()`
布局；20ms 等待为 wall-clock 控制，非严格确定性 barrier。端到端复现留待施工后（§9 验收
清单，或另立 e2e 测试单）。

四条已证 trace：

1. **footer 1→2→3→1 ↔ composer rect**：composer（editor）位于底部 dock VStack
   （basis:"auto"，transcript grow:1），其屏幕 Y = viewport_height − 下方 surface
   （widgetBelow + footer）高度。footer 1→2→3→1 行：composer y20→y19→y18→y20（bottom
   23→22→21→23）；belowEditor widget 显隐：y20→y19→y20；editor 多行 1→4：top 上移、
   bottom 恒 23（底边锚定，向上增长）。
2. **resetExtensionUI → 异步 rebind → 中间可见 frame**：真实链路 = `resetExtensionUI()` →
   `setExtensionFooter(undefined)` 恢复原生两行 footer → extension bind（异步 await）→
   `registerFooter` 重新注册 Motto 单行 footer。异步间隙若被 render，原生两行中间态可见 →
   composer 先上移再回位 = 用户报告的「上下跳跃、闪烁」。这是 **ROOT_CAUSE
   （STRONGLY_SUPPORTED）**——接缝机制已机械复现（上），端到端生产链未跑通（NOT_TESTED）。
3. **同 tick requestRender 合并**：同一同步块内 footer 1→2→1 只产生 1 次 flush
   （COALESCE_SAME_TICK=1）——既有 requestRender(nextTick 合并)已能折叠同 tick 变更；根因
   不在同 tick，而在 reset 与 re-register 之间的异步间隙。这也是 MINIMAL_PATCH_BOUNDARY
   的依据：最小修复 = 让 footer 1→2→1 过渡在同一可见 frame 内完成（复用 requestRender
   合并；或延后原生 footer 的可见化至 Motto 单行 footer 就位后）。
4. **mutation proof（早期，锚定链）**：将 dock 改回「非锚定（transcript+composer 均自然
   高）」旧链后，tool full→index 使 composer 随内容漂移（bottom 变化）→ 稳定高度断言失败；
   恢复锚定链后通过。证明测试能抓住旧链。**rebind 链本身的 mutation proof 见上方「机械
   证明」（原子 rebind 后中间帧消失、断言翻转），锚定 mutation 已被其取代。**

FRAME_TRACE 摘要（80×24）：各阶段 composer=y20/h3 footer=y23/h1；flush 逐 logical update
+1（一次可见 frame）；fullRedraw 恒 2（alt 进屏清屏+首帧清屏，仅 resize 追加清屏）；
reload/resume 与 first-turn 逐位一致；resize-h20/h30 composer y16/y26 跟随终端高。中生命
周期全为差分增量、无全空帧、无 stale 行。

MINIMAL_PATCH_BOUNDARY：布局原语（VStack 分配、transcript grow + dock basis:auto、bottom
锚定）**正确，无需改动**——正是它保证了 tool full→index、first turn、reload/resume、宽度
resize 下 composer/transcript rect 稳定。唯一缺口在 reset 与 re-register 之间的异步间隙。

IMPLEMENTATION_AUTHORIZED ✅——授权范围仅限上述候选最小修复（reset + footer 替换 + 最终
requestRender 合为一次可见 frame；或延后原生 footer 可见化至 Motto 单行 footer 就位后）；
不触碰 layout.ts / stack.ts / tui-alt-screen.ts 渲染差分、agent loop / session / 工具；
不复制 Codex/OpenCode 框架、不建第二套 composer、不用 timer debounce。

证据边界：逐帧数字以报告为准，机制经源码互证；footer 替换接缝机制经返工确定性测试机械复现
（可重放），**但该测试不是完整生产 rebind 链**（END_TO_END_RUNTIME_REBIND NOT_TESTED，
见上）。报告其余面（status/pending/widget/editor 多行/reload/resume/resize 的逐帧 rect 与
flush 计数）仍为 80×24 RecordingTerminal 报告记录，临时 harness 已删不可重放。Ghostty
实机 60/80/120 列连续捕获未在本轮覆盖，留待最小修复施工后的 USER_ACCEPTANCE 阶段。

## 9. P1 最小修复单（IMPLEMENTED — ACCEPTED WITH LIMITATIONS）

> 本节原为施工范围预登记。2026-08-13 已按合同实现并完成自动与 Ghostty 复验；现状由本节
> 与 §10 共同落账。Core patch 登记为 `tui-3-atomic-footer-replacement`。

### 修复合同（MOTTO_CUSTOM_FOOTER_HEIGHT_CONTRACT = 1，用户 2026-08-13 裁定）

```text
MOTTO_CUSTOM_FOOTER_HEIGHT_CONTRACT = 1

- custom→custom rebind：全程 1→1，无 native 中间帧
- custom→native：bind 结束后允许一次原子 1→2/3
- native→custom：允许一次原子 2/3→1
- bind 失败/取消：一次原子 fallback，不得先 1→2→1
- 仅最终 footer 拓扑改变时允许 composer 一次有定义的位置变化
```

解读（施工时的硬边界）：

- **合同只约束 custom footer 的高度，不约束原生 footer 本身**：custom 会话下 custom→custom
  rebind 全程 1→1、无 native 中间帧；但 custom→native（bind 结束后）与 native→custom
  （新会话接上 custom）是**合法拓扑转换**，允许一次原子 1→2/3 / 2/3→1——「custom 高度恒
  1」与「无 custom 时回落原生」因此不再矛盾。
- **Motto custom footer 投影**：自行消费 `footerData.getExtensionStatuses()`（已实现），
  多状态**稳定排序** + **单行内 bounded truncate**；不新增 placeholder row。
- **core 只提供原子 footer replacement 接缝**：任何转换（1→1 / 1→2/3 / 2/3→1 /
  fallback）都是**一次可见提交**，无中间帧、无 1→2→1 抖动。
- **core 生态 fallback（不假定 Motto 恒在）**：
  - rebind 期间保留当前 footer，禁止 native 中间帧；
  - 新 extension footer 注册后原子 commit；
  - 若新会话没有 custom footer、bind 失败或取消，一次原子 fallback 到 native footer，
    不得先 1→2→1；
  - core 不得假定 Motto 永远安装或一定重新注册；
  - 不得让旧 session footer 永久残留。
- **composer 位移规则**：仅最终 footer 拓扑改变（1→2/3 或 2/3→1）时允许 composer 一次
  有定义的位置变化；custom→custom 期间 composer rect 全程不变。
- canonical/session/tool payload 逐字节不变；不建第二套 composer/session pipeline。

### 目标

按 `MOTTO_CUSTOM_FOOTER_HEIGHT_CONTRACT = 1`：custom→custom rebind 全程 footer 1→1、
无 native 中间帧，composer 不再出现「先上移再回位」的抖动（用户回报现象）；custom→native /
native→custom / bind 失败回落均为**一次原子拓扑转换**，composer 仅在有定义的拓扑改变时
移动一次。改造后 composer 仅在最终 footer 拓扑改变与用户主动输入（editor 多行向上增长）
及 belowEditor widget 显隐等**有定义**的预期变化时才移动。

### 边界

- 目标文件：`packages/coding-agent/src/modes/interactive/interactive-mode.ts`（原子 footer
  replacement 接缝）与 `packages/motto/extensions/motto/`（`core.ts` `buildFooterLine` +
  `index.ts` `registerFooter`：extension statuses 投影进单行）。具体最小面以施工时逐帧验证
  为准。
- 实现分工（合同明定）：**extension 实现投影策略**（消费 `getExtensionStatuses`，稳定排序
  + bounded truncate）；**core 只提供原子 footer replacement 接缝**——任何 footer 拓扑
  转换（1→1 / 1→2/3 / 2/3→1 / fallback）均为一次可见提交；custom→custom 不落回原生多行
  footer；**含生态 fallback**——无 custom footer / bind 失败 / 取消时一次原子回落原生
  footer（见合同）。
- 原「改法候选 a/b」已由合同取代：a（同 tick 合并）不再必要——custom→custom 要求根本不
  落回原生多行 footer；b（延后原生 footer 可见化）被「原子拓扑转换」取代（custom→native /
  native→custom 允许一次原子 1→2/3 / 2/3→1，只是不得出现 1→2→1 抖动）。
- 不触碰：layout.ts / stack.ts / tui-alt-screen.ts 渲染差分；agent loop / session / 工具；
  canonical/session/tool payload；不建第二套 composer/session pipeline；不复制
  Codex/OpenCode 框架；不用 timer debounce 掩盖中间态。
- 变更按 PATCHES.json 一 commit 一 patch 登记（removalCondition 见上；core 接缝与
  extension 投影可分列为两条 patch，或合一条按施工裁定）。

### 关键不变量

- custom 会话下 footer 恒 1 行（底边恒 terminal H-1）；composer bottom 恒锚定（= H-1）；
  所有 dock rect 不越界、不留 stale 行。
- custom→custom rebind 全程无 native 2/3-line 中间帧、无 placeholder row；同批状态更新
  最多一次可见提交（COALESCE_SAME_TICK=1）。
- 任何拓扑转换（含 fallback）为一次原子可见提交：custom→native 恰一次 1→2/3、
  native→custom 恰一次 2/3→1、bind 失败/取消恰一次 fallback（不得 1→2→1）。
- extension statuses 经 Motto 单行 footer 投影后仍可见（稳定排序、bounded truncate，不丢
  状态语义）。
- editor 多行向上增长（bottom 不变）仍允许；pending/status 等 above-editor surface 变化
  不得移动 composer。
- reload / resume / rebind / first-turn 的 composer rect 逐位一致；resize 跟随终端高。

### 测试 / 门禁

- 定向测试：`packages/coding-agent/test/tui3-p0-rebind-frame.test.ts` 已翻转为修复后合同：
  custom→custom 全程 footer 1→1、composer rect 不变、无原生中间帧；mutation proof 保留
  （改回 custom→custom 立即落回原生多行 footer 的旧链必须失败）。
- **拓扑转换测试矩阵**（合同四类，已补齐）：
  - custom→custom：全程 1→1，composer rect 不变；
  - custom→native：bind 结束后一次原子 1→2/3，composer 一次有定义位移；
  - native→custom：一次原子 2/3→1，composer 一次有定义位移；
  - bind 失败/取消：一次原子 fallback，不得先 1→2→1。
- 新增 extension 投影测试：`getExtensionStatuses()` 多状态稳定排序 + 单行 bounded truncate
  （40/60/80/120/200 列零超宽），状态不因宽度丢失语义。
- END_TO_END_RUNTIME_REBIND 仍为 NOT_TESTED：本轮未驱动真实 runtimeHost + Motto extension
  bind 的完整端到端链；不得写「完整生产链已机械复现」。
- 另复用 RecordingTerminal + `mountInteractiveTui` + `renderLayoutFrame` 逐帧记录样板
  （`interactive-tui.test.ts` T3-1 段 + 已证报告）。
- `npm run check`；`git diff --check`；`bash scripts/maint/ci-checks.sh governance`；不运行
  全量 npm test / npm run build。

### 验收

- 测试绿（含拓扑转换矩阵四类）+ mutation proof 通过 + 逐帧证据（custom→custom 一次
  rebind = 一次可见 frame、footer 1→1；拓扑转换恰一次原子提交）落验收报告；extension
  statuses 在单行 footer 可见且排序稳定；
- Ghostty 实机 60/80/120 列连续捕获复核（USER_ACCEPTANCE）：快速 streaming、footer/status
  切换、多行 composer、stream 中 resize 均无 composer 非预期跳跃/闪烁；custom→native /
  native→custom 转换各复跑一次；
- 用户视觉终态为 ACCEPTED WITH LIMITATIONS；具体覆盖与限制见 §10。

## 10. P1 实现与验收收口（2026-08-13）

### 实现

- `interactive-mode.ts`：`resetExtensionUI()` 在 custom footer 在位时只标记 pending，不显示
  原生中间帧；`setExtensionFooter()` 原子解析替换；`commitFooterAfterRebind()` 在无新 custom
  footer、bind 失败或取消时一次回落原生 footer。`rebindCurrentSession()` 与 `/reload` 均有
  commit 点，core 不假定 Motto 恒安装。
- `/reload` 收尾统一经 `dismissReloadBox()` 对 editor/footer tree `invalidate()` 并
  `requestRender(true)`，保证清屏后无额外输入也提交最终 footer 行。
- Motto `buildFooterLine()` 同行投影 `getExtensionStatuses()`：按 key 排序、净化、有界截断；
  status 与 TPS 同为 priority 3 且放在其后，同级退化先弃 status，120 列不再吞 TPS。
- canonical/session/tool payload、layout/stack/tui-alt-screen、agent loop/provider/内置工具语义
  均未改变。

### 自动证据

```text
packages/coding-agent:
  tui3-p0-rebind-frame.test.ts + interactive-tui.test.ts  18/18 PASS
packages/motto/extensions/motto:
  tps + footer-degrade + motto                         22/22 PASS
```

`tui3-p0-rebind-frame` 覆盖 custom→custom、custom→native、native→custom、bind fallback、
reload 最终帧与旧链 mutation。Motto 组合矩阵覆盖 single/multi status × 40/60/80/120/200，
断言零超宽、稳定排序、120 保 TPS、200 TPS/status/model 同见。

### Ghostty 证据与终态

证据位于 `/private/tmp/motto-tui3-p1-evidence/`：60/80 列 `/reload` 各 6/6 帧 footer 可见且
组内 PNG hash 一致；120 列两项 status 同行可见；200 列 settled TPS、两项 status 与模型信息
同时可见；streaming 连拍 footer 未消失、未闪烁。启动门禁确认 Motto 牌记、单行 footer、
`deepseek-v4-flash · max`，排除了先前错误 dogfood 环境中的原生 Pi/no-models 画面。

```text
MOTTO-TUI-3-P1                 ACCEPTED WITH LIMITATIONS
ATOMIC_FOOTER_REPLACEMENT      PASS
RELOAD_FINAL_FRAME_FLUSH       PASS
MOTTO_CUSTOM_FOOTER_HEIGHT_1   PASS
TPS_STATUS_PRIORITY            PASS
CANONICAL                      UNCHANGED BY IMPLEMENTATION
```

限制：完整 runtimeHost 端到端 rebind、native→custom/custom→native Ghostty、40 列 Ghostty、
fresh→reload→resume 全宽矩阵与 canonical JSONL 逐字对照未测；composer rect 的 Ghostty 像素坐标
未机械读取。以上均不得补写为 PASS。
