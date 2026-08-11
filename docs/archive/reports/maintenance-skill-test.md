# Motto Maintenance Skill — 端到端实测与受控升级评估

- **执行者**: Motto（motto-maintenance executor）
- **日期**: 2026-08-12
- **仓**: `/Users/lesprivilege/Projects/pi`（单仓 fork，branch `motto/main`，HEAD `ad1d48626`，clean）
- **配置真源**: `~/.pi/agent/maintenance/config.json`；注册表 `docs/maintenance/`
- **程序**: 按 skill `motto-maintenance/SKILL.md` §0/§2/§4/§6/§7 逐条执行
- **约束遵守**: 未 accept/merge 到 motto/main；未 push 任何东西到 origin；只写 /tmp

---

## PART 1 — 脚本实测（只读 + 治理）

| # | 脚本 | 结果 | 证据 |
|---|------|------|------|
| 1 | `upstream-check.sh --state …/last-check.json` | **UPDATE_AVAILABLE: 68 commits since v0.84.1** | 上游 HEAD `a4453b79b`，受影响包 agent/ai/client/coding-agent/protocol/server/session-backends/telemetry/tui。状态文件已写（checkedAt 更新）。⚠️ 见「发现 A」：此 68 为**陈旧本地分支口径**，真实增量 108。 |
| 2 | `ci-checks.sh governance` | **GOVERNANCE: PASS** | 含 registry 一致性、5 扩展 typecheck、无二进制入库、**TUI baseline --check PASS**、**drift-check PASS**。 |
| 3 | `downstream-drill.sh` | **11 passed / 0 failed** | fetch→candidate→range-diff→build→install→rollback→cleanup 全链 PASS；`CANDIDATE_INSTALL_VERIFIED + ROLLBACK_VERIFIED`。 |
| 4 | `regression.sh` | **11 passed / 0 failed** | motto + 5 扩展全部 PASS，含 drift-check。 |
| 5 | `drift-check.sh` | **DRIFT-CHECK: PASS** | 5 扩展 + 3 themes 部署位与仓库一致（无需 deploy）。 |
| 6 | `launchers/motto version` | **身份块正常，release 2026-08-12.0** | base 0.84.1 / upstream 53fa77ccd / patchset motto.single-repo (7 patches)。 |

**清洁性确认（#3 演练后）**: `git worktree list` 仅剩主树 `motto/main`；`git branch | grep candidate` 为空；`git status` clean。演练自清理自包含，无残留。

---

## PART 2 — 受控升级 dry-run（skill §4 核心工作流真实测试）

### 2.1 fetch
`git fetch upstream --tags` 成功（exit 0），**拉取 40 个新提交**（`refs/remotes/upstream/main` 从 `a4453b79b` → `2a9b4ebc6`）。真实增量 **v0.84.1..refs/remotes/upstream/main = 108 commits**（非 68）。

### 2.2 range-diff 审查 / 分类表（108 提交，全量）

**（a）接缝/修复 —— 触及 Motto 7 patch 文件域（14 提交）**

