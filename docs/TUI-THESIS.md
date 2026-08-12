# MOTTO TUI 宣称（TUI-THESIS）

> 状态：MOTTO-TUI-0 定稿。本文件将 Motto TUI 的产品理念转化为**可测试不变量**，
> 不承载形容词。每条不变量的验收手段指向 `fixtures/tui/`（无头渲染基线 + Ghostty 捕获）
> 或对应 pack 的既有测试。
>
> 谱系：Motto 产品方向来自对目录版本之学的创造性转化——层级、留白、著录、提要、
> 异常记载、源流意识；转化后只保留其秩序精神，使用简洁的 CS 领域语言，不仿古、
> 不堆砌传统术语。设计推理中的谱系词汇不得出现在渲染输出、代码标识符与用户可见文案中
> （docs/MOTTO.md 总纲 4 的延续）。

## 0. 总则

Motto TUI 是 pi 之上的一层**只读投影**：它把 canonical session record 投影为
有层级的工作过程呈现。投影层不持有任何 canonical 数据，不产生任何模型语义，
不改写任何会话内容。**凡投影即弃**——canonical 是唯一证据，投影随时可重建。

总则的可测试形式（贯穿以下全部不变量）：

- **I0-1 单向投影**：投影层零写回。对 fixture 会话（`fixtures/tui/sessions/motto-tui-baseline.jsonl`）
  做任意次渲染/折叠/展开/复制，session JSONL 逐字节不变（git 校验 + sha256）。
- **I0-2 投影可重建**：同一会话 + 同一终端宽度 + 同一主题 + 同一展开态，渲染输出逐字节一致
  （`render-baseline.mjs` 幂等性）。

## 1. 正文、著录层、异常层的层级

transcript 分三层，各层职责与视觉权重不同，**不得平铺为流水日志**：

| 层 | 内容 | 视觉权重 | 折叠行为 |
|---|---|---|---|
| 正文 | assistant 最终回答、user 输入 | 最高，永不折叠 | 常开 |
| 著录 | 工具轨迹 recap（review-flow）、计数、提要 | 中，成功静默 | 随全局展开态 |
| 异常 | 失败、非零退出、超时、权限拒绝、错误提要 | 醒目标记（accent），**永不静默折叠** | 折叠态仍强制显露 |

可测试形式：

- **I1-1** 成功 turn 的著录层仅一行摘要（计数起始、无标签、无 ✓/×）；
  失败 turn 的汇总行含 `failed` 段（accent）且失败条目整行 accent（review-flow 测试 + `review-flow.txt` 基线）。
- **I1-2** assistant 最终回答在任何展开态下都完整显示（fixture T1/T8，40–200 列）。
- **I1-3** 全文 grep `fixtures/tui/baseline/review-flow.txt`：collapsed 输出中失败条目仍出现，
  成功条目不出现（失败不允许静默折叠）。
- **I1-4** 异常层文案为机械投影（工具名/路径/计数/退出状态/stderr 尾部 ≤5 行原文），
  全仓无 LLM 摘要或改写路径（review-flow 测试断言）。

## 2. 常规工具默认压缩

常事从简：探索型工具（read/grep/find/ls）的成功输出默认压缩为著录行，不展开全文；
执行型工具（bash）成功默认只留命令 + 退出状态 + 计数。

可测试形式：

- **I2-1** review-flow collapsed 渲染不含任何工具原始输出（`review-flow.txt` 基线 + 测试断言）。
- **I2-2** 探索洪流（fixture 不显式包含，但既有 20-tool 测试覆盖）单 turn 投影有界
  （≤ KB 级，结构开销随工具数线性，不落原始输出）。

## 3. 失败原文提要

失败获得与成功不同的对待：不只给状态码，给**stderr 尾部原文**（≤5 行，dim），
机械截取、无生成式改写。

可测试形式：

- **I3-1** 对 `bash-exit1.txt`（200 行 stderr）的投影只含尾部 ≤5 行，逐字节等于原文子串
  （review-flow errorTail 测试）。
- **I3-2** 失败行 accent、错误提要 dim、无第四种红、无绿（theme 槽位断言 + 全仓无
  success/warning/error 语义色、无 ✓/×）。

## 4. Markdown 排印层级

