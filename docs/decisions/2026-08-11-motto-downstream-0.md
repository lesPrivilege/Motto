# 工单：MOTTO-DOWNSTREAM-0 — Pi 受控下游立制

- 日期：2026-08-11
- 类型：工单登记（下一张工单，取代 MOTTO-TUI-1 的顺序）
- 依据：用户指令（2026-08-11）——「不能先做一块 Core patch，再倒推维护制度」。
  真正的「夺舍」首先是取得发行、版本、升级和回退主权；TUI 修改只是其后的第一组 patch。
- 状态：REGISTERED →（执行后按验收态推进）
- 关联：`docs/decisions/2026-08-11-motto-tui-0-boundary.md`（本工单修正其「MOTTO-TUI-1 先行」的排序）、
  `docs/maintenance/UPSTREAM-CONTRACT.md`（升级为本工单所定机制）、`docs/ROADMAP.md`

## 0. 为什么先行

MOTTO-TUI-0 的边界拆解证明第一项 Core 能力（per-entry transcript projection）是
可上游化接缝。但**接缝是否合入、何时合入、合入后如何吸收，都要求 Motto 先成为
一个真正可维护的 Pi downstream**：有版本锚、有 patchset 制度、有升级/回退演练、
有发行组合记录。没有这套装置，任何 Core patch 都只是一次性手工改上游，违背
「不靠每次手工阅读后重新复刻全部实现」的维护原则。

顺序：**先立制（发行/版本/升级/回退主权）→ 再改 TUI（第一组 patch）**。

## 1. 「夺舍」的准确边界

> Motto 开始拥有自己可发布、可升级、可回退的 Pi distribution；上游 Pi 继续提供
> agent loop、provider、session、工具和扩展生态，Motto 对交互集成层与 TUI 产品
> 经验拥有最终裁定权。

长期所有权划分：

| 层 | 所有者 | 策略 |
|---|---|---|
| `pi-ai`、provider | 上游 Pi | 默认零修改，按版本吸收 |
| `pi-agent-core`、agent loop | 上游 Pi | 默认零修改 |
| session canonical schema | 上游 Pi | 不分叉；Motto UI 状态不得写入 |
| 内置工具执行 | 上游 Pi | 不重注册、不改语义 |
| coding-agent interactive integration | **Motto 可维护薄补丁** | stable identity、projection、disclosure |
| `pi-tui` | **Motto 可维护薄补丁** | selection、copy、布局接缝 |
| Motto 视觉文法与策略 | Motto 仓 | extensions/themes/projectors |
| 社区 extensions | 各自上游 | 固定来源和版本，逐项升级 |

夺舍的是**产品控制面**，不是无边界吞入上游 Core。

## 2. 仓库拓扑

```text
earendil-works/pi
       ↓ upstream remote

lesPrivilege/pi
       受控下游：上游历史 + 独立 patchset
       不存 Motto extensions

lesPrivilege/Motto
       产品正典、主题、extensions、fixtures、
       patch registry、extension lock、release manifest
```

`lesPrivilege/pi` 即原宪制中的「PI repo」——由「上游维护」改为「Motto 受控下游」，
仍是同一仓位的实体。分支约定：

```text
upstream/main                 官方上游
upstream/v0.84.1              当前基线 tag

motto/main                    当前稳定 Motto Core
candidate/pi-<version>        上游升级候选
feature/tui-<slice>           单项 Core patch
```

纪律：每个 Motto Core commit 只实现一项可独立删除的接缝，禁止把数项 TUI 行为
压成巨型提交。

## 3. 运行与发布双轨

```text
pi          官方上游稳定版本
motto       当前已接受的 Motto downstream
motto-dev   候选版本 / dogfood 版本
```

在下游第一项 patch 出现前，`motto` 与官方 `pi` **行为等价**——先证明下游发行链
本身不产生差异，再开始改 TUI。

**不改 npm package 名称**：内部保留 `@earendil-works/pi-*` workspace identity，
避免社区 extension 的 peer dependency、运行时 import 与类型解析分裂。Motto 身份
放在发行 manifest、launcher 与版本输出中：

```text
Motto Pi
base: 0.84.1
upstream: 53fa77ccd8a279eb87e92294ef3687b03ff80112
patchset: motto.0
release: 2026-08-11.0
```

## 4. 版本记录（四件）

1. **PI-BASE.json**：上游 package version / tag / commit / source archive SHA-256 /
   Node/Bun 构建版本 / 四个 lockstep package 版本 / 当前上游与 Motto patchset 的
   commit range。
2. **PATCHES.json**：每条 Core patch 的独立登记（id / commit / packages / invariants /
   upstreamable / upstreamStatus / removalCondition / dogfoodEvidence / status）。
3. **EXTENSIONS.lock.json**：整个部署生态（不只 Motto 自研）——名称 / 来源 /
   精确版本或 commit / integrity / 暴露面 / 是否覆盖内置工具 / API 依赖面 /
   最近兼容验证的 Pi base / 更新方式 / 回退版本。Motto 自研 pack 用 Motto commit +
   文件哈希；npm extension 固定精确版本；git extension 固定 commit（禁浮动 main）。
