# Motto 宣言级 Handoff 独立验收报告 — motto/main @ acf7bae24

- 日期：2026-08-12
- 受验对象：`docs/HANDOFF-DECLARATION-2026-08-12.md`（四层验收阶梯自评）
- 验收方式：静态审计 + 沙箱内可跑测试；无真实 TUI，无 git 写权限
- 结论：**ACCEPTED WITH LIMITATIONS**

结论的限制条款有两类。工程实体一类：薄接缝边界、功能语不可侵两项经独立核验成立，且证据强度高于自评所给；单点可删、只读投影两项不成立，自评判为 ✅ 属过判。文档一类：宣言自称「锚定既有正典，不自立新义」，实测不成立；§六未达处清单漏列若干已发生且已被本仓文档记录的破例。

---

## 1. 测试环境

- OS / 架构：Linux arm64 沙箱容器，`HOME=/sessions/nifty-happy-brahmagupta`，非用户真机
- 运行时：node v22.22.3 / npm 10.9.8。`docs/maintenance/PI-BASE.json` 登记的构建环境为 node v25.9.0，本轮不一致
- 仓库状态：`motto/main @ acf7bae24`，`git status` 干净，`git rev-list --left-right --count HEAD...origin/motto/main` = `0 0`
- 权限及承载进程：只读审计，未修改仓库任何文件

环境限制（决定本轮大量条目只能标 NOT TESTED，非受验方缺陷）：

| 限制 | 后果 |
|---|---|
| `node_modules` 为 darwin-arm64 安装产物，`rolldown` 原生绑定在 Linux 下缺失 | vitest 全线不可跑；`packages/tui`、`packages/coding-agent` 测试无法执行 |
| `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent` 不存在 | `fixtures/tui/render-baseline.mjs --check` 无法执行 |
| 部署位 `~/.pi/agent` 在沙箱 HOME 下不存在 | `drift-check.sh` 报 FAILED，但该失败源于环境无部署位，不计入受验方 |
| `.git/index.lock` 存在且 `rm` 返回 `Operation not permitted` | 本轮无法执行任何 git 写操作：`git revert`、`git worktree`、`downstream-drill.sh` 均不可实测 |

`.git/index.lock` 为零字节，时间戳晚于最末提交，形态属陈留锁。该锁是否影响用户真机日常 git 操作，本轮未探查，宜自行检查。

---

## 2. 架构边界

链路：模型 → Core（agent loop / provider / session canonical）→ 扩展接缝（`registerMarkdownTransformer`、`appendEntry`、`registerEntryRenderer`）→ TUI 渲染组件。

以 `PI-BASE.json` 登记的上游基线 `534bcbffb` 为参照，`git diff --stat 534bcbffb..HEAD -- packages/` 共 113 文件、13045(+)/112(−)。其中 `packages/{agent,ai,protocol,session-backends,client,server,evals,telemetry}` **八包逐一确认零 diff**。改动落点仅三处：`packages/coding-agent/src` 的 interactive 集成层与主题、`packages/tui/src/components/markdown.ts`（约 100 行）、新增目录 `packages/motto/extensions/*`。内置工具实现、agent loop、session schema 定义文件均在零 diff 清单内。

未进入 Core，未引入非白名单依赖：`node scripts/check-pinned-deps.mjs` 退出码 0，`package-lock.json` 411 条 `resolved` 全为 registry tarball，无 git 类依赖。

---

## 3. 验收项

### L1 Build

| 项 | 结果 | 证据 |
|---|---|---|
| motto pack 测试 | PASS | `node --test` 逐文件：branding 3、cards 32、footer-degrade 4、headings 22、motto 5、project-doc 6、tps 6；review-flow 25。合计 103 通过 0 失败。cards 32/32 与自评一致 |
| tui markdown 79/79 | NOT TESTED | rolldown 原生绑定架构不符，vitest 不可启动 |
| coding-agent 全量 | NOT TESTED | 同上 |
| `npm run build` | NOT TESTED | 同上 |
| `render-baseline.mjs --check` | NOT TESTED | 依赖 `/opt/homebrew` 全局安装位，沙箱内不存在 |
| `drift-check.sh` | NOT TESTED | 沙箱 HOME 无部署位；脚本输出 FAILED 系环境所致，不作 FAIL 记 |
| `downstream-drill.sh` 11/11 | NOT TESTED | 需 git 写操作与 worktree，`index.lock` 阻塞 |
| PATCHES.json 登记完备性 | PASS | 10 条全部 `status: applied`，10 条全部具 `removalCondition`，12 个引用 SHA 经 `git cat-file -t` 确认存在 |

L1 在本环境内可复核的部分全绿；不可复核部分占多数。自评所列五道机械门，本轮独立证实零道，宜由用户真机复跑后补录证据。

### L2 Feature

