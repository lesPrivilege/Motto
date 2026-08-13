# TUI 参考图投喂包（2026-08-13）——ChatGPT image gen brief

> 用途：喂给 ChatGPT 网页版 image gen（gpt-image / 图像生成），产出 review-flow 下一版版式的参考图。
> 反向流程：参考图仅作候选（ROADMAP 四），不直接成工单；逆向修正 TUI 时以凡例与目验为准。
> 投喂方式：repo 为 public，可直接给链接；本文件附精简上下文，便于生成时引用。

## 一、仓库链接

- Repo: https://github.com/lesPrivilege/motto （Motto fork；凡例正典 `docs/MOTTO.md`，理念 `docs/MOTTO-PHILOSOPHY.md`）
- TUI 基线（文本渲染产物）: `fixtures/tui/baseline/`（theme-motto-dark.txt 等）

## 二、凡例要点（给生成模型的约束）

1. 视觉语言只有排布与用色：一处红（accent）、零装饰线、三级灰阶（text/dim/dimmer）、全部左锚、两列悬挂缩进、留白；无框、无竖线、无居中、无阴影。
2. 朱记三用：钤印（牌记题名）、改笔（路径与 diff）、校记（失败）。无第四种红、无绿、无 ✓/×、无 success/warning/error 语义色。
3. 间隔符唯 ` · `；显示宽度按 CJK 双列计（中文一字两列）。
4. 版式学原理层（目录版本之学）：源流考辨（为什么这样排）、善本目验（易读、留白、层级、不炫耀）。**三不**：不借词语、不借形体（不仿线装/竖排）、不牵附（不为典故而设计）。
5. 唯一准绳：人类目验 **clean and cool**——耳目一新（陌生化）但清爽分明。

## 三、当前 TUI 实况（目验快照 2026-08-13）

牌记（启动首屏）：

```text
motto  慎  厥  身  修  思  永

  deepseek-v4-flash · 2026-08-13

  context     AGENTS.md
  skills      archive · arxiv-browse · emil-design-eng · env-audit · house-style · motto-maintenance
              reading-companion · vercel-brand-guidelines · weread-skills
  extensions  pi-rewind@0.5.0 · pi-lsp@0.49.4 · pi-subagents@0.14.3 · motto · motto-canonical-copy
              motto-computer-use · motto-gemini-vision · motto-review-flow
  themes      motto · motto-dark · motto-light

~/Projects/Motto (motto/main) · 0.0%/1.0M (auto)                        deepseek-v4-flash · max
```

review-flow 目录体例（工作过程的书目呈现）：

- recap 两态：汇总一行（`tool 计数 · 耗时`，失败条目 accent 强显）→ 展开逐条；成功静默，仅偏差入记；thinking 不入目。
- 目录条目机械投影：tool 名、路径、计数、耗时、退出状态取自原生元数据；错误提要为 stderr 尾部原文（≤5 行，dim）。
- 失败条目整行 accent；全部左锚、无框；` · ` 断点。

## 四、生成任务（英文 prompt 骨架，可按需扩写）

```
Design a text-based terminal TUI for an AI coding agent's session review flow
("a bibliography of the work process"): tool-call ledger lines, compact by default,
failures surfaced in one accent color (vermillion red), everything else grayscale
(text / dim / dimmer). Hard rules: monospace, no boxes, no vertical lines, no centering,
no decoration lines, left-anchored, hanging-indent two-column layout, CJK double-width,
single separator glyph " · ", one accent red only, no green, no checkmarks/crosses,
no success/error semantic colors. Aesthetic: bibliographic (rare-edition catalog) spirit —
source-critical, quiet, generous whitespace — but strictly modern: no imitation of
ancient book forms, no borrowed terminology. The feel: unfamiliar yet clean and cool,
an unhurried ledger you enjoy reading even when not looking anything up.
Generate 2-3 layout variations of a full screen (banner header, review entries with
failed item, footer status line).
```

## 五、回收

- 参考图落地后：归档至 `docs/research/`（或 `docs/architecture/` 附分析），供逆向修正与后续召回；
- 本文件随生成流程完结后归档或合并入研究笔记。
