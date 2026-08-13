# 工单：TUI-1-S3-LIVE — 恢复成功内置工具在真实会话中的目行收敛

- 日期：2026-08-13
- 类型：工单（TUI-1 S3 的实机接线修复；单问题修复，不扩张范围）
- 状态：REGISTERED → 已认领 → IMPLEMENTED → READY_FOR_USER_REVIEW
- 写者：Motto（本 agent）· 验收者：用户（独立验收，写者与验收者分离；同仓同时至多一个写者）
- 公开锚点：repo `lesPrivilege/motto` · branch `motto/main` · P0 `1ff3e776ab9fc2746a655b2f052c713786e78790`（P0 证据锚）· ticket `TUI-1-S3-LIVE`

## 0. 立单依据（用户裁定）

用户对 `MOTTO-TUI-FULL-SESSION-P0` 所发现 **D1** 正式立单裁定：

> 修复成功内置工具在真实 Motto TUI 中未收敛为低对比目行的问题，使组件基线语义与真实
> session 接线一致；失败、流式、展开、自定义覆盖等既有边界全部保持。

证据锚：
- P0 research：`docs/research/2026-08-13-tui-full-session-composition-dogfood.md` §6 D1
  （R2 实机全卡 + recap 双份 tool+target；基线 vs 实机漂移根因分析）
- P0 handoff：`docs/reviews/2026-08-13-handoff-tui-full-session-p0.md` §三.1（S3 成功目行实机失效）

## 1. 根因

1. `ToolExecutionComponent` 内部持有两个 definition：constructor 传入的 `toolDefinition`
   （语义 = 自定义工具定义或内置工具覆盖定义）与自建的 `builtInToolDefinition`。
2. `isSuccessIndexLine()` 约定：`builtInToolDefinition !== undefined && toolDefinition === undefined`
   → 内置工具成功且未展开/未流式/无错误 → 收敛为低对比目行。
3. 但 `interactive-mode.ts` 的 `getRegisteredToolDefinition()` 直通
   `session.getToolDefinition(name)`，而 `AgentSession._toolDefinitions` 同时收容
   `source: "builtin"`、`source: "sdk"`、extension/package/project 来源的工具——
   **真实内置工具也取得一个 definition**，使组件误以为其遭自定义覆盖，`toolDefinition`
   恒非 undefined，`isSuccessIndexLine()` 对真实内置工具恒假。
4. `render-baseline.mjs` 以 `toolDefinition = undefined` 直接构造组件（组件语义），
   未覆盖真实 interactive 接线——基线绿 ≠ 实机绿。

独立复核结论（写者）：因果链成立。临时接线回归测试证明旧实现失败
（`session.getToolDefinition("read")` 对 source=builtin 的 read 返回非 undefined）。

## 2. 修复

### 2.1 以来源元数据判定（不猜名字、不比较 renderer/schema、不解析路径字符串）

新增纯函数 `packages/coding-agent/src/modes/interactive/tool-definition.ts`：

```ts
resolveToolDefinitionForComponent(tools: ToolInfo[], toolName, getDefinition)
```

`tools` = `session.getAllTools()`（含 `sourceInfo` 的既有公开只读 API，不新增 registry
抽象）；`sourceInfo.source === "builtin"` 或条目缺失 → 返回 `undefined`（fail-open）；
其余来源（sdk / extension / package / project）→ 返回 `session.getToolDefinition(name)`。

### 2.2 接线契约（interactive-mode.ts）

`getRegisteredToolDefinition` 更名 `getToolDefinitionForComponent`，改为：

```ts
resolveToolDefinitionForComponent(this.session.getAllTools(), toolName, (name) =>
  this.session.getToolDefinition(name),
)
```

definition 参数的新精确语义（与组件 `isSuccessIndexLine` 一致）：

```text
undefined      = 内置工具且无自定义覆盖
ToolDefinition = 非内置自定义工具，或对内置工具的自定义覆盖
```

未知工具 → `undefined`（generic fallback 完整卡，不代建目行）。组件 `isSuccessIndexLine()`
零改动（实际源码证明组件判定无需调整）。

### 2.3 明确未改的表面

agent loop / provider / session canonical schema / 内置工具执行语义 / tool 参数·结果·
错误对象 / 模型上下文 / system prompt / thinking / composer / footer / diff / Markdown /
卡片 / 颜色 / 主题 token / 配置项 / 快捷键 / fixture baseline——全部不动。

## 3. 行为矩阵（修复后，真实 interactive session）

| 工具情形 | 收工、未展开时 |
|---|---|
| 内置工具，无覆盖，成功 | 单行低对比目行 |
| 内置工具，无覆盖，失败 | 原生完整失败卡 |
| 内置工具，无覆盖，流式 | 原生运行卡 |
| 内置工具，无覆盖，用户展开 | 原生完整卡 |
| 内置工具被 extension/SDK 同名覆盖 | 保留覆盖定义及 renderer，不收敛 |
| 非内置自定义工具，成功 | 延续 review-flow A1：单行目行 |
| 非内置自定义工具，失败/流式/展开 | 原生或自定义完整卡 |
| 未知工具，无 definition | generic fallback，不代建目行 |
| 用户主动 `!!` Bash | 保持既有完整卡，不纳入本修复 |

## 4. 自动门

- 新增 wiring regression：`packages/coding-agent/test/tool-definition-wiring.test.ts`
  （7 用例）——经与 interactive-mode 相同的 selection 路径驱动真实 AgentSession registry
  （builtin/sdk/extension/builtin-override/unknown），旧 HEAD 会失败（直接 getToolDefinition
  对 builtin 返回定义）。
- 组件矩阵补足：`tool-execution-component.test.ts` +3（read/write 单行目行含无预览·无
  `$`·无 Took 断言；未知工具 generic fallback）。