| 项 | 结果 |
|---|---|
| `、、、 bash` 盒顶 accent 标签、盒内无分隔线 | NOT TESTED |
| 裸卡标题在盒内、自然 markdown 表格分隔线保留 | NOT TESTED |
| 长标注不撑宽 | NOT TESTED |
| computer-use 门禁 fail-closed / approve / revoke | NOT TESTED |

本轮无真实 TUI 可驱动，L2 整层未获独立证据。自评的 ✅ 依据是受验方自陈的 dogfood 记录，非本报告可背书。单元测试通过（cards 32/32）只是 L1 证据，按宣言 §〇 自设的阶梯不等价原则，不可上推为 L2。

### L3 Architecture

| 项 | 结果 | 证据 |
|---|---|---|
| 薄接缝边界，不吞 Core | **PASS** | 八包零 diff，见 §2。此项证据强度高于自评所述 |
| 一 commit 一 patch，单点可删 | **FAIL** | 见下 |
| 只读投影，零写回 | **PARTIAL** | 见下 |
| 受控升级链路为拉模式 | PASS | `scripts/maint/upstream-check.sh` 全文无 `merge`/`rebase`/`checkout`，只 fetch + `rev-list --count` + 写状态 + 打印。`upstream-check.launchd.plist` 每日 09:00，`RunAtLoad=false`，需手动 `launchctl load`，日志入 `/tmp`，不改仓库。回退经 `scripts/maint/launchers/motto:49-51`，`MOTTO_USE_OFFICIAL=1` 即 `exec "$OFFICIAL_PI"`，无状态突变。仅静态核验，未实跑 |
| 部署位镜像 + drift | NOT TESTED | `deploy.sh` 为 `rsync -a --delete` 单向镜像、`drift-check.sh` 为 `diff -rq` 非空即 FAIL，逻辑成立；实效未验（无部署位） |
| 分支卫生 | PASS | 本地仅 `main`（上游镜像锚）、`motto/main`（唯一产品线）、`upstream/v0.84.1`（基线）；本地=远端 |

**单点可删 FAIL 的依据。** 因 `index.lock` 阻塞，改用 `git apply --check -R` 试算反向补丁作等效核验。12 个登记 SHA 中仅 5 个可干净反向应用，7 个直接报 `patch does not apply`。根因两类，均可静态坐实：

其一，MOTTO-UPGRADE-1 把 7 条旧 patch 在新 base 上重放成新 SHA 的平行提交（如 `2daa52934`→`81dbec74f`，经 merge `20d6909d9` 合入同一历史），`PATCHES.json` 的 `commit` 字段仍登记旧 SHA，旧 SHA 与当前树状态已不匹配。

其二，即便换成重放后的新 SHA 重测仍有多条失败：同系列内后续 patch 覆写同一文件同一区域——`thinking-fold.ts` 被 T1/T2/T3 三条依次叠改，`assistant-message.ts` 被 S2/T1/T2 叠改，`cards.ts`/`markdown.ts` 被 tui-4-s1 与 tui-4-s2 叠改，`tool-execution.ts` 被 tui-1-s3 与 review-flow-a1 叠改。

`removalCondition` 逐条明文承诺「删除时 `git revert` 本 commit」。实测多数条目的移除需人工冲突消解，不是登记册所述的机械单命令操作。证据形态为 `git apply --check -R` 的保守近似，非 `git revert` 三方合并的最终形态，故冲突的严重程度（hunk 偏移抑或语义冲突）尚未逐条确定；但「多数条目不可机械单点回退」这一结论的信号已足。

**只读投影 PARTIAL 的依据。** cards（`packages/motto/extensions/motto/cards.ts:97` `projectDunhaoCards`）与 headings 均为纯函数，经 Core 公开的 `registerMarkdownTransformer` 接入，消费点仅 `user-message.ts:57`、`assistant-message.ts:139` 两处渲染组件，无 session 或 model-context 写入路径——此二者成立。

review-flow 不同。`packages/motto/extensions/motto-review-flow/index.ts:129` 在 `turn_end` 调用 `pi.appendEntry(ENTRY_TYPE, {...})`，经 `agent-session.ts:2385-2390` → `session-manager.ts:1122 appendCustomEntry()`，把 `type:"custom"` 的 `SessionEntry` 挂到 `leafId` 下并推进 leaf，即真实写入 session 树。落盘证据：`fixtures/tui/sessions/motto-tui-baseline.jsonl` 内 2 条 `{"type":"custom","customType":"motto-review-flow.turn.v1",...,"id":"f0022","parentId":"f0021"}`。

「不入模型上下文」这一半成立：`packages/agent/src/harness/session/context.ts:84-86` 对 `entry.type === "custom"` 仅在注册了对应 `entryProjector` 时转为消息，全仓确认 Motto 未注册 `motto-review-flow.turn.v1`，故该类型贡献零条模型消息。

