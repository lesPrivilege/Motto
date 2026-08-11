# 验收报告 — 「夺舍终局」单仓合并里程碑

- **验收人**：独立验收 agent（未参与编写代码）
- **验收对象**：`~/Projects/Motto` 并入 pi fork `~/Projects/pi`（branch `motto/main`）
- **方法**：严格复验，不采信编写者陈述；所有可复验项独立重跑
- **日期**：2026-08-12

---

## 1. 结构完整性（pi fork） — ACCEPTED

| 检查项 | 结果 | 证据 |
|---|---|---|
| `git status` 干净 | ✅ | `nothing to commit, working tree clean` |
| HEAD == origin | ✅ | HEAD == `ab306333877dbf116c2f6f70cd101156c0b5ddd0` == `origin/motto/main` |
| 4 个合并 commit 在 T2 时代之上 | ✅ | `025406274` → `cda0c3f2a`(import) → `c7896e854`(rewire) → `e6f07290c`(drill fix) → `ab3063338`(records+philosophy)；先前 TUI 工作完整保留 |
| **Harness 未动** | ✅ | `git diff --stat 025406274..HEAD -- packages/coding-agent/src packages/tui/src packages/ai/src packages/session-backends packages/agent/src packages/cli/src` **为空**；`cda0c3f2a..HEAD` 同路径亦为空 |
| **上游根 scripts/ 未动** | ✅ | `git diff 025406274..HEAD -- scripts/*.mjs scripts/*.sh` 为空；scripts/ 新增仅 `scripts/maint/`（13 个新文件，新子树） |
| workflows | ✅ | `ci.yml` 无 diff；新增 `motto-ci.yml` + `upstream-pin-verify.yml`（内容 sane：确定性检查 / 只读 pin 校验） |
| Motto 内容就位 | ✅ | `packages/motto/extensions/` 6 packs + REGISTRY.md；`docs/`（decisions/architecture/research/maintenance/… + AGENTS-MOTTO.md + CONTRIBUTING-PACKS.md + NOTICE-MOTTO.txt + MOTTO-PHILOSOPHY.md + MOTTO.md + TUI-THESIS.md + ROADMAP.md）；`fixtures/tui/`；`scripts/maint/`（含 launchers/motto + motto-dev） |
| 无违禁产物入库 | ✅ | `git ls-files packages/motto/extensions | grep -E "node_modules|/bin/|package-lock"` → 空 |

## 2. 可启动节点（里程碑门） — ACCEPTED

| 检查项 | 结果 | 证据 |
|---|---|---|
| `motto version` | ✅ | 身份块：`Motto Pi / base 0.84.1 / upstream 53fa77ccd / patchset motto.single-repo (7 patches…) / release 2026-08-12.0`，exit 0 |
| `motto --help` 跑 fork dist | ✅ | launcher 解析 `$REPO_ROOT/packages/coding-agent/dist/cli.js`（第 54 行），dist 存在 → 走 fork 分支；输出头 `motto - AI coding assistant`，exit 0 |
| 新会话 smoke | ✅ | `/tmp/launch-smoke.txt` 存在：`motto -p 'Say exactly: ok'` → `ok`，随后 `[motto-computer-use] server stopped`（扩展生命周期运行）——非交互启动成功 |
| 官方回退 | ✅ | `MOTTO_USE_OFFICIAL=1 motto --help` → 输出头 `pi - AI coding assistant`（官方 `/opt/homebrew/bin/pi` 真执行；注意 `--version` 在 launcher 内被拦截打印记录身份，故用 `--help` 验证真回退路径） |
| 主题/扩展部署 | ✅ | `~/.pi/agent/themes/`：motto/motto-dark/motto-light 三 JSON；`~/.pi/agent/extensions/`：5 个扩展 pack 目录；`drift-check.sh` → `DRIFT-CHECK: PASS` |

> 注（非缺陷）：部署位显示 5 个扩展 pack 而非 6 —— `motto-themes` 是非扩展 pack（REGISTRY 明载「非扩展 pack：无 index.ts/checksums」），其产物（3 个主题 JSON）部署到 `~/.pi/agent/themes/`，与 drift-check 一致。

## 3. 记录与文档 — ACCEPTED