- 既有 37 组件用例全绿（含失败/partial/expanded/自定义/override renderer 保留）。
- `git diff --check` PASS；`npm run build:offline` PASS；`npm run check` PASS；
  coding-agent 全量 `1968 passed / 49 skipped`；`bash scripts/maint/ci-checks.sh governance`
  PASS；`node --experimental-strip-types fixtures/tui/render-baseline.mjs --check` 逐字节
  PASS（40/60/80/120/200 零超宽，baseline 零漂移）。
- `packages/ai` 6 用例失败为既有环境性失败（stash 验证 pristine HEAD 同 6 失败），与本单无关。

## 5. Ghostty dogfood

隔离 scratch `/private/tmp/motto-tui-s3-live`，candidate commit `b27911c9c`（motto-dev →
仓内 dist 同源构建）。后台 Quartz 按键注入 + 窗口截图 + Vision OCR + motto_vision 目验；
未前台化、未移动鼠标、未申请权限。证据全录于 `/private/tmp/motto-tui-s3-live/DOGFOOD-EVIDENCE.md`
（原始截图/session 留 tmp，不入库）。

- **成功 read/Bash**：` read /private/tmp/motto-tui-s3-live/sample.txt` 与 ` bash printf 'ok'`
  单行目行；无输出预览、无 `$`、无 Took；recap `2 tools • explore 1 • run 1 • 1.7s` 仍在；
  最终 Markdown 不受影响。
- **失败 `false`**（无守卫，真 exit 1）：完整卡 `$ false` / `(no output)` /
  `Command exited with code 1` / `Took 0.0s`；recap `1 tool • run 1 • 1 failed • 1.2s` accent；
  失败条目折叠态强制显露；无新语义色。
- **展开**：Ctrl+O → `Tool output: expanded`，新 turn 成功工具完整原生卡
  （`$ printf 'hello-expanded'` + 输出 + Took）；折叠后既有卡回单行
  （`bash printf 'hello-expanded'`、`read …/sample.txt`）。
- **reload**：`/reload` 后新成功工具仍单行（`bash printf 'after-reload'`）。
- **resume**：`motto-dev --session <uuid>` 新窗口，既有工具记录渲染一致（全部单行目行）。
- **窄宽 60 列 + 长 bash target**：目行截断以 `…` 收尾、逐行 ≤ 宽、零超宽。
  ⚠️ 观察：极端长 target 在 60 列下 S3 目行按词换行为 2 行——`truncateVisible` 截到
  contentWidth 后追加 `…`（contentWidth+1），Text contentWidth=width−paddingX×2 较小而换行；
  属 S3 既有 `truncateVisible`/`Text` off-by-one，非本单引入，短 target 不受影响，
  判定「正确截断、不超宽」（§8.3.5 口径）成立，不越界修复。
- **composer dock 与 footer**：全部捕获中 footer 恒单行地脚、composer dock 固定下缘，无回归。
- **CUSTOM_OVERRIDE_LIVE**：NOT TESTED（环境无安全无额外依赖的自定义工具可稳定实机调用；
  由 wiring regression + 组件测试离线覆盖 override 路径）。
- **canonical 检查**：session JSONL 零投影污染（无 "Tool output:" / "Took" 等标记）；
  recap 5 turn 全部 status 正确。

## 6. 提交与 PATCHES

- code commit：`b27911c9c` — `fix(tui): restore live builtin success index-line wiring`
  （原子 code + test；interactive-mode.ts + tool-definition.ts + 2 测试文件 + 1 既有回归
  测试 mock 名对齐）。
- 本工单登记 + INDEX + PATCHES.json 落账为独立 docs/maintenance commit。

### PATCHES.json 登记

```json
{
  "id": "tui-1-s3-live-wiring",
  "commit": "b27911c9c",
  "removalCondition": "上游吸收等价内置工具卡 projector / source-aware renderer 后接线删除",
  "叠改关系": "S3(tui-1-s3-tool-index-line) 的 live-wiring 后续修正 + A1(review-flow-a1-tool-index-all) 同触 tool-execution.ts/interactive-mode.ts；删除按后置先退"
}
```

## 7. 验收态

```
TUI-1-S3-LIVE — READY_FOR_USER_REVIEW

ROOT_CAUSE_REPRODUCED         ✅（临时接线回归证明旧实现失败）
LIVE_WIRING_FIXED             ✅（sourceInfo.source === "builtin" 判定）
BUILTIN_SUCCESS_COLLAPSED     ✅（实机 read/Bash 单行目行）
BUILTIN_FAILURE_PRESERVED     ✅（实机 false 完整卡 + failed accent）
PARTIAL_EXPANDED_PRESERVED    ✅（实机流式卡/展开完整卡）
CUSTOM_OVERRIDE_PRESERVED     ✅（组件测试 + wiring regression；实机 NOT TESTED）
CUSTOM_TOOL_A1_PRESERVED      ✅（组件测试）
TARGETED_TESTS                ✅（wiring 7 + 组件 40）
FULL_OFFLINE_GATES            ✅（build/check/coding-agent 全量/governance/baseline）
REAL_GHOSTTY_DOGFOOD          ✅（Ghostty 1.3.1 实机 R0–R6 对应项）
CANONICAL_CONTENT_UNCHANGED   ✅（session 零投影污染）
PATCH_REGISTRY_UPDATED        ✅（docs commit 落账 b27911c9c）
REMOTE_SYNCED                 ⏳（验收后推送）
USER_ACCEPTANCE               ⏳（终态由用户独立验收裁定）
```

终态只允许 ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED，由用户验收后裁定；
本工单不自行写 ACCEPTED。
