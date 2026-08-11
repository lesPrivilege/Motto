# PACK-MOTTO-3 验收报告 — 多级 Markdown 标题视觉投影（H3–H6 → `## › 标题`）

- 日期：2026-08-09（首版）+ 2026-08-09（纠偏重做）
- 验收方式：单元测试（22 项新增,含真实 pi-tui renderer 输出级断言）+ 真实 pi TUI dogfood（tmux 嵌套 pty）+ **用户真实 Motto/Ghostty TUI 目验终验（通过）** + canonical session 检查 + 全量回归 + governance
- 结论：**ACCEPTED**（MD-HEAD-3TIER-1,2026-08-09 用户目验通过）

## 状态

```text
MD-HEAD-3TIER-1
IMPLEMENTED                    ✅（H3–H6 → `## › 原标题`,仅 interactive assistant final）
OFFLINE_VERIFIED               ✅（22 项单测全绿,含真实 renderer 输出级断言 + typecheck + 全量回归 + governance）
PI_TUI_RUNTIME_DOGFOODED       ✅（真实 pi TUI:H3–H6 统一 `› 标题`;fenced code 守卫;canonical 零改动）
USER_VISUAL_ACCEPTANCE         ✅（2026-08-09 用户于真实 Motto/Ghostty TUI 目验通过,截图确认）
REMOTE_SYNCED                  ✅（本 commit 已推送,见 §8）
```

## 0.5 行为范围定本（最终）

1. H3–H6 仅在 interactive assistant final 的 TUI display 层投影为 `## › 标题`;canonical
   Markdown 的真实 heading depth 不变(原 `###`/`######` 逐字保留于正文)。
2. user、thinking、streaming 一律原样;非 interactive 输出(print/json)不经过。
3. fenced code / indented code 等保护边界不变(代码块内标题原样)。
4. blockquote 前缀 heading 已覆盖(`> ###` → `> ## ›`);**list 内嵌套标题(`- ### x`)为当前范围外**,
   原样不做(须递归解析,超出最小面)。
5. 回退 PACK-MOTTO-3 只撤销本 display-only 投影(注册 + headings.ts + 测试 + 文档),不撤销:
   原生 H1–H6 renderer 能力、三套主题 `mdHeading: "dim"`、PACK-THEMES-2、FLOW 及其他既有能力。

## 0. 首版错误与纠偏（不改史、注补史）

首版实现把规则误读为「H4–H6 钳制为 H3（保留 `###` 前缀）」,真实 TUI dogfood 截图证明
transformer 已加载、能识别标题深度、能避开 fenced code、只改 TUI 投影——**接缝链路全部打通,
但投影规格被改写**:

| 项目 | 首版实现（错误） | 纠偏后（本报告） |
|---|---|---|
| H3 | 保留 `### 三级标题` | `## › 三级标题` |
| H4–H6 | 钳制为 `### 标题` | `## › 标题` |
| 最终 TUI | 仍有一排 `#` | 无标题井号 |

**纠偏内容**（窄改动,不扩大工程范围）:
- 投影规则:`depth >= 3 → ## › 原标题`（替换原 `depth >= 4 → clamp to 3`）。
- 函数更名 `collapseSubHeadings` → `projectDeepHeadings`(避免「压到 H3」的误导语义)。
- 调用条件收紧:仅 `messageType === "assistant" && !isStreaming`(interactive assistant final);
  user / thinking / streaming 一律原样。
- 其余边界不变:fenced code / indented code 守卫、blockquote 前缀处理、list 嵌套不动、
  CRLF 保留、幂等、fail-open、单一 transformer 注册、零新依赖、零 harness/主题改动。

## 1. 测试环境

- OS / 架构：macOS 26.5.2（arm64）
- Pi/Motto 版本：`@earendil-works/pi-coding-agent` 0.84.1（锁定）
- 固定运行时：无外部二进制（纯函数,零新增依赖）
- 承载进程：真实 pi TUI（tmux 嵌套 pty,fresh 自动发现 motto 扩展）+ 本地 node --test

