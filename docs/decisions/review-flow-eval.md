# review-flow 评估结论(API 核实 + 逐项裁决)

> 评估对象:GPT 包 `/Users/lesprivilege/Downloads/motto-review-flow.zip`(index.ts / policy.mjs / README.md / UPSTREAM-PROPOSAL.md / test / dev stubs)
> 评估基准:`motto-review-flow 体例(定稿)` + 勘误三条(优先于原文)
> pi 版本:`@earendil-works/pi-coding-agent` 0.84.1(npm 全局)+ `@earendil-works/pi-tui` 0.84.1
> 结论日期:2026-08-07

---

## 一、API 存在性核实(体例门槛 1,源码级)

全部在本地安装的 pi dist 源码中逐一定位,GPT 自写 stub 不作数。**7 项 API 全部存在,签名与 GPT 用法一致**(GPT 的 stub 恰好与真实签名相符,此项 GPT 无虚报)。

| API | 位置(dist 源码) | 签名 | 判定 |
|---|---|---|---|
| `pi.appendEntry(customType, data)` | `core/extensions/loader.js:271`(API 代理);`core/agent-session.js:1864`(bindCore 动作) | `(customType: string, data?: T) => void`,落 `session-manager.appendCustomEntry` → session 文件 `{type:"custom", customType, data, ...}` | ✅ |
| `pi.registerEntryRenderer(customType, renderer)` | `core/extensions/loader.js:250` | `(customType, renderer)`,渲染调用见 `modes/interactive/components/custom-entry.js:60`:`renderer(entry, { expanded }, theme)` | ✅ |
| `turn_start` 事件 | `core/agent-session.js:448-453` | payload `{ type, turnIndex, timestamp }` | ✅ |
| `tool_execution_start` 事件 | `core/agent-session.js:500-506` | payload `{ type, toolCallId, toolName, args }` | ✅ |
| `tool_execution_end` 事件 | `core/agent-session.js:519-526` | payload `{ type, toolCallId, toolName, result, isError }` | ✅ |
| `turn_end` 事件 | `core/agent-session.js:456-461` | payload `{ type, turnIndex, message, toolResults }` | ✅ |
| `Theme.fg(slot, text)`(渲染器第三参) | `modes/interactive/theme/theme.js:263` | 未知槽抛 `Unknown theme color`;`ThemeColor` 联合类型不含 `dimmer`(motto 私有槽) | ✅(需降级处理) |

配套核实:
- **entry 不入模型上下文**:`appendCustomEntry`(`session-manager.js:820`)只写 session 文件,不发 message;`CustomEntryComponent` 纯展示。✅
- **Ctrl+O 原生展开**:`custom-entry.js` 的 `setExpanded` 由 `interactive-mode.js` 的 `toolOutputExpanded` 驱动,renderer 收到 `options.expanded`。✅
- **双宗热切换**:主题切换 → `interactive-mode.js:3715 chatContainer.invalidate()` → `custom-entry.js invalidate()` → rebuild → renderer 以新 theme 重调。✅
- **窗口缩放重算**:布局 `layout.js renderCached` 按 (component,width) 缓存并调 `component.render(width)`;renderer 本身只在 rebuild 时被调 → 折行必须放在自定义组件 `render(width)` 内(见下"版式改造")。✅(已实现)

## 二、体例门槛逐项裁决

### 1. API 存在性 —— 见上表,全过。

### 2. fail-closed —— 已修

GPT 代码在缺 API 时 `throw new Error(...)`。核实:pi 会捕获并把错误投进启动诊断 `[Extension issues]`(`interactive-mode.js:1350` 起),**非静默**。按体例「静默失活」改为 `return`(no-op)。同时确认 GPT 代码与成品均**无 `sendMessage` 降级路径**(红线:展示数据注入模型上下文)。

### 3. session 负载有界 —— 通过

仅新增 `motto-review-flow.turn.v1` 投影。字段限于形制:verb / category / target / metric / status / durationMs / errorLines(失败 stderr 尾部 ≤5 行、每行 ≤100)。实测:8 工具典型 turn ≤1KB;20 工具 explore 洪流 ≈2.3KB(结构开销随工具数线性,不落任何原始输出)。

### 4. 色 token 改造 —— 已修(红线)

