# Acceptance Report — T2-3: thinking 交互键 (focus 游标 + fold 三态循环)

- 验收人：独立验收 agent（写者与验收者分离；未参与编写本 patch）
- 日期：2026-08-12
- 被测 commit：`dfb898c0b`（pi fork `motto/main`，HEAD）
- 工单：`/Users/lesprivilege/Projects/Motto/docs/decisions/2026-08-11-motto-tui-2.md` §2 T2-3
- 方法：逐代码核对 + 定向测试 + 全量测试 + 渲染基线 + PATCHES 制度 + 硬边界审计。未修改任何 tracked 文件，未 commit/push，笔记仅落 /tmp。

---

## 总体结论：ACCEPTED（附两点观察，均不构成门禁失败）

六个验收门全部通过。两项观察（非阻断）：(a) `recordThinkingFoldStates` 幂等追加未经自动化测试直接覆盖，仅靠代码审查确认；(b) 决策文档「渲染输出零改动」的表述只对 render-baseline 覆盖面成立——提示栏（hint bar）新增了两条键位提示文案（属预期交互，基线不覆盖该面）。

---

## Gate 1 — Keybindings：PASS

`packages/coding-agent/src/core/keybindings.ts`（+12 行）：
- **action registry 类型块**：`AppKeybindings` 接口新增 `"app.thinking.focus"` / `"app.thinking.fold"` ✓
- **defaultKeys/description map**：`app.thinking.focus` → `shift+ctrl+t`（"Focus next thinking block"）；`app.thinking.fold` → `alt+t`（"Cycle focused thinking block"）✓
- **camelCase 迁移别名**：`focusThinking` / `foldThinking` 入 `KEYBINDING_NAME_MIGRATIONS` ✓
- **碰撞检查**：
  - `shift+ctrl+t` 在 keybindings.ts 全文件仅出现 1 次（L94），无冲突。
  - `alt+t` 仅出现 1 次（L98），无冲突；TUI 侧 `alt+*` 仅有 alt+b/f/d/y/left/right/up/down/enter/backspace/delete/pageup，无 alt+t。
  - pi-tui `TUI_KEYBINDINGS`（packages/tui/src/keybindings.ts）中 `shift+ctrl+t`、`alt+t` 均不存在（grep 零命中）。
  - 既有 `ctrl+t` 双占（app.thinking.toggle L90 与 app.tree.filter.noTools L194）为 pre-existing，非本 commit 引入。
- **`alt+f` 占用主张核实**：属实——`tui.editor.cursorWordRight` 的 defaultKeys 为 `["alt+right", "ctrl+right", "alt+f"]`（packages/tui/src/keybindings.ts L96）。写者选 `alt+t` 作为 fold 键合理。
- `app.thinking.toggle`（Ctrl+T）未动 ✓

## Gate 2 — Handler 逻辑：PASS

`packages/coding-agent/src/modes/interactive/interactive-mode.ts`（+43 行）：
- `handleThinkingFocus`：`count=0 → no-op`；`thinkingFocusIndex = advanceThinkingFocus(...)`（环绕）；`showStatus(thinkingFocusLabel(...))`；`requestRender()`。✓
- `handleThinkingFold`：`count=0 → no-op`；`entryId = thinkingEntryOrder[thinkingFocusIndex]`（未移动默认 0）；`next = cycleThinkingFoldState(getThinkingFoldState(map, entryId))`；`setThinkingFoldState`；`showStatus(label + " · " + next)`；`requestRender()`。✓
- 两者经 `this.defaultEditor.onAction("app.thinking.focus"/"app.thinking.fold", ...)` 挂在既有 `app.thinking.toggle` 处理器旁（L2833-2834 区域），Ctrl+T 处理器未触碰。✓
- `recordThinkingFoldStates` 幂等：push 位于 `if (!this.thinkingFoldState.has(entryId))` 守卫内，且 fold map 只增不删（grep 确认无 delete/clear），故每个 entryId 至多入序一次，流式/恢复/重建不重复追加。**该性质经代码审查确认（见观察 a）。**
- `thinkingFoldState` / `thinkingEntryOrder` / `thinkingFocusIndex` 均为纯运行时字段；diff 全量审计无任何 session/settings 写入（不触 sessionManager/settingsManager）。✓

## Gate 3 — 纯 helpers：PASS

`packages/coding-agent/src/modes/interactive/components/thinking-fold.ts`（+37 行）：
- `cycleThinkingFoldState`：`THINKING_FOLD_CYCLE = { collapsed→preview, preview→full, full→collapsed }` ✓（三态循环精确）。
- `advanceThinkingFocus(current, count)`：`count<=0 → -1`；否则 `(current+1) % count` ✓。
- `thinkingFocusLabel(index, count)`：`Thinking {index+1}/{count}`；`count<=0 || index<0 || index>=count → "Thinking –"` ✓。

## Gate 4 — 测试：PASS（附观察 a）

