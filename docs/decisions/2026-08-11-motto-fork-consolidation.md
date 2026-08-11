# 裁定：夺舍终局 — Motto repo 并入 harness Core，单仓自足 Pi Fork

- 日期：2026-08-11
- 类型：决策记录（终局架构，用户指令）
- 触发：TUI 验收后（`MOTTO-TUI-1` 全部切片 ACCEPTED + GHOSTTY-BASELINE ACCEPTED）
- 状态：REGISTERED（目标态；合并动作被 TUI 验收门控住，验收前不执行）

## 0. 目标态一句话

> TUI 验收后，把 `~/Projects/Motto` 并入 `lesPrivilege/pi`（harness Core），
> 单仓即一个足量的 agent（类似 Pi Fork / omp 的效果）：上游历史 + Motto patchset
> + Motto 系列 extensions/skills/themes/docs/fixtures 同仓；上游与生态不进仓，
> 只作清单记录。

## 1. 目标拓扑

```text
earendil-works/pi          上游(remote, 永远不进仓)
   ↓
lesPrivilege/pi            ← 唯一产品仓(合并后)
   ├── 上游历史(v0.84.1 基线 + 未来吸收)
   ├── Motto patchset(PATCHES.json 登记)
   ├── packages/motto/     extensions + themes + skills(并入)
   ├── docs/               TUI-THESIS / SURFACE-MATRIX / PROJECTION / MAINTENANCE
   ├── fixtures/           TUI 基线 + ghostty 捕获
   └── scripts/            维护/构建/演练(motto-maintenance 泛化)
```

- **上游**：`upstream` remote，零入库；升级经 PI-BASE/PATCHES 清单驱动。
- **生态（第三方 extensions）**：不入仓，仅 `EXTENSIONS.lock.json` 清单记录
  （npm/git 钉版 + integrity + 兼容 base）。
- **单仓即发行**：合并后 `motto` 直接跑本仓构建产物，不再有「产品仓 → 部署位」
  的拷贝链路（deploy.sh 退化为 fork 内自包含）。

## 2. 与既有裁定的关系

- 取代 `2026-08-11-motto-downstream-0.md` §2「双仓拓扑」的**过渡期**表述：
  双仓是到达终局的过渡形态（上游历史与产品解耦，便于先立制再改 TUI）；
  终局是单仓自足 fork（用户 2026-08-11 裁定）。
- 修改 `AGENTS.md` 宪制第 5 条（拓扑封闭）：当前双仓 → 验收后单仓；
  第 7 条（受控下游）补充终局形态。
- 与 omp 同构：omp 正是「Pi fork + 内置电池」；Motto 走同一方向，
  但 patch 仍逐条登记、单点可删、removalCondition 不废（fork 纪律不因合并而松）。

## 3. 维护/update 机制泛化（合并前置）

合并要求维护机制不再依赖双仓路径，因此先行泛化：

- **单一配置**：`~/.pi/agent/maintenance/config.json`（harnessRepo / scriptsRoot /
  stateFile），脚本经 `scripts/maint-lib.sh` 读取（env > config > 默认）。
- **通用工作流**：`motto-maintenance` skill 改为与仓布局无关的通用表述——
  检查/升级/回退/定期，全部经配置解析路径；合并前后同一套脚本可用。
- **进仓形态**：合并后 scripts/ 与 config 随 fork 走，skill 正典在 fork 内
  `docs/maintenance/skills/`，部署位 `~/.pi/agent/skills/` 仍为运行时镜像。

## 4. 验收门（合并动作的触发条件，全部满足才动手）

1. `MOTTO-TUI-1` 全部切片（S1–S4）ACCEPTED；
2. `GHOSTTY-BASELINE` DRAFT → ACCEPTED（用户侧）；
3. 基线 `--check` 持续 PASS（`ci-checks.sh governance`）；
4. 维护机制泛化完成（本裁定 §3）且回归绿。

## 5. 合并执行清单（验收后执行，本裁定只登记）

1. `git -C ~/Projects/pi` 以子目录方式并入 Motto 内容（extensions/themes/skills/
   docs/fixtures/scripts），保持上游历史在前、patchset 在后。
2. 合并后统一路径，重写 deploy/漂移链路为 fork 内自包含。
3. `motto` launcher 指向本仓构建；`~/Projects/Motto` 归档至 `~/Archives/`。
4. 更新 PI-BASE/RELEASES 记录新发行；`~/Projects/Motto` 的 remote 转只读或存档。

## 6. 修订

- 2026-08-11：终局裁定登记。TUI 验收前不执行合并；维护机制泛化先行（见 §3）。
- 2026-08-12：§5 执行清单 1–4 落实（单仓合并完成）。