GPT 用了 `success / warning / error / toolTitle / muted` 五槽 + ✓/×。成品改映射为 **text / dim / dimmer / accent 四槽**:
- 动词列 → `text`;对象 → `dim`;计数/耗时等度量 → `dimmer`;失败整行与 diff 统计(改笔)→ `accent`。
- 逐槽语义取色,extension 内无 hex;`dimmer` 为 motto 主题私有槽,缺槽(非 motto 主题)时静默降级 `dimmer→dim→text`(探测 + 缓存,失败安全)。
- `grep` 源码无 `success/warning/error/toolTitle/muted` 语义色、无 ✓/×、无 `sendMessage`;有测试守护(见 `review-flow.test.mjs`)。

### 5. 版式改造 —— 已修

- GPT 无两列悬挂、无折行。成品:
  - 汇总行:无标签,直接以计数起始(勘误一),续行悬挂第 0 列。
  - 工具行:动词列定宽(本 turn 动词最大显示宽,上限 16,超长裁剪)+ 2 空格,对象列续行悬挂对齐;断点优先在 ` · `,超长单元硬折仍悬挂。
  - 显示宽度一律 CJK 双列(`pi-tui visibleWidth`)。
  - 窗口缩放:折行在自定义组件 `render(width)` 内按当前宽度重算(见门槛 1 的"窗口缩放重算")。
- 折叠态失败工具强制展示(失败不允许静默折叠):汇总行 + 失败行(整条 accent)+ stderr 尾部(dim,悬挂内容列);展开态展示全部工具。

### 6. 运行时验收 —— 全过(22/22,`notes/review-flow.test.mjs`)

GPT 三组 fixture(照用)+ 新增:
- 连续 explore 洪流(20 tools):单投影有界、不落原始输出。
- 失败测试长 stderr(200 行):尾部 ≤5 行原文截取、状态行去重、投影有界、折叠态强制可见。
- 双宗热切换:缺 `dimmer` 槽静默降级不炸。
- 纯文本 turn 无条目(无汇总行)。
- Ctrl+O 原生展开:collapsed/expanded 渲染分支有测试覆盖;原生 tool 行不受本扩展触碰。
- 典型 turn ≤1KB;CJK 双列不错列;折行悬挂;超长硬折。

### 7. 交付 —— 独立文件 + 单独 commit + 本评估文档

- `extensions/motto-review-flow.ts`(独立文件,git 单独 commit)
- `notes/review-flow.test.mjs` + `notes/review-flow-eval.md`

> **编者注（2026-08-08 省并裁定，不改史）**：本文件由 `~/.pi/agent/notes/review-flow-eval.md` 原样迁入本仓 `docs/decisions/`，正文路径不追改（历史原状）；原件归档于 `~/.pi/agent/notes/archive/`，映射见 `notes/archive/README.md` 与 `docs/reviews/2026-08-08-省并记录.md`。

## 三、勘误执行(三条,优先于原文)

1. **汇总行去标签**:不出现「目」/review/ledger 等任何标签,直接以计数起始:`5 tools · explore 2 · change 1 · run 1 · 1 failed · 14s`。源码与渲染均无标签词(有测试守护)。
2. **全机械投影**:tool 名、路径、计数、耗时、退出状态一律取自原生元数据;失败行退出状态由 bash 结果尾部的 `Command exited with code N` / `Command timed out after N seconds` / `Command aborted` 机械提取(`toolExitStatus`);错误提要 = stderr 尾部原文截取(trim + 裁剪 + 状态行去重),无任何生成式摘要或改写。
3. **内部设计语言不外泄**:「目/提要/全文」「常事不书」等不作渲染文案、不作标识符(标识符统一为 turnStats / toolLine / errorTail / ReviewLines 等中性词);UI 词汇沿用 pi 与成熟方案惯用词(tools / explore / change / run / failed / matches / lines / exit N 等)。源码注释亦已中性化。

## 四、与 GPT 原包的主要差异

| 项 | GPT 原包 | 成品 |
|---|---|---|
| 汇总行标签 | `review 6 tools · …`(禁用词) | 无标签,计数起始 |
| 色槽 | success/warning/error/toolTitle/muted + ✓/× | text/dim/dimmer/accent 四槽,无标记字符 |
| 版式 | 平铺无悬挂无折行 | 两列悬挂 + `render(width)` 重算折行 + CJK 双列 |
| fail-closed | throw(启动诊断可见) | 静默失活(return) |
| 退出状态 | 无 | 机械提取 exit N / timeout / aborted |
| 错误提要 | 单行 metric | stderr 尾部 ≤5 行原文,折叠态强制可见 |
| 类型验证 | 自写 stub | 对照真实 dist 类型 `tsc --strict` 0 错误 |
| 运行形态 | 目录包(index.ts + policy.mjs + stubs + tsconfig) | 单文件 `motto-review-flow.ts` |