| 检查项 | 结果 | 证据 |
|---|---|---|
| RELEASES.json | ✅ | 合法 JSON；release `2026-08-12.0` / `motto.single-repo.0`，`corePatchset` = 7 patch id，`mottoCommit` = `e6f07290c…`（见 §5 语义核验），`acceptanceEvidence` 5 项，schema 与 `releaseManifestFormat` 一致 |
| PI-BASE.json | ✅ | `commitRange.mottoMain` = `e6f07290c…` 已更新；上游五元组不变（0.84.1 / 53fa77ccd / tag v0.84.1 / tarball / integrity） |
| `~/.pi/agent/maintenance/config.json` | ✅ | `harnessRepo=~/Projects/pi`、`scriptsRoot=~/Projects/pi/scripts/maint`、`docsRoot=~/Projects/pi/docs/maintenance`，**无 productRepo 字段** |
| AGENTS-MOTTO.md | ✅ | §5 拓扑封闭→「单仓闭合（夺舍终局，2026-08-12 落实）」；§7 受控下游含「终局（单仓，2026-08-12 落实）」；路径用 `packages/motto/extensions/<pack>/`；工程原则/安全线 intact |
| ADR 2026-08-11-motto-fork-consolidation.md | ✅ | 尾部「§6 修订」追加 `2026-08-12：§5 执行清单 1–4 落实（单仓合并完成）`；历史正文（含"目标态/REGISTERED"）未改 |
| MOTTO-PHILOSOPHY.md | ✅ | 与 `/tmp/motto-philosophy.md` **逐字节一致**（`diff` 空）；`MOTTO.md` 与 `README.md` 均有指针行 |
| PATCHES.json 7 patch | ✅ | 7 条全部 `status: applied`；每条 commit 均存在于 git 历史（tui-1-s1 双 commit `2daa52934` + `5e94171e3` 均存在） |

## 4. 门禁复跑 — ACCEPTED

| 门禁 | 结果 | 证据 |
|---|---|---|
| baseline `--check` | ✅ | `BASELINE_CHECK_PASS: 与已提交基线逐字节一致,逐宽度零超宽`，exit 0 |
| downstream-drill | ✅ | **11 passed, 0 failed**；`CANDIDATE_INSTALL_VERIFIED + ROLLBACK_VERIFIED`；结束后 `git worktree list` 仅主树、`git branch -a` 无 candidate、`/tmp` 无残留 worktree、主树保持 `motto/main` |
| ci-checks governance | ✅ | `GOVERNANCE: PASS`（含 typecheck motto / 无构建产物入库 / baseline / drift） |
| regression.sh | ✅ | **11 passed, 0 failed**（per-pack：canonical-copy 1、computer-use 6、gemini-vision 1、review-flow 1、motto 1 + drift-check 1） |
| ./test.sh | ⏭ | 未复跑（长时间）；按编写者报告 exit 0 / 3193 passed / 0 failed 记录为 writer-reported |

## 5. 偏差合理性 — ACCEPTED

- **e6f07290c drill 修复**：commit 只改 `scripts/maint/downstream-drill.sh`（34+/15−）；隔离 worktree 方案 sound —— candidate 构建在独立 worktree，主树全程 motto/main，演练后无残留；我独立复跑 drill 11/11 且无残留，方案实证成立。
- **RELEASES mottoCommit 语义**：`mottoCommit` = `e6f07290c`（产品态 commit），而非记录 commit `ab3063338`。核验：`ab3063338` 只改 README/docs/AGENTS-MOTTO/ADR/PI-BASE/RELEASES（全部记录与文档，无产品代码）；`e6f07290c` 是最后触及产品/工具代码的 commit。故 `mottoCommit` 正确指向「真实 session 运行的那套系统」的产品态，规避自引用（记录自身 commit 无法自指）。与 releaseManifestFormat「mottoCommit: Motto 仓 commit」及 2026-08-11.0 惯例一致。

## 发现的不一致（均为非缺陷）

1. 初查脚本按 `patches` 键查找为空 —— 实际 schema 用 `corePatchset`（与 releaseManifestFormat 一致），7 个 patch id 齐全。工具误用，非数据问题。
2. 部署位扩展数为 5（非 6）—— `motto-themes` 为非扩展 pack，产物在 themes/，符合设计。
3. `MOTTO_USE_OFFICIAL=1 motto --version` 被 launcher 拦截打印记录身份（与 fork 相同），真回退以 `--help`（输出头 pi）实证。

---

## 总评：**ACCEPTED**

五个验收域全部通过：结构完整、可启动节点实证成立（fork dist 真实运行 + 扩展生命周期 + 官方回退）、记录与文档闭合、机械门禁独立复跑全绿（drill 11/11、baseline PASS、governance PASS、regression 11/11）、偏差合理且符合既有 schema 惯例。唯一未复跑项为长时 `./test.sh`（按 writer 报告记录）。无阻碍性发现。
