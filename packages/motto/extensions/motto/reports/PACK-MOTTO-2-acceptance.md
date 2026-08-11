# PACK-MOTTO-2 验收报告 — fenced 块展示牌记（display-only captioning）

- 日期：2026-08-09
- 验收方式：单元测试（21 项新增 + 全 pack 45 项）+ 真实 pi-tui Markdown 渲染探针 + 真实 Motto TUI dogfood（嵌套 pty）+ canonical session 检查 + 全量回归
- 结论：**ACCEPTED**（FLOW-FENCED-BLOCKS-1）
- 工单：`FLOW-FENCED-BLOCKS-1`（登记见 docs/usage-log/2026-08.md）

## 状态

```text
FLOW-FENCED-BLOCKS-1
IMPLEMENTED                    ✅
OFFLINE_VERIFIED               ✅（21 项单测全绿 + typecheck + 全量回归）
PI_TUI_RUNTIME_DOGFOODED       ✅（真实 pi TUI:assistant/user/边界三组输入）
CANONICAL_CONTENT_UNCHANGED    ✅（session 正文无 caption;print/json 不经过）
REMOTE_SYNCED                  ✅（commit 7773a18,本地/远端 HEAD 一致,见 8 节）
```

## 1. 测试环境

- OS / 架构：macOS 26.5.2（arm64）
- Pi/Motto 版本：`@earendil-works/pi-coding-agent` 0.84.1（锁定）
- 固定运行时：无外部二进制（纯函数,零新增依赖）
- 承载进程：真实 pi TUI（嵌套 pty / tmux capture）+ 本地 node --test

## 2. 架构边界

```
消息正文(canonical, 零改动)
  → pi interactive 组件(assistant-message / user-message)经 createMarkdownTransform
      → motto 扩展 registerMarkdownTransformer(annotateFencedBlocks)   ← 唯一接入点
          → 投影 caption + 空行 + 原 fence
  → pi-tui Markdown 组件(marked + 原生 fenced-code renderer)渲染
```

- 仅经 pi 0.84.1 公开 `ExtensionAPI.registerMarkdownTransformer`(dist types.d.ts:920)。
- pi core 的 `applyMarkdownTransformers` 逐个 try/catch(fail-open);transform 只存在于
  `modes/interactive/components/{assistant,user}-message.js`,print/json/RPC 路径不经过。
- session / 模型上下文 / resume·fork 数据 / tool result 均零改动(见 6 节 canonical 检查)。

## 3. 验收项（逐项）

| 项 | 结果 | 证据 |
|---|---|---|
| `text` → `文本块 · N 行` | PASS | `fenced-blocks.test.mjs` |
| `txt` / `plaintext` alias | PASS | 同上 |
| `log` → `日志 · N 行` | PASS | 同上 |
| `bash` / `sh` / `shell` / `zsh` alias → `命令片段` | PASS | 同上 |
| language 大小写不敏感 | PASS | 同上 |
| opening / body / closing 逐字保留(含缩进/info string) | PASS | 同上 |
| 行数只计 body 逻辑行,不含 fence;空 body 为 0 行 | PASS | 同上 |
| 同一消息多个目标块分别加牌记 | PASS | 同上 |
| 非 allowlist language / 无 language / 未闭合 完全不变 | PASS | 同上 |
| `isStreaming: true` 完全不变 | PASS | 同上 |
| thinking(assistant-thinking)完全不变 | PASS | 同上 |
| blockquote / list 内 fence 不变 | PASS | 同上 |
| 4 反引号包裹含 3 反引号正文不提前闭合 | PASS | 同上 |
| tilde fence 正确解析;与反引号互不闭合 | PASS | 同上 |
| CRLF 不破坏正文 | PASS | 同上 |
| 幂等(重跑不重复插入) | PASS | 同上 |
| malformed 输入 fail open | PASS | 同上 |
| 真实 pi-tui 渲染:caption 行 + 空行 + 原生 fenced block | PASS | 探针经 pi-tui `Markdown` 组件渲染 |
| 真实 TUI dogfood:assistant / user / 边界三组 | PASS | 见 5 节 |
| canonical session 无 caption 字样 | PASS | 见 6 节 |
| 全 pack 回归 + governance + drift 无回归 | PASS | `scripts/regression.sh` 11/11;`ci-checks.sh governance` PASS |
| 无新依赖 / 无 Pi core 改动 | PASS | package.json 未动;diff 仅 motto pack 展示层 |

## 4. 能力矩阵

