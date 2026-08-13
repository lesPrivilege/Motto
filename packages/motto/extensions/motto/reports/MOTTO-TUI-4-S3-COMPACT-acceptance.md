# MOTTO-TUI-4-S3-COMPACT-TEXT 验收报告 — 紧凑三顿号 text 文本块投影（Phase 1 + 增量裁定 + R2 视觉返工）

- 日期：2026-08-13
- 工单：MOTTO-TUI-4-S3-COMPACT-TEXT（紧凑三顿号 `、、、text` 文本块投影）
- 范围：语法与投影政策在 extension（cards.ts）；core 仅最小薄原语（pi-tui markdown.ts，PATCHES 登记）；agent loop/provider/session schema/内置工具零改动
- 结论：**MOTTO-TUI-4-S3-COMPACT-TEXT-R3 — ACCEPTED**（2026-08-13 用户独立复验通过，Phase 2 授权）

## 0.5 增量裁定(2026-08-13):text 签改为右上嵌框

增量属于本未提交工单,不另开工单:取消「盒外独立 `[text]`」及「左上嵌框」候选,定稿**右上嵌框**——
`、、、text` 与 `、、、 text` 均投影为 `┌─…─[text]─┐`(标签嵌进 top border 右上角,不占独立行)。

- 扩展发通用 presentation marker `<!--motto-card:tag-top-right-->`(仅标注恰为 `text` 时;
  其他带标注仍 `<!--motto-card:tag-->` 盒外标签、裸卡仍 `<!--motto-card-->`,逐字不变)。
- pi-tui core 提供通用右上嵌框薄原语(新增最小 core seam,独立登记 PATCHES
  `tui-4-s3-compact-text-tag-top-right`):不按标签字符串猜语义,marker 提供模式、表格头行提供标签文本;
  Markdown parser / 自然表格 / 普通 HTML 行为不变;agent loop / provider / session schema / 工具语义不变。

## 0.6 R2 视觉返工(2026-08-13):正文行距、轻框取色、全宽投影

用户目验发现:卡片仍按内容自然宽度收缩(在密集输出中参差)、框线与普通 Markdown 表格接近同一前景强度、
与相邻正文的上下行距没有独立回归证明。原 READY_FOR_USER_REVIEW 结论撤销,状态改为 REWORK REQUIRED。
R2 三处返工:

1. **全宽**:`tag-top-right` 单列表格不再用内容自然宽决定 boxWidth——boxWidth 恒等于 renderer 收到的
   availableWidth(transcript/Markdown 实际可用宽,非物理终端总宽),columnWidth = availableWidth-4;
   body/top/bottom 逐列同宽;内容按全宽 body 列宽正常折行;不用空格伪宽,左右边框落在实际两端。
2. **轻框取色**:新增 `MarkdownTheme.cardBorder?: (text) => string` 可选槽,Motto interactive 映射
   `theme.fg("dim")`;text 卡 top/bottom/左右 `│` 消费该槽(轻于自然表格),`[text]` 仍 cardLabel(accent),
   正文不染色;自然表格/其他顿号卡不消费,无 cardBorder 主题回落默认边框(不迫使上游生态同步迁移);
   不复用 cardLabel、不硬编码 ANSI/RGB/主题名。
3. **行距**:复用 Markdown block token 既有 spacing 机制(段落尾随空行 / space token / marked 折叠连续空行);
   投影在闭栏后紧邻非空行(源无空行)时补一个空行终止表格,防后续正文被吞进表格;与相邻正文恰一空白行、
   不双倍、卡在消息开头/结尾无多余空行、连续双卡间恰一空白行。

## 状态

