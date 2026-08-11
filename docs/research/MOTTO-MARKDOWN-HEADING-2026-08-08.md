# chat 区 markdown 渲染能力核查 — heading 层级（2026-08-08）

> 触发：使用触发候选——收工 review 屏内 heading 以原始 `###` 呈现，层级不可辨。
> 性质：只查不改（零代码改动）。
> 对象：pi 0.84.1（`@earendil-works/pi-coding-agent` + `@earendil-works/pi-tui` 0.84.1）。
> 证据：dist 源码逐行 + 真实渲染探针（`/tmp/md-probe.mjs`、`/tmp/md-motto.mjs`、`/tmp/md-link.mjs`，探针已清理）。

---

## 一、渲染器定位与支持矩阵

渲染器 = pi-tui `dist/components/markdown.js` 的 `Markdown` 组件（marked 解析 + 自有 token 渲染），
聊天区由 `assistant-message.js` / `user-message.js` 以 `new Markdown(text, padX, padY, markdownTheme)` 调用。
主题函数由 pi-coding-agent `modes/interactive/theme/theme.js` 的 `getMarkdownTheme()` 提供（各槽 `theme.fg(...)`）。

| 元素 | 支持 | 现行渲染形态 |
|---|---|---|
| heading h1 | ✅ | **无 `#` 前缀**；`theme.heading( bold( underline(text) ) )`；heading 后自动补空行 |
| heading h2 | ✅ | **无 `#` 前缀**；`theme.heading( bold(text) )`；补空行 |
| heading h3+ | ✅ | **保留 `#` 前缀**（`#`.repeat(level)+空格，前缀本身也套 heading 样式）；`theme.heading( bold(text) )`；补空行 |
| 列表 | ✅ | 无序 `- ` / 有序 `1. `；嵌套缩进 4 空格/层；`listBullet` 着色；task 列表 `[x]` |
| 表格 | ✅ | 完整边框 `┌─┬─┐` + 表头 bold + 列宽自适应折行；过窄回退原始 markdown |
| 引用 | ✅ | `│ ` 前缀 + `theme.italic` + `quote`/`quoteBorder` 着色 |
| 代码块 | ✅ | 围栏 ``` + `codeBlockBorder` 着色 + `codeBlock` 内容 + 可选 `highlightCode` 语法高亮 |
| 分隔线 hr | ✅ | `─`×min(width,80) + `hr` 着色 |
| 行内 | ✅ | strong/em/codespan/link(OSC8)/del(~~)/latex($$,\[ \])/escape |

**结论：heading 保留 `###` 标记是设计而非缺省**——源码显式分支 `headingLevel >= 3` 才输出前缀，
h1/h2 靠「bold/underline 装饰」区分，h3+ 靠「`#` 数量 + 前缀」区分。不是渲染缺省漏掉。

## 二、主题面：schema 暴露的 markdown 槽

theme-schema.json `colors` 中 markdown 相关槽（全部必填）：

| 槽 | 说明 |
|---|---|
| `mdHeading` | **单一槽，所有 heading 级别共用**（无 mdHeading2/3/4…） |
| `mdLink` / `mdLinkUrl` | 链接文字 / 链接 URL（无超链接能力时括号展示） |
| `mdCode` | 行内代码 |
| `mdCodeBlock` / `mdCodeBlockBorder` | 代码块内容 / 围栏 |
| `mdQuote` / `mdQuoteBorder` | 引用文字 / 引用边框 |
| `mdHr` | 分隔线 |
| `mdListBullet` | 列表符号/编号 |

**motto 三主题可调 markdown 项及当前取值**（三主题同值，仅色变量不同）：

| 槽 | motto | motto-dark | motto-light | 实际色 |
|---|---|---|---|---|
| `mdHeading` | `"text"` | `"text"` | `"text"` | 正文色 `#f2f3f4` / `#26282b`（**与正文同色**） |
| `mdLink` | `"text"` | `"text"` | `"text"` | 正文色（靠下划线区分） |
| `mdLinkUrl` | `"mid"` | `"mid"` | `"mid"` | `#8a9095` |
| `mdCode` | `"text"` | `"text"` | `"text"` | 正文色（靠等宽观感） |
| `mdCodeBlock` | `"text"` | `"text"` | `"text"` | 正文色 |
| `mdCodeBlockBorder` | `"mid"` | `"mid"` | `"mid"` | `#8a9095` |
| `mdQuote` | `"text"` | `"text"` | `"text"` | 正文色（靠斜体区分） |
| `mdQuoteBorder` | `"mid"` | `"mid"` | `"mid"` | `#8a9095` |
| `mdHr` | `"mid"` | `"mid"` | `"mid"` | `#8a9095` |
| `mdListBullet` | `"mid"` | `"mid"` | `"mid"` | `#8a9095` |