问题在措辞而非实现。扩展源码自身写得准确——`index.ts:128` 注释为「经 appendEntry 落 custom entry，不入模型上下文」，只声称后一半。宣言 §三把「不持有 canonical、不入模型上下文、不写回 session」三句合并，对 cards/headings/review-flow 一并下断言，于 review-flow 的「不写回 session」一句不成立。代码比宣言诚实。

### L4 Philosophy

| 项 | 结果 | 证据 |
|---|---|---|
| 功能语不可侵 | **PASS** | 见下 |
| 第三方 lock 禁浮动 main | **PARTIAL** | 见 §5 |
| 谱系词汇不入输出 | **PARTIAL** | I11-1、I11-2 成立；I11-3 不成立 |
| 「不自立新义」 | **FAIL** | 见下 |
| 取舍 2 单仓自足 | **已破例且未披露** | 见下 |
| 取舍 8 不保留向后兼容 | **已破例且未披露** | `docs/decisions/2026-08-11-motto-tui-2.md:73` 明文「hideThinkingBlock 兼容路径不删」，PATCHES.json 两条 patch 描述亦记「兼容路径保留且优先」。`docs/AGENTS-MOTTO.md:17` 宪制原文为「不保留向后兼容。删除废弃路径，不加兼容层、fallback 或迁移逻辑」。宣言 §三判此条 ✅ 无待察点 |
| 立言时间线 | **不可核验** | 见下 |
| 取舍 1、4、7 | 有落点 | UPGRADE-1 全程走 candidate→重放→门禁→dogfood→ACCEPT；EXTENSIONS.lock 三条 npm 均 pinned + integrity；三层阅读面即 TUI-THESIS 全篇 |

**功能语不可侵 PASS。** 全部 `@earendil-works/pi-*` 包名保留；CLI bin 仍为 `pi`（`packages/coding-agent/package.json:10-11`）；`config.ts:487-498` 的 `CONFIG_DIR_NAME` 默认 `.pi`，`ENV_AGENT_DIR = "PI_CODING_AGENT_DIR"` 等硬编码，并附明文划界注释；全仓约 40 处 `process.env.PI_*` 无一改名；`packages/protocol`、`packages/agent` 两个契约层包零 `motto` 命中。`packages/coding-agent/package.json:6-9` 的 `piConfig.name = "motto"` 非违规改写，而是上游内建的下游品牌钩子（上游提交 `e82fb0fc8`）。

此项另有回归测试守线：`packages/motto/extensions/motto/test/branding.test.mjs` 记录一次真实事故——曾用全文正则把独立 `pi` 替换为 `Motto`，越界改写 `.pi`/`/pi` 路径致 skill 读取 ENOENT——修复为只追加身份段，并对 `.pi` 路径、`@earendil-works/pi-*`、`PI_CODING_AGENT_DIR` 等 token 作逐字节断言。三条测试本轮实跑通过。灰色地带一处：`getDebugLogPath()`（`config.ts:567`）与 `tools-manager.ts:112` 的 GitHub API User-Agent 使用品牌化后的 `APP_NAME`；落在上游钩子划定的呈现层用途内，不判违规，供知悉。

**谱系词汇 PARTIAL。** `docs/TUI-THESIS.md:168-171` 立三条：I11-1 渲染输出与 UI 文案无仿古词、I11-2 标识符中性、I11-3 谱系词汇不出现在代码注释中。

I11-1、I11-2 经核实成立：对 钤印、改笔、校记、朱墨、牌记、著录、抻平、凡例、朱记、提要 作字符串字面量与标识符双重 grep，用户可见面与标识符零命中。

I11-3 不成立，命中多处且不限于 review-flow：`packages/motto/extensions/motto/core.ts:1,13,87,90,138,445,476,554`（牌记）、`index.ts:2` 及其 `package.json:5` 的 description 字段直接写 `"splash (牌记)"`、`motto-review-flow/core.ts` 十余处（著录、改笔、提要、悬挂）、`coding-agent/.../thinking-fold.ts:11`（著录层纪律）、`motto-layout.ts` 与 `user-message.ts`（界栏、悬挂）。TUI-THESIS 自记「review-flow 勘误已执行」，与该 pack 当前代码不符。宣言 §三对此条的待察点只写「抽查渲染输出与用户可见文案」，范围窄于 I11-3 自身适用面。

