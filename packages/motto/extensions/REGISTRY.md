# 扩展盘点注册表（REGISTRY）

> 状态定义：
> - **SHIPPED** — 已通过验收、已有 usage-log、处于维护状态
> - **ACCEPTED WITH LIMITATIONS** — 已验收但存在已记录限制
> - **DRAFT** — 有形态实现，未验收
> - **IDEA** — 仅登记

| Pack | 状态 | 能力契约 | 固定运行时 | 验收报告 | 狗粮日志 | 备注 |
|---|---|---|---|---|---|---|
| `motto` | **SHIPPED** | TUI 品牌层：牌记 / 单行 footer（含 TPS）/ 终端标题守护 / 提示词品牌化 / **项目本地正文**（cwd `.motto/agent.md` 独立段注入，超 32KB 截断+标注，缺省无声，牌记 context 并列）；**多级标题视觉投影**（display-only，H3–H6 → `## › 标题`，三层视觉 H1/H2/H3–H6 统一 `› 标题` 无井号；仅 assistant 完成态，fenced 代码块内原样，canonical/session 零改动，见 PACK-MOTTO-3，2026-08-09 用户真实 TUI 目验通过）；~~fenced 块展示牌记~~ **已回退**（FLOW-FENCED-BLOCKS-1 → ROLLED_BACK (VISUAL_ACCEPTANCE_FAILED)，2026-08-09 真实 TUI 目验否决，注册与模块已移除，见 PACK-MOTTO-2 报告勘误）；只经公开 API，零私有路径 | —（依赖 pi-tui visibleWidth，无外部二进制） | `motto/reports/PACK-MOTTO-1-acceptance.md`、`…-2-acceptance.md`（fenced 块牌记，结论已撤销）、`…-3-acceptance.md`（多级标题投影） | `motto/docs/usage-log/2026-08.md` | 凡例 `docs/MOTTO.md`；遗留：hardWrap/truncateToWidth 跨件重复、Ghostty 目视终验（用户侧） |
| `motto-canonical-copy` | **SHIPPED** | 复制边界层：`/copy-answer`、`/copy-code`，源为 canonical session 数据；快捷键 env-gated；无可复制内容 fail-closed | —（依赖 pi 公开 `copyToClipboard`，无外部二进制） | `motto-canonical-copy/reports/PACK-CANONICAL-COPY-1-acceptance.md` | `motto-canonical-copy/docs/usage-log/2026-08.md` | 复制体例见 `docs/MOTTO.md`；上游 clean copy 落地后本件退役 |
| `motto-review-flow` | **SHIPPED** | 对话流 recap 层：turn 级 `motto-review-flow.turn.v1` 投影（纯展示，不入模型上下文）；review-safe 对象列 + 命令凭据 fail-closed；守卫静默失活 | —（无外部二进制） | `motto-review-flow/reports/PACK-REVIEW-FLOW-1-acceptance.md` | `motto-review-flow/docs/usage-log/2026-08.md` | 目录体例见 `docs/MOTTO.md`；真三层挂上游 transcript projector |
| `motto-themes` | **SHIPPED** | Motto 主题三 JSON（motto/motto-dark/motto-light）；语义槽 bg/text/accent/dim/dimmer/mid；`mdHeading`=dim 明度分层（深宗亮一档/浅宗深一档）；部署位为 pi **主题目录** `~/.pi/agent/themes/`（与扩展部署位分开） | —（声明式 JSON，无二进制） | `motto-themes/reports/PACK-THEMES-1-acceptance.md`、`…-2-acceptance.md`（mdHeading 明度分层） | `motto-themes/docs/usage-log/2026-08.md` | 非扩展 pack：无 index.ts/checksums；颜色/主题见 `docs/MOTTO.md`；上游逐级槽为 ROADMAP 候选 |
| `motto-computer-use` | **SHIPPED（ACCEPTED WITH LIMITATIONS）** | 8 工具白名单（see/image/click/type/scroll/hotkey/set_value/perform_action）；**默认加载 + 会话级门禁**（armed 默认 false，/computer-use approve\|revoke\|status，重启回未批准态，门在扩展 execute 路径内）；AX-first 观察；reference-bound 坐标；权限/错误 fail-closed | Peekaboo v3.10.0（SHA-256 固定，见 `checksums/`） | `motto-computer-use/reports/PACK-COMPUTER-USE-1-acceptance.md`、`…-2-acceptance.md`（门禁行为变更） | `motto-computer-use/docs/usage-log/2026-08.md` | 单屏已验证；限制见报告（多屏未测 / see 激活目标 / 后台键盘未测 / CLI daemon 隔离）；不做按次审批（会话级单闸先上线，摩擦触发再升级）；tag `motto-computer-use-v1.0.0` |
| `motto-gemini-vision` | **SHIPPED（ACCEPTED WITH LIMITATIONS）** | 按需视觉工具 `motto_vision`（非 subagent）：单图（PNG/JPEG/WEBP 魔数识别）→ 注入式 provider-neutral `ObservationRequest`/`ObservationResult` → 单次无状态 Gemini adapter → 确定性纯文本 projection；canonical answer/evidence/limitations/artifacts/provenance/status；bbox/page/timestamp 严格范围校验；10 MiB 上限；取消/超时可区分；429/5xx 不重试；key/错误/raw provider JSON/base64 fail-closed；**凭据统一真源**：`~/.config/motto/credentials/google` → `motto-credential google` → `motto-google-key` → models.json `!` 引用 → `ctx.modelRegistry.getApiKeyForProvider("google")`（auth.json 不再持有 google） | —（无外部二进制；纯 fetch + Node 内置，零运行时依赖） | `motto-gemini-vision/reports/PACK-VISION-1-acceptance.md`、`…/PACK-VISION-2-observation-contract.md` | `motto-gemini-vision/docs/usage-log/2026-08.md` | PACK-VISION-2：IMPLEMENTED + OFFLINE_VERIFIED（71/71；受限沙箱初跑原 66 PASS/3 NOT TESTED，授权本地补强后全绿）+ **DEPLOYMENT_PENDING**（unit PASS，drift 对旧部署镜像 expected FAIL）；LIVE_PROVIDER_VERIFIED / PI_RUNTIME_DOGFOODED / DEPLOYED_AND_REGRESSED 仅为 PACK-VISION-1 历史证据。无 endpoint 注入面；当前 Gemini 仅 adapter，不能稳定文本化的重复视觉/长视频/多图任务改用原生多模态 one-shot；`store:false` 非绝对零保留承诺 |

