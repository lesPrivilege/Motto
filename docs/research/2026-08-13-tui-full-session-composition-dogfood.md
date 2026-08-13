# 全会话 TUI 文字体例 dogfood —— 真实 Ghostty 逐面观察与研究记录

> 性质：**研究记录**（dogfood 实测，非工单、非正典）。P0 消费轮：只观察、只对照、只草拟，
> 不改产品代码、不动基线、不执行下一张工单。
>
> - 日期：2026-08-13
> - 工单：Motto 唤醒工单「全会话 TUI 文字体例消费与真实 dogfood」（MOTTO-TUI-FULL-SESSION-P0）
> - 范围：消费仓内正典 + 网页 session 增量 → 真实 Ghostty alternate-screen dogfood →
>   全会话参考面 R0–R6 → 对照正典 → 草拟下一张施工单（本轮不执行）
> - 状态：**READY_FOR_USER_REVIEW**（证据链见 §9；颜色目验经 motto_vision 抽样确认，其余为
>   机械证据）
> - 关联：`docs/reviews/2026-08-13-handoff-tui-full-session-p0.md`（本轮 handoff）

---

## 1. Git 与运行环境

| 项 | 值 |
|---|---|
| 仓库 | `/Users/lesprivilege/Projects/motto`（`~/Projects/Motto` 同 inode 同一仓） |
| 分支 | `motto/main`，HEAD = origin/motto/main = `eb093c5e2`（fetch --prune 后 0 ahead / 0 behind） |
| 工作树 | 干净（`git status --short` 空），无并发写者，无未完成施工 |
| 发行 | `motto version`：base 0.84.1 · upstream `534bcbffb` · patchset 12 条 · release 2026-08-12.2 |
| 终端 | Ghostty 1.3.1 · macOS 26.5.2 · node v25.9.0 |
| 运行 | `~/bin/motto` → 仓内 `packages/coding-agent/dist/cli.js`（2026-08-13 09:56 构建，工作树一致） |
| 部署位 | `PI_CODING_AGENT_DIR=~/.motto/agent`（`~/.pi/agent` 为 symlink 同指） |
| dogfood 配置 | provider deepseek · model deepseek-v4-pro · thinking max · hideThinkingBlock: true · 双宗主题 |
| dogfood 项目 | `/private/tmp/motto-tui-session-composition`（隔离 scratch，产品仓零改动） |
| 驱动方式 | computer-use 门禁未批准（需 `/computer-use approve`）→ 改用 Quartz `CGEventPostToPid` 后台按键注入 +
  `screencapture -l <windowID>` 窗口截图 + Vision OCR 逐行取证 + motto_vision 颜色抽样。全部后台驱动，
  未前台化任何 dogfood 窗口。限制：鼠标拖选（I6-3）、滚轮路由未实机驱动，如实标注。 |

机械门禁（本轮全绿）：

```bash
git diff --check                                                    # PASS (exit 0)
bash scripts/maint/ci-checks.sh governance                          # GOVERNANCE: PASS（含 pinned-deps/typecheck×5/drift-check）
node --experimental-strip-types fixtures/tui/render-baseline.mjs --check   # 与已提交基线逐字节一致, 40/60/80/120/200 零超宽
```

> 工作单 §7 中的 `scripts/ci-checks.sh` 在仓内实际路径为 `scripts/maint/ci-checks.sh`，按实际补齐。

## 2. 实际读取的正典与实现

正典（全读）：`docs/AGENTS-MOTTO.md`、`docs/MOTTO.md`、`docs/MOTTO-PHILOSOPHY.md`、
`docs/TUI-THESIS.md`、`docs/ROADMAP.md`、
`docs/decisions/2026-08-13-motto-thin-harness.md`、
`docs/decisions/2026-08-11-motto-tui-3-composer-dock.md`、
`docs/decisions/2026-08-12-motto-tui-4-dunhao-cards.md`、
`docs/architecture/TUI-REVIEW-FLOW-RESEARCH.md`、
`docs/architecture/TUI-CARD-FRAME-RESEARCH.md`、
`docs/architecture/TUI-SURFACE-MATRIX.md`、
`docs/research/2026-08-13-image-gen-brief.md`、
`docs/reviews/2026-08-13-handoff-for-independent-acceptance.md`、
`fixtures/tui/baseline/GHOSTTY-BASELINE.md`（仍 DRAFT，未填写）。