```text
MOTTO-TUI-4-S3-COMPACT-TEXT-R3
GEOMETRY_UNCHANGED        ✅(仅取色映射变化;像素逐卡同构 96/96/192/576;全宽/右锚/行距逐字保持)
BORDER_MUTED              ✅(cardBorder 映射 borderMuted #5c6166,非 dim;mutation proof 捕获)
LABEL_ACCENT_UNCHANGED    ✅([text] 仍 accent;像素 accent 计数 R2/R3 相同 666px)
BODY_COLOR_UNCHANGED      ✅(正文不染 cardBorder;三主题 body plain)
NATURAL_TABLE_UNCHANGED   ✅(自然表格不消费 borderMuted;像素 fg 计数 R2/R3 相同 13547px;更重于 text 卡)
THREE_THEMES_CHECKED      ✅(motto/motto-dark #5c6166、motto-light #b8bdc2;label accent 可辨不抢正文)
USER_VISUAL_ACCEPTANCE    ✅(用户独立复验通过 2026-08-13)
R3_1_TEST_DETERMINISM       ✅(TERM=dumb NO_COLOR=1 / truecolor / 默认 三环境各 45/45;TUI 91/91;仅测试能力固定+注释勘误)
```

## 0.7 R2 mutation proof

- 全宽:临时恢复自然宽算法(boxWidth = max(content, tag)) → 2 项全宽用例立即失败;恢复后全绿。
- 轻框:临时移除 cardBorder 消费(identity) → 1 项可区分主题取色用例失败;恢复后全绿。
- 行距:临时移除投影补空行 → 1 项行距用例失败;恢复后全绿。
- 临时改动均已还原,`git diff` 无残留。

## 0.8 R3 框线降权(2026-08-13)

