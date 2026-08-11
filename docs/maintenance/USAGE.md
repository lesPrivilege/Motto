# Motto 受控下游 — 使用手册（USAGE）

> 2026-08-11 夺舍版。Motto 拥有自己的 Pi distribution：发行、版本、升级、回退主权。
> 本手册是日常与长周期维护的操作入口；机制定义见 UPSTREAM-CONTRACT.md，
> 版本真源见 PI-BASE.json / PATCHES.json / EXTENSIONS.lock.json / RELEASES.json。

## 0. 三个命令

```text
pi          官方上游稳定版本（0.84.1）—— 已夺舍：交互 shell 中 pi 交付 Motto
pi-official 官方上游逃生口（= MOTTO_USE_OFFICIAL=1 motto）
motto       当前已接受的 Motto downstream（日常主力）
motto-dev   候选 / dogfood 版本（升级、patch 试用）
```

```bash
motto version              # 身份块: base / upstream / patchset / release
motto --help               # 跑下游产物(零 patch 期与官方逐字节一致)
MOTTO_USE_OFFICIAL=1 motto # 原子回退官方(rollback 对照)
MOTTO_DOWNSTREAM_ROOT=…    # 覆盖下游根(默认本仓 ~/Projects/pi,单仓自包含)
```

## 1. 日常使用

- 主力命令 `motto`（= pi 行为 + Motto 身份）。扩展/主题/skills 走 `~/.pi/agent`
  部署位，pi 与 motto 共享同一套配置，零迁移。
- 改动后的 self-host：`motto-dev` 跑候选产物（`~/Projects/pi/packages/coding-agent/dist/cli.js`），
  摩擦写 `docs/usage-log/`；验收通过后 `motto` 才指新产物。
- **维护交互（skill）**：`motto-maintenance` skill（部署于 `~/.pi/agent/skills/`，正典在
  `docs/maintenance/skills/`）——对 motto 披露检查/升级/回退操作。
  用户说「检查上游更新」「升级 pi」即触发；定期检查由状态文件驱动。

## 2. 上游升级（长周期主链路）

```bash
# 0) 锚点核对
bash scripts/maint/downstream-drill.sh           # 全链路演练(当前应 11/11)
# 0.5) 检查上游增量(只读,可随时跑;motto 会经 motto-maintenance skill 主动报)
bash scripts/maint/upstream-check.sh             # 完整报告(含受影响包)
bash scripts/maint/upstream-check.sh --state ~/.pi/agent/maintenance/last-check.json
#    定期: launchd 模板 docs/maintenance/upstream-check.launchd.plist(用户侧 opt-in)
#    状态文件 checkedAt 距会话启动 >24h 时,motto 会话内跑一次只读检查再报
# 1) 拉上游
cd ~/Projects/pi && git fetch upstream --tags
# 2) 增量审查(不重读全量)
git rev-list --left-right --count v0.84.1...upstream/main   # left=基线性,right=上游新增
git range-diff v0.84.1...upstream/main                      # 逐 diff 分类
# 3) 按包分类:接缝/修复/破坏/无关 → 逐项接受/拒绝(留审计记录)
# 4) candidate 分支重放 Motto patches
git checkout -b candidate/pi-<新版本> <新tag>               # 重放 PATCHES.json 各 patch
# 5) 机械门 + 回归门 + dogfood 门(见 UPSTREAM-CONTRACT §9)
bash scripts/maint/offline-hydrate.sh            # 重建下游产物(离线水化)
motto-dev version && motto-dev --help      # 冒烟
# 6) 接受 → 更新 PI-BASE.json 五元组 + RELEASES.json + PATCHES.json status
#    拒绝 → 维持旧锚 + 记录原因
```

禁止自动跟随 main；禁止直接覆盖稳定环境。重放失败 → 稳定 `motto` 留旧 base，
candidate 判 `BLOCKED_BY_UPSTREAM_CHANGE`。

## 3. 扩展更新（与 Core 分开）

```bash
# 每第三方 extension 单独:发现新版本 → source/tag/SHA diff → API/工具所有权检查
#   → 隔离运行 → 与 Motto pack 共存测试 → 真实 dogfood → 更新 lock 或维持旧版
# 真源:docs/maintenance/EXTENSIONS.lock.json
#   npm 扩展固定精确版本+integrity;git 扩展固定 commit(禁浮动 main)
# 更新后:ci-checks.sh governance(含 registry/drift/TUI baseline 门禁)
```

一次 release train 只含：一次 Pi base 更新 / 一项 Core patch / 一到数个有明确关联的
extension 更新。Core 与 extension 不得混成一次不可归因升级。

## 4. diff / 增量 update

- 上游增量：`git range-diff <旧base>...<新base>`（只审差异，不重读全量）。
- Motto patch 增量：`PATCHES.json` 每条单点可删；上游吸收后删除并跑有/无旧 patch
  对照；**不保留兼容层**。
- 基线增量：`render-baseline.mjs --check`（已接 ci-checks governance）——渲染层
  任何改动必须过此门；`--write` 仅在说明漂移理由时使用。

## 5. 回退

```bash
MOTTO_USE_OFFICIAL=1 motto      # launcher 级原子回退官方(临时)
pi-official                     # 同左(命令级)
# 补丁回退: ~/Projects/pi git revert <patch>,重跑全量回归 + 基线 diff
# 升级回退: PI-BASE.json 还原旧五元组 + 重建下游 + session fixture resume 证明兼容
```

## 6. 演练与验证

```bash
bash scripts/maint/downstream-drill.sh    # fetch→candidate→range-diff→build→install→rollback(11/11)
bash scripts/maint/ci-checks.sh governance    # 含 TUI baseline --check + drift-check
./scripts/maint/regression.sh             # 全 pack 无权限回归
```

## 7. 夺舍（2026-08-11 完成）

- 交互 shell：`pi` 现交付 Motto 发行（~/.zshrc `pi()` → motto launcher）；
  官方上游为 `pi-official` 与 `MOTTO_USE_OFFICIAL=1`。
- 零 patch 期 `motto` 与官方逐字节等价（--help 已验）；TUI-1 patch 落地后
  `motto` 呈现 Motto 视觉，`pi-official` 保持官方原貌。
- 移除旧 `motto() { command pi }` shell 函数（夺舍前遗留，遮蔽 launcher）。
- 逃生口常开：删掉 ~/.zshrc 中 `pi()`/`motto()` 函数即回到官方 `pi`，产品层
  （扩展/主题）不受影响。

## 8. 夺舍终局（2026-08-12 单仓自足）

- `~/Projects/Motto` 产品内容已并入本仓（唯一产品仓）：扩展/主题落
  `packages/motto/extensions/`，维护脚本落 `scripts/maint/`，docs/fixtures 同仓；
  launcher/deploy/drift 全部自引用本仓，双仓互引消除。
- 维护命令统一为 `bash scripts/maint/<script>`；launcher 为
  `scripts/maint/launchers/motto` 与 `scripts/maint/launchers/motto-dev`。
- 原 `~/Projects/Motto` 归档只读，历史可追溯（RELEASES.json 记 mottoCommit）。
