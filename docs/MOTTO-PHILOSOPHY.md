# Motto 的理念与取舍（夺舍终局 · 合并时代宣言）

> 用途：嵌入单仓自足 Pi fork（`lesPrivilege/pi`）作合并时代正典，与 `docs/MOTTO.md`（凡例）、
> `docs/TUI-THESIS.md`（可测试不变量）并列；本文是「为什么」，二者是「是什么、怎么验」。
> 引用编号见文末「出处索引」。

## 一、定位一句话

Motto 不是又一个 agent，是骑在极简 harness 上的一套版式：耳目一新的 TUI、简明的 harness（pi）、
快而廉的模型三者相配，从内而外利落疏朗。模型的 agentic 能力越强，为约束而生的 harness 理应越薄；
Motto 站在两线收束处，既是对 model 的选择，也是对 harness 的态度，因此自足。〔R〕

## 二、核心取舍（选 X 而非 Y，理由）

1. **选受控下游，而非自研 harness，亦非永久 extension-only。**
   不 fork 的结论不变，但「受控下游」不是 fork——是先取得发行、版本、升级、回退主权再改 TUI。
   顺序铁律：先立制，再改 TUI；不能先做一块 Core patch 再倒推维护制度。夺舍的是**产品控制面**
   （coding-agent interactive 集成层 + pi-tui 薄接缝 + Motto 策略层），不是无边界吞入上游 Core——
   agent loop、provider、session canonical schema、内置工具执行默认零修改，按版本吸收。
   上游优先：可上游化的能力走上游 issue/PR（#7721 定性为未接纳/不可依赖，账已结，不催办）。〔D0, T0, R〕

2. **选单仓自足 fork，而非双仓，而非纯 extension-only。**
   双仓是到达终局的过渡形态（先立制再改 TUI 的过渡）；终局是单仓自足 fork：上游历史 + patchset +
   Motto 系列 extensions/skills/themes/docs/fixtures 同仓，单仓即一个足量的 agent，效果近 omp
   （omp 正是「Pi fork + 内置电池」）。但 fork 纪律不因合并而松：patch 仍逐条登记、单点可删、
   removalCondition 不废。上游与第三方生态**不进仓**，只作清单记录（EXTENSIONS.lock / PI-BASE）。
   纯 extension-only 已证不足：per-entry 三态投影整层拆为 12 EXTENSION_NATIVE + 9
   GENERIC_CORE_SEAM + 1 Motto 策略层，第一项 core 能力必须动 Core。〔F, T0, D0〕

3. **选「产品呈现层 Motto / 平台契约层 Pi」，而非全量替换。**
   Motto 不抛弃 Pi。产品呈现归 Motto（logo、终端标题、help/usage、slash 描述、onboarding、
   launcher 身份块）；平台契约保留 Pi（npm 包名 `@earendil-works/pi-*`、configDir `.pi`、
   env 覆盖名 `PI_*`、导出文件名 `pi-session-*`、session schema、内部类型）——凡改动可能影响
   生态或维护处一律保留原名。品牌化只做加法、不做改写：身份段拼接于提示词末尾，上游提示词原文
   逐字节不动；「设计语不外泄」的对偶条款是「功能语不可侵」：路径、命令、包名、API 名等功能性
   token 不可被品牌化改写。理由：生态兼容 + 维护连续性，社区扩展、脚本、CI 依赖这些不变量。〔R, M, D0〕

4. **选「自家件入仓、第三方只 lock」，而非全盘收编生态。**
   上游零入库；第三方 extensions 不入仓，仅 `EXTENSIONS.lock.json` 记录（npm/git 钉版 +
   integrity + 兼容 base + 暴露面 + 回退版本，禁浮动 main）。一次 release train 只含一次 Pi base
   更新 / 一项 Core patch / 一到数个有明确关联的 extension 更新；不混成一次不可归因升级。
   理由：保持单仓自足与可归因，生态是固定来源、逐项升级的伙伴，不是原料。〔F, D0〕

5. **选极简视觉（无框、无竖线、无装饰、朱墨三用、灰阶、左锚），而非任何装饰堆叠。**
   视觉语言只有排布与用色：一处红、零装饰线、三级灰阶（text/dim/dimmer）、两列悬挂、留白、
   全部左锚、CJK 双列、间隔符唯 ` · `。朱记三用：钤印（牌记题名）、改笔（路径与 diff）、
   校记（失败），全系统无第四种红、无绿、无 ✓/×、无 success/error 语义色。界栏、悬挂、著录、
   提要等来自目录版本之学的**创造性转化**——转化后只保留秩序精神，使用简洁 CS 语言，不仿古、
   不堆砌传统术语；谱系词汇不得出现在渲染输出、代码标识符与用户可见文案中。理由：装饰堆叠即
   噪声；辨识度来自秩序（层级、留白、两列悬挂、朱墨三用），不是古风符号。〔M, T, R〕

6. **选「成功静默、失败强显；thinking 归不著录之列；投影零写回、不入模型上下文」。**
   正常成功轨迹默认压缩为著录行；失败不允许静默折叠——失败条目整行 accent 强制显露，给 stderr
   尾部原文提要（≤5 行，机械截取、无生成式改写）。thinking 不著录、依 pi 原生。投影层是**只读
   投影**：不持有 canonical 数据、不产生模型语义、不改写会话内容；凡投影即弃，canonical 是唯一
   证据，投影随时可重建。投影不入模型上下文、不写回 session、拒绝凭据形状。理由：一部好书目不
   据以查书翻着也舒服，因为每一行都承重；review-safe 是著录学的不滥收，投影不入上下文是书目
   不混入正文。〔T, R, RF〕