附带核查一条：主题 `motto.json`/`motto-dark.json`/`motto-light.json` 的 `success`、`warning` 均映射 `mid`，`error` 映射 `accent`（`#c0453e`/`#b03a34`），结构上确无第四色、无绿。但 `docs/MOTTO-PHILOSOPHY.md:51-52` 的断言措辞为「全系统无第四种红、无绿、无 ✓/×」，字面不成立：`model-selector.ts:280,285`、`oauth-selector.ts:175,180`、`trust-selector.ts:110`、`scoped-models-selector.ts:256-258`、`interactive-mode.ts:1602,1610,6319,6354`、`export-html/template.js:1153` 仍用 `✓`/`✗`，`git blame` 逐一确认为未经 Motto patch 触碰的上游原码。此差异源于「薄接缝不吞 Core」的取舍，是两条取舍的真实张力，非疏忽；但宣言 §四清单原文照抄「全系统」措辞，实测应如实标注不成立，宜将适用范围收窄为 Motto 新增投影层。

**「不自立新义」FAIL。** 宣言 §〇 的四层验收阶梯（L1 Build / L2 Feature / L3 Architecture / L4 Philosophy）全仓无正典先例。grep 唯一命中 `docs/INDEX.md:18`，而该行系同一 commit `acf7bae24` 写入的自引用条目。MOTTO-PHILOSOPHY、AGENTS-MOTTO、TUI-THESIS、MAINTENANCE 均无此分层。有出处的只是三类结论体例（ACCEPTED / ACCEPTED WITH LIMITATIONS / REJECTED，出 `docs/templates/ACCEPTANCE.md`），被装进自造的四层容器。

另有两处拔高。其一，§一 1.3 标题「制度先于施工，施工先于功能」，正典 `AGENTS-MOTTO.md:13` 与 `decisions/2026-08-11-motto-downstream-0.md:19` 均止于两段式「立制先于任何 Core patch」，第三段为续写。其二，§三判取舍 2、8 为「✅ 无待察点」，而两者均有本仓文档自记的破例。

四层阶梯本身作为验收框架并无不当——本报告即按其执行，且其「阶梯不等价」的判据在 L2 一层直接生效。问题只在自我定性：新造框架宜自认新造，不宜以「锚定正典、不自立新义」开篇。

**取舍 2 单仓自足已破例。** `docs/decisions/2026-08-11-motto-fork-consolidation.md:56-61` 设四道验收门，明文要求全部满足才执行合并，其中第 1 项为「MOTTO-TUI-1 全部切片 S1–S4 ACCEPTED」，第 2 项为「GHOSTTY-BASELINE DRAFT→ACCEPTED（用户侧）」。而 `decisions/2026-08-11-motto-tui-1.md:96-120` 的最末记录仍是两项 ⏳ 未决，并声明「终态验收权在用户……未完成前不宣称 ACCEPTED」；全仓 `GHOSTTY-BASELINE*` 无匹配文件，该文档从未存在。`fork-consolidation.md:73` 却记「2026-08-12：§5 执行清单 1–4 落实（单仓合并完成）」，即门未过而执行。既有的 `docs/archive/reports/acceptance-consolidation.md` 五个验收域亦未覆盖此两项前置门。宣言 §三、§六均未披露。

**立言时间线不可核验。** `git log --diff-filter=A` 逐一核对：`2026-08-11-motto-downstream-0.md`、`-fork-consolidation.md`、`-tui-0-boundary.md`、`-tui-1.md`、`-tui-2.md`、`-tui-construction-prep.md`、`AGENTS-MOTTO.md` 全部首次出现于同一 commit `cda0c3f2a`（2026-08-12 01:00:11，message「import Motto product content」）。`git rev-list --parents -n1` 确认单亲，非 merge，即原 Motto 仓内容系整体拷贝入本仓，未保留原仓提交历史。这些文档标注的 2026-08-11 是文本字符串，非可复核的 git 元数据。

对照：TUI S1/S2/S3 代码提交 `2daa52934`/`fd0a3e812`/`1cdfd5d3c` 在本仓有原生 author date `2026-08-11 18:43:21`–`18:47:38 +0800`，属一手记录。

因此「立制先于改 TUI」这条顺序铁律，内部叙事自洽（downstream-0 与 tui-0-boundary 互相引用，tui-1 §前置引用 downstream-0 §7），但本仓 git 历史不能证实决策文档撰写时间早于 18:43 的代码提交。证据链断在两仓合并处，只能采信自陈，不能作已证事实。原始归档 `~/Archives/Motto-2026-08-11-single-repo/` 本可核验，不在本轮可访问路径内。宣言 §一 1.3 以表格形式把该排序作确凿陈述呈现，未标可验证性受限。

---

## 4. 断言—实测对照矩阵

