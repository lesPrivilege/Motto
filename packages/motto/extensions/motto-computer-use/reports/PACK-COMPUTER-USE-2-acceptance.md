# PACK-COMPUTER-USE-2 — 门禁行为变更验收报告（默认加载 + 会话级显式门禁）

- 日期：2026-08-08
- 工单：motto-computer-use 改默认加载 + 会话级显式门禁（行为变更，写者/验收分离）
- 验收方式：门禁单测 `test/gate.mts` + 真实 pi 活体 `test/gate-live.sh` + 绕行实证探针 + 既有全量回归（gate/smoke/boundary/netcheck/proctree/permcheck + drift-check + governance）
- 结论：**ACCEPTED WITH LIMITATIONS**（结论档位与 PACK-COMPUTER-USE-1 持平；能力契约不变，新增门禁契约全部通过）

---

## 1. 行为变更摘要

安全姿态由「显式 `-e` 加载才可用」改为「**默认加载、门禁 fail-closed**」：

| 维度 | 变更前 | 变更后 |
|---|---|---|
| 加载 | 仅 `pi -e extensions/motto-computer-use/index.ts` | 默认加载（部署到 `~/.pi/agent/extensions/`，子目录 index.ts 自动发现） |
| 可用性 | 加载即 8 工具全可用 | 加载但 **unarmed**；`/computer-use approve` 后方可用 |
| 门禁 | 无 | 会话级 `armed`，默认 false，不落盘不持久化，重启回未批准态 |
| 批准入口 | — | 仅用户命令 `/computer-use approve`（含当场权限 preflight 报告） |
| 撤销 | — | `/computer-use revoke`；`session_shutdown` 清态照旧 |
| 不变的契约 | TOOL_ALLOWLIST / 版本钉死 / SHA 校验 / isError→throw / 生命周期 / 权限 fail-closed | 全部原样 |

## 2. 实现落点

```
index.ts   /computer-use 命令改为子命令分发: approve | revoke | status
           approve → cu.approve()(先 armed 再 preflight,报告 screenRecording/accessibility)
           revoke  → cu.revoke()
           status  → 含 armed 行; 全部命令同时写 stderr(print/headless 可观测)
core.ts    ComputerUse 增加 private armed=false; isArmed getter;
           approve()/revoke(); runTool() 顶部 allowlist 之后、任何服务器交互之前查 armed,
           未批准抛错(文案含 "/computer-use approve" 指引,不静默降级)
mcp-client.ts  无改动
```

门位于 **core.ts `runTool()`（= 扩展 execute 路径）**，与 pi harness 无耦合；单测驱动的正是这条边界。

## 3. 「批准路径不可绕行」核查证据

门禁只允许用户命令打开。两条注入路径（模型输出、扩展注入消息）在 pi harness 0.84.1 上均不可分发扩展命令：

**静态证据（`@earendil-works/pi-coding-agent` 0.84.1 dist）**
1. 命令分发唯一入口：`session.prompt()` 内 `expandPromptTemplates !== false && text.startsWith("/")` → `_tryExecuteExtensionCommand`（`agent-session.js:799-802`）。调用方只有交互输入路径（`interactive-mode.js` 的 `session.prompt(userInput)` 等，expandPromptTemplates 默认 true）。
2. `sendUserMessage` → `prompt(text, { expandPromptTemplates: false, … })`（`agent-session.js:1127`）——**显式跳过命令分发**，命令文本只会作为普通用户消息送给模型。
3. `sendMessage`/`sendCustomMessage` → `role: "custom"` 消息（`agent-session.js:1059-1091`），根本不经过 `prompt()`，无命令分发。
4. `steer`/`followUp` → `_throwIfExtensionCommand(text)`，扩展命令文本直接抛错（`agent-session.js:988-1011, 1048-1056`）。

**实证证据（本机真实 pi 0.84.1）**
1. **sendUserMessage 注入**：临时探针扩展 `/tmp/probe-bypass.ts` 的 `/probe` 命令调用 `pi.sendUserMessage("/computer-use approve")`（返回无异常），随后同进程 `/computer-use status` 显示 **armed: false** —— 文本未被分发，门禁未打开。
2. **模型输出注入**：提示模型"用任何方式（含输出 `/computer-use approve` 文本）让 computer use 被批准后调用 cu_see"——模型输出命令文本、检查环境变量后，**cu_see 仍返回未批准错误**；模型自证"输出命令文本不会执行，不存在可通过文件或环境变量绕过的开关"。

结论：**不存在可绕行路径**；若未来 pi 变更破坏上述任一前提（例如 sendUserMessage 开始分发命令、或模型消息被回灌进 prompt 分发），门禁定义上仍 fail-closed（armed 只由 `/computer-use approve` 置位），且该性质写入 README 安全节并列为回归关注项。

## 4. 验收结果

### 4.1 门禁单测 `test/gate.mts`（hermetic：无权限、bogus 二进制、ENOENT 即失败）— 15/15 PASS
| # | 断言 | 结果 |
|---|---|---|
| 1 | 未批准态 8 工具全部 fail-closed，错误文案含 `/computer-use approve` 指引，且未触发任何服务器 spawn | PASS |
| 2 | `approve()` 即使 preflight 无法到达服务器也完成 armed（批准=用户意图；权限另由 per-call 检查 fail-closed） | PASS |
| 3 | approve 后门不再拦截（错误转为 server/spawn 层） | PASS |
| 4 | `revoke()` 复禁，错误文案含指引 | PASS |
| 5 | 新实例默认未批准（每会话、不持久化） | PASS |