## 2. 架构边界

```
消息正文(canonical, 零改动)
  → pi interactive 组件(assistant-message)经 createMarkdownTransform
      → motto 扩展 registerMarkdownTransformer(projectDeepHeadings)   ← 唯一接入点
          → H3–H6 行投影为 `## › 原标题`,代码块/非 heading/缩进代码原样
  → pi-tui Markdown 组件(marked + 原生 renderer)渲染
```

- 仅经 pi 0.84.1 公开 `ExtensionAPI.registerMarkdownTransformer`(dist types.d.ts:920);
  全扩展集内唯一 transformer(无其他阶段被覆盖)。
- 纯 display-only:session / 模型上下文 / resume·fork 数据 / print·json 均不经过、零改动。
- 基线能力保留:H1 bold+underline(无前缀)、H2 bold(无前缀)、三主题 `mdHeading: "dim"`
  (PACK-THEMES-2 定本)一字未动;FLOW-FENCED-BLOCKS-1 回退保留不变。
- 撤销边界:若最终目验仍失败,只撤销本 display-only 投影(注册 + headings.ts + 测试 + 文档),
  不得连带回退已恢复的多级标题原生能力、`mdHeading: "dim"` 或 PACK-THEMES-2 定本。

## 3. 验收项（逐项）

| 项 | 结果 | 证据 |
|---|---|---|
| `###` → `## › 标题`(H3 投影) | PASS | `headings.test.mjs` |
| `####` → `## › 标题`(H4) | PASS | 同上 |
| `#####` → `## › 标题`(H5) | PASS | 同上 |
| `######` → `## › 标题`(H6) | PASS | 同上 |
| H1 / H2 逐字不动 | PASS | 同上 |
| 前导 ≤3 空格 H3 投影、空格保留;4+ 空格(缩进代码)不动 | PASS | 同上 |
| `###foo` 无空白分隔非 heading,不动;7+ `#` 非 heading,不动 | PASS | 同上 |
| 纯 `#` 串空 heading:3–6 投影,1–2 与 7+ 原样 | PASS | 同上 |
| 反引号 / 波浪号 / 4 反引号 fenced 块内 `###`–`######` 行不动 | PASS | 同上 |
| 带 info string 与缩进的 fenced 块内不动 | PASS | 同上 |
| fence 闭合后正文标题仍投影 | PASS | 同上 |
| blockquote 前缀 `> ###` 投影;`> > #####` 嵌套投影(非递归) | PASS | 同上 |
| blockquote fenced 块内不动;list 嵌套标题不动 | PASS | 同上 |
| closing sequence(`### 标题 ###`)保持可解析 | PASS | 同上 |
| heading 内 inline code/link/emphasis 保留 | PASS | 同上 |
| CRLF 不破坏正文 | PASS | 同上 |
| 幂等(重跑不变) | PASS | 同上 |
| user / thinking / 流式中完全不变 | PASS | 同上 |
| fail-open(非字符串 / 空串 / 无标题文档) | PASS | 同上 |
| **真实 pi-tui renderer 输出级断言** | PASS | 见 §4 |
| 真实 TUI dogfood:H3–H6 统一 `› 标题`,无标题井号 | PASS | 见 §5 |
| canonical session 保留原始 `###`/`######` | PASS | 见 §6 |
| 全 pack 回归 + governance + drift 无回归 | PASS | `scripts/regression.sh` 11/11;`ci-checks.sh governance` PASS |
| 无新依赖 / 无 Pi core / 无主题改动 / 单一 transformer | PASS | package.json 未动;diff 仅 motto pack 展示层 + 文档 |

## 4. 真实 pi-tui renderer 输出级断言

直接实例化 `@earendil-works/pi-tui` 的 `Markdown` 组件(与 chat 区同一渲染器),断言最终渲染文本:

- 输入 `### 三级标题`(经 `projectDeepHeadings` 投影为 `## › 三级标题`)→ 渲染文本
  **包含** `› 三级标题` 且 **不包含** `### 三级标题`。