| 宣言断言 | 自评 | 实测 | 差 |
|---|---|---|---|
| L1 五道机械门全绿 | ✅ | 可跑者全绿（103 测试），五道门本轮零道复核 | 环境所限，非过判 |
| L2 已目验 | ✅ | NOT TESTED | 本报告不背书 |
| 薄接缝不吞 Core | ✅ | PASS，八包零 diff | 实测强于自评 |
| 一 commit 一 patch 单点可删 | ✅ | FAIL，12 之 7 不可反向应用 | **过判** |
| 投影零写回 | ✅ | PARTIAL，review-flow 写 session 树 | **过判** |
| 升级链路拉模式 | ✅ | PASS（静态） | 相符 |
| 功能语不可侵 | ⚠️ 待察 | PASS，另有回归测试守线 | 实测强于自评 |
| 第三方 lock 禁浮动 | ⚠️ 待察 | PARTIAL，无样本可验且门禁有缺口 | 部分成立 |
| 谱系词汇不入输出 | ⚠️ 待察 | PARTIAL，I11-3 不成立 | 部分成立 |
| 不自立新义 | 开篇自称 | FAIL | **过判** |
| 上游 112 commits 未应用 | §六 | 措辞失准：112 系对旧基线 v0.84.1 计，其中 109 已由 UPGRADE-1 吸纳，对当前基线 `534bcbffb` 的实际残余为 3 | 见下 |

末条实测：`git rev-list --count upstream/v0.84.1..upstream/main` = 112，`upstream/v0.84.1..534bcbffb` = 109，`534bcbffb..upstream/main` = 3。PI-BASE.json 自身已声明 base 为 `534bcbffb`，宣言 §三、§六仍以 v0.84.1 计增量，读者会误以为有 112 条待决。

---

## 5. 安全与供应链

`EXTENSIONS.lock.json` 三条 `communityNpm`（`pi-rewind`、`@narumitw/pi-lsp`、`@tintinweb/pi-subagents`）字段齐全：精确版本、sha512 integrity、compatBase、exposed、updateMode: pinned、rollback。无浮动版本符号。全仓 `package.json`/`package-lock.json` 无 git 类依赖，`check-pinned-deps.mjs` 实跑退出码 0。

三处缺口：

其一，`communityGit` 为空对象（第 111 行）。「禁浮动 main」这条规则当前无实例可核，属无样本，不是通过。

其二，`scripts/check-pinned-deps.mjs:28-30` 的 `isNonRegistrySpecifier()` 对 `git+`/`github:`/`git:`/`https?:`/`ssh:` 开头的说明符直接 `continue` 跳过，不校验其是否钉了 commit SHA；强制精确 semver 只施于 registry 依赖。日后若加入 `"foo": "github:user/repo#main"`，此脚本不会报错。防浮动门禁对最需要防的一类实为空白。

其三，`check:pinned-deps` 仅由 `npm run check` 触达，而唯一调用它的 `.github/workflows/ci.yml:8-9` push 触发器为 `branches: [main]`。产品分支是 `motto/main`，`main` 为上游镜像锚。直接推送 `motto/main` 不触发该 workflow 的 push 事件，只有无分支过滤的 `pull_request:` 会跑；`motto-ci.yml` 不调用此检查。若日常走直接提交而非 PR，此门禁在实际工作分支上无自动触发保证。

另：`EXTENSIONS.lock.json` 无任何脚本作自动 drift 校验，与自研 pack 有 `drift-check.sh` 逐字节比对不同，属纯人工台账。

---

## 6. 已发现问题

**高**

1. 投影零写回断言对 review-flow 不成立（§3 L3）。若验收者只读宣言不查代码，会误以为 review-flow 与 cards/headings 同样对 session 无副作用。修法二择一：宣言分述三者，或为 review-flow 的 session 写入补一条独立说明。
2. 单点可删对 10 条之 7 不成立（§3 L3）。`PATCHES.json` 登记的是 UPGRADE-1 重放前的过时 SHA，且同系列 patch 间存在真实的文件区域重叠。至少应更新登记 SHA 为重放后值，并把叠改条目的 `removalCondition` 从「revert 本 commit」改为如实描述其依赖关系。
3. 单仓合并的自设验收门未满足而执行，且 §六未披露（§3 L4）。宜补记该缺口，或补做 TUI-1 终态验收与 GHOSTTY-BASELINE。

**中**

4. 「不自立新义」自我定性不成立（§3 L4）。四层阶梯宜自认为新立框架并入正典登记，而非以锚定正典开篇。
5. `check-pinned-deps.mjs` 对 git 类依赖整体跳过校验（§5）。
6. pinned-deps 门禁的 CI 触发分支与产品分支错配（§5）。
7. 上游增量的 112 之数以旧基线计，与 PI-BASE 自身声明的 base 冲突，实际残余为 3（§4）。
8. 宪制「不保留向后兼容」与 hideThinkingBlock 兼容路径的保留冲突，且 §三判此条无待察点（§3 L4）。此破例本身或有理由，但理由应写进 decisions 与宣言，不应以 ✅ 掩过。

**低**