Markdown 是正文的排印语言，须层级可辨：**H1 / H2 / H3+ 三档排印**（H1 无前缀
bold+underline、H2 无前缀 bold、H3–H6 统一投影为 `## › 标题`），列表/引用/代码/
表格/公式均按 pi 原生渲染器能力呈现。六级独立色槽属后续 generic seam，不在此面扩张。

可测试形式：

- **I4-1** H1/H2 无 `#` 前缀（原生）；H3–H6 在 Motto 投影下统一为 `## › 标题`，无井号
  （`md-multilevel.md` → raw vs motto-projected 基线对照，`theme-*.txt`）。
- **I4-2** `mdHeading` 明度分层：深宗比正文亮一档、浅宗深一档（motto-themes 对比度测试）。
- **I4-3** fenced 代码块、嵌套列表、blockquote、表格在 40–200 列下不错列、无超宽
  （`render-baseline.mjs` 每行 ≤ 目标宽度校验）。

## 5. display 与 semantic source 分离

屏幕显示（折行、留白、前缀、装饰）与语义源（逻辑段落、代码行、URL、命令）是
两个不同的文本；显示层不得改写语义源。这是投影层的根基。

可测试形式：

- **I5-1** 全部显示投影（headings 变换、review-flow recap、footer、牌记）只作用于
  **渲染输入**，canonical/session/print/json 路径不经过（motto/headings 测试 + 品牌化
  逐字节断言）。
- **I5-2** fixture 会话导出（`pi --export`）与源 JSONL 语义一致：语义源未被显示层改写
  （导出 HTML 中的 session-data 解码后与源 JSONL 的文本逐字一致）。

## 6. display 与 copy projection 分离

复制体例以**语义源**为准，不以屏幕行为准：一个软折行跨 5 个视觉行的段落，复制出来
必须是原逻辑段落。

可测试形式：

- **I6-1** `/copy-answer` 返回最后 assistant 文本原文，无换行清理启发式（canonical-copy 测试）。
- **I6-2** `/copy-code` 返回 fenced 块原文，不含显示前缀与 caption（canonical-copy 测试）。
- **I6-3** 鼠标拖选复制（视觉行 join `\n`，`tui-alt-screen.js:749` 行为）是**已知上游缺口**，
  在侧车（selection sidecar）落地前，本宣称不要求拖选保真，但不得声称其保真
  （Ghostty 捕获第 4 节记录该基线）。
- **I6-4** 任何 Motto 渲染/命令不得写入装饰字符或显示前缀到剪贴板。适用范围就地
  界定：**命令路径**（`/copy-answer`、`/copy-code`）读语义源，绝对保真、永不含显示
  前缀；**拖选路径**按 I6-3 视觉行 join 复制，S1 首行界栏 `│ ` 为显示投影、会随拖选
  进入剪贴板，续行悬挂缩进的两空格只作列对齐的布局空格、非界栏——侧车
  （selection sidecar）落地前不宣称保真，也不得以规避界栏、改背景色、以空格冒充
  `│` 界栏等方式伪装保真（Ghostty 捕获第 4 节记录 S1 前后拖选字节对照）。

## 7. streaming 稳定

流式期是渲染最脆弱时段：投影不得在流式期改变结构、引入闪烁或重排。

可测试形式：

- **I7-1** headings 投影在 `isStreaming: true` 时不变换（既有测试断言）。
- **I7-2** review-flow 不在流式期落条目（turn_end 才 appendEntry；既有事件时序测试）。
- **I7-3** TPS 流式期显示滚动速率、工具执行期分母冻结（tps 测试）。

## 8. 无气泡化、无装饰堆叠

视觉语言只有排布与用色：无气泡、无框、无竖线、无阴影、无 spinner、无 success marks、
无居中。装饰堆叠即噪声。唯一例外：transcript user 消息首行界栏 `│ ` + 续行悬挂缩进
（I6-4 裁定，界栏非装饰框，标记消息边界，为显示投影；续行以两空格悬挂缩进对齐正文列）。

可测试形式：

- **I8-1** 全屏视觉一处红、零装饰线、三级灰阶（motto 测试 red-lines）。
- **I8-2** 源码无 `#` hex（theme JSON 除外）、无 `•`、`MOTTO_DOUBLE_HEIGHT=false` 时无
  `ESC#3/#4`（motto 测试）。
