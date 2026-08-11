# pi 生态调研：pi-peer 与 pi-rlm（2026-08-08）

按 reading-companion 体例产出，官方源浅克隆核验。调研只形成参照与候选，不形成工单（AGENTS.md 工作方式 / ROADMAP.md）。

与 Motto 的关联备注（收编时补）：pi-subagents 输出的著录类目是 ROADMAP 已登记的待验空白；pi-peer 的 peer 消息若入流，属同一「非工具内容入流」问题域——两者都等真实使用证据，不因本调研立单。pi-rlm 零测试、护栏无断言，按本仓契约层标准不足以进入依赖集。

---

# pi-peer（shift-labs-ai）— 让本机 pi 会话互相发消息

- 来源: https://github.com/shift-labs-ai/pi-peer（官方源 + 本地浅克隆核验）
- 日期: 2026-08-07 创建，2026-08-08 更新（发布仅一天）
- 作者/机构: shift-labs-ai
- 类型: repo（pi 扩展，TypeScript，MIT）
- 置信度: high（README 与源码一致，关键设计已核验）

## 核心问题

同一台机器上开多个 pi 会话做同一个 repo，一个会话发现的信息（分支落地、测试红了、问题答案）要靠人肉在终端之间誊抄。需要一种会话之间低成本的文本通道。

## 核心方案

1. 纯文件信箱，无守护进程无 socket：每个会话在 `~/.pi/agent/peers/`（0700）下写一条记录 + 一个 inbox；发送 = writeFile + rename 原子落盘，接收 = fs.watch 自己 inbox。已核验 ARCHITECTURE.md 与源码一致。
2. 地址绑定会话而非进程：cwd + session id 的 hash，重启后地址不变；离线会话的信在磁盘上排队，恢复后读。
3. 回执 = 消费：接收方读信即 unlink，发送方因此区分 delivered（文件消失）与 queued（文件还在）。
4. 两个工具：list_peers（含 idle/working/offline 状态）、message_peer（纯文本 ≤32KB）；/peers 命令同款列表。
5. 权力边界：来信带前置声明「来自 peer、无权威」；slash 命令当惰性文本处理；PI_PEER_INBOUND 支持 accept/ask/refuse。
6. 结构上防环：10 秒内同文本去重、30 秒 8 条限流、未读积压 50 条封顶——两个 agent 互回会自动停下。

## 证据

维护信号为主：~2500 行（源码 ~960 行 + 测试 ~1400 行，9 个测试文件），测试即规格、每条保证都有对应断言（已核验 test/ 存在且与 invariant 一一对应）；CI + biome + bun 全套。无量化基准（本就不适用）。

## 风险与弱点

- 信任模型很薄：inbox「任何人可写、只有 owner 读」——同一台机器上任何进程都能往里放信，安全完全依赖本机文件权限，不防同用户的其他进程或木马。
- 「无权威」是软约束：边界声明只是模型读到的文本，模型对 peer 消息的遵从度不可强制；若模型把 peer 消息误当用户指令，本质是 prompt 层的防线。
- 发布仅一天：63★、1 fork、无 release 历史，抗真实故障（多会话并发写、sweep 竞态）未经过场验证。
- 单机限制是设计取舍（文件即传输），容器与宿主之间、两台机器之间不可达——README 已明确承认。

## 待验证问题

- 多个会话同时向同一 inbox 投递时，rename-into-place + drain 的并发行为是否真的无竞态？
- 「未读积压 50 条」与 UI context 的 idle 判定耦合，非 idle 的慢会话会不会被积压截断？

---

# pi-rlm（manojlds）— pi 的递归语言模型（RLM）扩展

- 来源: https://github.com/manojlds/pi-rlm（官方源 + 本地浅克隆核验）
- 日期: 2026-03-13 创建，2026-08-08 更新；v0.1.3 已发布 npm
- 作者/机构: manojlds
- 类型: repo（pi 扩展 + CLI，TypeScript，MIT）
- 置信度: high（README 与源码一致，guardrail 实现已核验）

## 核心问题

单个 agent 上下文有限，复杂任务一次 solve 容易漏；需要把大任务深度递归分解、并行处理子任务再合成，且要有成本护栏。

## 核心方案

1. rlm 工具：planner 节点决策 solve/decompose → 子节点递归子任务 → synthesizer 合成子输出（src/engine.ts，已核验）。
2. 护栏全在引擎里：maxDepth、maxNodes（节点预算，超了直接 skip 并记日志）、maxBranching（每层子节点数）、基于 normalized task lineage 的环路检测、op=cancel 可取消（已核验 engine.ts 95–218 行实现）。
3. 三种后端：sdk（进程内 Pi SDK 会话，默认，低开销）、cli（每个子调用一个 pi -p 子进程，隔离好）、tmux（每 run 一个 detached 会话，按深度建窗口/面板，可观测）。
4. CLI 包装：pi-rlm "task" --backend sdk --max-depth 3，支持 --json、--live（读 events.jsonl 实时渲染树）、--tmux-current-session。
5. 产物：/tmp/pi-rlm-runs/<runId>/{events.jsonl, tree.json, output.md}，每次 run 可审计。
6. 附带自包含示例 examples/web-data-extraction（RLM + browser-tools 抓网页）。

## 证据

维护信号：~3200 行，结构清晰（engine/backends/prompts/runs/types 分层）；npm 已发 0.1.3，有 CI 与 release workflow；示例项目自含 .pi/settings.json 可复现。无任何测试文件（已核验 repo 内没有 test/，只有 typecheck）。

## 风险与弱点

- 零测试：护栏是全部卖点（深度/预算/环路），却没有一个自动化测试钉住这些边界，回归风险高。
- README 无任何定量证据：没有「RLM vs 平铺 solve」在任务完成率/成本上的对比，价值主张停留在定性描述。
- 成本失控风险未量化：递归 + 并发子调用（concurrency: 2、maxNodes: 24）意味着单次 run 的 token 消耗可能数倍于一次 solve；README 未给成本上限或估算。
- 三后端 = 三份维护面：sdk/cli/tmux 行为差异（进程内 vs 子进程 vs 面板）是持续的复杂度来源；sdk 后端进程内跑子会话，隔离性与状态污染边界未说明。
- 环路检测基于「规范化任务文本」的启发式，语义相近但表述不同的重复子任务可能漏检。

## 待验证问题

- maxNodes 触发 skip 后，被跳过的子任务结果对父级合成的质量影响有多大（静默降级）？
- sdk 后端进程内并发子调用，是否共享同一模型上下文或受到同一 API 限流影响？

---

一句总结：pi-peer 解决「同机多会话横向沟通」，小而精、测试完善但发布一天未经历实战；pi-rlm 解决「单会话纵向加深」，架构完整但零测试、零定量证据，成本护栏的可靠性存疑。选型视角下 pi-peer 更接近可用状态。