## 盘点方法（每季度）

1. 遍历 `extensions/*/`，核对 `README.md`、`test/`、`reports/`、`docs/usage-log/` 是否齐备。
2. 每个 SHIPPED pack 校验：验收报告存在、白名单未扩大、固定运行时 checksum 仍在 `checksums/`（仅二进制依赖 pack）、usage-log 有近期条目。
3. 更新本表与 `docs/MAINTENANCE.md` 节奏表勾选。

## 部署位与 canonical

- 本仓为唯一 canonical source；部署位：扩展 → `~/.pi/agent/extensions/`，主题 → `~/.pi/agent/themes/`。
- 部署/漂移检查：`scripts/deploy.sh`（拷贝，理由见该脚本头部）与 `scripts/drift-check.sh`（diff 非空即报警），并入 `scripts/regression.sh` 与 `scripts/ci-checks.sh governance`。

## 边界说明

- 本仓只收 **PI/Motto 扩展（pi tool extension）**。Motto **skills**（如 `~/.Motto/agent/skills/` 下的 archive / arxiv-browse / env-audit / house-style / reading-companion / weread-skills）是另一类别（agent 技能/调用胶水），**不在本仓范围**，如需收编应另立 `skills/` 区并单独定体例。
- 运行时依赖（Peekaboo 等）不是本仓产物，只是固定版本的外部设备层。
