---
name: motto-maintenance
description: >
  维护 Motto 受控下游（Pi fork）与上游（earendil-works/pi）的更新链路：
  检查上游增量、执行受控升级、回退。泛化实现：与仓布局无关，经配置解析路径。
  TRIGGER when: 用户要求「检查上游/pi 更新」「升级 pi/上游」「拉取更新」「回退 pi」,
  或会话启动时检测到定期检查过期（见「定期检查」节）。
  只读检查可随时执行;任何升级应用必须走完整验收门,禁止自动跟随 main。
---

# Harness 下游维护（泛化）

本技能是调用胶水：工作流逻辑在维护脚本（`scripts/maint/`，自定位），路径经配置解析——
配置真源 `~/.pi/agent/maintenance/config.json`（harnessRepo / stateFile 等），
由 `scripts/maint/maint-lib.sh` 读取（env > config > 默认）。夺舍终局后 harness 与
产品内容同仓（单仓自足），脚本位于仓内 `scripts/maint/`，随仓走。

## 0. 铁律（先于一切）

- **只读检查 ≠ 升级**。检查脚本永远不改任何东西。
- **禁止自动跟随 main**、禁止直接覆盖稳定环境、禁止未经 dogfood 的应用。
- 升级是用户/执行者决策，须留审计记录（commit 落账）。
- 回退口常开：`pi-official` / `MOTTO_USE_OFFICIAL=1` / `git revert <patch>`。
- 上游与生态（第三方）不入仓，只作清单记录（PI-BASE / EXTENSIONS.lock）。

## 1. 定位脚本与配置

- 维护脚本：仓内 `scripts/maint/`（`$HARNESS_REPO/scripts/maint`；夺舍终局后即同仓
  `scripts/maint/`，Motto 仓回退已删除）。
- 配置：`~/.pi/agent/maintenance/config.json`；读取失败用默认
  （harnessRepo=~/Projects/pi, stateFile=~/.pi/agent/maintenance/last-check.json）。

```bash
MAINT_CONFIG=~/.pi/agent/maintenance/config.json
HARNESS_REPO="$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('$MAINT_CONFIG'))).get('harnessRepo','~/Projects/pi'))")"
SCRIPTS="$HARNESS_REPO/scripts/maint"
```

## 2. 检查上游增量（只读）

```bash
bash "$SCRIPTS/upstream-check.sh"                     # 完整报告(含受影响包)
bash "$SCRIPTS/upstream-check.sh" --quiet             # 单行摘要
bash "$SCRIPTS/upstream-check.sh" --state <file>      # 额外写状态
```

- 输出 `NO_UPDATE` 或 `UPDATE_AVAILABLE: N commits since v<base>`（+ 受影响包）。
- 有更新时向用户**报告**，不自动升级。

## 3. 定期检查（拉模式，不自动应用）

- 状态文件：`$MAINT_CONFIG` 的 stateFile（checkedAt / upstreamHead / baseCommit /
  newCommits）。
- 会话启动或用户提到维护时：若状态缺失或 checkedAt 距今 >24h，跑一次
  `upstream-check.sh`（默认即写状态文件），再按结果向用户简述。
- 可选真定时：launchd 模板（`docs/maintenance/upstream-check.launchd.plist`，
  用户侧 opt-in），仅写状态，不应用。

## 4. 受控升级（用户明确要求后才执行）

按 `docs/maintenance/USAGE.md §2`（合并后同一路径）全流程：

1. 锚点核对：`bash "$SCRIPTS/downstream-drill.sh"`（应 11/11）。
2. fetch + 增量审查：`git -C "$HARNESS_REPO" fetch upstream --tags`；
   `git -C "$HARNESS_REPO" range-diff v<旧>...v<新>` 逐 diff 分类
   （接缝/修复/破坏/无关）。
3. 逐类接受/拒绝（记录原因）；`candidate/pi-<新>` 分支重放 PATCHES.json 各 patch。
4. 机械门 + 回归门 + dogfood 门：`bash "$SCRIPTS/offline-hydrate.sh"` →
   `motto-dev version` 冒烟 → 真实工作流 dogfood。
5. 接受 → 更新 PI-BASE.json 五元组 + RELEASES.json + PATCHES.json status；
   拒绝 → 维持旧锚 + 记录原因。升级 commit 落账，message 写依据。

## 5. 扩展更新（与 Core 分开）

- 用户要求升级某第三方扩展：查 `EXTENSIONS.lock.json` 当前钉版 → source/tag/SHA
  diff → API/工具所有权检查 → 与 Motto pack 共存测试 → 真实 dogfood → 更新 lock 或
  维持旧版。一次 release train 只含一类更新。第三方不进仓。

## 6. 回退

- 命令级：`pi-official` / `MOTTO_USE_OFFICIAL=1 motto`。
- 补丁级：`git -C "$HARNESS_REPO" revert <patch>` + 全量回归 + 基线 `--check`。
- 升级级：还原 PI-BASE 旧五元组 + 重建产物 + session fixture resume 证明兼容。

## 7. 每次维护动作后

- 跑 `bash "$SCRIPTS/ci-checks.sh" governance`（含 TUI baseline `--check`）。
- 有真实使用摩擦 → 写 `docs/usage-log/` 条目。
- 不留下半成品分支：candidate 用完即删或登记。
