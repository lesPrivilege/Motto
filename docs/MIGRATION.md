# 迁移指南（MIGRATION）— Motto

换机 / 重装时从零再生 Motto 足迹的唯一路径。本仓是唯一 canonical source；
部署位、二进制、命令位、用户环境文件按下表逐项落位。

## 足迹清单（仓外触点）

| 触点 | 类型 | 再生方式 | 依据 |
|---|---|---|---|
| `~/.pi/agent/extensions/` 部署位 | 自动可再生 | `scripts/maint/deploy.sh` | 部署位镜像，仓库唯一真源 |
| `~/.pi/agent/themes/` 主题 | 自动可再生 | `scripts/maint/deploy.sh` | 同上 |
| computer-use 二进制 | 自动可再生 | `scripts/maint/fetch-binaries.sh`（checksums 两级校验，fail-closed） | 固定版本 + SHA-256 |
| launcher shim `~/bin/motto` | 自动可再生 | `ln -s <repo>/scripts/maint/motto ~/bin/motto` | 命令位，用户环境显式安装 |
| `~/.pi/agent/settings.json` 关键键 | 人工（随 `.pi/agent` git 仓 clone） | 见下，只列键名与依据 | 该文件归 `.pi/agent` 仓 |
| `~/.zshrc` 两条 MOTTO_COPY env | 人工 | 手动 export | 快捷键 env-gated |
| ghostty 配置 `theme = light:/dark:` 双值 | 人工 | 手动改 ghostty config | 双宗 auto |
| 各项目 `.motto/agent.md` | 无需迁移动作 | 随项目仓走 | 项目自有，本仓不收容 |

### settings.json 关键键（只列键名与依据，文件本身归 `.pi/agent` git 仓，迁移即 clone）

- `theme: "motto-light/motto-dark"` — 双值，牌记/footer 双宗（见 `docs/MOTTO.md`「主题」）。
- `hideThinkingBlock: true` — thinking 隐藏（个人偏好）。
- `packages` 钉版 — `pi-rewind@0.5.0` / `pi-lsp@0.49.4` / `pi-subagents@0.14.3`，依据：省视第五步钉版核对、`MAINTENANCE.md`「第三方构件版本维护」（升级只按安全修复或 usage-log 摩擦）。

### zshrc MOTTO_COPY env

- `export MOTTO_COPY_ANSWER_SHORTCUT=alt+c` — ⌥C 复制最后一条 answer
- `export MOTTO_COPY_CODE_SHORTCUT=alt+x` — ⌥X 复制最后一段 fenced code

依据：motto-canonical-copy 快捷键 env-gated（不设 env 则快捷键不启用）。

### ghostty

- `theme = light:<…>/motto-light dark:<…>/motto-dark`（双值；双宗 auto，不跟随系统的终端须自声明外观与底色一致，见 `docs/MOTTO.md`）。motto 主题文件已在 `~/.config/ghostty/themes/`。

## 一键再生（自动项）

```bash
./scripts/maint/bootstrap.sh
```

幂等：重复执行零副作用（已就位且校验通过的部署位 / 二进制 / shim 均跳过）。结束后打印「人工项清单」，**只打印不代写**——用户环境文件的修改保持显式动作纪律（与 `.motto` 立域同族）。

## 手动步骤（人工项照单走）

1. clone 两个仓：`~/.pi/agent`（settings / models / skills / notes 随之而来）与 `pi`（本仓，单仓自足含全部 Motto 产品内容，`git clone https://github.com/lesPrivilege/pi.git`，放 `~/Projects/`）。
2. 跑 `./scripts/maint/bootstrap.sh`（自动项全落位）。
3. 按脚本末尾清单逐项：zshrc 两条 env、ghostty theme 双值、settings.json 关键键核对。
4. 各项目 `.motto/agent.md` 随项目仓 clone 自动携带，无需动作。
5. 验证：真实 pi 起会话，五项冒烟（牌记 / footer 含 TPS / recap 落盘 / `/copy-answer` / `cu_*` 门禁 fail-closed）+ `./scripts/maint/drift-check.sh` PASS。

## 验收

- 临时 HOME 沙盒跑 bootstrap（`HOME=<沙盒> PI_CODING_AGENT_DIR=<沙盒>/.pi/agent ./scripts/maint/bootstrap.sh`）→ 五项冒烟全过 + drift-check PASS。
- 本清单步骤照单走一遍无缺项（沙盒验证记录见交付简报）。