定向运行：`npx vitest run test/thinking-fold.test.ts test/assistant-message.test.ts test/user-message.test.ts test/interactive-tui.test.ts`
→ **48 passed / 0 failed**（4 files passed，1.77s）。

- `thinking-fold.test.ts` **+5**（T2-3：cycle 三态推进、三档循环幂等回到原态、advance 环绕 0→1→2→0、空/单条目哨兵与恒回 0、label 1-based 与占位）。均断言真实返回值，非空洞。
- `interactive-tui.test.ts` **+4**，经 prototype-call 轻量 harness（该文件既有模式，L98/108/142/166/237 同类用法）：
  1. focus 前进 + 1-based status + 环绕（索引 1→2→0，status "Thinking 2/3"/"3/3"/"1/3"，requestRender 被调）；
  2. fold 在聚焦 entry 上三态循环，**断言 map 实际被变更**（`fold.get("a1:1")` 依次 preview/full/collapsed/preview）；
  3. focus 移动后 fold 作用于新聚焦 entry（`fold.get("a1:2")="preview"`，`fold.get("a1:1")` undefined）；
  4. 无 entry 时 focus/fold no-op（索引不变、status/render 均未调用）。
- **观察 a（非阻断）**：工单要求确认「repeat recordThinkingFoldStates 不重复 order 条目」——该性质**未以自动化测试直接覆盖**（grep 确认 recordThinkingFoldStates 无直接测试），仅靠代码审查确认成立（守卫 + 只增不删的强不变量）。建议后续补一条幂等回归测试，但不影响本门判定。

## Gate 5 — 无渲染变更 + 全量套件 + registry：PASS

- 渲染基线：`cd ~/Projects/Motto && node --experimental-strip-types fixtures/tui/render-baseline.mjs --check`
  → **BASELINE_CHECK_PASS：与已提交基线逐字节一致，逐宽度零超宽**（dark/motto/motto-dark/motto-light 四主题，overflow 均 0；review-flow 104 lines）。
  基线文件最后改动在 T2-2 commit `9d8eddd`，Motto 工作树干净 → 与 T2-2 逐字节未变。
- 全量：`npx vitest run`（coding-agent）
  → **1934 passed / 49 skipped / 0 failed（216 files passed / 6 skipped / 222 total）**，与预期逐项吻合。
- `tsgo -p tsconfig.build.json --noEmit` 退出码 0（类型检查干净）。
- PATCHES.json（Motto `docs/maintenance/PATCHES.json`）：合法 JSON；`tui-2-t3-thinking-keys` 存在，commit=`dfb898c0b`，removalCondition 注明「上游吸收等价 per-entry thinking 交互后删除…git revert 并跑 render-baseline --check 与全量测试」，status=`applied`。
- 决策文档 §6：`THINKING_KEYS ✅ 已实现(commit dfb898c0b,2026-08-12;T2-3)…`，且标注「终态 ACCEPTED 待用户验收」——**未标 ACCEPTED**，符合写者-验收者分离。
- 两仓状态：pi `git status` clean，HEAD `dfb898c0b` == `origin/motto/main`；Motto clean，HEAD `b029c9f` == `origin/main`。

## Gate 6 — 硬边界：PASS

`git show dfb898c0b --name-only` 仅 5 文件：
`core/keybindings.ts`、`modes/interactive/components/thinking-fold.ts`、`modes/interactive/interactive-mode.ts`、`test/thinking-fold.test.ts`、`test/interactive-tui.test.ts`。

无 session-manager.ts / packages/ai/src/types.ts / user-message.ts / motto-layout.ts / theme / tool-execution / agent loop 改动。无新组件/config/settings——仅 2 action + 3 纯 helper + 2 运行字段 + 2 处理器 + 2 条 hint 展示文案。fold 纯内存、不入 session、不入模型上下文；hideThinkingBlock 兼容路径与 Ctrl+T 全隐并存保留（本 commit 未触碰）。

---

## 观察汇总（均不构成门禁失败）

| # | 观察 | 影响 |
|---|------|------|
| a | `recordThinkingFoldStates` 幂等无直接自动化测试（代码审查确认成立） | 覆盖缺口；建议后续补幂等回归测试 |
| b | 决策文档「渲染输出零改动」仅对 render-baseline 覆盖面成立；提示栏新增两条键位 hint（app.thinking.focus/fold 文案） | 属预期交互（向用户宣告新键）；基线不覆盖提示栏面，门禁按定义通过 |
| c | PATCHES.json 位于 Motto `docs/maintenance/` 下（非仓库根） | 路径说明，无碍 |

## 结论

**整体 ACCEPTED。** 六个门禁全部通过：键位三处登记齐全且无碰撞、处理器逻辑与纯 helper 与规格一致、48 项定向测试 + 1934 项全量全绿、渲染基线逐字节不变、PATCHES/决策文档登记正确、硬边界零越界。最终 ACCEPTED 终态仍须用户（与 GHOSTTY-BASELINE 交互面记录）拍板，本报告不替代用户终态验收。
