# PACK-CANONICAL-COPY-1 验收报告 — motto-canonical-copy(复制边界层)

- 日期:2026-08-08
- 验收方式:单元测试 + 真实 pi 冒烟(命令分发 + 剪贴板)+ s002 独立复测
- 结论:**ACCEPTED**
- 源:`.pi/agent` 仓 notes/motto-suite-final-report.md、motto-suite-verification.md、pack-interact-1-local-acceptance.md(原件保留)

## 1. 测试环境

Pi 0.84.1;macOS 26.5.2;真实模型 turn 产出后执行 `/copy-answer`、`/copy-code`。

## 2. 架构边界

只依赖公开 API:`pi.registerCommand`/`pi.registerShortcut`、`ctx.sessionManager.getBranch()`、
`copyToClipboard()`(pi 公开导出)。复制源 = session 数据(非屏幕投影);不 monkey-patch 私有方法、
不拦截 stdout/OSC 52、不自建剪贴板后端。

## 3. 验收项(逐项)

| 项 | 结果 | 证据 |
|---|---|---|
| 单元测试 8 项 | PASS | `test/policy.test.mjs`(8/8) |
| `/copy-answer` 分发 | PASS | smoke-final.py:剪贴板为整段回答(>100 字符),notify「Copied canonical answer」 |
| `/copy-code` 分发 | PASS | smoke-final.py:fenced code 原文(非整段),逐字节保真 |
| 复制源为 canonical session 数据 | PASS | 单测:trailingAssistantText/findLastAssistantText/findLastFencedCode;软折行不拼接 |
| 无可复制内容 fail-closed | PASS | 单测 + 代码路径(仅提示,零写入) |
| 快捷键 env-gated,默认不启用 | PASS | 代码审计(MOTTO_COPY_ANSWER/CODE_SHORTCUT);shift/super 启动警告 |
| typecheck | PASS | `npm run typecheck` 零错误 |

## 4. 已发现问题

- 冒烟初版剪贴板轮询时序不稳(会话提交延迟 + 系统剪贴板残留)→ 属测试驱动问题,改为轮询剪贴板变更 +
  重试;本件零发现。

## 5. 最终结论

ACCEPTED。复制边界与体例一致(复制体例见 docs/MOTTO.md);上游 clean copy 落地后本件退役。

## 未覆盖 / 残余风险

- 任意鼠标选区 clean copy 属上游课题(#7721 等),本件不承诺。

## 源 commit 互引

- `.pi/agent`:b0b9902(验收收编)/ 50ed842(alt+shift 警告)/ 563be3a(PACK-INTERACT-1 三修一正名)/ a9bbba6(阶段三)/ f186ed9(s002 核验)
- `motto-extensions`(本仓):本 pack 归仓 commit
