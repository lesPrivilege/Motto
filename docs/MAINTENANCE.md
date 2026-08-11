# 维护模型（三层 + 收官节奏）— Motto

长期维护的主引擎是 **dogfooding**，防腐剂是**契约再验收**。本仓为唯一 canonical source；
部署位（`~/.pi/agent/extensions/`、`~/.pi/agent/themes/`）由 `scripts/deploy.sh` 拷贝并受
`scripts/drift-check.sh` 守护。

## 第 1 层 · 狗粮反馈层（主引擎）

- 强制 self-host：每个 pack 必须进入维护者的真实 PI 工作流，不只是被测试调用。
- 每次真实使用遇到问题 → 写 `docs/usage-log/YYYY-MM.md` 条目（模板见 `docs/templates/USAGE-LOG.md`）。
- 规则：**没有 usage log 支撑的功能不升级、不扩面**。usage log 是维护 backlog 的唯一可信输入。
- 所有 pack（motto / canonical-copy / review-flow / themes / computer-use）一律适用。

## 第 2 层 · 契约层（防腐剂）

- pack = 代码 + 安全契约（白名单 / 固定版本 + SHA-256 / fail-closed 路径）+ 验收报告。
- 任何变更必须跑该 pack 全量回归（`scripts/regression.sh`）；行为变化直接记录，不引入兼容层。
- 部署一致性：`scripts/drift-check.sh`（部署位 vs 仓库 diff 非空即报警）并入 `regression.sh`
  与 `ci-checks.sh governance`；部署后 `/reload` 或重启 pi 生效。

## 第 3 层 · 环境驱动层（事件触发，最容易悄悄坏）

- macOS 大版本升级 → 全量回归 + 真实 TUI/主题/复制链路验证 + 权限再确认。
- 上游发版 → 按下方「Pi 升级流程」走完再决定升级或继续固定。
- 季度契约审计 → 白名单是否仍最小、权限边界、stale/越界 fail-closed 是否被环境破坏。

## 收官节奏表（双周或 pi 升级触发，取先到者，写死）

| 动作 | 节奏 | 产出 |
|---|---|---|
| 真实使用 + usage log | 随用随记 | `docs/usage-log/YYYY-MM.md` |
| **定期省视**（drift + regression + 上游导出核对 + backlog 裁定） | **每双周，或 pi 升级触发（取先到）** | `docs/reviews/YYYY-MM-DD-review.md`（模板 `docs/templates/ACCEPTANCE.md`） |
| 回归 + 修 bug | 每月（或每批 usage log） | 更新后的验收报告 |
| 全量回归 | macOS 升级 / 上游发版时 | 复验报告（PASS / PARTIAL / FAIL） |
| 契约审计 | 每季度 | 审计 checklist 勾选 |
| 收容仓盘点 | 每季度 | `extensions/REGISTRY.md` 更新 |

### 定期省视的五项固定步骤

