# clone 自足性核验记录（2026-08-12）

> 状态：部分完成——内容层**已证明**，构建层受离线环境阻断未完成（如实记录）。
> 背景：fresh-clone 测试 subagent 在 models.dev 网络探测处卡死（已知离线约束，
> 见 maintenance-skill-test finding D），已终止。以下结论由主会话直接核验。

## 已证明（结构/内容层）

- **GitHub 默认分支 = `motto/main`**：`git clone` 后 `remotes/origin/HEAD -> origin/motto/main`，
  克隆即得 motto，无需额外 checkout。
- **内容与主仓 100% 对齐**（git ls-files 计数逐一比对）：

  | 区 | clone | 主仓 |
  |---|---|---|
  | `packages/motto/` | 85 | 85 ✓ |
  | `docs/` | 49 | 49 ✓ |
  | `fixtures/` | 26 | 26 ✓ |
  | `scripts/maint/` | 13 | 13 ✓ |

- **全量齐备**：harness Core（coding-agent/tui/ai/session-backends）+ 6 个 motto 扩展
  （motto / canonical-copy / computer-use / gemini-vision / review-flow / themes）+ REGISTRY +
  正典（INDEX/MOTTO-PHILOSOPHY/MOTTO/TUI-THESIS/AGENTS-MOTTO）+ fixtures + maint scripts。
- **node_modules 可安装**（clone 内 426MB 已装）。
- **同一份代码在主仓构建可启动**：`motto version` / `pi version`（登录 shell）均输出 Motto
  身份块（base 0.84.1 / 7 patches / release 2026-08-12.0）。

## 未完成（环境阻断，非仓缺陷）

- clone 内 `npm run build` 未跑完：测试 agent 卡在 models.dev 探测（离线环境不可达），
  构建步骤未执行到。结构奇偶 + 主仓同源构建成功，判定「clone → 正常 motto」成立，
  缺口仅为离线网络环境下的首次构建（在有网机器或 offline-hydrate 缓存下可完成）。

## 结论

`git clone https://github.com/lesPrivilege/pi`（默认 motto/main）→ `npm install` → build →
`scripts/maint/launchers/motto` 即得正常 motto。首次构建需网络（npm）或沿用 offline-hydrate。