| 场景 | 投影 | 备注 |
|---|---|---|
| 顶层 `text` fence(完成态) | `文本块 · N 行` + 空行 | 无 paste 语义 |
| 顶层 `bash`/`sh`/`shell`/`zsh` fence | `命令片段 · N 行` + 空行 | 无执行状态/时长/exit |
| 顶层 `log` fence | `日志 · N 行` + 空行 | — |
| 其余语言 / 无 language / 未闭合 / 嵌套 | 原样 | 不做近似识别 |
| 流式中 / thinking | 原样 | 防闪烁 |

## 5. 真实 TUI dogfood

- 启动方式：`deploy.sh motto` 部署后,在临时目录以嵌套 pty + tmux capture 启动真实 `pi` TUI
  （同一锁定 0.84.1,motto 扩展自动发现加载）。
- 输入 A（assistant fenced blocks）：主模型输出 text / bash / json 三块 → 完成后 `text` 块上方
  显示 `文本块 · 3 行`、`bash` 块上方 `命令片段 · 2 行`、`json` 块无牌记;fence/缩进/引号原样;
  无 execution status;无重复 caption;流式期未见 fence 破坏。
- 输入 B（user fenced block）：真实 user 消息含顶层 `text` fence → user 消息显示 `文本块 · 1 行`;
  session 正文仍为原始文本(见 6 节)。
- 输入 C（边界）：未闭合 fence 与 unsupported language 原样;`/reload` 后无重复 caption;
  终端宽度变化(窄/宽)重绘无重复 caption;resume 当前测试 session 无重复 caption。
- 现有 theme / review-flow / 表格 / 列表 / 代码高亮未见回归（同屏目视）。
- 终端选择/复制 code body：复制源为 session 数据(经 /copy-code 验证取回 body 原文无 caption),
  屏幕投影不改写正文——复制行为记录为「经 session 源复制无 caption,与 display-only 设计一致」。

## 6. Canonical content 检查

- 检查真实 session jsonl：`message.content` 中不存在 `文本块 · N 行` / `命令片段 · N 行` / `日志 · N 行`
  字样（除用户/模型原文外）。
- print/json 输出不经过 markdown transform（pi core 仅 interactive 组件消费）,无 caption。

## 7. 已发现问题

无（观察期记录见 usage-log）。

## 8. 远端同步

- 已 push:`d6cc338..7773a18 agent/ship-gemini-vision`;本地 HEAD == 远端 branch hash == `7773a18`。
- 注意：`motto-gemini-vision`「凭据统一真源」为同仓另流工作(另写者,commit `d6cc338`,已推远端),
  与本工单无关;本批只 stage motto pack 文件(REGISTRY.md 的 motto 行增补已随 d6cc338 入仓,不重复提交)。

## 最终结论

ACCEPTED — completed top-level text/log/shell fences receive lightweight display-only captions in the
Motto TUI. Canonical messages, model context, session data, tool execution, and Pi core remain unchanged.
Real interactive TUI dogfood passed.

---

## 9. 目验复核与状态撤销（2026-08-09 追加，不改史、注补史）

> **本报告第 1 节「结论：ACCEPTED」判定撤销。** 原验收记录保留供追溯，不作删除。

- 复核方式：用户在**真实 Motto/Ghostty TUI** 目验（决定性证据，截图存档）。
- 技术链路：`registerMarkdownTransformer` 已实际注册、`annotateFencedBlocks` 已实际加载、
  Pi Markdown renderer 已消费投影——技术路径验证通过。
- 视觉结果：**未形成 card affordance**。caption 仅表现为普通正文（与正文同字号同层级），
  原生 fenced-code renderer 仍显示 ```` ```lang ```` / ```` ``` ````，H3+ 仍显示 `### ` 前缀；
  整体只增加纵向留白，未改善 reviewability——视觉目标失败。
- 裁定：NO-GO，回退全部本工单改动（见 usage-log 2026-08-09 条目）。
- 处置：移除 `index.ts` 中 `annotateFencedBlocks` 的 import 与 `registerMarkdownTransformer` 注册；
  删除 `fenced-blocks.ts` 与 `test/fenced-blocks.test.mjs`；tsconfig include 恢复 `["index.ts", "core.ts"]`；
  部署位同步回退。fenced 块回到 Pi 原生基线，canonical/session 无任何迁移或改写。
- 状态登记：**`FLOW-FENCED-BLOCKS-1 — ROLLED_BACK (VISUAL_ACCEPTANCE_FAILED)`**。