对照：pi 默认主题 dark/light 的 `mdHeading` = `#f0c674` / `yellow`（**明显区别于正文**），
motto 三主题刻意统一为 `"text"`——**这是 heading 层级不可辨的直接根因**：
h2 仅剩 bold，与正文粗体在色上完全无异；h3+ 虽有 `### ` 前缀，但前缀与正文同色同粗，视觉上只是「原始 `###` 字样」。
（h1 有 underline 尚可辨；h2 最弱。）

## 三、分类结论

### 档一：主题可调 —— ✅ 成案（motto-themes 小单）

根因在主题面，且 schema 暴露了 `mdHeading` 槽，motto 三主题当前取值 `"text"` 是**主动选择**而非平台限制。
出小单规格：

- **目标**：heading 从正文中浮现，层级靠明度与留白分辨（不靠装饰堆叠）。
- **改动点**（三主题各一处）：`mdHeading`: `"text"` → 明度区分色。
- **建议取值**（motto 语义槽现有五色）：
  - `mdHeading = "accent"`（`#c0453e`）：最稳，heading 立即可辨；但红色偏重，review 屏大量 heading 时可能喧宾夺主。
  - `mdHeading = "dim"`（暗 `#a8adb2` / 亮 `#5c6166`）：反向明度——heading 用次级色而非高亮，靠「比正文暗」形成层级，符合 motto 低调风格；但暗色在亮底上需防对比不足。
  - `mdHeading = "mid"`（`#8a9095`）：与现有 `mdHr`/`mdListBullet`/`mdLinkUrl` 同族，观感一致，但区分度弱于 accent。
- **疏朗方案**（配合渲染器既有行为，零上游依赖）：
  1. **留白**：heading 后自动空行已有（renderToken heading 分支 `lines.push("")`），无需改动。
  2. **前缀**：h3+ 的 `### ` 前缀为设计特性，配合 mdHeading 上色后「`#` 数量 + 色块」即可分辨 h3/h4/h5，无需去掉。
  3. **明度**：mdHeading 单槽无法区分 h1/h2 内部层级——h1 仍靠 underline、h2 靠 bold 与正文区分；在 mdHeading 上色后，h1/h2 与正文对比已足够，h2 vs h3 靠前缀。若要求 h1/h2 间也靠明度区分，需上游（见档二）。
- **验收**：drift-check 三主题一致；改后 review 屏目视 heading 可辨（用户侧终验）。

### 档二：上游可提 —— 挂跟踪清单（非本次）

**简单缺口存在**：`mdHeading` 为单一槽，无法逐级区分 h1/h2/h3/h4 的明度。若主题侧要「h1 最亮、逐级递减」的疏朗方案，需 pi 上游支持逐级槽（如 `mdHeading1..mdHeading6` 或渲染层按 depth 分级取色）。
- 量级：小（theme-schema 加槽 + theme.js `getMarkdownTheme` 分级 + markdown.js heading 分支按 depth 选槽）。
- 性质：友好 PR 量级，符合「上游演进经 issue/PR 提出，不在本仓 fork」宪制。
- 处置：**挂跟踪清单**（docs/ROADMAP.md 候选/MAINTENANCE 上游通道），本次不行动；档一落定后如层级仍嫌不足再评估。

### 档三：不值得做 —— 不适用

「heading 在 TUI 里本可由 `###` 自明」不成立：h1/h2 **不显示** `#` 前缀（渲染器已替用户剥掉），
h3+ 才显示——若完全不做任何改动，h1/h2 只能靠裸 bold/underline 分辨，review 屏层级确实不可辨。
且根因在主题面（`mdHeading="text"`），属于 motto 自身可控项，非平台无力项，不做属于放任已知瑕疵。

## 四、处置落点

- usage-log 条目：见 `extensions/motto-themes/docs/usage-log/2026-08.md`（本条）。
- 成案状态：**档一成案（motto-themes 小单），档二挂跟踪，档三不适用**。
- 本核查记录零代码改动；主题小单规格待用户裁定后另开工单执行。
