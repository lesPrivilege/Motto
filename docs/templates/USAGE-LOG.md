# usage-log — <YYYY-MM>

真实使用记录（dogfooding）。每条 = 一次真实工作流中的遭遇。这是维护 backlog 的来源；
**没有记录的功能不升级、不扩面**。

## 条目格式

```text
### YYYY-MM-DD HH:MM — <一句话现象>

- 场景：<这次在做什么真实任务>
- 扩展/动作：<pack> <cu_xxx / 命令>
- 目标应用/环境：<TextEdit / Safari / 多屏 / …>
- 现象：<成功 | 失败 | 异常行为 | 想做的做不到>
- 可逆性：<是否可逆；已如何恢复>
- 疑似根因：
- 处置：<已修 / 待修 / 记录为版本限制 / 已记录待验收>
- 跟进：<issue/回链接>
```

## 2026-08

### 2026-08-08 — 首次动态验收（PACK-COMPUTER-USE-1 正式签收）

- 场景：motto-computer-use 最终动态验收（真实二进制捕获 / live / pi 模型闭环）。
- 扩展/动作：motto-computer-use：cu_see / cu_image / cu_set_value / cu_click。
- 目标应用/环境：TextEdit 草稿，单屏，macOS 26.5.2。
- 现象：核心链路全部通过；发现 3 个真实问题（见下）。
- 可逆性：全部可逆（草稿文本 / 光标点击），已 `saving no` 关闭并清理。
- 疑似根因与处置：
  1. `_meta → meta` 归一化缺失导致 coordinate_context 全链路丢失 → **已修**（mcp-client.ts）。
  2. `cu_see` 观察会激活目标应用 → **记录为版本限制**（Peekaboo v3.10.0），动作环节不受影响。
  3. CLI `peekaboo image` 残留 bridge daemon → **记录为版本限制**，MCP 路径无此问题。
- 跟进：验收报告 `extensions/motto-computer-use/reports/PACK-COMPUTER-USE-1-acceptance.md`；
  结论 ACCEPTED WITH LIMITATIONS。剩余限制（多屏 / 后台键盘 / see 激活策略 / CLI daemon）拆为独立增强项。
