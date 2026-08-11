# 上游维护契约（UPSTREAM-CONTRACT）

> MOTTO-DOWNSTREAM-0 立制版（2026-08-11）。本契约是 Motto 作为 **pi 受控下游**的
> 执行机制：版本锚定、patch 登记、升级/回退演练、发行组合记录。
> 工单规格与验收态见 `docs/decisions/2026-08-11-motto-downstream-0.md`（权威），
> 本文件是机械执行版。

## 0. 锚定原则

1. **单仓自足、分区共存**（夺舍终局）：`lesPrivilege/pi` 为唯一产品仓，上游历史 +
   最小 patchset + Motto 产品内容（`packages/motto/`、`docs/`、`fixtures/`、
   `scripts/maint/`）同仓但物理分区；harness（`packages/`）零改动，产品内容只进
   专属目录。
2. **不修改 node_modules**：所有补丁以源码层 patch 存在（§3），安装走正常 npm。
3. **拉模式**：上游演进只经 fetch/range-diff/rebase 流程进入，不主动跟随 main；
   每次决策（接受/拒绝/回退）留审计记录。
4. **dogfood 是最终验收门**：任何 patch 未经过真实工作流 dogfood 不得进入 release
   manifest。
5. **所有权边界**（谁拥有什么，见工单 §1）：agent loop / provider / session schema /
   内置工具执行归上游，默认零修改；Motto 只拥有发行主权与交互集成层/pi-tui 薄接缝。

## 1. Pi base 固定方式

固定 = （npm 版本, 上游 tag, 上游 commit, source tarball integrity, 构建环境）
五元组，真源在 `docs/maintenance/PI-BASE.json`（schemaVersion 2）。

校验命令（写死）：

```bash
pi --version
curl -sL "https://api.github.com/repos/earendil-works/pi/git/refs/tags/v<ver>" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['object']['sha'])"
grep -nE "registerEntryRenderer|appendEntry" \
  /opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts
```

升级即更新 PI-BASE.json（+ 部署位灰跑 + 全量回归 + 双宗真实渲染）；升级被否决时
维持旧五元组并记录原因。

## 2. 包边界（0.84.1 实测）

| 包 | 版本 | 职责 | Motto 消费点 | 所有权 |
|---|---|---|---|---|
| `pi-coding-agent` | 0.84.1 | 交互 CLI | 扩展 API、copyToClipboard、initTheme | 上游(可薄补丁) |
| `pi-agent-core` | 0.84.1 | agent loop/状态/事件 | turn_*/tool_execution_* 事件 | 上游(零修改) |
| `pi-tui` | 0.84.1 | 组件/布局/选区/剪贴板 | visibleWidth、Markdown、renderer 基元 | 上游(可薄补丁) |
| `pi-ai` | 0.84.1 | provider/LLM 流式 | modelRegistry.getApiKeyForProvider | 上游(零修改) |

要点：选区/剪贴板协议在 pi-tui（`TuiAltScreen`），transcript 拼装在 pi-coding-agent
interactive 层——只换 pi-tui 不够（TRANSCRIPT-PROJECTION 第十节）。

## 3. Core patch registry（PATCHES.json）

真源：`docs/maintenance/PATCHES.json`。每条 patch：

```json
{
  "id": "TUI-DISCLOSURE-1",
  "commit": "<lesPrivilege/pi commit>",
  "packages": ["coding-agent"],
  "invariants": ["I0-2", "I5-1", "I7-1"],
  "upstreamable": true,
  "upstreamStatus": "not-submitted | submitted | accepted | rejected | closed-unmerged",
  "removalCondition": "upstream provides equivalent per-entry disclosure",
  "dogfoodEvidence": [],
  "status": "candidate | applied | upstreamed | superseded | reverted"
}
```

纪律：

- 每 commit 只实现一项可独立删除的接缝，禁止巨型提交。
- 作用域只限 coding-agent interactive 集成层与 pi-tui 薄接缝。
- 上游吸收等价能力：验证语义等价 → 从 patchset 删除 → 跑有/无旧 patch 对照 →
  更新 removal evidence → 不保留兼容层。