用户目验裁定:全宽、右上 [text] 目签、行距均通过;当前框线明度与视觉线重略重。唯一产品改动:
Motto interactive theme 的 `cardBorder` 由 `theme.fg("dim")` 改为 `theme.fg("borderMuted")`
(#5c6166,既有 subtle-borders 语义槽,比 dim #a8adb2 更退后);light 主题为反相 #b8bdc2。

- 线形保持:┌ ─ ┐ │ └ ┘ 不变;不换 ━┃、虚线/点线/ASCII、不缩全宽、不改圆角、不加背景阴影。
- 非 Motto:package-manager-cli 与 TUI 测试主题 cardBorder 由 red 改 chalk.dim;无 cardBorder 生态主题继续 identity fallback。
- 几何不变:仅取色映射变化,不产生任何字符级差异(像素:卡片相对几何 R2/R3 逐卡同构 96/96/192/576)。
- 机械证明:cards.test.mjs 断言 cardBorder 输出 === `\x1b[38;2;92;97;102m`(borderMuted)且 !== dim;label accent;正文不染色;自然表格不消费。
- mutation proof:临时改回 dim → 3 项用例失败;恢复 borderMuted 后全绿。
- 三主题:mot-to/motto-dark cardBorder #5c6166、motto-light #b8bdc2,label accent 逐主题可辨;自然表格均明显重于 text 卡。

## 0.9 Phase 2 收口(2026-08-13)

用户独立复验通过并正式接受(ACCEPTED):`TERM=dumb NO_COLOR=1` / truecolor / 默认 三环境各 45/45、
TUI Markdown 91/91、`git diff --check` CLEAN、R3.1 仅测试能力固定与注释勘误、无运行时变化。
Phase 2 已执行:显式暂存 compact-text/R3 文件(排除并行 composer P0 文档与独立 coding-agent 测试)、
单一 commit、push。commit hash 与远端一致性见本仓 git 记录。

## 1. 基线

| 项 | 值 |
|---|---|
| HEAD | `43c38e6bb625978dcd3f763b267a92aeefb16f1f`（motto/main） |
| origin 同步 | origin/motto/main `599469143`，HEAD 领先 2 个未推送 commit，落后 0 |
| 工作树 | 非干净：并行 composer P0 文档（docs/INDEX.md、ROADMAP.md、decisions/…、usage-log/2026-08.md、research/…）+ 并行 coding-agent 测试（interactive-mode-get-tool-definition.test.ts）——本单不触碰 |
| 本单改动 | 仅 `packages/motto/extensions/motto/cards.ts`、`test/cards.test.mjs`（未暂存、未提交） |

## 2. 实现（cards.ts + pi-tui 薄接缝）

扩展侧（cards.ts）——新增单个紧凑开栏 token，不改既有解析路径：

```ts
/** 顿号紧凑 text 开栏:`、、、` 后无空白直接接 `text`(模型常见 plain-text 紧凑别名,等同 `、、、 text`)。 */
const DUNHAO_COMPACT_TEXT_RE = /^ {0,3}、、、text[ \t]*$/;
```

`dunhaoAnnotation()` 在既有 `DUNHAO_ANNOT_RE`（须空白分隔）与 `DUNHAO_BARE_RE`（裸闭栏）之间插入：
`、、、text` 命中时标注恒为 `"text"`。标注恰为 `text`（紧凑或带标注）时发
`<!--motto-card:tag-top-right-->` 标记；其他带标注仍 `<!--motto-card:tag-->`、裸卡仍
`<!--motto-card-->`（逐字不变）。

core 侧（pi-tui markdown.ts，PATCHES `tui-4-s3-compact-text-tag-top-right` 登记）——新增
`cardTagTopRight` 类字段 + `renderCardTagTopRightBorder` 薄原语：
- 标签右锚、前后各至少 1 格 `─`、左右角保留；
- 内容短时卡片扩宽到能容纳角+框线+标签（≤ availableWidth）；
- 长标签按 visibleWidth 截断为 `[… ]` 安全形式（不破坏 ANSI）；
- 极窄下保留角与闭合框、不外泄 marker；
- boxWidth 同步列宽，top/body/bottom 逐列同宽；
- 标签用既有 cardLabel（accent）槽，框线维持既有低对比色；无背景/阴影/额外色槽。

最小边界（未泛化）：
- 只认精确 token `、、、text`（≤3 前导空格、允许尾随空白）；
- `、、、textx`、`、、、text extra`、`、、、bash` 等一律非围栏 → 原样（歧义守卫保留）；
- 开/闭栏各自独占一行；`、、、text、、、` 同行不解释为块；
- 闭栏仍必须裸 `、、、`（卡内 `、、、text` 行是内容，不闭卡）。

## 3. 测试（cards.test.mjs 33 → 41 项 + pi-tui markdown.test.ts 80 → 89 项）

扩展新增/更新（§16 节）：
1. `、、、text` 与 `、、、 text` 投影逐字相同且均发 `<!--motto-card:tag-top-right-->`；其他带标注/裸卡 marker 不变。
2. 端到端：经真实 pi-tui Markdown 组件渲染为右上嵌框——仅一条 top border（`[text]` 嵌入）、无独立 `[text]` 行、标签前后各至少一格 `─`、accent 标签/非 accent 框线、top/body/bottom 可见宽度一致、无分隔线、围栏不残留、空行与正文顺序保留。
3. 右上嵌框卡片 40/60/80/120/200 列零超宽、短内容自动扩宽。
4. `、、、标题` 及近似紧凑 token（`、、、bash`/`、、、textx`/`、、、text extra`）非围栏 → 原样。
5. 未闭合 `、、、text`（含仅带标注闭栏）fail-open 原样。
6. fenced 代码块内 `、、、text` 原样；卡片体内嵌代码块含 `、、、text` 不提前闭卡。
7. user / thinking / streaming 下紧凑 `、、、text` 一律原样。
8. CRLF 行尾保留、幂等（重跑不变、无 `、、、` 残留）、40 列零超宽。

pi-tui 新增 9 项（Card top-right embedded tag describe）：仅一条 top border + 标签嵌入；右锚且前后 ≥1 格 `─`；标签 accent/框线非 accent；top/body/bottom 可见宽度一致；短内容扩宽到 `┌─[text]─┐`；40/60/80/120/200 零超宽；CJK/长标签截断不破框；marker 不泄漏；`<!--motto-card:tag-->` 盒外标签（bash）与裸卡/自然表格逐字不变。

mutation proof ×2：
- core：临时把 `tag-top-right` 标记改回盒外 `cardTag` 行为 → 6 项右上嵌框用例立即失败；恢复后全绿。
- extension：临时让 text 不发右上签 marker → 4 项用例立即失败；恢复后全绿。

临时改动均已还原，`git diff` 无残留。

## 4. 真实 dogfood（Ghostty alternate-screen）

- 运行：`/private/tmp/motto-tui4-s3-compact`，`motto`（deepseek-v4-pro · max · thinking max）
- 驱动:Quartz `CGEventPostToPid` 后台按键注入 + `screencapture -l <windowID>` + 本地 Vision OCR + 逐像素边框取证(无 API 配额依赖)
- R2 确定性输出(密集场景):普通正文 + 短内容 text 卡 + 会折行的长内容 text 卡 + 后续正文 +
  普通 Markdown 表格(取色对照)+ 连续两个 text 卡;canonical 逐字保存(见 06-r2-canonical.txt,
  模型输出与 seed 逐行一致)

### 4.1 R2 呈现验证(密集输出 dogfood,截图见 reports/evidence-tui4-s3/;旧窄框截图移入 SUPERSEDED-pre-R2/)

| 项 | 结果 | 证据 |
|---|---|---|
| 卡片左右边框落在 transcript 可用宽度两端(全宽) | ✅ | 像素:736px(≈95 列)四张卡 top/bottom 边框均 x147→1460(左右缘对称);440px(≈55 列)x147→868;1100px(≈130 列)x151→2184;resume 会话 x195→2228——全部等于该宽度下 transcript 内容宽,非内容自然宽 |
| text 卡框线明显轻于普通表格 | ✅ | 像素:卡片边框色 (168,173,178) dim(cardBorder 槽);自然表格边框色 (200,203,206) 默认前景——两档明显可辨;自然表格保持自然宽(x147→372) |
| `[text]` 右锚、标签不抢正文 | ✅ | 像素:tag accent (192,69,62) 位于 top border 右端(736px 卡内 x1346-1429,右框 x1460;宽 1100px x2070-2153,右框 x2184),标签后恰 `─┐`;无独立 `[text]` 行 |
| 正文与卡片之间恰一空白行 | ✅ | 渲染层逐行核对(卡边框间距=2 行距=1 空白行);prose↔卡↔prose、多源空行、卡首尾、连续双卡均恰一空白行 |
| 连续卡片不显杂乱、框体闭合无错位无闪烁 | ✅ | 连续卡甲/乙两卡间恰一空白行;两次连拍像素逐位一致(bbox None) |
| 60/80/120 列不超宽、body 正常折行 | ✅ | 440/736/1100px 三档卡片全宽、长内容卡 body 折 3 行仍全宽零超宽(单元测试另覆盖 40/60/80/120/200 严格相等) |
| canonical/session 仍原始三顿号文本 | ✅ | 06-r2-canonical.txt 逐字保存 `、、、text…、、、`;resume/fork/print 读原文 |
| reload/resume 后投影一致 | ✅ | `--session` 恢复旧会话(alpha/beta/gamma 卡)后仍全宽 + dim 轻框 + 右锚 tag(04-r2-resume-1100px.png) |
| 无背景/阴影/无 marker 泄漏 | ✅ | 像素无背景色;渲染无 motto-card 文本泄漏 |

### 4.2 NOT TESTED

- 用户真实目验(本单终点,⏳)。
- 鼠标拖选/滚轮路由(沿用既有驱动限制,未实机驱动)。

## 5. 机械门禁

```bash
cd packages/motto/extensions/motto
node --test test/cards.test.mjs     # 40/40 PASS
npm run typecheck                   # PASS
cd <repo-root>
npm run check                       # PASS（biome/pinned-deps/ts-imports/shrinkwrap/install-lock/tsgo/browser-smoke）
git diff --check                    # PASS
bash scripts/maint/ci-checks.sh governance   # GOVERNANCE: PASS（含 render-baseline --check + drift-check）
```

> 未运行全量 `npm test`（工单 §五 明令）。

## 6. 并行文件隔离

并行 composer P0 文档与 `packages/coding-agent/test/interactive-mode-get-tool-definition.test.ts`
未编辑、未暂存、未移动、未格式化（git status 逐项核对）。本单仅拥有
`cards.ts`、`cards.test.mjs`、`README.md`、`docs/usage-log/2026-08.md`、本报告及 evidence 目录。

## 7. 文档（Phase 1 更新、未提交）

- `README.md`：语法三态写清（`、、、 text` 通用带标注；`、、、text` 仅作紧凑别名；其他 `、、、标题` 不因此成围栏）。
- `docs/usage-log/2026-08.md`：追加本单条目。
