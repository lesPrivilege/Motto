# MOTTO — 凡例正典(唯一权威)

> 本文件为 Motto 系列的凡例正典,canonical home 在本仓 `docs/MOTTO.md`(夺舍终局后单仓自足)。
> 部署位(`~/.pi/agent/MOTTO.md`)只留指针;两处出现分歧一律以本正典为准,并回仓修订。
> 各 pack 体例引用本正典对应节:`motto`(牌记/footer/TPS/标题/项目本地正文)、`motto-review-flow`(目录体例)、
> `motto-canonical-copy`(复制体例)、`motto-themes`(颜色/主题)。
> 「为什么」见 `docs/MOTTO-PHILOSOPHY.md`(理念与取舍宣言);「怎么验」见 `docs/TUI-THESIS.md`(可测试不变量)。

---

# MOTTO — current specification

## Motto 总体例(合订定稿,2026-08)

### 一、总纲

1. Motto 是 pi 之上的一层极简 TUI:牌记(启动)、目录(review-flow)、复制(canonical-copy)三件,同宗同版。
2. 服务两事:开工仪式感;人类 review 的清爽分明。不承载 agent 功能。
3. 注入不侵入:全部资产在 ~/.pi/agent 内(唯一例外:项目本地正文 `.motto/agent.md` 归各项目所有,见「六、项目本地正文」)。
   承载层关系见 MOTTO-DOWNSTREAM-0 立制:pi 为受控下游,产品控制面归 Motto;上游内建对应能力时,本地件退役。
6. **品牌边界(夺舍声明,2026-08-11)**:Motto 不抛弃 Pi,是 pi 之上的一套自足发行。
   产品呈现层归 Motto(启动 logo、终端标题、help/usage、slash 描述、onboarding、launcher 身份块);
   平台契约层保留 Pi(npm 包名 `@earendil-works/pi-*`、configDir `.pi`、env 覆盖名 `PI_*`、
   导出文件名 `pi-session-*`、session schema、内部类型)——凡改动可能影响生态或维护处一律保留原名,
   不搞全量替换。品牌化仍只做加法:功能性 token(路径/命令/包名/API 名)不可被品牌化改写(第 5 条延续)。
   实现见 `~/Projects/Motto` MOTTO-REBRAND-1(patch 登记于 PATCHES.json)。
   理念与取舍（为什么）见 `docs/MOTTO-PHILOSOPHY.md`，与 `docs/MOTTO.md`（凡例）/ `docs/TUI-THESIS.md`（不变量）并列。
4. 视觉语言只有排布与用色(朱墨、灰阶、两列悬挂、留白);设计推理中的谱系词汇不出现在渲染输出、代码标识符与用户可见文案中。
5. 品牌化只做加法,不做改写:身份段拼接于提示词末尾,上游提示词原文逐字节不动。路径、命令、包名、API 名等功能性 token 不可被品牌化改写——「设计语不外泄」的对偶条款:「功能语不可侵」;extension 与 fork 的边界以功能性内容为界。

### 二、牌记凡例

一、一红:accent 于牌记仅现于题名 motto 一处。
二、零线:不置装饰线;线唯 composer 与 footer 原生边界。
三、块间必空一行,块内不空;天头二行。
四、全部左锚,右侧余白不填充;无框、无竖线、无居中(辖 chrome,不辖 content:文档表格等数据结构的框线归原生渲染;唯一例外:transcript user 消息首行界栏 `│ ` + 续行悬挂缩进,I6-4 裁定,界栏非装饰框)。
五、间隔符唯 ` · `;显示宽度按 CJK 双列计。
六、theme 只管色(五槽 bg/text/accent/dim/dimmer,另 mid 双宗同值),extension 只管版式;代码内无 hex。
七、题名疏排;倍高行为默认关闭的实验位。
八、footer 单行,地脚层级,数据取自原生同源,不增删指标;唯一例外:TPS(输出 token 吞吐)为会话事件派生指标,见 Footer 节。
九、终端侧配置不入本工程;双宗 auto 依赖终端自声明外观与底色一致(ghostty:window-theme)。
十、朱记三用:钤印(牌记题名)、改笔(路径与 diff)、校记(失败)。Motto 新增投影层与主题无第四种红,无绿,无 ✓/× 与 success/warning/error 语义色(上游 legacy 选中/成功标记为未改动原码,在 Motto 主题下渲染为 mid 灰,不构成语义色)。