## 五、上游 proposal

`UPSTREAM-PROPOSAL.md`(GPT 包内与 Downloads 两份一致)为 presentation-only transcript projector 提议(per-entry fold / three-level preview / turn-level grouping)。保持原样,可在整理后提交 pi 上游 discussion;若上游内建 turn 级聚合,本扩展按惯例退役,体例分类细则与静默原则转为对上游实现的验收标准。

## 附:验证命令

```bash
# 测试(22/22)
cd ~/.pi/agent && node --test notes/review-flow.test.mjs
# 类型对照真实 dist 类型(0 错误)
cd ~/.pi/agent && ./node_modules/.bin/tsc -p tsconfig.typecheck.json
```

## 六、活体验收(pi 真实 loader + 真实 theme,补录 2026-08-07)

单测之外,用 pi 的**真实加载链路**做了端到端活体验收:`notes/review-flow.live.mjs` 经 `discoverAndLoadExtensions`(pi 启动同款)加载全部 extension —— **零错误**,review-flow 与 motto.ts 同载;随后走真实事件流(turn_start / tool_execution_start / tool_execution_end / turn_end)驱动混合负载(3 read/grep、1 edit、1 故意失败的 bash),再以真实 motto-light / motto-dark theme 经注册的 renderer 渲染(折叠/展开 × 100/48 列)。

结果核对:
- 汇总行无标签、计数起始;工具行两列悬挂;48 列窄窗下续行悬挂正确(第 6 列)。
- 四槽分布正确:动词 text / 对象 dim / 度量 dimmer / 失败与 diff accent;错误提要为 dim。
- 投影 821 字节(5 工具 1 失败),有界。
- 失败 bash 整行 accent(朱记第三用/校记首次上屏):同屏 accent 元素 = 汇总「1 failed」段 + 失败行 + (展开时)diff 统计,共 2–3 处,错误提要未用 accent——浓度受控,无过量。
- 彩色预览:`notes/review-flow-live-preview.html`(双宗真色,浏览器打开即可人眼裁决)。

遗留:真实 pi session 内 /reload 后的肉眼终检仍建议由用户执行(本环境无交互 TUI 屏)。活体验收脚本:`notes/review-flow.live.mjs`。

## 七、开源生态二轮调研(自足边界,补录 2026-08-07)

本轮不再比较外观,只提取 Motto 能以 pi 公开 API 自足实现的 review 文法。

