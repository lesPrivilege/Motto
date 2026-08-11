# 验收报告 — T2-2 thinking 三态渲染 (工单 MOTTO-TUI-2 切片 2)

- 验收者：独立验收 agent（写者与验收者分离；未参与 T2-2 编写）
- 被验对象：
  - PI fork `~/Projects/pi` @ `7b80fa727` (branch `motto/main`)
  - Motto meta-repo `~/Projects/Motto` @ `9d8eddd` (branch `main`)
- 工单依据：`docs/decisions/2026-08-11-motto-tui-2.md`（T2-2 三态渲染：collapsed 默认 / preview 有界摘要 / full 原文）

## 总判定：ACCEPTED

五个验收门全部通过，未见缺陷或弱化。仅记一条与 T2-2 无关的既有 flaky 测试观察（见 §4），以及一条工单预期的 interim-state 观察（见 §5）。

---

## 1. 源码语义（pi fork）— ACCEPTED

### 1.1 `components/thinking-fold.ts`
- 新增 `buildThinkingPreview` 纯 helper（HEAD=64 / TAIL=40 / ELLIPSIS="…"）：
  - 空白折叠为单段（`replace(/\s+/g," ").trim()`），输入空 → 返回 `""`。
  - `budget = 64+40+1 = 105`；`flat.length <= budget` → 原样返回（不截断）。
  - 更长 → `head(flat[0:64]) + "…" + tail(flat[-40:])`，总长恒 105。
  - 字符预算数学自洽：head/tail 永不重叠（截断仅在 length>105 时发生）；`length<=105` 时 head+tail 必重叠或相接，故提前返回原样，无 slice 重叠 bug。
- 新增命名常量 `THINKING_PREVIEW_HEAD_CHARS` / `TAIL_CHARS` / `ELLIPSIS`，注释文档化行数预算（40 列 ~3 行、其余 ≤2 行，软目标；硬门禁是零超宽）。

### 1.2 `components/assistant-message.ts`
- `thinkingFoldProvider?` 可选构造参数（末位追加，缺省 `undefined`）；未注入 → `DEFAULT_THINKING_FOLD_STATE`（collapsed），组件独立可用（测试/基线路径均验证）。
- thinking run 处（T2-1 entryId 计算后）：`foldState = entryId!==undefined && provider ? provider(entryId) : DEFAULT`。
  - `full` = 完整 Markdown（与原非隐藏路径逐字节一致）；`preview` = 单 `Text(italic + thinkingText + buildThinkingPreview(...))`；`default`(collapsed) = 单行静态标签（复用 `hiddenThinkingLabel` 样式，与 hideThinkingBlock 全隐同款）。
- `hideThinkingBlock === true` 分支优先：程序化比对 pre/post 分支文本，**逐字节一致**（`byte-identical: True`）。
- T2-1 记账 `thinkingRunIndex++` / `thinkingEntryIds.push(entryId)` 完整保留（仅重构为局部 `entryId` 变量，语义不变）。
- 无新语义色：三态全部复用 `theme.fg("thinkingText")` + `theme.italic`。

### 1.3 `interactive-mode.ts`
- `this.getThinkingEntryFoldState.bind(this)` 注入**两处**构造点：流式 `message_start`（~3155）与 `addMessageToChat` 的 `assistant` case（~3569）。
- diff 仅这两处（各 +2 行：注释 + bind），无其他改动；`recordThinkingFoldStates` / `getThinkingEntryFoldState` 均未动。
- 全 diff grep 无新增 session/settings 写入（零新增写；fold 纯内存）。

### 1.4 硬边界 / 勿增实体
- `git show 7b80fa727 --name-only` 仅 5 文件：`assistant-message.ts`、`thinking-fold.ts`、`interactive-mode.ts` + 2 个测试文件。**不包含** session-manager.ts、packages/ai/src/types.ts、user-message.ts、motto-layout.ts、theme 文件、tool-execution、agent loop。
- 新增表面 = preview helper + 3 常量 + provider 参数 + switch 分支；无新组件/配置/设置。

## 2. 测试（pi fork）— ACCEPTED

- 定向运行：`npx vitest run test/assistant-message.test.ts test/thinking-fold.test.ts test/user-message.test.ts`
  → **3 files passed / 33 tests passed / 0 failed**（与预期一致）。
