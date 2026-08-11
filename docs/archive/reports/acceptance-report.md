# Motto 独立验收报告 — WO-1 / WO-3 / WO-4

验收人：独立验收 agent（未参与任何实现）。日期：2026-08-12。
被验仓库：`~/Projects/pi`（branch `motto/main`，HEAD `94a2d111d`）、`~/Projects/Motto`（branch `main`，HEAD `a0098fb`）。
验收期间未修改任何被跟踪文件、未 commit、未 push。

---

## 总评

| 工单 | 结论 |
|---|---|
| WO-1 S1 user-message gutter 细化（pi `5e94171e3` / Motto `43d4606`） | **ACCEPTED** |
| WO-3 T2-1 thinking identity（pi `0cb127bef` / Motto `8b58c21`） | **ACCEPTED** |
| WO-4 rebrand test debt（pi `94a2d111d`） | **ACCEPTED** |

三项工单全部满足各自验收门与硬边界，未发现越界、隐藏行为变更或回写路径。以下为逐项证据与两条非阻断性注记。

---

## WO-1 — S1 user-message gutter 细化

**commit 范围**：pi `5e94171e3` 仅 2 文件（`user-message.ts` 13 行变更、`user-message.test.ts` 14 行变更），15+/12-。Motto `43d4606` 仅 docs + fixtures + MANIFEST。

**源码验证**（`user-message.ts render()`）：
- 首行界栏 + 续行 2 空格悬挂缩进：`body.map((line, i) => (i === 0 ? gutter : " ".repeat(GUTTER_WIDTH)) + line)`。`GUTTER_WIDTH = 2`（motto-layout.ts），续行 `" ".repeat(2)`，正文列仍锚于第 3 列，与 S2 BODY_INDENT 同列。
- OSC133 标记未变：`lines[0]` 行首 `OSC133_ZONE_START`，末行行尾 `OSC133_ZONE_END + OSC133_ZONE_FINAL`。
- `motto-layout.ts` 未被触碰（本 commit 及当前工作树均未改）。
- 无新增组件/常量/flag；仅就地改 `map` 回调与注释。

**测试**：`vitest run test/user-message.test.ts test/assistant-message.test.ts` → **19 passed / 0 failed**（user-message 4 + assistant-message 15）。断言与行为一致：line 0 = `GUTTER + text`（`│ hello world, this`），续行 = 两空格 + text（`  is a longer user` 等），末行 OSC 收尾。⚠️ 注记：验收门写「(4 + 11)」，实际为 19——多出的 4 条 assistant 测试来自后落地的 WO-3，非本工单缺陷。

**基线**：`fixtures/tui/baseline/theme-motto.txt` user-gutter (S1) 块在全部 5 个宽度（40/60/80/120/200）均呈现「首行 `│ ` + 续行两空格」。WO-1 基线重生成改动严格局限于 5 个 user-gutter 块（5 个 hunk，各 ± 对称），无其他块漂移；MANIFEST 仅时间戳。`render-baseline.mjs --check` → **BASELINE_CHECK_PASS（逐字节一致、逐宽度零超宽）**。

**文档记账**：
- MOTTO.md 第 34/163/170 行均为「首行界栏 `│ ` + 续行悬挂缩进」措辞（逐行核对）。✓
- TUI-THESIS I6-4 / §8 / I8-3 全部改为「首行界栏 + 续行悬挂缩进」，I6-4 修订注记入 §6。✓
- PATCHES.json `tui-1-s1-user-gutter`：`commit` 字段 = `"2daa52934, 5e94171e3"`（含 `5e94171e3`），title/description/fixture 均已更新，removalCondition 保留。✓

**范围外注记**：`motto-layout.ts` 顶部注释仍写「user 消息逐行左界栏 `│ `」（WO-1 硬边界要求该文件零改动，故合规；仅提示未来可顺手清理陈旧注释，非缺陷）。

---

## WO-3 — T2-1 thinking identity

**commit 范围**：pi `0cb127bef` 仅 5 文件（新增 `thinking-fold.ts` 58 行、`assistant-message.ts` +21、`interactive-mode.ts` +50、2 个测试文件），323+/2-。**硬边界核对**：未触碰 `session-manager.ts`、`packages/ai/src/types.ts`、任何 theme、工具执行、agent loop、`motto-layout.ts`、`user-message.ts`。两处删除恰为 `addMessageToChat` 签名扩展与其调用点（已逐行核验，无隐藏删除）。

**源码语义**：
- `thinking-fold.ts`：纯 helper——`messageKeyForAssistantOrdinal`（`a{ordinal}`）、`thinkingEntryId`（`aN:runIndex`）、`countAssistantMessageEntries`（只数 `type==="message"` 且 `role==="assistant"`）、`get/setThinkingFoldState`（缺省 collapsed）。仅 type-only import 自 session-manager（只读）。
- `assistant-message.ts`：可选构造参数 `thinkingMessageKey?` + `getThinkingEntryIds()`。entryId 在渲染循环内按「相邻 thinking 块合并为一 run」的序数推导；`thinkingRunIndex++` 与 push 为纯记账，渲染分支（hideThinkingBlock 单行标签 / Markdown 段）与 spacing 逻辑逐字符未动 → **渲染行为不变**成立。
- `interactive-mode.ts`：`thinkingFoldState` Map（纯内存）；messageKey 在 `message_start` 处理器（内容到达前）定死 = `countAssistantMessageEntries(buildContextEntries()) + 1`；`message_update` 时 `recordThinkingFoldStates`；恢复/重建路径 `renderSessionItems` 内 `assistantOrdinal++` 计数。