9. I11-3 谱系词汇不入代码注释，多个活跃文件违反，含自称已勘误的 review-flow pack（§3 L4）。
10. MOTTO-PHILOSOPHY.md「全系统无 ✓/×」措辞被上游选择器组件字面证伪，宜收窄适用范围（§3 L4）。
11. `PI-BASE.json` 的 `commitRange.mottoMain` 仍为 `20d6909d9`，落后当前 HEAD 四次提交；若属升级快照字段则非缺陷，宜注明其语义。
12. `.git/index.lock` 陈留（§1）。
13. 立言时间线因两仓合并丢失原始历史，不可用本仓 git 独立核验（§3 L4）。宜在 §一 1.3 标注该表依据文档自陈，或指出原始归档路径供核。

---

## 7. 最终结论与理由

**ACCEPTED WITH LIMITATIONS。**

接受的依据是工程实体。薄接缝边界一项，八个平台包逐一零 diff，是本轮所见最硬的证据，其强度高于宣言自述；功能语不可侵一项，不仅未见违规，且有由真实事故驱动、作逐字节断言的回归测试守线。此二者是宣言 §二取舍 1、3 的实质落点，成立。

限制的依据分两类，须分开处理，不宜混为一谈。

其一为过判：L3 的单点可删与只读投影两项判 ✅ 而实测不成立。这两项不是措辞问题——`removalCondition` 承诺的机械回退在多数条目上做不到，属登记册与实况脱节，是可修的实体缺陷。

其二为文档失准：宣言自称不自立新义而框架系新造，§六未达处清单漏列已被本仓 decisions 自身记录的两处破例（单仓合并门未过、兼容路径保留）。宣言 §〇 立「build 全通 ≠ 功能实现 ≠ 架构实现 ≠ 理念实现」为总纲，其自身的诚实标准即由此设定；以该标准衡量，§三的 ✅ 用得比证据允许的更宽。

REJECTED 不适用：无安全红线违反，无 Core 侵入，无供应链浮动引用，缺陷均可在不改架构的前提下修复。

复验条件：问题 1、2、3 修复后可重提 L3 层复验；L1、L2 两层须由用户真机复跑并留证据，本报告对该两层不作结论。

---

## 未覆盖 / 残余风险

- L2 整层未获独立证据。宣言所述 dogfood 记录本轮未核。
- L1 五道机械门本轮零道复核，全部因环境限制标 NOT TESTED，非受验方缺陷。
- `downstream-drill.sh` 全链路（fetch→candidate→build→install→回退）未实跑，仅静态审查。
- `MOTTO_USE_OFFICIAL=1` 回退依赖 `/opt/homebrew/bin/pi` 实际存在，沙箱内不可验；机制设计成立，运行时依赖未证。
- 单点可删的 FAIL 基于 `git apply --check -R` 的保守近似，非 `git revert` 三方合并的最终形态；冲突严重程度未逐条确定。
- 取舍 3 呈现层/契约层分治，本轮只核了功能语一面，未作逐文件品牌化 diff 全查。
- 取舍 6 的「成功静默、失败强显」属渲染行为，需 L2 目验，未核。
## 8. 第二轮复验记录（返修后，2026-08-12）

> 本轮针对首轮报告与返修 commit 的复验。结论：**高 1 部分闭合（登记 SHA 修正正确、叠改如实登记）、
> 高 2 闭合、中 5/中 6 闭合、I11-3 残留清毕、五条文档项全部落定**。

### 8.1 方法更正

首轮「单点可删」反向应用试算跑在脏工作区上（返修注释清理恰好触及 `tool-execution.ts` 等文件），
读数被污染。改用 `git apply --cached --check -R` 对 HEAD 重测，并经第三轮 §9.3 以同一命令同一方法复核：
**2 条**可干净反向应用（`055c43962`、`34b30ba80`），10 条冲突。第二稿曾记 5 条可清（`81dbec74f`、
`055c43962`、`e6af3794d`、`943e67312`、`34b30ba80`），该读数采于注释清理提交 `8b5f903d7` 落 HEAD 之前
（对 `acf7bae24`）；`8b5f903d7` 与前序 patch 同文件区域（`user-message.test.ts:9`、
`tool-execution-component.test.ts:53`、`bash-execution-width.test.ts:78`）注释层重叠后，其中 3 条转冲突。
故反向应用可清数为 **HEAD 依赖值**，不设固定清单；主结论「多数条目不可机械单点回退」在 2/12 与 5/12
下均成立，`removalOrder` 的处置（后置先退、接受冲突手工合并）不变。

### 8.2 逐项闭合状态