- 仓内 `.motto/agent.md`：**不存在**（立域未做，扩展静默跳过，符合凡例六）。
- 实现对照（源码核实）：
  - composer dock：`interactive-mode.ts:907` `fullscreenLayoutRoot = VStack[transcriptScrollView, dock(pending/status/widgets/editor/footer)]`，
    `tui-alt-screen.ts` `ViewportTUI`/`setLayoutRoot` —— 上游 `ea1e77e2d` 已在 fork v0.84.1（MOTTO-TUI-3 判定不改代码，只验证）。
  - thinking：`assistant-message.ts` `hideThinkingBlock` + thinking-fold 三态；`Ctrl+T` 切换。
  - 工具块：`tool-execution.ts`（S3 `isSuccessIndexLine` + `renderSuccessIndexLine`）、
    `bash-execution.ts`、`core/tools/bash.ts`（非零退出 throw → `isError`）、
    `agent-loop.ts`（execute catch → `isError: true` → `tool_execution_end` 事件）。
  - review-flow：`motto-review-flow/index.ts`（turn_start/tool_execution_end/turn_end →
    `appendEntry("motto-review-flow.turn.v1")`）+ `core.ts` `buildTurnLines`
    （collapsed 只显 error 条目；汇总行含 failed 段）。
  - 卡片：`cards.ts`（`、、、`/`、、、 标注` → 单列表格 + `<!--motto-card-->` 帧标记）、
    `packages/tui/src/components/markdown.ts:628`（卡片帧/小标签模式）。
  - 标题：`headings.ts` `projectDeepHeadings`（H3–H6 → `## › 标题`）。
  - 基线夹具：`fixtures/tui/render-baseline.mjs:91` 以 `toolDefinition = undefined`
    构造 ToolExecutionComponent —— 与真实会话的接线不同（见 §7 差距 D1）。

## 3. Dogfood 任务与真实轨迹

任务（一条多段 user 请求，正常措辞，无测试专用协议）：

> 在这个 scratch 目录做一个真实小任务：写一个 Node CLI `stats.mjs`，接收文件路径参数、
> 统计每文件行数并打印逐文件表格与总计；先在 `sample.txt` 上跑，再对一个不存在的文件跑
> 看失败形态；然后把脚本改成缺文件逐文件告警而不是崩溃；展示修改 diff；最后用 markdown
> 报告收尾（标题结构、短列表、行内代码、bash 围栏用法、json 围栏示例输出、测试结果小表格）。

真实轨迹（session JSONL 机械记录，7 个 recap turn + 2 条后续）：

```text
turn0  bash ls+cat sample.txt                     ok   14ms    → recap: bash::ls
turn1  write stats.mjs                            ok    5ms    → recap: write::…/stats.mjs · 24 lines
turn2  bash 跑 sample.txt (exit 0) + 跑缺失文件     ok  100ms×2  → 两行 bash::cd
turn3  bash 探查 (no output)                       ok   15ms
turn4  edit stats.mjs (修复)                       ok    9ms    → recap: edit::…/stats.mjs · +12 −3
turn5  bash 混合跑 (sample+缺失, exit 1 按设计)     ok   20/150ms
turn6  write report.md                             ok    6ms
turn7  bash ls -la                                 ok   23ms
      → 最终 markdown 回报 1706 字符（H2×3、列表、行内代码、```diff 围栏、表格）
后续1  复查两条命令(模型自带 echo "exit=$?" 守卫)   ok    → recap 两行 bash::cd / bash::ls
后续2  `false`（无守卫）                          error exit 1 9ms → recap: bash::false · exit 1
后续3  「2+2」一句话 → 纯文本答案（无工具）
补样  showcase 会话：H1/H2/H3、列表、行内代码、```bash、```json、表格
```

关键认识：**前两轮「失败」被模型自己的 `echo "exit=$?"` 守卫拦下**（shell 整体 exit 0）。
不是 recap 漏报——后续 2 用无守卫 `false` 复现后，失败路径完整成立（见 R3）。这正是
「受控失败」要等模型真把非零退出放出来的原因，dogfood 记录保留这一过程。

## 4. R0–R6 逐面观察

截图证据存 `/private/tmp/motto-tui-session-composition/captures/`（窗口 ID 截图 + OCR 行坐标）。
下列参考面为真实窗口 OCR 去噪后的逐行转写（OCR 会合并/错读少量字符，已按上下文修正；
颜色以 motto_vision 抽样与既有槽位语义为准）。

### R0 — Ready / idle

观察：启动牌记完整（题名 accent 红、格言疏排、facts 两列悬挂、天头两行）；transcript 空；
composer 原生边框 + 块光标固定于底栏；footer 单行。quietStartup 生效（无按键提示块）。

```text
motto  慎  厥  身  修  思  永                    ← motto accent 红, 格言逐字疏排(text bold)

   deepseek-v4-pro · 2026-08-13                 ← mid, 缩进 3

   context     AGENTS.md                         ← dimmer 标签列 12, 内容列 15
   skills      archive · arxiv-browse · emil-design-eng · env-audit · house-style
               motto-maintenance · reading-companion · vercel-brand-guidelines
               weread-skills
   extensions  pi-rewind@0.5.0 · pi-lsp@0.49.4 · pi-subagents@0.14.3 · motto
               motto-canonical-copy · motto-computer-use · motto-gemini-vision
               motto-review-flow
   themes      motto · motto-dark · motto-light

▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  ← composer 原生上边界
█                                                                         ← 块光标
/private/tmp/motto-tui-session-composition          (deepseek) deepseek-v4-pro · max   ← footer 单行
```

对应：`motto/index.ts` 牌记 + footer 扩展；不变量 I8-1（一处红）/I9-3/牌记凡例。**保持**。

### R1 — Active thinking

观察：`hideThinkingBlock: true`（用户设置）下，thinking 活跃时只有一行安静的
`Thinking...` 标签，不抢正文权重、不写成 recap 目行；`Ctrl+T` 切「Thinking blocks: visible」
后状态行确认，完成态 thinking 以折叠标签呈现；thinking 原文在 session JSONL 有完整记录
（逐 run 的 `thinking` 字段），不入 recap、不入模型回写。

```text
…(user 消息尾部)
Thinking...                          ← 活跃 thinking 单行标签(隐藏态)
$ ls -la /private/tmp/motto-tui-session-composition && echo "---" && cat sample.txt
… (7 earlier lines, ctrl+o to expand)   ← 运行中工具卡(有界预览)
Took 0.0s
1 tool · run 1 · 2.1s                  ← recap 汇总行, 无 thinking 内容
```

对应：`assistant-message.ts` thinking fold + `hideThinkingBlock`；凡例三「thinking 依 pi
原生，不入目」。**保持**。未实机捕获流式 thinking 逐 token 画面（模型 think 快于采样），
但「不抢权重、不入 recap」的关键属性已由多帧证实。

### R2 — Successful tool burst

观察：连续成功 bash/write 后，工具卡收敛为「`$` 命令 + 输出预览 + Took 时长」，recap 落
一行汇总。**注意：成功内置工具未收敛为 S3 低对比目行（`bash <target>`），而是原生全卡**
——见 §7 差距 D1。

```text
$ cd /private/tmp/motto-tui-session-composition && node stats.mjs does-not-exist.txt; echo "exit=$?"
warning: does-not-exist.txt: ENOENT
file                     lines
TOTAL                    0
exit=1
Took 0.1s
…
2 tools · run 2 · 2.7s                  ← recap 汇总行(成功条目 collapsed 不逐条列出)
```

对应：`tool-execution.ts` S3 分支（源码在，实机未命中）+ `motto-review-flow`。成功静默在
recap 面成立（collapsed 不列成功条目）；chat 流内成功卡未压缩是差距 D1，不是 recap 面问题。
**调整候选**（入下一张工单，见 §8）。

### R3 — Controlled failure

观察（后续 2，`false` 无守卫）：失败整卡强显（toolErrorBg + `Command exited with code 1`），
recap 汇总行含 `1 failed` 段 **accent 红**，失败条目整行 accent、stderr 尾部提要 dim
（此处 `(no output)`），折叠态依然显露。颜色经 motto_vision 实机确认。

```text
$ false
(no output)
Command exited with code 1
Took 0.0s
1 tool · run 1 · 1 failed · 3.0s      ← "1 failed" accent 红
  bash  false · exit 1 · 9ms           ← 失败条目整行 accent(折叠态仍显)
  (no output)                          ← 错误提要 dim
```

对应：I1-1/I1-3/I3-1/I3-2，recap `buildTurnLines` collapsed 过滤 error。**保持**。

### R4 — Edit / diff

观察：edit 工具卡呈现 `@@ -8,8 +8,16 @@` 起头的 diff hunk（行内 `-`/`+`），recap 目行
`edit::…/stats.mjs · +12 −3`；diff 与周边 tool ledger 不争夺层级（diff 属工具卡内原生
renderDiff，recap 只记统计）。

```text
@@ -8,8 +8,16 @@
 }
 
 let total = 0;