**序数一致性（独立复核）**：流式路径按 `buildContextEntries()` 数 assistant 消息 entry；恢复路径经 `renderSessionEntries` 的 `sessionEntryToContextMessages` flatMap 后数 `role==="assistant"` 消息。我核实 `sessionEntryToContextMessages` 对 message entry 恒返回单条 `[message]`（1:1），且实例方法 `this.sessionManager.buildContextEntries()` 即导出的 `buildContextEntries(getEntries(), leafId, byId)` 同源同序 → 两条路径序数推导严格一致。✓

**回写审计**：对新增代码 grep `appendCustomEntry|sendMessage|appendEntry|addCustomEntry|settings|persist|context.append` —— 仅命中预存调用 `this.addCustomEntryToChat(item)`（diff 上下文，非新增）与测试名「persists across rebuild」；**无任何 session/context 写入**。✓

**测试**：`vitest run test/assistant-message.test.ts test/thinking-fold.test.ts test/user-message.test.ts` → **23 passed / 0 failed（15+4+4）**。新增用例非空转：`updateContent` 帧间稳定性（`a2:1` → 追加正文后 `a2:1,a2:2` → 重复 update 仍 `a2:1,a2:2`，I7-1）、空 thinking 块跳过并合并 run、多 run 序数、fold map 缺省 collapsed + 同 messageKey 重建后保持。✓

**基线**：Motto `8b58c21` 对 7 个 theme 文件各 **+32 行纯新增**（唯一「-」为 diff 头行 `--- a/...`，非删除），新增 `thinking-collapsed (T2-1)` 块（5 宽度 × 7 主题）+ `render-baseline.mjs` +28（新增 `forkThinkingLines`）、MANIFEST 时间戳。现有块零改动。`render-baseline.mjs --check` → **BASELINE_CHECK_PASS**。✓

**登记**：PATCHES.json `tui-2-t1-thinking-identity`（commit `0cb127bef`、removalCondition 存在、fixture 记 thinking-collapsed 块）。决策文档 `2026-08-11-motto-tui-2.md` §6：`THINKING_IDENTITY ✅ 已实现(commit 0cb127bef,…)`，且明确「终态 ACCEPTED 待用户验收(写者与验收者分离)」，**未自标记 ACCEPTED**。✓

**范围注记（非缺陷）**：fold map 为进程内内存态，跨进程重启不保持（跨重建/压缩保持）；与工单意图「in-memory map, default collapsed」一致。

---

## WO-4 — rebrand test debt

**commit 范围**：pi `94a2d111d` `--name-only` 恰为 3 个测试文件；`--stat` 无任何 `src/` 改动（19+/12-）。TEST-ONLY 成立。✓

**断言核对**：
- `credential-print.test.ts`：**保留 `pi auth check` 为规范子命令**，仅调用前缀 `pi --help` → `motto --help`（附注释说明产品层/平台契约层分工）。✓
- `first-time-setup.test.ts`：改名用例「returns false for a rebranded (motto) distribution — not official pi」断言 `false` 并附品牌策略注释；读文件确认其余 3 个用例（experimental 关闭 / 自定义 agent dir / settings.json 已存在）未动。✓
- `package-command-paths.test.ts`：9 条断言行随产品层改 `motto`（install usage、`--help`、`is already up to date`、`update --self`、`Updated motto` × 2、`not Updated motto` × 2）。

**全量套件**：`npx vitest run` → **216 passed / 6 skipped（222 文件），1915 passed / 49 skipped（1964 测试），0 failed**——与验收门预期数字完全一致。三个被改文件单独跑 → 40 passed / 0 failed（未被跳过，实际执行新断言，且源码确实输出 motto 前缀，证明断言与实现相符）。✓

**注记（非缺陷）**：commit message 称「9 项修复」，实际改动断言行为行数合计 11（package-command-paths 9 + credential-print 1 + first-time-setup 1）。表述上的小出入，不影响正确性。

---

## 横切检查（Cross-cutting）

1. `render-baseline.mjs --check` → **BASELINE_CHECK_PASS**（逐字节一致、逐宽度零超宽；覆盖 dark/motto/motto-dark/motto-light 四主题 + review-flow）。
2. **双仓干净且已推送**：pi `git status` 干净，`rev-parse motto/main` == `origin/motto/main` == `94a2d111d`；Motto `git status` 干净，`rev-parse main` == `origin/main` == `a0098fb`。
3. **PATCHES.json 为合法 JSON**（node require 通过），5 条 patch：`tui-1-s1-user-gutter`（commit 含 5e94171e3）、`tui-1-s2-assistant-body`、`tui-1-s3-tool-index-line`、`tui-2-t1-thinking-identity`（0cb127bef，含 removalCondition）、`motto-rebrand-1`。
4. **范围蔓延 / 隐藏行为变更审查**：三份 WO 的完整 diff 均已逐行审阅——WO-1 无新实体；WO-3 渲染输出逐字符不变、无回写路径、无边界文件；WO-4 纯断言字符串。未发现任何未声明的行为变更。

---

## 非阻断性注记汇总

1. WO-1 验收门测试数「(4 + 11)」现为 19（4 + 15），因 WO-3 后续为 assistant-message 新增 4 条测试；WO-1 自身断言全绿。
2. WO-4 commit message「9 项修复」实际改动断言 11 处（9+1+1），表述出入，不影响结果。
3. `motto-layout.ts` 顶部注释仍为旧「逐行界栏」措辞（该文件按硬边界不可动，建议未来随上游吸收后一并清理）。

三项工单均可进入用户终态验收。