| 项目 | 当前可核实策略 | 对 Motto 的有效启示 |
|---|---|---|
| [Qwen Code](https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md) | `compactMode` 可隐藏 tool output 与 thinking,但审批永不隐藏;shell 内联默认最多 5 行,错误、用户主动 shell、审批中工具与聚焦 shell 强制全文 | **异常/审批优先级独立于紧凑度**;preview 预算按内容类别分配,不是统一截断 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md) | `compactToolOutput` 默认开启,`errorVerbosity` 另设 low/full,审批期间 drawer 另有折叠策略 | **内容压缩、错误详细度、交互状态是三根正交轴**,不应揉成一个 expanded 布尔值 |
| [Kimi Code](https://github.com/MoonshotAI/kimi-code/blob/main/apps/kimi-code/CHANGELOG.md) | 连续 tool calls 可聚成 collapsible stack;edit 显示 diff 行数 chip;截断 preview 时完整日志另存;运行中的 bash 先显示命令且可展开;todo 有独立折叠键 | **先聚合事件,再按工具类型投影**;完整证据与内联 preview 分储 |
| [Aider](https://github.com/Aider-AI/aider/blob/main/HISTORY.md) | `/diff` 以一次用户请求为范围展示全部改动,包括后续 lint/test 修复 | **事件回顾与制品审查分面**;change 不应只作为 tool timeline 的附属信息 |
| [Codex](https://github.com/openai/codex) | 主视图把连续探索归并为 `Explored`,有界 command preview 指向独立 transcript | 既有「压缩轨迹、不压缩回答」总则继续成立;探索洪流应优先在 reducer 层消解 |
| [Grok Build](https://github.com/xai-org/grok-build) | entry 自有 display mode 与 canonical selection projection | 仍属 pi 上游能力参照;Motto 不复制其原生 row 主权与选区 sidecar |

共同结论不是「所有项目都做三态」,而是:

1. 正常成功轨迹默认压缩;
2. 失败、审批、用户主动操作不随正常轨迹一起隐藏;
3. explore / change / execute 使用不同摘要器;
4. 完整证据保留在 canonical transcript、日志或独立 review 面;
5. 聚合单位逐渐从单 tool 提升到 turn、连续活动组、一次用户请求。

Aider 带来的新增认识是**事件回顾与制品审查先分面**:当前 `motto-review-flow` 只回答「这轮发生了什么」;「这轮总共改了什么」已有 pi `/diff` 与 git 覆盖。体例将来扩展前先判定需求属于哪个面,不把制品审查重复塞回事件 ledger。

## 八、pi 0.84.1 公开 API 映射

### 可由 Motto 自足实现(零 core patch)

1. **turn reducer**:在 `turn_end` 前按 category + review-safe target 归并重复调用,记录次数、累计耗时、最终状态与失败次数。
2. **Explore 高层组**:连续 read/grep/find/ls 投影为一组 `Explored`,组内只保留计数与有界 target 样本;不落文件正文。
3. **Change 制品摘要**:按文件合并多次 edit/write/patch,机械累计 diff stat;与执行命令分面。
4. **Execute 结果摘要**:成功只记命令首词制、退出状态与耗时;失败沿用 stderr 尾部 ≤5 行;不新增成功 stdout 持久化。
5. **独立 review overlay(需求存疑)**:注册 `/review` 或快捷键,经 `ctx.ui.custom()` 打开 Motto 自有投影的可导航面。技术上可拥有自己的状态与 TUI 重绘入口,但目前没有使用记录证明 review 需要离开对话流进入独立审查间;不因 API 可行而立项。

### 仍不可由 ledger entry 自足实现

1. persistent custom entry renderer 只收到 `{ expanded: boolean }`,没有 entry ID、焦点、局部模式或 render scheduler;
2. `registerShortcut` handler 没有公开 `requestRender()`;
3. `Component.invalidate()` 只清缓存,不是从快捷键向 TUI 请求一帧;
4. extension 没有原生 transcript selection、screen-to-source offset、soft-wrap joiner 或 native row projector。

因此,**ledger 原地独立三态与任意选区 clean copy 仍不立项**。可行替代是「常驻 recap + 全局展开的逐项投影 + 独立 review overlay」,而非 monkey-patch persistent rows。

## 九、v2 候选清单与裁决

本轮只形成候选清单,不构成方向已定的架构。任何候选的触发条件都是观察期出现可复述的摩擦记录,不是调研完备度。

1. **turn reducer(合规候选)**:若实际使用反复出现 explore 洪流仍碎,参考 Kimi 的 stack 与 Codex 的 `Explored`,在 safe projector 后按 explore/change/execute 分型聚合。它是最可能的 v2 第一单,但当前不预立项。
2. **`/review` overlay(需求存疑)**:公开 API 技术上可行,但它把「可交互三态」搬进独立容器,尚未证明用户需要离开流进入审查间。只有真实 review 记录显示 recap 与原生 transcript 均不足时才重评。

若观察期触发任一候选,实现仍须满足:

- v1 entry 继续可渲染,新写入改用 version 2;
- 单 turn 投影设置序列化硬上限,超限保留机械计数与失败数,不无界落 rows;
- 成功 stdout、文件正文、完整 diff、完整命令一律不进入 Motto entry;
- 失败仍在 collapsed 强制显露;
- overlay 是 review 面,不是 canonical evidence 替身;
- theme 仍只使用 text / dim / dimmer / accent,缺槽降级;
- 不重注册 built-in tools,不触碰模型上下文,不改 pi expanded 状态。

**本轮裁决:调研可消费,实现暂缓。** 当前 recap 正处观察期;唯一正当活动是使用并记录摩擦。若 explore 洪流反复造成逐行噪声,重评 reducer;若出现必须离流审查的实际需求,再重评 `/review` overlay。运行中 live widget 与「收工后 review」正交,从候选清单删除。停止继续横向调研,避免以研究代替使用。
