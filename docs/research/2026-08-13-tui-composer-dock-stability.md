# TUI composer 固底稳定性调研（Codex CLI / OpenCode / Grok Build）

- 日期：2026-08-13
- 类型：只读开源调研；为既有 `MOTTO-TUI-3` 重开提供参照，不直接授权施工
- 触发：Motto dogfood 中 composer 虽位于独立 dock，仍会在状态切换时上下跳跃、闪烁
- 调研者：Luna 独立 subagent；架构裁决：主验收 agent

## 1. 问题改写

旧 TUI-3 已证明 alt-screen 具有 `transcript ScrollView + dock VStack`，但这只证明 composer
不会随 transcript 滚出屏幕，不等于 composer 的屏幕坐标稳定。当前 dock 的 intrinsic height
会随 pending/status/widgets/editor/footer 改变；任一子项在相邻帧改变高度，composer 都会重新
分配 Y 坐标。

本轮只调研三个问题：

1. transcript 与 bottom pane 如何分配高度；
2. streaming / resize / 动态 footer 如何保持底部锚；
3. 一次状态变更如何避免中间布局态上屏。

## 2. 开源实现

### 2.1 Codex CLI — VERIFIED

公开源码：

- [`chatwidget/rendering.rs`](https://github.com/openai/codex/blob/main/codex-rs/tui/src/chatwidget/rendering.rs)：
  transcript 为弹性区，bottom pane 为非弹性底部区；active cell 以可用 transcript 底部为锚。
- [`bottom_pane/mod.rs`](https://github.com/openai/codex/blob/main/codex-rs/tui/src/bottom_pane/mod.rs)：
  status/footer/pending preview/composer 组成同一个 bottom pane；`desired_height(width)` 与实际
  render 使用同一 renderable，避免测量与绘制各走一套逻辑。
- [`app.rs`](https://github.com/openai/codex/blob/main/codex-rs/tui/src/app.rs) 与
  [`tui.rs`](https://github.com/openai/codex/blob/main/codex-rs/tui/src/tui.rs)：每帧按当前宽度
  重算高度；resize reflow 保留 bottom-aligned 状态；终端绘制使用 synchronized update，将
  viewport 更新、清理与绘制合并提交。

简化 trace：

```text
stream delta / resize
→ active-cell revision + redraw request
→ desired_height(current width)
→ transcript 取得余量，bottom pane 取得当前高度
→ 同一 synchronized frame 清理并绘制
```

可消费的是“同源测量 + 单帧提交 + bottom-aligned reflow”，不是 Rust/Ratatui 类型结构。

### 2.2 OpenCode — VERIFIED

公开源码（`dev` 分支当前树）：

- [`packages/tui/src/app.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/tui/src/app.tsx)：
  root 使用终端尺寸；内容区 `flexGrow=1, minHeight=0`，底部 slot `flexShrink=0`。
- [`packages/tui/src/routes/session/index.tsx`](https://github.com/anomalyco/opencode/blob/dev/packages/tui/src/routes/session/index.tsx)：
  transcript `scrollbox` 使用 sticky-bottom；permission/question/subagent footer/prompt 位于其后的
  非收缩底部区。

简化 trace：

```text
terminal/session signal
→ root 重新布局
→ transcript flexGrow 占余量
→ prompt/footer flexShrink=0 留在底部
→ sticky-bottom 只在仍处于跟随态时追尾
```

OpenTUI 内部 dirty-region / 双缓冲本轮未核实，记为 `NOT VERIFIED`；其 60 FPS 与 Solid/Yoga
实现不应直接移植，显式延时 `toBottom()` 也不是 Motto 候选。

### 2.3 Grok Build — BEHAVIOR REFERENCE ONLY

[`xai-org/grok-build`](https://github.com/xai-org/grok-build) 与
[`xAI 公告`](https://x.ai/news/grok-build-open-source) 可核实其公开源与 full-screen terminal UI，
但本轮未定位稳定的 composer/viewport 高度分配函数。不得从产品截图反推内部实现；只保留
“composer 视觉稳定”的行为参照。

## 3. Motto 当前 trace

当前根布局：

```text
fullscreenLayoutRoot
├─ transcriptScrollView  basis=0 grow=1 minSize=1
└─ dock                  basis=auto grow=0 minSize=1
   ├─ pending            minSize=0
   ├─ status             minSize=0
   ├─ widgetsAbove       minSize=0
   ├─ editor             minSize=3
   ├─ widgetsBelow       minSize=0
   └─ footer             minSize=1
```

`dock basis=auto` 会重新测量全部子项。至少三条真实路径可改变 composer 的 Y 坐标：

1. editor 从单行输入增长为多行；
2. `belowEditor` widget 出现或消失；
3. `resetExtensionUI()` 先恢复原生 footer，Motto 随后重新注册单行 footer。

第三条尤其具体：原生 `FooterComponent.render()` 固定返回 cwd + stats 两行，存在 extension
status 时可为三行；Motto footer 返回一行。若 reset 与 re-register 之间发生 render，请求会把
dock 从一行 footer 暂时量成两/三行，再回到一行，composer 因而先上移后下移。该因果链由
源码成立，但本轮尚未捕获逐帧终端证据，状态为 `CANDIDATE ROOT CAUSE`，不是已证根因。

现有 T3-1 测试只覆盖静态 transcript/editor/footer，未覆盖以上动态高度转换，也不记录相邻帧
composer rect。因此“dock 结构测试绿”不能证明“composer 坐标稳定”。

## 4. 最小候选机制（不授权施工）

先保持现有布局系统，不新建 composer/session pipeline。候选按优先级为：

1. **原子 rebind**：extension UI reset、footer 替换与最终 requestRender 合并，禁止中间 footer
   高度上屏；这是最小且最贴近已知 trace 的候选。
2. **明确 bottom-pane 契约**：测量与绘制必须消费同一帧的 dock state；一次 logical update 最多
   安排一次 frame。
3. **区分固定底边与固定 composer**：允许多行 editor 向上增长；pending/status/permission 的
   出现不得无定义地穿过 composer。若产品要求 composer 输入框本身固定，则须先裁定附加区应
   放在其上方还是下方，不能只写“dock 固定”。
4. **保持 scroll anchor**：仅在用户仍处于 follow-end 时追尾；手动上滚时 dock 高度变化不得
   改变用户正在阅读的 transcript 锚点。

不候选：复制 Codex renderable 层、复制 OpenCode Yoga root、固定任意像素/行数、用 timer
debounce 掩盖 rebind、建立第二套 composer。

## 5. 下一步验收矩阵

### P0 确定性复现（先于产品修改）

- 使用 VirtualTerminal / RecordingTerminal 捕获连续 frame，而不是只比较最终 viewport。
- 40/60/80/120/200 列 × 多个终端高度。
- 分别触发：Motto footer 1→原生 2/3→Motto 1、status 显隐、pending 显隐、belowEditor
  widget 显隐、editor 1→多行、streaming delta、resize grow/shrink、reload/rebind。
- 每帧记录 editor/composer 顶边、底边与 footer 底边；区分预期的多行向上增长和非预期跳跃。
- mutation proof：人为插入中间 render 时测试必须失败；原子化后通过。

### 自动不变量候选

- footer 底边恒为 terminal `H-1`；所有 dock rect 不越界、不留 stale 行。
- 单次 logical rebind 不出现原生 footer 中间帧；同批状态更新最多一次可见提交。
- follow-end 时 transcript 随 dock 高度重算后仍贴尾；手动上滚时阅读锚保持。
- resize 后按新宽度重算 wrap；composer 草稿与光标不丢失。

### Ghostty 实机

- 60/80/120 列，快速 streaming、footer/status 切换、多行 composer、stream 中 resize。
- 用连续屏幕捕获而非单张截图检查 composer rect，不得仅凭最终静态画面判 PASS。
- `/reload`、session rebind、resume 均覆盖；闪烁与上下跳跃各自记录。

## 6. 调研裁决

```text
OPEN_SOURCE_RESEARCH        COMPLETE
CODEX_SOURCE                VERIFIED
OPENCODE_SOURCE             VERIFIED
GROK_LAYOUT_SOURCE          NOT VERIFIED
MOTTO_STATIC_DOCK           ALREADY_PRESENT
COMPOSER_COORD_STABILITY    NOT ESTABLISHED
CANDIDATE_ROOT_CAUSE        FOOTER/DOCK INTERMEDIATE HEIGHT FRAME
PRODUCT_IMPLEMENTATION      NOT AUTHORIZED BY RESEARCH ALONE
NEXT_STEP                   TUI-3 P0 DETERMINISTIC FRAME TRACE
```

> 上述为调研完成时的裁决（中间态）。P0 逐帧 trace 后，`CANDIDATE_ROOT_CAUSE` 升级为
> **STRONGLY_SUPPORTED**（footer 替换接缝机制 PROVEN、端到端生产 rebind 链 NOT_TESTED）、
> 最小修复已授权（见 §7 与决策单 §8.5）；`COMPOSER_COORD_STABILITY` 在 rebind 期间未建立
> （即用户回报的 bug，正是修复对象）；本节保留作调研历史脉络。

## 7. P0 逐帧 trace 复验结论（2026-08-13）

上节 §6 裁决后，TUI-3 重开单 §8.3 P0 以只读复验完成（临时 harness 已删；权威报告
`/private/tmp/motto-tui4-s3-compact/TUI-3-P0-FRAME-STABILITY-report.md`，5.4KB，
2026-08-13 16:16）。本节回填四条已证 trace，取代 §3 的 `CANDIDATE ROOT CAUSE`——现为
**ROOT_CAUSE STRONGLY_SUPPORTED**（footer 替换接缝机制 PROVEN、端到端生产 rebind 链
NOT_TESTED；结论登记：`docs/decisions/2026-08-11-motto-tui-3-composer-dock.md` §8.5）。

1. **footer 1→2→3→1 ↔ composer rect**：composer（editor）位于底部 dock VStack
   （`basis:"auto"`，transcript `grow:1`），其屏幕 Y = viewport_height − 下方 surface
   （widgetBelow + footer）高度。footer 1→2→3→1 行：composer y20→y19→y18→y20（bottom
   23→22→21→23）；belowEditor widget 显隐：y20→y19→y20；editor 多行 1→4：top 上移、
   bottom 恒 23（底边锚定，向上增长）。
2. **resetExtensionUI → 异步 rebind → 中间可见 frame**：真实链路 = `resetExtensionUI()` →
   `setExtensionFooter(undefined)` 恢复原生两行 footer → extension bind（异步 await）→
   `registerFooter` 重新注册 Motto 单行 footer。异步间隙若被 render，原生两行中间态可见 →
   composer 先上移再回位 = 用户报告的「上下跳跃、闪烁」。这就是 ROOT_CAUSE
   （STRONGLY_SUPPORTED——接缝机制已机械复现，端到端生产链 NOT_TESTED）。
3. **同 tick requestRender 合并**：同一同步块内 footer 1→2→1 只产生 1 次 flush
   （COALESCE_SAME_TICK=1）——既有 requestRender(nextTick 合并)已能折叠同 tick 变更；根因
   不在同 tick，而在 reset 与 re-register 之间的异步间隙。这也是 MINIMAL_PATCH_BOUNDARY
   的依据：最小修复 = 让 footer 1→2→1 过渡在同一可见 frame 内完成（复用 requestRender
   合并；或延后原生 footer 的可见化至 Motto 单行 footer 就位后）。
4. **mutation proof**：将 dock 改回「非锚定（transcript+composer 均自然高）」旧链后，tool
   full→index 使 composer 随内容漂移（bottom 变化）→ 稳定高度断言失败；恢复锚定链后通过。
   证明测试确实能抓住旧链。

FRAME_TRACE 摘要（80×24）：各阶段 composer=y20/h3 footer=y23/h1；flush 逐 logical update
+1（一次可见 frame）；fullRedraw 恒 2（alt 进屏清屏+首帧清屏，仅 resize 追加清屏）；
reload/resume 与 first-turn 逐位一致；resize-h20/h30 → composer y16/y26（跟随终端高，底边
锚定）。中生命周期全为差分增量、无全空帧、无 stale 行。

**footer 替换接缝机制机械复现（2026-08-13 返工）**：评审指出报告只展示手动 footer 高度
变化、mutation proof 只验证 dock anchoring，未驱动真实 reset/rebind 链。返工新增确定性
测试 `packages/coding-agent/test/tui3-p0-rebind-frame.test.ts`：驱动 `resetExtensionUI` /
`setExtensionFooter`（真实原型方法）+ 真实 `FooterComponent` + 真实 alt-screen 渲染管线 +
RecordingTerminal 80×24，在受控异步间隙（渲染计时器先于 re-register 落盘）逐帧捕获 footer
1→2→1 行、composer y20→y19→y20——原生两行 footer 以可见中间帧上屏、composer 先上移再
回位（2/2 通过）；mutation proof：原子替换后中间帧消失、断言翻转。**注意：这只是
FOOTER_REPLACEMENT_SEAM_MECHANISM 的 PROVEN，不是完整生产 rebind 链**——
END_TO_END_RUNTIME_REBIND **NOT_TESTED**（未驱动 runtimeHost→rebindCurrentSession→
bindExtensions→session_start；测试内 dummy footer，未过完整 init() 布局；20ms 为
wall-clock 非严格 barrier）。该测试即最小修复单的验收测试，修复落地后翻转断言为「rebind
期间 composer rect 不变」。修复方案已由用户裁定收紧为 `MOTTO_CUSTOM_FOOTER_HEIGHT_
CONTRACT = 1`（决策单 §9）：custom→custom 全程 1→1、无 native 中间帧；custom→native /
native→custom / bind 失败回落均为一次原子拓扑转换；Motto footer 自行投影 extension
statuses；core 原子接缝含生态 fallback；占位仅作 mutation 探针。

```text
FOOTER_REPLACEMENT_SEAM_MECHANISM  PROVEN
END_TO_END_RUNTIME_REBIND          NOT_TESTED
ROOT_CAUSE                         STRONGLY_SUPPORTED
IMPLEMENTATION_AUTHORIZED          YES
```

MINIMAL_PATCH_BOUNDARY：布局原语（VStack 分配、transcript grow + dock basis:auto、bottom
锚定）正确无需改动；唯一缺口在 reset/rebind 的异步间隙。**IMPLEMENTATION_AUTHORIZED ✅**
——授权范围仅限 §8.5 候选最小修复（reset + footer 替换 + 最终 requestRender 合为一次可见
frame；或延后原生 footer 可见化至 Motto 单行 footer 就位后）；不触碰 layout.ts / stack.ts /
tui-alt-screen.ts 渲染差分、agent loop / session / 工具；不复制 Codex/OpenCode 框架、不建
第二套 composer、不用 timer debounce。此处记录 P0 授权时点；P1 后续已实施并验收，见 §8
与决策单 §9/§10。

证据边界：逐帧数字以报告为准，机制经源码互证；footer 替换接缝机制经返工确定性测试机械复现
（可重放），**但该测试不是完整生产 rebind 链**（END_TO_END_RUNTIME_REBIND NOT_TESTED）。
报告其余面（status/pending/widget/editor 多行/reload/resume/resize 逐帧 rect 与 flush）仍
为 80×24 RecordingTerminal 报告记录，临时 harness 已删不可重放。Ghostty 实机 60/80/120
列连续捕获未在本轮覆盖，留待最小修复施工后的 USER_ACCEPTANCE 阶段。

结论登记：`docs/decisions/2026-08-11-motto-tui-3-composer-dock.md` §8.5；
usage-log：`docs/usage-log/2026-08.md` 2026-08-13 composer 条目。

## 8. P1 消费结果（2026-08-13）

调研中的“原子 rebind、单帧提交、bottom-aligned”候选已在 Motto 边界内消费：core 只增加
custom footer replacement/commit 接缝与 reload 最终强制帧；Motto extension 负责单行 status
投影和 TPS/status 退化。未复制 Codex renderable、OpenCode Yoga root 或 Grok Build 架构。

自动测试覆盖四类 footer 拓扑、reload 最终帧、mutation proof，以及 single/multi status ×
40/60/80/120/200。Ghostty 覆盖 60/80 reload 连拍、120 status 与 200 TPS+status；终态为
`ACCEPTED WITH LIMITATIONS`。未覆盖项见决策单 §10；尤其完整 runtimeHost 端到端 rebind 与
Grok Build 具体布局源码仍为 `NOT TESTED / NOT VERIFIED`。
