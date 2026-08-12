# motto — TUI 品牌层

Motto 的 TUI 品牌扩展:启动牌记(splash)、单行 footer(含 TPS)、终端标题守护、提示词品牌化。
纯展示层,不承载 agent 功能、不触碰模型上下文与 session 语义。

体例正典见仓内 [`docs/MOTTO.md`](../../../docs/MOTTO.md)(凡例);本 README 只讲本 pack 的用法与边界。

## 能力

| 能力 | 说明 |
|---|---|
| 牌记(splash) | 启动 header:题名 + 格言(逐字疏排)+ 刊记(model · date)+ facts 细目(context/skills/extensions/themes);全左锚、两列悬挂、灰阶三级 + 一朱 |
| footer | 单行地脚:左簇 cwd · 统计(`↑↓R W CH% $ context%`)+ TPS,右簇 model · thinking;显式优先级降级,任意宽 ≤ 终端宽 |
| TPS | footer 派生指标:输出 token 吞吐(tokens/sec)。流式滚动 `~N t/s` → 结算转均值 `N t/s`(usage.output/窗口时长);工具期分母冻结;TTL 60s;无 NaN/∞ |
| 标题守护 | TUI 下固定终端标题为 `Motto`;启动退避覆盖 + 周期守护(5s 自停) |
| 提示词品牌化 | `before_agent_start` 只注入 identity 段(纯加法,上游提示词原文零改写;曾用全文正则把 `pi`→`Motto` 越界改写路径导致 ENOENT,已废弃替换路径) |
| 多级标题视觉投影 | display-only:把 H3–H6(`###`~`######`)投影为 H2 文本 `## › 原标题`,TUI 呈现收敛为三层视觉(H1 bold+underline / H2 bold / H3–H6 统一 `› 标题`,无标题井号);仅 assistant 完成态;fenced 代码块内与缩进代码原样;canonical/session/模型上下文/print·json 零改动 |
| 顿号卡片投影 | display-only:把 `、、、` 三顿号围栏卡片投影为单列 Markdown 表格,TUI 原生渲染出 box-drawing 卡片(标题粗体头 + 内容折行);仅 assistant 完成态;fenced 代码块内 `、、、` 原样;canonical/session/模型上下文/print·json 零改动(见下) |
| 项目本地正文 | cwd `.motto/agent.md` 存在时,作为独立段追加在身份段之后(纯加法,项目原文逐字节保留,段标明来源);缺失/为空静默跳过,不建目录不写文件;超 32KB 截断+截断点标注+每会话 notify 一次;牌记 `context` 行与 AGENTS.md 并列列出。体例见 docs/MOTTO.md「六、项目本地正文」 |
| ~~fenced 块牌记~~（**已回退**，见下） | 完成态、顶层、带 allowlist 语言标记(text/txt/plaintext → 文本块,log → 日志,bash/sh/shell/zsh → 命令片段)的 fenced block,在 opening fence 上方投影一行轻量 caption(如 `文本块 · 2 行`)+ 空行;display-only(只改 TUI 渲染输入),原始正文/session/模型上下文/print·json 输出零改动;未闭合/嵌套/非 allowlist/无 language/流式中一律原样 |

## 多级标题视觉投影(display-only)

经 `pi.registerMarkdownTransformer` 接入(纯逻辑见 `headings.ts`),把 H3–H6 投影为
H2 文本,消除常见 assistant 输出中 H3–H6 前成堆的 `#`,呈现收敛为三层视觉:

```text
# 一级标题     →  一级标题          (bold+underline,无前缀,渲染器原生)
## 二级标题    →  二级标题          (bold,无前缀,渲染器原生)
### 三级标题   →  › 三级标题        (投影为 ## › 原标题)
#### 四级标题  →  › 四级标题        (同上)
##### 五级标题 →  › 五级标题        (同上)
###### 六级标题 →  › 六级标题       (同上)
```

- 纯展示投影:只改 interactive 组件的 Markdown 渲染输入(仅 assistant 完成态);原始消息
  正文、session、模型上下文、resume/fork 数据、print/json 等非交互输出均不经过、零改动
  (见 `docs/MOTTO.md` 总纲五「功能语不可侵」)。user / thinking / 流式期一律原样。