### 三、目录体例(review-flow)

1. recap 两态:汇总一行(独立;失败条目按第 6 条强显) → 展开逐条(随 pi 全局 expanded 状态,同时含原生 tool rows 全文)。纯展示,不入模型上下文。
2. 成功静默,仅偏差入记(失败/超时/非零退出),以 accent 标示;禁 ✓/× 与 success/warning/error 语义色。
3. assistant 最终回答永不折叠;thinking 依 pi 原生,不入目。
4. 全部文案为机械投影:tool 名、路径、计数、耗时、退出状态取自原生元数据;任何位置无 LLM 摘要或改写;错误提要为 stderr 尾部原文(≤5 行,dim)。
5. 汇总行无标签,计数起始;版式同牌记细目(动词列定宽 + 对象列悬挂,` · ` 断点,CJK 双列)。
6. 失败不允许静默折叠:汇总行含 failed 段(accent),失败条目整行 accent 强制展示。
7. 对象列 review-safe:路径、模式、命令首词;不复制 content、完整输出、custom-tool 参数。
8. session 投影限 motto-review-flow.turn.v1,单 turn KB 级有界。
9. 守卫为静默失活:启动时若 pi 缺 `appendEntry` / `registerEntryRenderer`(如 0.85+ 改名),本件不注册、不渲染、不抛错,扩展无声消失——但会弹一次启动警告(仅 TUI),不崩溃、不影响加载其余扩展。

### 四、复制体例(canonical-copy)