- 重放失败：稳定 `motto` 留旧 base；candidate 判 `BLOCKED_BY_UPSTREAM_CHANGE`；
  不以重写 session、删除扩展或降低 TUI 不变量换取升级。

## 4. 生态锁定（EXTENSIONS.lock.json）

真源：`docs/maintenance/EXTENSIONS.lock.json`。覆盖整个部署生态：
Motto 自研 pack（Motto commit + 文件哈希）、npm extension（精确版本 + integrity）、
git extension（固定 commit，禁浮动 main）。每条记录：暴露面 / 是否覆盖内置工具 /
API 依赖面 / 最近兼容验证的 Pi base / 更新方式（manual|pinned|vendor）/ 回退版本。

## 5. 发行组合（RELEASES.json）

真源：`docs/maintenance/RELEASES.json`。每个可运行发行 = Pi base + Core patchset +
Motto commit + extension lock hash + theme hash + TUI fixture hash + acceptance
evidence。回答「这一场真实 session 当时运行的是哪套系统」。

## 6. 仓库拓扑与分支（单仓自足）

```text
earendil-works/pi  (upstream remote)
   ↓
lesPrivilege/pi    (唯一产品仓:上游历史 + 独立 patchset
                    + Motto 产品内容 packages/motto/·docs/·fixtures/·scripts/maint/)
```

原 `lesPrivilege/Motto` 双仓已并入本仓（2026-08-12 夺舍终局），历史归档只读。
分支约定：

```text
upstream/main                 官方上游
upstream/v0.84.1              当前基线 tag
motto/main                    当前稳定 Motto Core
candidate/pi-<version>        上游升级候选
feature/tui-<slice>           单项 Core patch
```

## 7. 运行与发布双轨

```text
pi          官方上游稳定版本
motto       当前已接受的 Motto downstream
motto-dev   候选版本 / dogfood 版本
```

在下游第一项 patch 出现前，`motto` 与官方 `pi` **行为等价**（先证明发行链本身
零差异，再改 TUI）。不改 npm package 名称；Motto 身份在发行 manifest / launcher /
版本输出中。版本显示：

```text
Motto Pi
base: 0.84.1
upstream: 53fa77ccd8a279eb87e92294ef3687b03ff80112
patchset: motto.0
release: 2026-08-11.0
```

## 8. 升级流程（Core 与 extensions 分开）

**Pi Core 更新**：发现 release → 获取 tag/commit/changelog → old…new range-diff →
按包分类变化 → candidate 分支重放 Motto patches → 冲突与语义漂移审计 → 上游
check/tests → Motto extension compatibility → fixture/baseline → motto-dev dogfood →
接受或保持旧版。禁止自动跟随 main、禁止直接覆盖稳定环境。

**Extension 更新**：与 Core 更新不混成一次不可归因升级。每个第三方 extension
单独：发现新版本 → source/tag/SHA diff → API 与工具所有权检查 → 隔离运行 →
与当前 Motto pack 共存测试 → 真实工作流 dogfood → 更新 lock 或维持旧版。
一次 release train 只含：一次 Pi base 更新 / 一项 Core patch / 一到数个有明确关联
的 extension 更新。

## 9. 升级接受门

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

## 10. 回退方法

- **升级回退**：launcher 原子切换回旧 release（并行安装保证）；PI-BASE.json 还原
  旧五元组；session fixture 可 resume 即证明向后兼容。
- **补丁回退**：`git revert <patch>`（补丁独立，禁叠加依赖），重跑全量回归 + 基线 diff。
- **整叉回退**：`motto` launcher 指回官方 `pi`，删除下游产物；产品层（扩展/主题）
  不受影响——「扩展与核心分仓」的结构性收益。

## 11. 与既有治理的关系

- 本契约是 `AGENTS.md` 宪制第 7 条「受控下游」的执行机制；
- MAINTENANCE.md 的「Pi 升级流程」升级为本契约 §8 的机械流程；
- MOTTO-TUI-0 产出的 `docs/maintenance/PI-BASE.json`（schemaVersion 1）升级为
  schemaVersion 2（本契约 §1）。