- 解析纪律:小逐行 scanner(不用跨全文宽泛正则);fenced 代码块(``` / ~~~,含 blockquote 前缀形式)
  内一律跳过;只认 CommonMark ATX heading(前导空格 ≤3)及其简单 blockquote 前缀(`>` 可嵌套,
  非递归);list 内嵌套标题原样(须递归解析,超出最小面);`###foo`/缩进代码/7+ `#` 非 heading 原样;
  closing sequence 保持可解析;heading 内 inline code/link/emphasis 保留;CRLF 不破坏正文;幂等;fail-open。
- 基线能力保留:H1/H2 原生渲染、三主题 `mdHeading: "dim"`(PACK-THEMES-2 定本)均未触碰;
  与 ROADMAP「mdHeading 逐级槽」(theme 侧逐级取色,上游解锁候选)不冲突、互不替代。
- 验收:2026-08-09 用户于真实 Motto/Ghostty TUI 目验通过(见 reports/PACK-MOTTO-3-acceptance.md)。
- 无用户配置:加载本扩展即生效。
- 撤销边界:回退仅限移除本 display-only 投影(注册 + headings.ts),不得连带回退基线能力。

## 顿号卡片投影(display-only)

经 `pi.registerMarkdownTransformer` 接入(纯逻辑见 `cards.ts`),把 `、、、` 三顿号围栏卡片
投影为单列 Markdown 表格,TUI 原生渲染出 box-drawing 卡片:

```text
、、、
验收结论
基线逐字节、tui 909/909 全绿
、、、
```

```text
┌────────────────────────────────────────────┐
│ 验收结论                                    │   ← 粗体标题头
├────────────────────────────────────────────┤
│ 基线逐字节、tui 909/909 全绿                │
└────────────────────────────────────────────┘
```

- 格式:`、、、` 独占一行(前导空格 ≤3)为开/闭围栏;开栏后首个非空行 = 标题(表格头行),
  其后至闭栏的非空行 = 内容(单空格连接,保留行内 Markdown);内容为空则仅标题头。
- 纯展示投影:只改 interactive 组件的 Markdown 渲染输入(仅 assistant 完成态);原始消息正文、
  session、模型上下文、resume/fork 数据、print/json 等非交互输出均不经过、零改动
  (见 `docs/MOTTO.md` 总纲五「功能语不可侵」)。user / thinking / 流式期一律原样。
- 解析纪律:小逐行 scanner(不用跨全文宽泛正则);fenced 代码块(``` / ~~~)内一律跳过;
  `、、、` 行须独占(带其他文本的顿号行不是围栏);内容/标题中的 `|` 转义为 `\|`;
  未闭合 / 空卡片 / 缺标题 fail-open 原样;CRLF 不破坏正文;幂等;fail-open。
- 目标构造选表格:TUI `Markdown` 组件中表格是唯一能原生渲染出完整边框盒的构造
  (blockquote 仅左 rail、code fence 仅 ``` 行),与仓库文档表格(如 `.motto/agent.md` 验收表)
  视觉同源。调研见 `docs/decisions/2026-08-12-motto-tui-4-dunhao-cards.md`(opencode /
  grok-build / Codex CLI 三家卡片渲染结论)。
- 无用户配置:加载本扩展即生效。
- 撤销边界:回退仅限移除本 display-only 投影(注册 + cards.ts),不得连带回退基线能力。

## fenced 块牌记(display-only)——【已回退】

> **2026-08-09 目验复核（不改史、注补史）**：本能力（FLOW-FENCED-BLOCKS-1）技术链路通过
> （captain transformer 与 Pi Markdown renderer 均实际加载），但用户于真实 Motto/Ghostty TUI
> 目验未形成 card affordance——caption 只是普通正文、原生 renderer 仍显示 ```` ```lang ```` / ```` ``` ````、
> H3+ 仍显示 `### ` 前缀，整体只增加纵向留白未改善 reviewability。**视觉目标失败，状态撤销并回退**：
> 注册与模块已移除，fenced 块回到 Pi 原生基线；本文保留历史描述供追溯。
>
> 状态登记：`FLOW-FENCED-BLOCKS-1 — ROLLED_BACK (VISUAL_ACCEPTANCE_FAILED)`（见 usage-log）。

完成态、顶层、带 allowlist 语言标记的 fenced block,在 TUI 中于 opening fence 上方投影一行
轻量 caption + 空行,再交给 Pi 原生 fenced-code renderer:

````text
文本块 · 2 行

```text
cd ~/Projects/pi
npm test
```
````

- 纯展示投影:经 `pi.registerMarkdownTransformer` 接入,只作用于 interactive 组件的 Markdown
  渲染输入;原始消息正文、session、模型上下文、resume/fork 数据、print/json 等非交互输出均不经过、
  零改动。这不是 PasteCard、不是 Bash execution card,也不修改模型输出(见 `docs/MOTTO.md` 总纲五「功能语不可侵」)。
- 语言 allowlist:`text`/`txt`/`plaintext` → `文本块`,`log` → `日志`,`bash`/`sh`/`shell`/`zsh` → `命令片段`
  (大小写不敏感);其余语言与无 language 的 fence 原样。
- 解析纪律:小逐行 scanner(不用跨全文宽泛正则);只认顶层 fence(前导空格 ≤3);closing 须同字符且
  run 长度 ≥ opening;行数只计 body 逻辑行(空 body 为 `0 行`);未闭合/嵌套(blockquote、list)不动;
  CRLF 不破坏正文;幂等;fail-open。
- 流式期(`isStreaming: true`)与 thinking 消息完全不改,避免流式 fence 闪烁。
- 无用户配置:加载本扩展即生效。

## 主题依赖

本 pack 只通过 `theme.fg` 语义槽取色,无 hex;依赖 `motto` 系列主题的 `dimmer`/`mid` 私有槽,
缺槽时(内置 dark/light)静默降级到 dim,不崩牌记/地脚。主题文件见 `motto-themes` pack。

## 配置

- 格言:`~/.pi/agent/motto` 首行(仅渲染首行;空首行则无题名块)。
- 倍高渲染:`core.ts` 内 `MOTTO_DOUBLE_HEIGHT`(默认 false,opt-in 实验位)。
- 项目本地正文:`<项目>/.motto/agent.md`(存在即注入为独立段;上限 32KB 截断;立域是用户动作,扩展只消费)。

## 启用 / 部署

部署位为 pi 扩展目录与主题目录,由仓库 `scripts/maint/deploy.sh` 统一拷贝(见仓根 README):

```bash
./scripts/maint/deploy.sh          # 部署全部 pack 到 ~/.pi/agent/
./scripts/maint/deploy.sh motto    # 只部署本 pack + 主题
```

## 命令位（launcher shim，可选）

终端直接敲 `motto` 起会话：仓库 `scripts/maint/motto` 是兼容 shim（委托同目录 `launchers/motto` 下游 launcher）。

安装是**显式动作**（命令位属用户环境，deploy.sh 不自动安装——与 .motto 立域同族纪律）：

```bash
ln -s ~/Projects/pi/scripts/maint/motto ~/bin/motto   # ~/bin 须在 PATH
```

选型：`~/bin`（用户级、免 sudo，与既有 taucode symlink 同先例）；`/usr/local/bin` 需 sudo，不默认。

边界三条：

1. **不改 pi 的 configDir**：`.pi` 语义域不可占（宪制第 2 条），命令位只是 `exec` 透传，零环境变量、零配置写入。
2. **不改 argv[0]/进程名**：终端观感由标题守护（setTitle）已覆盖；进程真名 `pi` 保留，利于排查。
3. **自动更新推送不受影响**：上游更新推送走 chat 区（chatContainer），不经 footer/牌记区，与命令位无关（见 `MAINTENANCE.md`「上游更新通道」注脚）。

## 测试

```bash
cd extensions/motto && npm install && npm test && npm run typecheck
```

`test/`:`motto.test.mjs`(宽度/theme 降级/全屏红线)、`footer-degrade.test.mjs`(左簇降级序)、
`tps.test.mjs`(TPS 五判定:流式滚动/结算转均值/工具期分母不涨/窄宽按序被弃/无 NaN·∞)、
`headings.test.mjs`(H3–H6 → `## › 标题`/H1–H2 不动/代码块与缩进守卫/blockquote 前缀/closing sequence/
inline 保留/CRLF/幂等/fail-open/user·thinking·流式不动/真实 pi-tui renderer 输出级断言)。
（`fenced-blocks.test.mjs` 已随 FLOW-FENCED-BLOCKS-1 回退移除——2026-08-09 目验复核撤销,见上。）
活体验收(真实 pi TUI)见 `reports/`。

## 边界与遗留

- `hardWrap` 与 `motto-review-flow/core.ts` 的 `hardWrapText` 为同算法跨件重复:**保留**
  (各 pack 独立可退役,共享模块破坏单件独立性)。
- `truncateToWidth` 为体例自实现(`…` 单字符省略号 + CJK 双列),与 pi-tui 同名导出语义不同:**保留**。
- Ghostty 目视终验(用户侧):双宗切换、Ctrl+O、标题行为待用户于 ghostty 手动确认。
- 上引 `docs/MOTTO.md` 为凡例正典;本 pack 体例与正文冲突时以正典为准并回仓修订。
