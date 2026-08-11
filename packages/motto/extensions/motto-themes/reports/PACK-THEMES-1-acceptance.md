# PACK-THEMES-1 验收报告 — motto-themes(三 JSON)

- 日期:2026-08-08
- 验收方式:声明式 JSON 静态验收 + 真实 TUI 双宗渲染 + s002 复核
- 结论:**ACCEPTED**(Ghostty 目视终验为用户侧遗留)
- 源:`.pi/agent` 仓 notes/motto-suite-final-report.md、motto-suite-verification.md、theme-auto-closure.md(原件保留)

## 1. 文件与角色

| 文件 | name | 角色 | 来源 |
|---|---|---|---|
| `motto.json` | motto | 基准单宗(dark 基底,vars 驱动) | `.pi/agent` 仓历史 38967e8(sealed 终版) |
| `motto-dark.json` | motto-dark | 深宗 | `.pi/agent/themes/motto-dark.json` 原件 |
| `motto-light.json` | motto-light | 浅宗 | `.pi/agent/themes/motto-light.json` 原件 |

## 2. 语义契约

- 五主槽 bg/text/accent/dim/dimmer + mid(双宗同值 #8a9095);dimmer/mid 为 motto 私有槽。
- 其余字段按同一灰阶逻辑就近映射,不引入新色相;扩展代码无 hex(theme 只存色)。
- 深浅双宗版式逐字符一致,仅颜色不同(双宗 auto)。

## 3. 验收项(逐项)

| 项 | 结果 | 证据 |
|---|---|---|
| 三 JSON 结构合法、name 正确 | PASS | JSON 解析 + 键集核对 |
| 双宗真实渲染 | PASS | 真实 pi TUI 牌记/footer 双宗渲染(review-flow.live.mjs、Ctrl+O 活体) |
| 扩展缺槽降级 | PASS | `motto` pack 测试:内置 dark/light 无 dimmer/mid 时静默降级到 dim,不崩 |
| 色值无越界(仅本 pack 存 hex) | PASS | `motto` pack 源码红线测试(扩展代码无 hex) |

## 4. 已发现问题

- 无。

## 5. 最终结论

ACCEPTED。

## 未覆盖 / 残余风险

- Ghostty 目视终验(双宗切换、window-theme 一致性;用户侧)。
- ghostty `command` 直启 pi 的 syncAppearance 闪现窗为已知边界(正典记录)。

## 源 commit 互引

- `.pi/agent`:38967e8(motto.json sealed)/ 6ad1884(footer 窄宽修复,同主题基线)/ a9bbba6(阶段三)/ f186ed9(s002 核验)
- `motto-extensions`(本仓):本 pack 归仓 commit