1. 两命令:/copy-answer(最后一条 assistant 最终文本原文)、/copy-code(其中最后一个 fenced code block 原文)。复制源为 session 数据,非屏幕投影;无换行清理启发式。
2. 传输一律经 pi 公开导出 copyToClipboard;不自建剪贴板后端,不拦截 stdout,不改写 OSC 52。
3. fail-closed:无可复制文本仅提示,无任何写入;无 UI 时全静默。
4. 快捷键机制 env-gated,默认不启用。
5. 已知边界:鼠标选中复制(regular 硬折行、fullscreen 视觉行拼接)属 pi 上游课题(#7721 等);需要准确文本以命令为准。上游 clean copy 落地后本件退役。

### 五、变更规则

1. 凡新增视觉或功能之议,先对本总体例;不合者不立单。
2. 目录粒度参数(条目聚合、提要行数、入目类别)处于观察期:修订须以真实使用摩擦记录为据,不做预防性迭代。已知空白待验:subagent 输出是否入目。
3. 上游跟踪项:#7721/#7757/#7761(selection/copy)、#7770(DSR 语义)、transcript projector 提案(真三层 progressive disclosure:per-entry ID + collapsed/preview/full);pi 升级时核对,对应能力内建即启动本地件退役。两份上游设计稿存于 docs/research/(UPSTREAM-PROPOSAL.md / UPSTREAM-SELECTION-PROJECTION.md)。升级 pi 前须核对 review-flow 依赖的两个 custom-entry API 仍在 dist 导出(命令:`grep -nE "registerEntryRenderer|appendEntry" node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`),任一缺失即按第 9 条静默失活处置。
4. 维护态改动一律 git 单独 commit,先核实后动手,如实报告,错则勘误留档。

### 六、项目本地正文(.motto/agent.md)

1. **立域**:`.motto/` 为 Motto 在各项目内的自有目录,`agent.md` 为其正文;立域是项目作者的动作(自建该文件),扩展只消费——不建目录、不写文件,缺失/为空静默跳过,全链路无差异。
2. **性质**:内容归项目所有;`before_agent_start` 将其作为独立段追加在身份段之后(与身份段同法:纯加法、上游提示词与项目原文逐字节零改写、段有明确标题标明来源)。
3. **上限防线**:正文超 32KB 截断注入并在截断点注明,UI 通知一次(每会话);防项目文件失控变成 context 税。
4. **与全局分工**:全局 AGENTS.md(agent 目录)管风格与规则;本地 `.motto/agent.md` 管该项目的维护语境。两者重复由项目作者自理,扩展不去重。
5. **零干涉**:与 pi 自有 context 机制零干涉——pi 注入什么照旧,motto 只加自己这一段。
6. **可见性**:牌记 facts 的 `context` 行在 `.motto/agent.md` 存在时与 AGENTS.md 并列列出,本地域可见。

## 版式:牌记 (单一左对齐)

```text
row 1   (blank)
row 2   (blank)
row 3   ■motto■  ■慎 厥 身 修 思 永■   accent bold · text bold,顶格,格言逐字疏排
row 4   (blank)
row 5      {model} · {date ISO}    mid 色,缩进 3
row 6   (blank)
row 7      context     {context}   dimmer · dim,两列悬挂缩进
row 8      skills      {skills}
row 9                  {续行}      悬挂对齐第 15 列
row 10     extensions  {extensions}
row 11     themes      {themes}
row 12  (blank)
row 13+ host output, untouched
```

- 全部左对齐,无居中、无 96 列版心、无格言下短横线。
- 语义块(题名 / 刊记 / facts)两两之间空 1 行,块内不空;天头 2 空行,牌记块后留 1 空行再接后续内容。
- 标签列 `context` / `skills` / `extensions` / `themes` 小写无方括号,dimmer 色,列宽定死 12(不动态计算),内容列自第 15 列起,dim 色。
- 列表项间隔符一律 ` · `,不用逗号。extensions 显示末段短名(`@narumitw/pi-lsp:src` → `pi-lsp`)。

## 格言疏排

- 题名行格言逐字疏排:仅相邻两个 CJK 字素之间插入一个空格(`慎厥身修思永` → `慎 厥 身 修 思 永`);拉丁词、数字内部不拆(`ABC慎厥123` → `ABC慎 厥123`)。
- 疏排只作用于格言;`motto` 五个拉丁字符不疏排。
- 按字素处理(共享 `Intl.Segmenter`,标准 API,无新依赖)。宽度计算计入插入的空格。

## 折行

- 一切宽度用显示宽度(CJK 每字 2 列),复用 `@earendil-works/pi-tui` 的 `visibleWidth`,不引入新依赖。
- facts 内容列可用宽度 = 终端宽度 − 15;续行悬挂第 15 列;断点优先在 ` · ` 处,断行后行首不残留间隔符。
- 题名行超出终端宽度时,格言(疏排后)折行并悬挂对齐格言起始列(第 7 列),`motto` 恒在行首;断点落在疏排空格处。
- 除折行外无任何窗口断点逻辑,不存在多级布局退化。

## MOTTO_DOUBLE_HEIGHT(opt-in 实验项,默认关闭)

- `const MOTTO_DOUBLE_HEIGHT = false`。为 `true` 时题名行改用 DECDHL 倍高渲染:每行输出为 `ESC#3`(上)+ `ESC#4`(下)两行同一内容,与疏排叠加。
- 不做终端能力检测,由用户自行开关;默认 `false` 时代码路径完全不发该序列。

## 主题:深浅双宗

- 双宗 auto;不跟随系统的终端须自声明外观与底色一致(ghostty:window-theme)。
- 已知边界:ghostty `command` 直启 pi 可能命中 syncAppearance 闪现窗(~1-2s)误载 light;手动起 pi 不受影响。

## facts 来源

- `context`:agent 目录 `AGENTS.md` 优先,否则 cwd 下 `AGENTS.md`,相对 cwd 显示;cwd 下 `.motto/agent.md` 存在时并入同一行(与 AGENTS.md 并列,` · ` 分隔,见「六、项目本地正文」)。
- `skills` / `themes`:agent 目录下 `skills/`(含 SKILL.md 的目录)与 `themes/*.json`。
- `extensions`:settings.json `packages`(npm,按声明顺序取短名)后接本地 `extensions/*.ts`。

## 配置

`~/.pi/agent/motto` 可含一行格言,仅渲染首行;空首行则无题名块。facts 不受影响。

## 终端标题

TUI 模式下固定以 `Motto` 替换原生终端/标签页标题(不再附加 session/cwd)。pi 原生在启动(init / resetExtensionUI)与 `session_info_changed` 时写 `π - …`,扩展以「事件后延迟覆盖(启动退避 0/300/800/1500/3000ms)+ 每秒周期守护(启动后 5 秒自停)」保证标题稳定为 `Motto`;5 秒后仅依赖 `session_info_changed` 等事件钩子重设。

退出行为:pi 在 `session_shutdown` 之后还会经 resetExtensionUI 再写一次 `π - …`,且 ghostty 1.3.1 不实现标题栈(CSI 22/23t 为空操作),故退出后标题保持 pi 最后一次写入,无法恢复终端默认。

## Footer:单行

扩展经 `ctx.ui.setFooter` 替换 pi 原生 footer 为单独一行,地脚层级低于正文:

```text
~ · ↑66k ↓36k R3.0M CH99.6% ~1.2k t/s 10.1%/1.0M (auto)          deepseek-v4-flash · max
```

- 左簇:`cwd`(沿用原生缩略,含 ` (branch)` 与 ` · session`)后用 ` · ` 接统计;统计项与原生 footer 完全同源、同指标、同显隐条件:`↑in ↓out RcacheRead WcacheWrite CH{命中率}% $cost {percent}%/{window}(auto)`,另加派生指标 `TPS`(见下)。数据取自会话 `entries` 累计 + `getContextUsage()`,`formatTokens`/`formatCwdForFooter` 与原生逐字一致;auto-compact 读 settings.json `compaction.enabled`(缺省 true)。
- 右簇:`<model> · <thinking-level>`(仅 reasoning 模型显示 thinking;`•` 一律替换为 `·`)。
- 右对齐:填充 = 终端宽度 − 左簇宽 − 右簇宽,最小间距 2。两级退化:先缩为仅 model 名,仍不足则右簇整体省略;右簇整体省略后左簇仍超宽,则左簇统计段按显式优先级降级(低者先弃):`$cost`(记账,价值最低)→ `CH`/`W`(缓存细节)→ `TPS`/`R`(TPS 为瞬态,同优先级最右先弃)→ `↑`/`↓`(吞吐)→ `context%/window`(操作最关键,最后保),`cwd` 永不主动弃,最终仅剩 `cwd` 仍超宽时以省略号(…)截断兜底;任何情况下渲染行宽 ≤ 终端宽,不折行。
- TPS(输出 token 吞吐,tokens/sec):窗口 = 一次 assistant 回答(message_start → message_end)。流式期显示滚动速率,`~` 前缀标注估算(`~1.2k t/s`);结算转均值(`1.2k t/s`,以 message_end 的 `usage.output` 为精确分子)。分母锚定最近一次产出 token 的时刻:工具执行期无产出 → 分母冻结、速率恒定(「工具期分母不涨」)。结算均值展示 TTL 60s 后自然隐藏;除零/非有限值一律不显示(无 NaN/∞)。
- 色值:整行 dim;右簇 model 名 mid 稍突出,其余 dim;不得使用 text / accent。
- footer 上方不新增任何线;composer 既有边界原样。数据刷新沿用原生 footer 的刷新时机(渲染时实时计算),不新增定时器。

## 颜色

- light:bg `#f2f3f4` / text `#26282b` / accent `#b03a34` / dim `#5c6166` / dimmer `#b8bdc2` / mid `#8a9095`
- dark:bg `#26282b` / text `#f2f3f4` / accent `#c0453e` / dim `#a8adb2` / dimmer `#5c6166` / mid `#8a9095`
- 其余 theme 字段按同一灰阶逻辑就近映射(syntax、markdown、thinking 等),不引入新色相。

## Not in scope

居中、96 列版心、格言下居中短横线、方括号标签、frame、竖线、阴影、spinner、success marks、占位符、消息/tool/diff 渲染器、host 输出改写、extension statuses 行均不得实现或恢复。对话流渲染不挂任何 hook。唯一例外:transcript user 消息首行界栏 `│ ` + 续行悬挂缩进(TUI-1 S1,依据 I6-4 就地界定;界栏非装饰框,会随拖选进入剪贴板,侧车落地前不宣称保真)。

## Acceptance

1. 深浅两宗切换后,版式逐字符一致,仅颜色不同。
2. 终端从 200 列缩到 40 列:牌记始终左锚、无居中跳动、折行悬挂正确、CJK 不错列;格言疏排生效,bold 与色值不变。
3. motto.ts 中无 `#` 开头的 hex;全屏间隔符无 `•`;`MOTTO_DOUBLE_HEIGHT` 为 false 时输出无 `ESC#3`/`ESC#4`。
4. 全屏视觉:一处红、零装饰线、三级灰阶(text bold / dim / dimmer)、块间空行;无框、无竖线、无阴影(transcript 首行界栏 `│ ` 为 I6-4 裁定例外)。
5. footer 单行,左右簇对齐,窗口宽度连续变化时右簇对齐无抖动、按两级退化;数值与原生 footer 逐项一致;composer 与 context 显示与重构前一致。