| 项 | 状态 | 说明 |
|---|---|---|
| 高 1 登记 SHA 陈旧 | **闭合** | 7 条全部更新为重放后实际哈希，`merge-base --is-ancestor` 逐一确认在 motto/main；PI-BASE/RELEASES 同步 |
| 高 1 叠改不可机械回退 | **如实登记** | 新增 `removalOrder`（后置先退）+ 各条「叠改注」；不再假称单命令机械可退 |
| 新缺陷：`8f1e90d61` 自登记 PATCHES.json | **已注记** | 该 commit diff 内含登记册自身（+10 行），PATCHES.json 该条已补「另注」；返修登记册压尾独立成 commit 避开自引用 |
| 高 2 投影零写回 | **闭合** | 宣言措辞收窄：review-flow 经 I10-1 允许追加 custom entry，不入模型上下文、不发 message |
| I11-3 谱系词（低 9） | **闭合** | src 与测试注释残留全清（`牌记`/`提要`/`界栏`/`目行`）；`悬挂` 经 TUI-THESIS I11 边界裁定为现代排版术语，不计 |
| 「全系统无 ✓/×」（低 10） | **闭合** | 收窄为「Motto 新增投影层与主题」，上游 legacy 标记注明为未改原码、渲染 mid 灰 |
| 中 5 check-pinned-deps | **闭合** | git 依赖强制 commit SHA 钉版，6 单测实跑通过 |
| 中 6 CI 分支错配 | **闭合** | motto-ci 触发含 motto/main；governance 内置 pinned-deps（本地与 CI 同源） |
| 高 3 单仓合并门未过 | **披露** | §六 如实补记；TUI-1 终态验收与 GHOSTTY-BASELINE 留用户侧补做 |
| 「不自立新义」 | **闭合** | 开篇/结尾自认四层阶梯为新立框架，§七 勘误登记 |
| 中 7 上游增量计数（112/109/3） | **闭合** | 修正为「共 112，109 已吸纳至 base 534bcbffb，2026-08-12 检查时点残余 3」；上游为外部仓，后续读数以 `upstream-check.sh` 最近输出为准（§9.5 已记漂移至 6） |
| 中 8 hideThinkingBlock 兼容路径 | **披露** | 上游原生特性与宪制「不保留向后兼容」的张力在 §六 披露，取舍 8 待察点补注 |
| 低 13 立言时间线 | **标注** | §1.3 标注文档自陈性质 + 归档路径 |

### 8.3 验证证据

- `node scripts/check-pinned-deps.mjs` 退出码 0；`check-pinned-deps.test.mjs` 6/6 实跑通过
- 返修测试：motto pack 78/78、review-flow pack 25/25、coding-agent 相关组件 96/96（8 文件，含 first-time-setup-fork）、scripts 11/11
- 两 pack `tsc --noEmit` 零错；biome 零告警；五批 commit 每次 pre-commit `npm run check` 全绿
- `ci-checks.sh governance`：pinned-deps PASS、TUI baseline --check PASS（注释清理未改渲染输出）
- **部署留证（2026-08-12，先 commit 后 deploy）**：`bash scripts/maint/deploy.sh`（motto / motto-review-flow 等五 pack + 三主题，rsync -a --delete）→ `drift-check.sh` PASS（8 ok，5 pack + 3 主题）→ `ci-checks.sh governance` **GOVERNANCE: PASS**。部署次序保证镜像与 canonical（而非脏工作区）一致

### 8.4 待用户真机补验（非返修缺陷）

- L1/L2 整层（build、render-baseline、真实 TUI 目验）在用户真机复跑留证
- TUI-1 终态验收与 GHOSTTY-BASELINE 补做
- `MOTTO_USE_OFFICIAL=1` 回退实跑、`downstream-drill.sh` 全链路实跑

## 9. 第三轮独立复验（本机实测，2026-08-12）

> 本轮在真实机器上执行，非沙箱。环境：darwin arm64（`uname -a` 确认），node v25.9.0、npm 11.12.1，与 `PI-BASE.json` 声明的 `buildEnvironment.node` 一致；仓库状态 `git status` 干净，`git rev-list --left-right --count origin/motto/main...motto/main` = `0 0`；真实部署位 `~/.pi/agent` 存在。前两轮因沙箱缺 rolldown 原生绑定、缺全局安装位、缺部署位而标 NOT TESTED 的项，本轮具备条件逐一实测。

### 9.1 补齐的 L1 机械门

| 项 | 结果 | 证据 |
|---|---|---|
| `npm run check`（biome/pinned-deps/ts-imports/shrinkwrap/install-lock/tsgo/browser-smoke） | **PASS** | biome 检查 1063 文件零告警；六项子检查全绿，`tsgo --noEmit` 零错 |
| `npm run build:offline`（9 包全量构建） | **PASS** | tui→telemetry→ai→agent→sqlite-node→protocol→client→server→coding-agent 顺序构建，零报错 |
| `render-baseline.mjs --check` | **PASS** | 四主题（dark/motto/motto-dark/motto-light）逐宽度零超宽，与已提交基线逐字节一致；`BASELINE_CHECK_PASS` |
| `drift-check.sh`（真实部署位） | **PASS** | 5 pack + 3 主题，共 8 条 `ok`（§8.3 记「9 ok」，实测 8，计数误差，见 9.4） |
| `ci-checks.sh governance` | **PASS** | pinned-deps、registry 一致性、五包 typecheck、binary-guard、TUI baseline --check、drift-check 全绿 |

