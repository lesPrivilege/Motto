# motto-review-flow — 对话流 recap 层

对话流 turn 级 recap:每 turn 一条 `motto-review-flow.turn.v1` 投影(纯展示),经 pi 原生 custom entry
落盘,不入模型上下文、不改工具/消息/session 语义。

体例正典见仓内 [`docs/MOTTO.md`](../../../docs/MOTTO.md)「目录体例」节。

## 能力

- **recap 两态**:汇总一行(独立,失败强显)→ 展开逐条(随 pi 全局 expanded 状态,Ctrl+O)。
- **机械投影**:tool 名、路径、计数、耗时、退出状态取自原生元数据;无 LLM 摘要或改写;错误提要为
  stderr 尾部原文(≤5 行,dim)。
- **review-safe**:对象列只投影路径/模式/命令首词,不复制 content、完整输出、custom-tool 参数;
  命令凭据形状 fail-closed(Authorization/token/JWT/URI userinfo/高熵)。
- **成功静默,仅偏差入记**:失败/超时/非零退出以 accent 标示,禁 ✓/× 与 success/warning/error 语义色。
- **session 投影有界**:单 turn KB 级,`turn.v1` 唯一 entry type。
- **守卫为静默失活**:pi 缺 `appendEntry`/`registerEntryRenderer` 时本件不注册、不渲染、不抛错,
  仅启动一次性警告(仅 TUI)。

## 启用 / 部署

部署位为 pi 扩展目录,由 `scripts/maint/deploy.sh` 统一拷贝。

## 测试

```bash
cd extensions/motto-review-flow && npm install && npm test && npm run typecheck
```

`test/review-flow.test.mjs`:25 项(投影 review-safe/命令凭据 fail-closed/度量/退出状态/错误提要/
有界性/两列悬挂/CJK 双列/窗口缩放/fail-closed 守卫)。活体验收(真实 loader + Ctrl+O + 并行乱序)
见 `reports/`。

## 边界与遗留

- 真三层 progressive disclosure(per-entry ID + collapsed/preview/full)挂上游 transcript projector,
  本件按「recap 两态」守界。
- Ghostty 目视终验(用户侧)未做。
- 上引 `docs/MOTTO.md` 为凡例正典;冲突时以正典为准并回仓修订。