- 对照:原生 `### 三级标题`(未投影)渲染确实保留 `### 三级标题` 前缀——证明断言有区分度。
- 对照:`# 一级标题` / `## 二级标题` 原生渲染无井号前缀。

## 5. 真实 TUI dogfood（重跑）

- 启动方式:`deploy.sh motto` 部署后,在临时目录以 tmux 嵌套 pty 启动真实 `pi` TUI
  (锁定 0.84.1,motto 扩展自动发现加载,牌记 extensions 列表含 motto)。
- 输入 A(H1–H6 六档):主模型按要求输出六行真实 markdown 标题 →
  渲染结果 `一级标题`(H1,无前缀)/ `二级标题`(H2,无前缀)/ `› 三级标题` /
  `› 四级标题` / `› 五级标题` / `› 六级标题`(H3–H6 统一 `› 标题`,无标题井号)。
- 输入 B(fenced code 守卫):主模型输出 ```python 围栏,内含 `#### 这是一行注释` 与
  `###### 这是另一行注释`,围栏外一个 `### 标题` → 代码块内两行逐字不动,围栏外投影为
  `› 标题`。流式期无投影(按设计原样),完成后才收敛。
- 现有 theme / review-flow / 表格 / 列表 / 代码高亮未见回归(同屏目视)。

### 5.1 用户真实 Motto/Ghostty TUI 目验终验（2026-08-09）

用户在真实 Motto/Ghostty TUI 完成视觉终验,截图确认:

- H1:无前缀,bold + underline。
- H2:无前缀,bold。
- H3–H6:统一显示为 `› 标题`,不显示标题井号。
- fenced code 内 `####` / `######` 逐字保持。
- 围栏外深层标题投影为 `› 标题`。
- 整体视觉符合预定的 chatbot 三层标题体验。

**结论:真实 TUI 视觉终验通过。**（注:截图内旧规格文字系 reload 所致的历史会话残留,非当前实现;当前规范表述以本报告 §0.5 与 §4/§5 为准。）

## 6. Canonical content 检查

- 检查真实 session jsonl:`message.content` 中 assistant text 块逐字节为
  `# 一级标题\n## 二级标题\n### 三级标题\n#### 四级标题\n##### 五级标题\n###### 六级标题`——
  原始 `###`/`####`/`#####`/`######` 完整保留,无投影痕迹。
- print/json 输出不经过 markdown transform(pi core 仅 interactive 组件消费),无投影。

## 7. 已发现问题

首版投影规则错误(H4–H6→H3,保留 `###`),已按纠偏口径重做,见 §0。当前实现无未决缺陷;
记录边界(非缺陷):list 内嵌套标题(`- ### x`)原样不做,须递归解析超出最小面;
blockquote fence 若以异前缀闭合属罕见角落,最坏情形为少投影(under-application,fail-safe)。

## 8. 最终状态

- 2026-08-09 用户真实 Motto/Ghostty TUI 目验**通过** → 本报告记 ACCEPTED。
- 本 commit 含全部 PACK-MOTTO-3 文件(实现 + 测试 + 文档),已按仓内既有流程推送
  `agent/ship-gemini-vision`(commit subject 见本报告末「提交」;HEAD == origin)。
- 撤销边界:回退本 commit 即恢复任务开始前的原生标题基线(Pi 原生 H1–H6 渲染),
  不影响 PACK-THEMES-2 三主题 `mdHeading: "dim"` 定本与 FLOW 及其他既有能力。

## 附:目验口径(已由用户核对通过)

```text
H1:原生 bold + underline(无井号)
H2:原生 bold(无井号)
H3–H6:统一显示为 `› 标题`,不得出现标题井号
fenced code:井号逐字保持
canonical/session:逐字保持
```

## 提交

- 单一可回退 commit,仅含 PACK-MOTTO-3 文件(实现 + 测试 + 文档,见本报告范围)。
- subject 依仓内既有体例:`motto: 多级标题视觉投影——H3–H6 投影为 ## › 标题 (MD-HEAD-3TIER-1)`。