- 新增 T2-2 用例（5 条 assistant-message + 5 条 thinking-fold = 10 条）均**非空泛**：
  - (a) 默认无 provider → collapsed 标签（断言 `Thinking...` 恰好 1 次、thinking 文本不出现）；
  - (b) provider `full` → 完整文本（断言全文出现、无标签）；
  - (c) provider `preview` → 有界摘要（断言 `rendered.length < thinking.length`、含 `…` 与 `TAIL_END_MARKER`、省略号在尾标之前、中部独有标记不出现）；
  - (d) `hideThinkingBlock=true` 且 provider 返回 full → 兼容标签仍优先（全文不出现）；
  - (e) 三态跨 `updateContent` 重渲染逐字节稳定（frame-stable）+ entryId `a1:1`。
  - thinking-fold：短文本原样返回 / 空白折叠单段 / 长文本 head+…+tail 且总长 105 / 空白输入返回空串 / 40 列 ≤3 行预算断言。
- 两条被改为显式 `full` 的旧测试（output padding、Markdown transformer）逐条核对：以 `() => "full"` 精确复现 pre-T2-2 唯一渲染路径（非隐藏全量 Markdown），断言内容不变（padding 位置、`assistant-thinking:reasoning` 变换），**未弱化**。

## 3. 基线（Motto repo）— ACCEPTED

- `node --experimental-strip-types fixtures/tui/render-baseline.mjs --check`
  → **`BASELINE_CHECK_PASS`**：与已提交基线逐字节一致，40/60/80/120/200 × 4 主题（dark/motto/motto-dark/motto-light）**零超宽**。
- `git show 9d8eddd` 基线 diff 仅限 thinking 块（原 `thinking-collapsed (T2-1)` 改名 `thinking-hidden (T2-1 compat)` + 新增 collapsed/preview/full 三块）+ MANIFEST 时间戳；对基线 diff 的删除行全量核对，**无 user-gutter / assistant-body / tool-index / md-\* 块改动**（非 thinking 删除行 = 0）。
- `theme-motto.txt` width=80 四块实测：
  - `thinking-hidden (T2-1 compat)`：单行 ` Thinking...`（80 列满宽，正确）；
  - `thinking-collapsed (T2-2)`：单行 ` Thinking...` 标签；
  - `thinking-preview (T2-2)`：2 行有界摘要 `…/重建同源同序,身份稳定(I7-1)。结束标记 TAIL_END_MARKER。`；程序化验证 head==`flat[:64]`、tail==`flat[-40:]`、总长 105、与 full 不同 → **有界且目视截断**；
  - `thinking-full (T2-2)`：7 行完整原文（含 `TAIL_END_MARKER`，与 preview 明显不同）。
  - preview 行数预算：40 列→4 行、60→3、80→2、120→2、200→1（均 ≤ ~4）；各块最大行长 33/54/61/114/160 均 < 声明宽度，零超宽。

## 4. 全量测试 + 登记 — ACCEPTED

- 全量：`npx vitest run` → **216 files passed / 6 skipped；1925 tests passed / 0 failed / 49 skipped**。
  - 与预期完全一致（1915 + 10 新 = 1925）。
- 观察（非 T2-2 缺陷）：首次全量运行 `test/footer-data-provider.test.ts` 出现 1 条 `waitFor` 超时失败（reftable debounce 计时用例）；该文件与源码均未被本 commit 触碰；单独重跑 8/8 通过，第二次全量运行全绿。属既有计时型 flaky，非回归。
- `PATCHES.json`：JSON 解析有效；`tui-2-t2-thinking-three-state` 存在，`commit: 7b80fa727`，`removalCondition`（上游吸收等价 per-entry 披露后 revert + 跑基线与全量测试），`status: "applied"`。
- 决策文档 §6：`THINKING_THREE_STATE ✅ 已实现(commit 7b80fa727,2026-08-12;T2-2)`，**未标记终态 ACCEPTED**（`终态 ACCEPTED 待用户验收(写者与验收者分离)`）。
- 双仓状态：`git status` 均 clean；本地 HEAD == origin（pi `motto/main`==`origin/motto/main`==`7b80fa727`；Motto `main`==`origin/main`==`9d8eddd`）。

## 5. Interim-state 观察（非缺陷）

T2-2 使 thinking 默认 collapsed，而交互展开键（T2-3）尚未落地。实际使用中默认 fold map 全为 collapsed，所有 thinking 均渲染为单行标签（等效于原 hideThinkingBlock 全隐的观感，但走 collapsed 态路径）；`full`/`preview` 今日仅能经测试/基线的 provider 注入触达。这与工单一致：默认 collapsed 是著录层纪律的刻意选择，交互键属 T2-3 范围。记作 interim-state 观察，非缺陷。

## 附：验证环境备注

- 全量套件首跑出现 1 条 flaky 失败（footer-data-provider，与 T2-2 无关），重跑后 1925/0/49 精确命中；定向 33/33、基线 `BASELINE_CHECK_PASS` 均一次通过。
- 未修改任何被跟踪文件、未 commit、未 push；仅写入本报告（/tmp）。