- **I8-3** 渲染输出中无 `┌─┐│└┘` 等表格边框以外的装饰字符（表格边框为原生数据结构
  呈现，豁免；transcript 首行界栏 `│ ` 属 I6-4 就地界定的显示投影，一并豁免）。

## 9. 宽度适配

一切宽度以显示宽度计（CJK 双列），任何渲染行宽 ≤ 终端宽，不横向滚动、不折行溢出。

可测试形式：

- **I9-1** `render-baseline.mjs` 在 40/60/80/120/200 列对四主题全部场景行宽校验，零超宽。
- **I9-2** footer 两级退化链 + `…` 兜底，任何宽度下行宽 ≤ 终端宽（footer-degrade 测试）。
- **I9-3** 牌记窄窗折行悬挂正确、CJK 不错列（motto 测试）。

## 10. 不污染 session / context / tool payload

所有视觉投影不得进入模型上下文、session 语义、tool 参数或结果。

可测试形式：

- **I10-1** `appendEntry` 只写 session 文件、不发 message（review-flow 测试：无 sendMessage
  降级路径）。
- **I10-2** 投影数据不入模型上下文（review-flow 测试断言 + `sessionEntryToContextMessages`
  对 custom 条目返回空）。
- **I10-3** 品牌化只做加法、功能 token（路径/命令/包名/API 名）零改写（branding 测试）。
- **I10-4** 投影拒绝凭据形状（review-flow 测试：Authorization/Bearer/sk-/ghp_ 等 fail-closed）。

## 11. 陌生化来自布局秩序而非仿古符号

Motto 的辨识度来自**秩序**（层级、留白、两列悬挂、朱墨三用），不是古风装饰
（竖排、印章、文言 UI 文案）。渲染输出、标识符、UI 文案全用现代简洁 CS 用语。

可测试形式：

- **I11-1** 渲染输出与 UI 文案 grep 无文言/仿古词汇（术语表：禁用 目/提要/朱记/著录 等
  作为渲染文案；docs/MOTTO.md 勘误三已有先例）。
- **I11-2** 标识符中性（turnStats/toolLine/errorTail，review-flow 已执行）。
- **I11-3** 谱系词汇不出现在代码注释中（review-flow 勘误已执行；新代码延续）。

> 边界（2026-08-12 返修勘误立）：**悬挂**（hanging indent 标准中译）与缩进/对齐/列宽等
> 现代排版术语不属谱系词，代码注释可用；谱系词的对偶出口一律用现代 CS 用语（gutter/recap/
> error tail/diff/index/splash 等）。判定口径：命中词按是否目录版本之学的仿古借词计，
> 现代排版/布局术语不计。

## 12. 可测试规范的验收口径

每条不变量在 MOTTO-TUI-1 及以后，必须有至少一种自动验收手段，缺省为：
**fixtures/tui/ 无头基线 diff**（`render-baseline.mjs` 输出作为回归锚点提交 git）。
交互面（streaming/拖选/折叠/composer）以 `GHOSTTY-BASELINE.md` 用户侧记录为准，
每条不变量标注其验收面（A=自动 / U=用户侧 / B=两者）。

- I0-1 A · I0-2 A · I1-1 A · I1-2 A · I1-3 A · I1-4 A · I2-1 A · I2-2 A
- I3-1 A · I3-2 A · I4-1 A · I4-2 A · I4-3 A · I5-1 A · I5-2 A
- I6-1 A · I6-2 A · I6-3 U · I6-4 A · I7-1 A · I7-2 A · I7-3 A
- I6-4 修订（2026-08-11，S1 首行界栏 + 续行悬挂缩进）：界栏 `│ ` 只落首行，续行两空格悬挂缩进，
  显示投影语义不变（仍随拖选进剪贴板、不宣称保真），验收手段与措辞见 §6。
- I8-1 A · I8-2 A · I8-3 A · I9-1 A · I9-2 A · I9-3 A · I10-1 A · I10-2 A · I10-3 A · I10-4 A
- I11-1 A · I11-2 A · I11-3 A

> 注解：本文件把 docs/MOTTO.md 的凡例从「文字约定」升级为「可测试不变量」；凡例仍是
> 语义真源，本文件是其测试化出口。两者冲突时以凡例为准并回仓修订本文件。
