# PACK-REVIEW-FLOW-1 验收报告 — motto-review-flow(recap 层)

- 日期:2026-08-08
- 验收方式:单元测试 + 真实 loader 活体 + 真实 pi TUI 活体(并行乱序 / Ctrl+O)+ s002 独立复测
- 结论:**ACCEPTED**
- 源:`.pi/agent` 仓 notes/motto-suite-final-report.md、motto-suite-verification.md(原件保留)

## 1. 测试环境

Pi 0.84.1;deepseek-v4-flash;tmux 3.7b(嵌套 pty 真实 Ctrl+O 键序 0x0f);双宗真实 theme 渲染。

## 2. 架构边界

经公开 API:`pi.on(turn_start/tool_execution_start/tool_execution_end/turn_end/session_start)`、
`pi.appendEntry`/`pi.registerEntryRenderer`(custom entry,不入模型上下文)、pi-tui `Text`/`visibleWidth`/`Component`。
零私有路径;展示专用投影,不挂工具/消息渲染 hook,不改 session。

## 3. 验收项(逐项)

| 项 | 结果 | 证据 |
|---|---|---|
| 单元测试 25 项 | PASS | `test/review-flow.test.mjs`(25/25) |
| 并行乱序 + reload late-loaded 活体 | PASS | `review-flow-parallel.live.mjs`(17/17):完成序≠发起序逐项核对;reload 分支触发 |
| 真实并行 turn(3 bash,一失败) | PASS | `review-flow-parallel.pty.py`(12/12):计数/metric/errorLines 与实际吻合 |
| Ctrl+O 键路径(真实 0x0f) | PASS | `review-flow-ctrl-o.live.py`(13/13):折叠/展开/复折叠三态 vs `buildTurnLines(options.expanded,width=100)` 静态逐行一致 |
| 真实 loader + 真实 theme 渲染 | PASS | `review-flow.live.mjs`(双宗 × 折叠/展开 × 100/48 列) |
| session 投影有界 + review-safe | PASS | 单测:KB 级有界、不落原始输出、命令凭据 fail-closed |
| 守卫静默失活(缺 API) | PASS | 单测:不抛、不注入上下文、仅 TUI 一次性警告 |
| 死代码/调试语句 | PASS | noUnusedLocals 零告警;grep 零命中 |

## 4. 已发现问题

- 驱动侧(非本件):`/tmp` 脆弱性 + 残留污染(session-id 写死致续写)→ 属驱动缺陷,s002 独立修复于
  17b61ec,与本件无关。
- 本件零发现。

## 5. 最终结论

ACCEPTED。渲染输出与静态 `buildTurnLines` 逐行一致,Ctrl+O 两态与 pi 全局 expanded 联动正确。

## 未覆盖 / 残余风险

- 真三层 progressive disclosure 挂上游 transcript projector(README 遗留节)。
- Ghostty 目视终验(用户侧)。

## 源 commit 互引

- `.pi/agent`:e81cf08(补验)/ a9bbba6(阶段三)/ 17b61ec(健壮版驱动)/ f186ed9(s002 核验)
- `motto-extensions`(本仓):本 pack 归仓 commit