### 9.2 测试计数复核

| 套件 | §8.3 所记 | 本轮实测 | 差异 |
|---|---|---|---|
| motto pack | 78/78 | 78/78 | 一致 |
| review-flow pack | 25/25 | 25/25 | 一致 |
| coding-agent 相关组件（assistant-message、user-message、thinking-fold×2、first-time-setup×2、bash-execution-width、tool-execution-component 共 8 文件） | 95/95 | **96/96** | 差 1（见 9.4） |
| `scripts/check-pinned-deps.test.mjs` | 6/6 | 6/6 | 一致 |

### 9.3 单点可删清单未能复现

§8.1 称改用 `git apply --cached --check -R` 对 HEAD 重测，12 条登记 SHA 中 5 条可干净反向应用（`81dbec74f`、`055c43962`、`e6af3794d`、`943e67312`、`34b30ba80`）。本轮以同一命令、同一方法独立重放，且所处 HEAD 与 §8.1 撰写时一致（`ee7ebdc64` 之后仅 `35906f1ea` 一次纯文档提交，未触代码），结果为 **2 条**（`055c43962`、`34b30ba80`）可干净反向应用，另 3 条（`81dbec74f`、`e6af3794d`、`943e67312`）冲突。冲突落点分别为 `user-message.test.ts:9`、`tool-execution-component.test.ts:53`、`bash-execution-width.test.ts:78`——三者均为 `8b5f903d7`（I11-3 注释清理，其提交时间早于 §8.1 复测所在的 `ee7ebdc64`）触及的同一文件区域。

带 `--cached`（对暂存区，不落working tree）与不带 `--cached`（对working tree，`git status` 全程确认干净）两种方式各测一遍，结果一致；12 条 SHA 本身逐一以 `git merge-base --is-ancestor` 确认为 HEAD 祖先，登记无误，差异只在反向应用可清结果。

差额不影响 §8.1 的主论点——「多数条目不可机械单点回退」在 2/12 与 5/12 两种读数下都成立，`removalOrder` 的处置建议（后置先退、接受冲突手工合并）不因此改变。但作为独立证据链的一环，「5/12」这一具体数字本轮未能复现，宜在 §8.1 或 `PATCHES.json` 的 `removalOrder` 说明中更正为 2/12，并注明差额来源（`8b5f903d7` 与前序 patch 的注释层重叠）。

### 9.4 两处计数误差

- `drift-check.sh` 记「9 ok」，实测为 8 ok（5 pack + 3 主题之和）。不影响 PASS 结论。
- coding-agent 相关组件记「95/95」，本轮实测同一 8 个测试文件为 96/96。不影响 PASS 结论，差 1 未溯源。

### 9.5 上游残余数为写作当时的读数,已随时间推移

`docs/HANDOFF-DECLARATION-2026-08-12.md` 三处以定值写「上游残余 3 commits」（`534bcbffb..upstream/main`）。本轮重新 `git fetch upstream` 后，`upstream/main` 较该数写下时已前进 3 个新提交（fetch 回显 `47b5119d0..9795d6023`）；实测 `upstream/v0.84.1..upstream/main` = 115（原记 112）、`534bcbffb..upstream/main` = 6（原记 3）。`v0.84.1..534bcbffb` 仍为 109，不变——base 已固定，不受上游后续提交影响。

此非本仓缺陷：`upstream-check.sh` 的性质即某一时刻的只读快照，upstream 为持续更新的外部仓库，数字必然随时间移动。但文档以确定语气写入定值且未标读数时间戳，读者数小时后核对即见数字与实况不符。建议改为引用 `upstream-check.sh` 最近一次运行的时间戳与输出，而非把某一时刻的计数写成固定事实。

### 9.6 结论

**ACCEPTED WITH LIMITATIONS（维持）。** 本轮在真实机器（构建环境与 `PI-BASE.json` 声明一致）上补齐了前两轮因沙箱限制标记 NOT TESTED 的五道 L1 机械门，全部实测 PASS；测试计数除两处一位数误差外与 §8.3 相符；高 2（投影零写回）、中 5/中 6（pinned-deps 门禁）复核成立；高 3（单仓合并门）、中 8（hideThinkingBlock）两项披露文字如实在案，未被误标为已解决，与 §8.2 的「披露」状态一致。

未成立的一项：高 1 的反向应用清单（「5/12 可清」）本轮未能复现，实测 2/12，已记于 9.3，建议更正登记。

残余未覆盖（同 §8.4，本轮未推进）：L2 整层真实 TUI 目验、TUI-1 终态验收、GHOSTTY-BASELINE、`MOTTO_USE_OFFICIAL=1` 回退实跑、`downstream-drill.sh` 全链路。