+let warned = false;
 const rows = files.map((file) => {
-  const text = readFileSync(file, 'utf8');
+  let text;
+  try {
+    text = readFileSync(file, 'utf8');
+  } catch (err) {
+    console.error(`warning: ${file}: ${err.code}`);
+    warned = true;
+    return null;
+  }
@@ -17,7 +25,8 @@
…
edit /private/tmp/motto-tui-session-composition/stats.mjs
1 tool · change 1 · 20s                   ← recap 目行
```

对应：`core/tools/edit.ts` renderDiff + recap `toolMetric`。**保持**（diff 配色走既有
`components/diff.ts`，未在 dogfood 单独验色，沿用既有基线）。

### R5 — Final Markdown report

观察：最终回报是正文、永不折叠；H2 无前缀 bold、H3 投影 `› 标题`；` ```diff ` 围栏、
表格盒框、列表逐级成立；` ```bash `/` ```json ` 围栏（showcase 会话补样）以 ``` 行 +
cli-highlight 呈现，**不伪装成已执行命令**；表格与代码块不混同一语义。

主任务最终回报（1706 字符，canonical 原文节选，屏幕渲染与之一致）：

```markdown
## What I did
- **Created `stats.mjs`** — takes file paths as args…
- **Ran it on `does-not-exist.txt`**: crashed with `ENOENT`, exit 1.
- **Fixed it** so missing files print `warning: <file>: ENOENT`…

## Diff of the fix
```diff
@@ -8,8 +8,16 @@
…
```

## Test results after fix
| Run | Result |
| --- | --- |
| `node stats.mjs sample.txt` | `1` line, exit 0 |
| `node stats.mjs sample.txt does-not-exist.txt` | table + warning, exit 1 |
```

showcase 补样（60 列窗口，屏幕实测）：

```text
› Nested Headings                        ← H3 投影为 › 标题
- One
- Two
- Three
This paragraph demonstrates `inline code` rendered inside flowing text.
```bash
npm test
```
```json
{"ok":true,"count":3}
```
| Feature | Status |
| --- | --- |
| Render | ✅ |
| Pipeline | ✅ |
```

对应：I1-2（最终回答永不折叠）、I4-1（三档标题）、凡例三。`✅` 是模型自产 emoji，非
Motto 语义色（主题下按普通文本渲染）。**保持**。

### R6 — Narrow width / resumed state

观察：60 列窗口 resume 同一 session（session 选择器选中 → 全量恢复）；composer 与 footer
固定下缘；recap 失败行折叠态仍 accent；`/reload` 后扩展/主题/prompt 重载，footer 仍单行
（self-heal 生效）；全屏无超宽、无横向滚动；footer 左簇退化顺序实机符合「统计段先折 →
cwd 截断 → 模型信息最后折」。

```text
1 tool · run 1 · 1 failed · 3.0s      ← 60 列 recap 折行悬挂正常
  bash  false · exit 1 · 9ms
  (no output)
…
/private/tmp/motto-tui-session… (deepseek) deepseek-v4-pro · max
                                     ← 60 列: 统计段已折, cwd 截断(…), 模型信息保留
Reloaded keybindings, extensions, skills, prompts, themes, and context files   ← /reload 状态行
```

对应：I9-1/I9-2（render-baseline 40–200 列全绿 + 实机 60 列）、MOTTO-TUI-3（dock 固定）。
**保持**。窗口 resize 属 macOS AX 对同 app 第二实例不可寻址（System Events 只解析到
首实例），本轮的「窄宽」以配置窄窗启动 + resume 覆盖；80/100/120/200 列以 render-baseline
门禁 + footer-degrade 测试为准。

## 5. Canonical 对照表（session 增量 × 正典 × 实机）

| session 提议 | 当前是否已有 | 正典依据 | 真实 dogfood 证据 | 摩擦 | 最小改动面 | 折旧 | 退出条件 | 本轮判定 |
|---|---|---|---|---|---|---|---|---|
| 固定底栏（composer 沉底） | 已有（上游 ea1e77e2d） | MOTTO-TUI-3 / 凡例二 | R0/R6 实机：composer+footer 固定下缘，transcript 滚动 | 无 | 无 | 不折旧 | 上游回收即退役 | ALREADY_PRESENT |
| thinking 活跃可见、不抢正文 | 已有（hideThinkingBlock + fold 三态 + Ctrl+T） | 凡例三 / TUI-THESIS I7 | R1：单行标签，recap 无 thinking | 无 | 无 | 不折旧 | — | ALREADY_PRESENT |
| 成功工具默认收敛 | **半有**：recap 面收敛 ✓；chat 流内 S3 目行实机未命中（见 D1） | I2 / S3 PATCHES | R2 实机全卡 + recap 汇总并存 | 有（双份 tool+target 呈现） | 组件级接缝 1 处判定 | 不折旧 | 上游工具卡 projector 吸收 | CANDIDATE |
| 失败强制显露 | 已有 | I1-1/I1-3/I3 | R3：`1 failed` accent + 整行 accent + 提要 dim，折叠态仍显 | 无 | 无 | 不折旧 | — | ALREADY_PRESENT |
| diff 独立呈现 | 已有（renderDiff + recap 统计） | 凡例朱记三用 | R4：hunk 渲染 + `+12 −3` 目行 | 无 | 无 | 不折旧 | — | ALREADY_PRESENT |
| 最终 Markdown 为正文、永不折叠 | 已有 | I1-2 / 凡例三 | R5：H2/H3 投影、diff/bash/json 围栏、表格成立 | 无 | 无 | 不折旧 | — | ALREADY_PRESENT |
| ```bash 不等同执行记录 | 已有 | 凡例三 / 工单 §2.3 | R5：代码围栏为 ``` 行 + 高亮；工具执行走 `$` 卡 + 状态 | 无 | 无 | 不折旧 | — | ALREADY_PRESENT |
| text fence 不标 paste | 已有（无任何 paste 标注路径） | 工单 §2.3 | 全 session 无 paste 卡片出现 | 无 | 无 | 不折旧 | — | ALREADY_PRESENT |
| 顿号卡片（含标注小标签） | 已有（tui-4-s2，源已落地） | MOTTO-TUI-4 / cards.ts | 源与基线核实；本轮模型未自然输出卡片，实机未渲染（标 NOT TESTED） | 待验 | 无 | 不折旧 | — | ALREADY_PRESENT（实机 NOT TESTED） |
| 窄宽 40–200 不超宽 | 已有 | I9-1/I9-2 | 基线门禁全绿 + 60 列实机无超宽 | 无 | 无 | 不折旧 | — | ALREADY_PRESENT |
| footer 单行 + 折叠优先级 | 已有 | 凡例 Footer | 60 列实机：统计先折、cwd 截断、模型信息保留；/reload 后仍单行 | 无 | 无 | 不折旧 | — | ALREADY_PRESENT |
| resume 完整恢复 | 已有 | S23 不动 | R6：resume 选择器 → 全量恢复 + dock 固定 | 无 | 无 | 不折旧 | — | ALREADY_PRESENT |
| recap 目行对象列「命令首词」 | 已有（凡例三 7 对象列 review-safe） | 凡例三 | 实机：所有 bash 目行 target=首词（多为 `cd`），区分度差 | 轻微（可审性） | recap 目标抽取微调 | 不折旧 | — | CANDIDATE（观察期，不立单） |
| 参考图/书目隐喻迁移 | 不做 | 三不原则 / ROADMAP 四 | 无对应实机面 | — | — | — | — | NO_GO |

## 6. 当前行为与 session 意图的差距

### D1 — S3 目行在真实会话中不生效（唯一实质性差距）

- **源码结论**：`tool-execution.ts` `isSuccessIndexLine()` 对内置工具要求
  `toolDefinition === undefined` 才收敛为目行；但 `interactive-mode.ts:2000`
  `getRegisteredToolDefinition(name)` 直通 `agent-session.getToolDefinition(name)`，
  而 `_toolDefinitions` 由「内置定义（source `<builtin:${name}>`）+ 扩展注册」合成
  （`agent-session.ts:2479` 起）——**内置工具恒有 definition，S3 收敛条件恒假**。
- **实机结论**：成功 bash 全部渲染原生全卡（`$` 命令 + 输出预览 + `Took 0.0s`），
  与 recap 目行构成「tool+target 双份呈现」——正是
  `docs/architecture/TUI-REVIEW-FLOW-RESEARCH.md` §2.3 记录的重复感来源。
- **基线 vs 实机漂移**：`render-baseline.mjs:95` 以 `toolDefinition = undefined`
  构造组件，夹具中 S3 目行成立、基线全绿——**基线记录的是组件语义，不是实机接线**。
  这是本轮 dogfood 最有价值的一条：无头基线无法发现接线层失效。
- 归类：**真实 review 摩擦**（不是视觉偏好）——chat 流内成功工具不收敛，长会话
  「命令原文 + 输出预览」重复铺屏，与「成功静默」总则（I2）相悖。

### D2 — recap 目行对象列区分度（观察项，不立单）

凡例三 7「命令首词」在 `cd /path && node x` 形态下恒为 `cd`，一轮多个 bash 目行不可区分。
属观察期条款（凡例五 2：目录粒度参数以真实使用摩擦为据）；本轮仅记录，等 usage-log 证据。

### D3 — 非摩擦的观察项（记录，不施工）

- 用户设置 `hideThinkingBlock: true` 时 thinking 即安静标签，session 意图「收工后应安静、
  可折叠或依 Pi 原生」已由该设置达成；不需要新能力。
- `/exit` 不是合法斜杠命令（dogfood 中误发，模型按普通消息回复）——与本轮无关，不影响判定。
- 模型自产 emoji（表格内 `✅`）按普通文本渲染，不构成语义色。
- `docs/architecture/TUI-CARD-FRAME-RESEARCH.md` 落款 2026-08-14，早于本文记录日一天，
  疑似日期笔误，建议勘误（不属本工单范围，仅记录）。
- `fixtures/tui/baseline/GHOSTTY-BASELINE.md` 仍为 DRAFT 空表；本轮的实机证据在本文件，
  是否回填该用户侧表格由验收方决定。

## 7. 哪些只是视觉偏好，哪些是真实 review 摩擦

- **视觉偏好（不施工）**：参考图的书目隐喻、边框形态、字号行距等——三不原则直接排除；
  composer 边界的原生水平线属凡例二豁免，不视为装饰。
- **真实 review 摩擦（可立单）**：仅 D1——成功内置工具在 chat 流内不收敛，与 recap
  重复呈现 tool+target；失败路径、recap 面、footer、窄宽全部无摩擦。
- **待更多使用证据**：D2 recap 首词区分度；subagent 输出入目（ROADMAP 既有空白）。

## 8. 不应施工的内容（本轮判定）

1. 不新建 composer/布局系统、不动 alt-screen layout（上游已实现，已实机验证）。
2. 不把 thinking 写入 review ledger、不做 thinking 摘要。
3. 不新增 Card framework、不复活 fenced caption、不把 ```bash 标成执行记录、
   不把 text fence 标成 paste。
4. 不重做颜色/语义 token/diff 设计。
5. 不实现参考图任何「书目感」形制（仿古框、竖排、印章、装饰线）。
6. 不修改 fixture 基线来掩盖 D1（基线是组件语义记录，修正方向是接线层判定或
   S3 判定条件，且须走工单）。
7. 不在本轮修改产品代码。

## 9. 证据链与局限

- 机械证据：session JSONL 全量（recap turn 数据、thinking 原文、最终回报 1706 字符）；
  窗口截图 20 张（R0–R6）；OCR 行坐标；motto_vision 颜色抽样（R0 题名红、R3 failed 段红、
  R6 composer/边框/无超宽）；render-baseline --check 逐字节。
- 局限（如实）：computer-use 门禁关闭 → 鼠标拖选（I6-3）、滚轮路由未实机驱动；
  80/100/120/200 列未在真实窗口逐档目验（以 40–200 自动门 + 60 列实机覆盖）；
  diff 配色沿用既有基线未单独验色；顿号卡片本轮模型未自然输出，实机渲染 NOT TESTED。

---

## 附录：下一张工单建议（草案，本轮不执行）

> 只解决 D1，一个问题一个切片；最小改动、可验收、可回退。详见
> `docs/reviews/2026-08-13-handoff-tui-full-session-p0.md`。

- **TUI-1-S3-LIVE（拟定）**：让 `isSuccessIndexLine` 的「无自定义覆盖」判定与实机接线
  一致（例如以 `sourceInfo.source === "builtin"` 或独立的自定义注册表区分内置/扩展），
  恢复成功内置工具 → 低对比目行；失败/流式/展开态守卫不变；自定义工具维持 A1 行为。
  - 改动面预计：`interactive-mode.ts` 传参（1 处）+ `tool-execution.ts` 判定（1 处）
    + 对应测试；登记 PATCHES.json；removalCondition = 上游工具卡 projector 吸收。
  - 验收：coding-agent 全量测试 + render-baseline --check 不漂移（夹具语义不变）+
    真实 Ghostty 复跑一条成功 bash 目验单行目行。
  - 本轮状态：**DRAFT**，待用户裁定后立单。