1. **drift check**：`./scripts/drift-check.sh`，部署位与仓库不一致即收敛（deploy.sh）。
2. **regression**：`./scripts/regression.sh` 全量单测 + typecheck + drift，FAIL 即先修。
3. **上游 dist 导出核对**：确认 review-flow 依赖的两个 custom-entry API 仍在 pi dist 导出：
   `grep -nE "registerEntryRenderer|appendEntry" node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
   （任一缺失 → review-flow 按凡例「守卫静默失活」处置，登记本省视记录）。
4. **usage-log 汇 backlog**：本月/双周内全部条目逐条裁定（已修 / 待修 / 记录为版本限制 / 已记录待验收），
   产出入模板（`docs/templates/ACCEPTANCE.md` 或省视专用节），不回填未裁定条目。
5. **第三方扩展钉版核对**：对照 `~/.pi/agent/settings.json` 中钉住的社区扩展
   （现为 pi-rewind / pi-lsp / pi-subagents 类），顺看各自上游 release；只在
   安全修复或 usage-log 摩擦指向时升级，升级后跑真实 TUI 冒烟 + 本仓全量回归。

## 第三方构件版本维护（最小实现）

- **版本真源唯一**：`~/.pi/agent/settings.json` 的钉版本即全部事实；本仓与全局 AGENTS.md
  均不登记版本清单（防双真源漂移，也不给每轮 session 加 context 税）。
- **理由与来历**：钉住/升级/回退一律在 `~/.pi/agent` 仓以 commit 落账，message 写明依据
  （安全修复 / 摩擦记录 / 上游 breaking），可由 git log 追溯，不另立文档。
- **升级依据**：与 pack 同纪律——无 usage-log 摩擦、无安全修复不升级；"上游出了新版"
  本身不构成升级理由。
- **harness core（pi）**：按上方「Pi 升级流程」，不适用本节。

## Pi 升级流程（写死）

> **上游更新通道（拉模式）**：Motto 对上游更新采取拉模式——更新的唯一接收器是定期省视（第五步含钉版核对）与升级流程；上游推送提示若被呈现层接管遮蔽，属预期而非缺陷。
>
> 注（2026-08-08 核查，pi 0.84.1 dist）：上游确有内建更新推送，但全部呈现于 **chat 区**（`chatContainer`），不经 footer/牌记区——
> (1) pi core 版本检查 `utils/version-check.js:65` `checkForNewPiVersion`（请求 `https://pi.dev/api/latest-version`）→ `interactive-mode.js:752` → `showNewVersionNotification`（`interactive-mode.js:3374`）写 `chatContainer`；
> (2) 扩展包更新检查 `core/package-manager.js:912` `checkForAvailableUpdates`（settings.json `packages` 的 npm/git 语义化版本比对）→ `interactive-mode.js:758` → `showPackageUpdateNotification`（`interactive-mode.js:3397`）写 `chatContainer`；
> (3) 启动 changelog（`interactive-mode.js:882` `getChangelogForDisplay` / `:511` `showStartupNoticesIfNeeded`）写 `chatContainer`。
> motto 的 `setHeader`（替换 builtInHeader = logo+快捷键+onboarding，`interactive-mode.js:694/1777`）与 `setFooter`（footer-data-provider 仅 branch/statuses/provider count，无版本项）**均不遮蔽**推送；print/RPC 模式无任何版本检查。未做降版本安装活体复现（推送仅在「真有更新」且联网时触发，与接管面零交叠，dist 推演可定论）。

1. **核对导出**：确认 `appendEntry` / `registerEntryRenderer` 仍在上游 dist 导出（上述 grep）；
   若改名/缺失，先按凡例静默失活处理 review-flow，再评估。
2. **部署位灰跑**：升级 pi 后，`./scripts/deploy.sh` + 真实 TUI 冒烟
   （牌记 / footer 含 TPS / Ctrl+O 两态 / `/copy-answer` `/copy-code` / turn.v1 落盘）。
3. **全量门槛**：`./scripts/regression.sh` 全绿 + 双宗真实渲染 + 列宽 40/60/66/80/200 零超宽。
4. **仓内登记版本**：更新各 pack `package.json` 的 `@earendil-works/pi-coding-agent` 版本 +
   REGISTRY 备注 + 本省视记录；通过才登记，不通过维持固定版本并记录原因。

## 不维护什么

- 上游运行时的 bug（如 Peekaboo 的 `see` 激活目标、CLI 残留 daemon）→ 记录为版本限制，等上游修复后做升级评估；不在本仓内打补丁。
- Pi core → 绝不 fork；适配需求走上游 issue/PR。
- 不把“裸全局坐标”“后台键盘 pid-routed”等未验收能力宣传为已承诺。
- 部署位不是 canonical：改动 canonical 只在仓库，部署位一律经 deploy.sh，禁止手改部署位镜像。