| 提交 | 标题 | 触及文件 | 与 patch 重叠点 |
|------|------|----------|-----------------|
| `00121ed9` | feat(tui): fullscreen transcript search **#7913** ⭐ | `interactive-mode.ts`, theme/{dark,light,schema,ts}, `tui/src/alt-screen-search.ts` 等 | **直接编辑 interactive-mode.ts + theme-schema.json**（T1/T2/T3/rebrand 重叠）→ 实测 auto-merge CLEAN |
| `ac4ac9ea` | feat(coding-agent): configure fullscreen exit output | `interactive-mode.ts`, settings-manager, settings-selector, index.ts | **直接编辑 interactive-mode.ts** → auto-merge CLEAN |
| `1279952d` | feat(tui): single-line transcript scrolling **#7903** ⭐ | `tui/src/keybindings.ts`, tui-alt-screen.ts | tui 层；与我们的 `coding-agent/src/core/keybindings.ts` **不同文件**，无冲突 |
| `4a879dd7` | fix(tui): no-redraw-on-blur **#7892** ⭐ | `tui/src/tui-alt-screen.ts` | 无重叠 |
| `18dee5f0` | fix(tui): full-width zero-recomposite ⭐ | `tui/src/layout.ts` | 无重叠 |
| `06ed8716` | fix(tui): split Alt+Enter (#7899) | `tui/src/terminal.ts` | 无重叠 |
| `2a95ef70` | fix(tui): ESC timeout 仅限 lone ESC | `tui/src/{stdin-buffer,terminal}.ts` | 无重叠 |
| `452923b5` | fix(tui): multiline LaTeX | `tui/src/latex.ts` | 无重叠 |
| `9c53c47f` | fix indent | `tui/test/stdin-buffer.test.ts` | 无重叠 |
| `3dd4623e` | Fix cwd prompt formatting (#7887) | `coding-agent/src/core/system-prompt.ts` | core 域，非 patch 文件，无冲突 |
| `e47b8e37` | feat(ai): additional_tools for deferred tools | `coding-agent/src/core/model-config.ts` | core 域，无冲突 |
| `7915cdac` | feat(ai): strict tool schema conversion | `coding-agent/src/core/{experimental,tools/*}.ts` | core 域，无冲突 |
| `b987ead3` | feat(agent): expandPromptTemplates (#7857) | `coding-agent/src/core/{agent-session,extensions/types}.ts` | core 域，无冲突 |
| `310411ba` | Add [Unreleased] section | `tui/CHANGELOG.md` 等 | 无 |

⭐ = 已知 alt-screen follow-up。**4 个已知 follow-up 全部在本 108 增量内**（`#7913`、`#7903`、`#7892`、`18dee5f0`）——均落在上游-check 漏报的 40 提交里（`18dee5f0` 除外，它在 68 口径内）。

**（b）无关 / 基础修复（~84 提交）**：harness-v3 存储/事件设计文档（约 40 条 docs(agent)）、AI provider 修复（Bedrock/Cloudflare/Gemini/DeepSeek/Mistral→原生/Codex/OpenCode/Kimi）、sqlite 修复、JSONL codec 与会话恢复修复、contributor 审批（.github）、chore(docs)、nanoid 刷新、npm12 发布脚本、AGENTS.md。均不触及 patch 文件。

**（c）破坏性或需重放注意（~10 提交 / 4 类）**：
1. **依赖面升级**：`5ac91336` nanoid 3.3.17、`9dd90a49` Mistral SDK→原生传输、`7915cdac` 严格 tool schema、`e47b8e37` additional_tools —— 上游 lockfile 现钉 `openai@6.40.0`（0.84.1 为 6.26.0）。**候选构建必须全新 `npm install`；用旧 node_modules 会构建失败**（见 2.4）。
2. **rebrand 测试对账缺失**：上游 3 个测试文件在 0.84.1→main 间把断言改回 `pi *`（`motto install`→`pi install` 等），与我们的 rebrand（APP_NAME=motto）产生 9 项失败。需随升级带上 motto 侧未登记的对账提交 `94a2d111d`（见发现 C）。
3. **上游删除/改写测试**：上游重构了 settings-manager/settings-selector/agent-session-prompt 等测试（+新增 strict-mode 测试），与 patch 无冲突但需跑全量回归确认。
4. 无破坏我们 patch 的 API 变更 —— 所有重叠文件实测均 auto-merge。

### 2.3 candidate 分支 + patch 重放（隔离 worktree，主树未动）

`git worktree add /tmp/motto-candidate -b candidate/pi-next refs/remotes/upstream/main`（HEAD `2a9b4ebc6`，真实上游）。逐 commit cherry-pick：

| # | patch | commit(s) | 结果 | 说明 |
|---|-------|-----------|------|------|
| 1 | tui-1-s1-user-gutter | `2daa52934` | **CLEAN** | 4 文件，新增 motto-layout.ts |
| 2 | tui-1-s1-user-gutter (细化) | `5e94171e3` | **CLEAN** | 2 文件 |
| 3 | tui-1-s2-assistant-body | `fd0a3e812` | **CLEAN** | 2 文件 |
| 4 | tui-1-s3-tool-index-line | `1cdfd5d3c` | **CLEAN** | 3 文件 |
| 5 | tui-2-t1-thinking-identity | `0cb127bef` | **CLEAN** | interactive-mode.ts auto-merge |
| 6 | tui-2-t2-thinking-three-state | `7b80fa727` | **CLEAN** | interactive-mode.ts auto-merge |
| 7 | tui-2-t3-thinking-keys | `dfb898c0b` | **CONFLICT→已解** | 仅 `test/interactive-tui.test.ts` 导入块：上游加 `FullscreenExitOutput`、我方加 `ThinkingFoldState`，两条 import 并存即解（语义零冲突，已最小化解析） |
| 8 | motto-rebrand-1 | `33ca9585d`（实际落地 commit，见发现 B） | **CLEAN** | interactive-mode.ts + theme-schema.json auto-merge；config.ts / export-html 无上游触碰 |

**验证合并完整性**：candidate 中 `searchMatchStyle`（#7913）、`FullscreenExitOutput`（fullscreen-exit）、`thinkingFoldState`/`BODY_INDENT`（我方）、config.ts `PI_CODING_AGENT_DIR`（rebrand 平台层保留）全部并存。未添加任何 Motto 产品内容（docs/fixtures/scripts/maint 系单仓自带的路径，候选为纯上游 + patch 重放）。

**支持性提交（PATCHES.json 未登记，实测需要）**：`94a2d111d`（rebrand 测试对账 9 项，CLEAN，修复全部 9 项失败）、`025406274`（T2 NO_SESSION_POLLUTION 测试 228 行，CLEAN）、`2fecf1d22`（motto-layout 注释，CLEAN）。

### 2.4 candidate 构建 + 门禁（尽力而为，全部如实）

- **构建**：首次用主树 node_modules symlink 构建失败 —— `openai-responses-shared.ts` `"additional_tools"` 类型错误（openai 6.26 缺该联合成员）。**根因 = node_modules 陈旧**（0.84.1 依赖集），非 replay 冲突、非上游破坏。候选内 `npm install`（registry 可达，openai 升至 6.40.0）+ 先建 leaf（protocol/telemetry）后，`offline-hydrate.sh` **ALL_BUILD_OK**：9 包全部构建成功，`dist/cli.js` 生成。
- **coding-agent 测试**：
  - 触及区（thinking-fold/user-message/assistant-message/tool-execution/interactive-tui）：**78/78 PASS**。
  - 全量（7 patch 重放后）：**10 失败** = 9 项 rebrand 对账缺失（package-command-paths 7 + credential-print 1 + first-time-setup 1）+ footer-data-provider 1（超时）。
  - 带入 `94a2d111d` 后全量重跑：**218 files / 1946 tests PASS，0 fail，6 skip**（比 motto/main 当前 217/1941 还多，因含上游新增 strict-mode/agent-session-prompt/settings 测试）。
  - `footer-data-provider` 单独跑 **8/8 PASS** → 该失败为全量并行负载下的**偶发时序**，非升级回归（motto/main 全量本次 0 fail）。
- **tui 测试**（node --test）：**908 PASS / 0 fail**（覆盖 #7892/#7903/#7913/18dee5f0 alt-screen 相关测试）。
- 说明：`offline-hydrate` 的 ai 构建走 `build:offline`（规避 models.dev 不可达），数据仍 0.84.1 版本 —— 对类型/逻辑验证足够；真实发布时建议网络可达下全量 `npm run build`。

### 2.5 回退口确认（skill §6）
- `MOTTO_USE_OFFICIAL=1 launchers/motto --help` → **官方 pi 品牌**（`pi - AI coding assistant…`）✓
- 普通 `launchers/motto --help` → 下游 motto 品牌（`motto - AI coding assistant…`）✓
- 官方 `/opt/homebrew/bin/pi --version` → `0.84.1`（无 motto 串，全局包为未夺舍官方构建）✓
- ⚠️ 细节：launcher 在 MOTTO_USE_OFFICIAL 分支**之前**拦截 `version/--version/-v`，故 `MOTTO_USE_OFFICIAL=1 motto --version` 恒打身份块；演练脚本也只验 exit code。等价性对照应以 `--help` 或真实子命令为准（本次已用 `--help` 实证）。

### 2.6 清理
`git worktree remove --force /tmp/motto-candidate` + `git branch -D candidate/pi-next`（was `9135e405a`）+ `git worktree prune`。最终：`git worktree list` 仅主树，`git branch` 无 candidate，主树 `motto/main` clean（`nothing to commit`），`/tmp/motto-candidate` 已删。主树 `node_modules` 未被污染（openai 仍 6.26.0）。

---

## 发现（审计记录）

- **A. 检查脚本引用歧义 ref（工具缺陷，建议修）**：`upstream-check.sh` 与 `downstream-drill.sh` 用裸 `upstream/main`，git 解析到**陈旧本地分支** `refs/heads/upstream/main`（`a4453b79b`，behind 40）而非 `refs/remotes/upstream/main`（`2a9b4ebc6`）。当前**漏报 40 提交**（68/108），且漏报的正是 4 个已知 alt-screen follow-up 中的 3 个。建议改用 `refs/remotes/upstream/main` 并定期清理/同步本地 `upstream/main` 分支（或删除之）。
- **B. PATCHES.json motto-rebrand-1 commit 字段陈旧**：登记 `289e5338f`（兄弟提交，不在 motto/main），实际落地为 `33ca9585d`（含 config.ts/export-html 的最小选择性版）。升级与回退都应锚定 `33ca9585d`；建议修 registry。
- **C. 3 个未登记支持性提交**：`94a2d111d`（rebrand 测试对账，**升级必需**）、`025406274`（T2 NO_SESSION_POLLUTION 测试）、`2fecf1d22`（docs 注释）。不在 7-patch 清单内，但重放与回归依赖它们；建议补登 PATCHES.json（或作为测试支撑随升级 commit 落账）。
- **D. 依赖面**：升级需全新 `npm install`（openai 6.40.0 等），旧 node_modules 必挂；环境 registry 可达、models.dev 不可达（沿用 offline-hydrate）。

---

## RECOMMENDATION（给用户的接受/拒绝决策）

- **（a）接缝/修复类 —— 建议接受**。与 patch 文件重叠的上游改动（#7913 search、fullscreen-exit、4 个 alt-screen follow-up）全部与我们的 7 patch **auto-merge 干净**，语义无冲突；tui 908 测试全绿。
- **（b）无关/基础修复 —— 建议接受**。纯增量，含大量 harness-v3 文档与 AI provider 修复。
- **（c）破坏性/注意类 —— 有条件的接受**：无阻断性破坏；但 ① 升级必须随带 `94a2d111d` 对账提交（否则 coding-agent 9 项测试失败），② 构建须全新安装依赖，③ 建议一并补登 B/C 两个 registry 修正。
- **7 patch 重放结论：干净可重放**。8 个 commit 中 7 个 CLEAN、1 个（T2-3）仅测试导入块 trivial 冲突（我方解析，两条 import 并存）。真实升级可以 proceed；**需注意**：a) 随升级带上 `94a2d111d`/`025406274`/`2fecf1d22` 三个未登记支持提交；b) 修 A（歧义 ref）后再跑一次上游-check 以覆盖全 108 增量；c) 走完 skill §4 的 offline-hydrate → 冒烟 → 真实 dogfood 门后再 accept；d) 升级 commit 落账时在 message 记录本评估依据。
- **未做**：未 accept/merge、未 push、未 dogfood（skill 门需用户在场）、未改 PI-BASE/RELEASES/PATCHES 状态。主树保持 `motto/main` 原样。