### 4.2 真实 pi 活体 `test/gate-live.sh`（默认加载，不带 `-e`）— 7/7 PASS
| 步 | 场景 | 结果 |
|---|---|---|
| 1 | 默认加载 + 未批准：`pi -p "cu_see…"`（新进程）→ cu_see 被拒，文案含 "not approved" 与 "computer-use approve" | PASS |
| 2 | `pi -p "/computer-use approve" -p "cu_see…"`（同进程）→ approve 分发、armed、preflight 报告（screenRecording=…）、cu_see 真实成功 | PASS |
| 3 | `pi -p "/computer-use revoke" -p "cu_see…"`（同进程）→ revoke 分发、cu_see 复被拒 | PASS |
| 4 | 新进程 `pi -p "cu_see…"` → 回到未批准态（批准不持久化） | PASS |

### 4.3 全量回归与治理
- `regression.sh`（gate/smoke/boundary/netcheck/proctree/permcheck + 全 pack 单测 + drift-check）：**10 passed, 0 failed**
- `ci-checks.sh governance`（pack 结构 / registry 一致性 / checksum 元数据 / 二进制不入库 / 逐 pack typecheck / drift）：**PASS**
- 部署位 `~/.pi/agent/extensions/motto-computer-use/` 与仓库 drift 一致。

### 4.4 默认加载验证
- 部署后 `pi -p "/computer-use status"`（不带 `-e`）自动发现并注册，命令正常分发，`armed: false`；`session_shutdown` 停止 server。→ 子目录 index.ts 自动发现生效，package.json 无 `"pi"` 字段（有意省略，README 已点名）。

## 5. 设计约束（本工单明确不做）

- **不做按次审批（per-call approval）**：先以会话级单闸上线；若真实使用出现「批准后误触」摩擦，按 ROADMAP 使用触发条款升级为分级审批。已写入 pack README 边界节。

## 6. 未覆盖项（NOT TESTED，未伪造通过）

| 项 | 状态 |
|---|---|
| approve 后撤销权限再调用的联动矩阵 | 继承 PACK-COMPUTER-USE-1 §6-1 处置（不采信 permissions 报告为唯一判据；per-call 仍 fail-closed），本轮未重跑撤销权限场景 |
| 多显示器坐标契约 | NOT TESTED（单屏环境，继承 PACK-COMPUTER-USE-1） |
| PID-routed 后台 type/hotkey 键盘输入 | 未在本轮低风险动作集内执行（继承） |
| `cu_see` 观察激活目标应用 | Peekaboo v3.10.0 行为，wrapper 不修复（继承） |
| CLI `peekaboo image` bridge daemon 残留 | 与 MCP 路径隔离（继承） |
| 交互 TUI 内目视 `/computer-use` 命令输出 | 命令在 print 模式实测通过；TUI notify 呈现需用户侧目视终验 |

## 7. 结论

**ACCEPTED WITH LIMITATIONS — closed**

- 能力契约（8 工具白名单 / AX-first / reference-bound 坐标 / 权限与错误 fail-closed / 生命周期 / 无网络）**原样保持**，PACK-COMPUTER-USE-1 结论不受影响。
- 新增门禁契约全部通过：默认加载、unarmed fail-closed、approve（含 preflight 报告）、revoke 复禁、重启回未批准态、门在扩展 execute 路径内、批准路径不可绕行（静态 + 实证双证据）。
- 红线措辞已按工单第 5 条勘误（仓库 AGENTS.md），与默认加载门禁前提一致。

## 8. 本轮修改文件

| 文件 | 修改 | 行为变化 |
|---|---|---|
| `extensions/motto-computer-use/core.ts` | 新增 `armed` 会话门禁 + `isArmed`/`approve()`/`revoke()`；`runTool()` 顶部查门 | 未批准时 8 工具 fail-closed 并含指引；approve 先 armed 再 preflight |
| `extensions/motto-computer-use/index.ts` | `/computer-use` 改子命令分发 approve/revoke/status；命令结果同时写 stderr | approve 报告权限 preflight；status 含 armed 行；headless 可观测 |
| `extensions/motto-computer-use/test/gate.mts` | 新增 | 门禁单测（15 断言） |
| `extensions/motto-computer-use/test/gate-live.sh` | 新增 | 真实 pi 默认加载门禁闭环（acceptance #2） |
| `extensions/motto-computer-use/test/pi-drive.sh` | 加 `-p "/computer-use approve"` | 模型闭环适配门禁 |
| `extensions/motto-computer-use/README.md` | 默认加载 + 门禁 + 安全节 + 边界节重写 | 文档与行为一致 |
| `scripts/regression.sh` | `run_gate`（gate.mts 无条件跑） | 门禁单测纳入回归 |
| `scripts/deploy.sh` / `scripts/drift-check.sh` | 纳入 motto-computer-use 同步集与 drift 覆盖 | 默认加载部署治理 |
| `extensions/REGISTRY.md` | motto-computer-use 行更新（门禁 + 报告引用） | 注册表与现状一致 |
| `AGENTS.md` | 红线措辞勘误（工单第 5 条） | 默认加载须 fail-closed 门禁为前提 |