4. **RELEASES.json**：每个可运行发行 = Pi base + Core patchset + Motto commit +
   extension lock hash + theme hash + TUI fixture hash + acceptance evidence。
   回答「这一场真实 session 当时运行的是哪套系统」。

## 5. Core 与 extensions 分开升级

**Pi Core 更新**：发现 release → 获取 tag/commit/changelog → old…new range-diff →
按包分类变化 → candidate 分支重放 Motto patches → 冲突与语义漂移审计 → 上游
check/tests → Motto extension compatibility → fixture/baseline → motto-dev dogfood →
接受或保持旧版。禁止自动跟随 main、禁止直接覆盖稳定环境。

- 上游吸收某 Motto patch：验证语义等价 → 从 patchset 删除 → 有/无旧 patch 对照 →
  更新 removal evidence → **不保留兼容层**。
- 重放失败：稳定 `motto` 留在旧 base；candidate 判 `BLOCKED_BY_UPSTREAM_CHANGE`；
  不以重写 session、删除扩展或降低 TUI 不变量换取升级。

**Extension 更新**：与 Core 更新**不混成一次不可归因升级**。每个第三方 extension
单独：发现新版本 → source/tag/SHA diff → API 与工具所有权检查 → 隔离运行 →
与当前 Motto pack 共存测试 → 真实工作流 dogfood → 更新 lock 或维持旧版。
一次 release train 只含：一次 Pi base 更新 / 一项 Core patch / 一到数个有明确关联
的 extension 更新。

## 6. 升级接受门

- **机械门**：可从 manifest 重建相同二进制；build artifact 哈希稳定；patch 可在
  精确 base 上重放；extension lock 无浮动引用；session fixture 可 resume/export；
  官方 `pi` 与无 patch 的 `motto-dev` 行为等价；稳定与候选可并行安装；launcher
  可原子回退。
- **回归门**：Pi 上游检查；全部 Motto pack；extension 加载与工具所有权；
  TUI 40/60/80/120/200 列；streaming、取消、compaction、resume；session/context
  零污染；Ghostty 视觉与复制。
- **dogfood 门**：候选至少经过多轮真实 coding、长 thinking、多工具调用、工具失败、
  中途取消、resume、至少一次 compaction、官方 `pi` 与 `motto-dev` 对照。
  Dogfood 只决定「是否晋升」，不承担 patch 迁移。

## 7. 本轮验收目标（MOTTO-DOWNSTREAM-0）

1. 修改宪制：从永久禁止 fork 改为 upstream-first + controlled downstream。
2. 建立 `lesPrivilege/pi` 的 upstream/origin 拓扑。
3. 以 `v0.84.1` 建立零 patch 的 `motto/main`。
4. 生成 `pi`、`motto-dev` 并行 launcher。
5. 证明零 patch 下行为与官方发行等价。
6. 完成 `PI-BASE`、`PATCHES`、`EXTENSIONS.lock`、`RELEASES`。
7. 实际演练一次：fetch / candidate / range-diff / build / 安装 / 回退。
8. 不修改任何 TUI/Core 产品行为。

最终状态：

```text
DOWNSTREAM_REPOSITORY_READY
UPSTREAM_BASE_ANCHORED
ZERO_PATCH_EQUIVALENCE_VERIFIED
EXTENSION_ECOSYSTEM_LOCKED
CANDIDATE_INSTALL_VERIFIED
ROLLBACK_VERIFIED
CORE_MODIFICATION_AUTHORIZED
```

全部通过后才开启 **MOTTO-TUI-1 — Transcript Visual Composition**（纯视觉投影：user 左界栏 +
悬挂正文、assistant 无框正文、tool 成功压成低对比目行、review recap 著录化、失败朱红强显；
不含 reducer 与折叠）。per-entry thinking disclosure 后移 **MOTTO-TUI-2**。

## 8. 修订

- 2026-08-11：本工单登记，取代 MOTTO-TUI-1 的顺序；`docs/decisions/2026-08-11-motto-tui-0-boundary.md`
  第六节「MOTTO-TUI-1 最小垂直切片」自此被本工单取代（其内容归档为该工单的备选切片，
  仅在下游制度成立后、且 usage-log 摩擦触发时方可重启评估）。
- 2026-08-11（A2 收口勘误）：本工单登记时沿用了旧定名「MOTTO-TUI-1 — Per-entry Thinking
  Disclosure」，与同日用户指令裁定的首单范围（纯视觉）相冲突。第七节据裁定改为
  **Transcript Visual Composition**，per-entry thinking disclosure 后移 MOTTO-TUI-2；
  `AGENTS.md` 第 7 条同步。裁定出处见 `docs/decisions/2026-08-11-tui-construction-prep.md` §1.3。