7. **选渐进展开三层阅读面（ledger / preview / canonical），而非单一展开布尔。**
   第 0 层 turn ledger（做了什么/是否成功/改了什么/耗时）；第 1 层 bounded preview（错误摘要/
   diff 统计/命令尾部/关键诊断）；第 2 层 canonical evidence（完整输出/diff/transcript）。
   共同结论：正常流压缩；失败、审批、用户主动操作不随正常轨迹隐藏；explore/change/execute 用
   不同摘要器；完整证据另有去处；聚合单位从 tool 升到 turn、连续活动组、一次用户请求。
   理由：内容压缩、错误详细度、交互状态是三根正交轴，不应揉成一个 expanded 布尔。〔T, RF, G〕

8. **选工程纪律（分层生长、最小实现、勿增实体、不保留向后兼容、上游优先、一 commit 一 patch），
   而非过度设计与兼容面。**
   选择最简单地满足当前需求的实现；不保留向后兼容，删旧路径优于加兼容分支；分层生长：先做最小
   可端到端工作的版本，再在其上长能力；绝不为未完成复杂度牺牲可用产品。调研形成候选，使用形成
   工单；不因调研完备度立单，需求存疑不因 API 可行而立项，NO_GO 不因生态成熟而复活。每个 Motto
   Core commit 只实现一项可独立删除的接缝，禁止巨型提交。理由：不留 context 税，不制造上游漂移面，
   不以研究代替使用。〔A, D0, R, G〕

## 三、吸纳的生态理念（只取与 Motto 取舍一致者）

- **低 chrome 是取舍不是缺省**：视觉取 Codex 低 chrome（无围栏重绘，靠空白+高亮）+ Grok 小标签
  （一侧 accent + 轻标题），不复制 Grok/OpenCode 的重卡片架构——与「无框无竖线无装饰」同向。〔G〕
- **fork + 内置电池**（omp 同构）：单仓即足量 agent，但 patch 逐条登记、单点可删——「fork 是
  发行姿态，纪律是 fork 的前提」。〔F〕
- **版本学对标与证据纪律**（pi-peer / pi-rlm 调研）：pi-rlm 零测试、零定量证据、成本护栏无断言，
  不足以进入依赖集——引用第三方前先要测试、先要证据，这正是契约层（pack = 代码 + 契约 + 验收
  报告）的对外口径；pi-peer 的「非工具内容入流」与 subagent 著录同属待验问题域，无真实使用证据
  不立项。〔R2, R3〕
- **最小核心 + 激进可扩展**（pi 生态）：primitives not features、context engineering 优先、
  agent builds agent——Motto 的 extension/skill 分流与「扩展只是调用胶水，逻辑留在脚本」同一
  精神；吸收为「对上游只提 issue/PR，不吞入 Core」。〔R3, R4〕
- **外部设备层的固定与 fail-closed**（Peekaboo/openclaw）：固定版本 + 官方 checksums 逐字节校验、
  白名单只缩不扩、权限缺失/越界一律 fail-closed、会话级门禁默认关闭、显式批准、重启回未批准态；
  高风险设备是「固定版本、可替换的外部设备层」，不是 core。此即「一个 pack = 代码 + 安全契约 +
  验收报告」的实例。〔P, R5〕
- **探索洪流聚合**（Codex `Explored` / Kimi stack）：探索类工具的成功输出默认压缩为著录行——
  与「压缩轨迹、不压缩回答」总则一致；但 reducer 是观察期条款，须先有「目行粒度失准」的可复现
  摩擦记录才立项，调研不构成触发。〔RF, R, G〕

## 四、一句话收束（fork README/docs 落点建议）

> 能力阶梯自有其名，Motto 始终代表**更简单**：骑在极简 harness 上的一套版式与发行，不抛弃承载
> 层、只夺取产品控制面——把工作的秩序感交给可测试的投影，把证据交给 canonical，把一切多余
> 交给删除。

---

## 出处索引

- [R] `docs/ROADMAP.md`（定位摘要、已裁定不做、终局裁定、动土合法依据）
- [M] `docs/MOTTO.md`（凡例正典：品牌边界、朱墨三用、视觉语言、变更规则）
- [T] `docs/TUI-THESIS.md`（可测试不变量：只读投影、三层、成功静默失败强显、width、零污染）
- [D0] `docs/decisions/2026-08-11-motto-downstream-0.md`（受控下游立制、主权划分、一 commit 一 patch）
- [F] `docs/decisions/2026-08-11-motto-fork-consolidation.md`（单仓自足 fork、omp 同构、lock 记录）
- [T0] `docs/decisions/2026-08-11-motto-tui-0-boundary.md`（12+9+1 拆解、上游优先）
- [RF] `docs/decisions/review-flow-eval.md`（渐进展开调研、API 映射、候选裁决、四槽体例）
- [G] `docs/research/TUI-GPT-SESSION-SUPPLEMENT-2026-08-11.md`（7 主题消费、低 chrome、三层阅读面）
- [A] `AGENTS.md`（工程原则、受控下游宪制、安全红线）
- [R2] `docs/research/pi-peer-pi-rlm-survey-2026-08-08.md`
- [R3] `docs/research/pi-agent-community-research-2026-07-14.md`
- [R4] `README.md`（品牌边界表、目录体例、核心原则）
- [P] `docs/research/PEER-OPENCLAW-PEEKABOO-3.10.0.md`（固定审计、fail-closed）
- [R5] `docs/decisions/2026-08-11-tui-construction-prep.md`（TUI-PREP-1：召回与分单、硬边界）
