# PACK-MOTTO-1 验收报告 — motto(TUI 品牌层)

- 日期:2026-08-08
- 验收方式:单元测试 + 真实 pi 冒烟 + 真实 TUI 活体(嵌套 pty + tmux)+ 只读代码复核(s002 独立)
- 结论:**ACCEPTED**(Ghostty 目视终验为用户侧遗留)
- 源:`.pi/agent` 仓 notes/motto-suite-final-report.md、motto-suite-verification.md、tps-acceptance.md(原件保留不删)

## 1. 测试环境

- OS:macOS 26.5.2(arm64);Pi 0.84.1;tmux 3.7b
- 真实模型:deepseek-v4-flash(openai-responses);主题 motto-light/motto-dark 双宗

## 2. 架构边界

牌记/footer/标题/提示词品牌化全部经公开 API(`ctx.ui.setHeader/setFooter/setTitle`、`pi.on`
session_start/session_info_changed/session_shutdown/before_agent_start/message_start/update/end、
`ctx.sessionManager`、`ctx.getContextUsage`、`theme.fg/bold`);零私有路径;数据只读会话与事件,不改
session/模型上下文。

## 3. 验收项(逐项)

| 项 | 结果 | 证据 |
|---|---|---|
| 牌记版式(左锚/两列悬挂/疏排/一朱/零线) | PASS | `motto.test.mjs` 宽度 + 渲染;真实 TUI 冒烟 |
| 列宽 40/60/66/80/200 零超宽零崩溃 | PASS | `motto.test.mjs`(含在 48/48 内) |
| footer 左簇降级显式优先级 | PASS | `footer-degrade.test.mjs`(逐宽度序列比对) |
| theme 槽降级(dimmer/mid 缺槽静默→dim) | PASS | `motto.test.mjs`「非 motto 主题不炸」;s002 只读复核 |
| 全屏红线(无 hex/无 `•`/DECDHL 关闭) | PASS | `motto.test.mjs` 源码断言 |
| **TPS 五判定** | PASS | `tps.test.mjs`(6 项)+ `tps.live.py` 真实观测(结算均值 67-71 t/s) |
| 标题守护/提示词品牌化 | PASS | 真实冒烟牌记出现;s002 复核 |
| 真实 TUI 渲染(双宗 + Ctrl+O 联动) | PASS | `review-flow-ctrl-o.live.py`(footer 同屏验证) |
| 无死代码/调试语句 | PASS | `--noUnusedLocals/Parameters` 零告警;grep console 零命中 |

## 4. 已发现问题

- `message_update` 的 `message` 字段流式期为空对象(role 缺失)→ TPS 事件接线原 role 过滤全跳过,
  **已修**(改按 `assistantMessageEvent` 取 delta);此为 TPS 落地关键勘误,单测 + 活体复测锁定。

## 5. 最终结论

ACCEPTED。与 f186ed9 基线比对逐项一致(差异仅 TPS 新增项),无回归。

## 未覆盖 / 残余风险

- Ghostty 目视终验(用户侧,预期唯一遗留)。
- `hardWrap`/`truncateToWidth` 跨件重复为裁定保留项(见 README 遗留节),不趁迁移改。

## 源 commit 互引(两仓)

- `.pi/agent`:a9bbba6(阶段三 polish)/ 17b61ec(健壮版驱动)/ f186ed9(s002 核验)/ f6f93ca(TPS 落地)
- `motto-extensions`(本仓):本 pack 归仓 commit(见仓根 README 互引表)
