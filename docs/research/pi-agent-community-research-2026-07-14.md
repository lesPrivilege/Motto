# Pi Coding Agent：社区用法与 Extension 生态调研

> 调研日期：2026-07-14  
> 范围：官方文档 / monorepo 源码架构 / package catalog / X 社区分享 / 代表性 extension 实现逻辑  
> 定位对象：Pi coding agent（最小 agent harness），非其它同名项目

---

## 0. 一句话结论

**Pi 是 Mario Zechner（@badlogicgames）主导、现归属 Earendil Works 的「最小核心 + 激进可扩展」终端 coding agent。**  
核心只有极短 system prompt 与少量内置工具（默认 `read` / `write` / `edit` / `bash`），**故意不内置** MCP、sub-agent、plan mode、permission popup、todo、background bash。  
社区与官方的共识是：**需要的能力用 TypeScript extension / skill / package 补，或直接让 Pi 写一个给自己用。**  
官方分发：`pi.dev` + npm `@earendil-works/pi-coding-agent`；包市场：`https://pi.dev/packages`；Discord：`https://discord.com/invite/nKXTsAcmbT`；非官方 Reddit：`r/PiCodingAgent`。

---

## 1. 是什么、从哪来

### 1.1 项目身份

| 项 | 现状 |
|---|---|
| 官网 | https://pi.dev |
| 主仓库 | https://github.com/earendil-works/pi |
| 旧仓库 | `badlogic/pi-mono`（已迁移） |
| CLI 包 | `@earendil-works/pi-coding-agent` |
| 作者 | Mario Zechner（badlogic） |
| 组织迁移 | 2026-05 迁入 Earendil Works（`@earendil-works/*` scope） |
| 许可证 | MIT |
| 典型定位 | Claude Code / Codex 类 harness 的「最小可塑」替代品 |
| 下游集成 | OpenClaw 等以 Pi 为 agent harness 内核 |

### 1.2 Monorepo 包结构

| Package | 职责 |
|---|---|
| `@earendil-works/pi-ai` | 多 provider 统一 LLM API、流式、tool calling、跨 provider context handoff、token/cost |
| `@earendil-works/pi-agent-core` | Agent loop：工具执行、状态、事件、message queue |
| `@earendil-works/pi-tui` | Retained-mode 终端 UI + 差分渲染（differential rendering） |
| `@earendil-works/pi-coding-agent` | 交互式 CLI：session、extension、skill、package、TUI 接线 |

### 1.3 哲学（社区与作者反复强调）

来源：Mario 长文 *What I learned building an opinionated and minimal coding agent*（2025-11-30）、Armin Ronacher *Pi: The Minimal Agent Within OpenClaw*（2026-01-31）、官网与 README。

1. **Context engineering 优先**  
   默认 system prompt 极短（连工具定义合计约 <1000 tokens 量级），避免 harness 在背后注入不可见上下文。

2. **Primitives, not features**  
   不把 sub-agent / plan / MCP 写死进 core；用 extension 做「插件式 DAW/VST」式扩展。

3. **YOLO by default**  
   默认无权限弹窗；安全边界建议用 container / sandbox extension（Gondolin、Docker、OpenShell、landstrip 等），而不是虚假的命令审核。

4. **Agent builds agent**  
   鼓励把官方/他人 extension 指给 Pi：「照这个写，但改成我的 workflow」；热重载 `/reload` 支持边写边试。

5. **可观测性**  
   Session 是 JSONL 树结构，可 `/tree` 分支、`/export`、`/share`；对比 Claude Code sub-agent 黑盒，Pi 社区更强调可见。

---

## 2. 安装与基本用法

### 2.1 安装

```bash
# npm（推荐忽略 lifecycle scripts）
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

# 官方 install script
curl -fsSL https://pi.dev/install.sh | sh
```

认证：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
# 或交互 /login（Claude Pro/Max、Codex、Copilot 等 OAuth）
```

### 2.2 四种运行模式

| 模式 | 用法 | 场景 |
|---|---|---|
| Interactive | `pi` | 日常 TUI |
| Print | `pi -p "query"` | 脚本、一次性 |
| JSON event stream | `pi --mode json` | 管道/观测 |
| RPC | `pi --mode rpc` | 非 Node 宿主、OpenClaw 类集成 |
| SDK | `createAgentSession(...)` | 嵌入自有应用 |

### 2.3 内置工具与裁剪

默认工具：`read`、`write`、`edit`、`bash`（另有只读工具 `grep`/`find`/`ls` 可按需开启）。

```bash
# 只读规划
pi --tools read,grep,find,ls

# 禁用全部内置工具，只留 extension 工具
pi --no-builtin-tools

# 排除某个工具
pi --exclude-tools ask_question
```

### 2.4 关键交互习惯（社区高频）

| 操作 | 说明 |
|---|---|
| `Enter`（agent 运行中） | Steering：当前 tool 后打断后续 tools |
| `Alt+Enter` | Follow-up：等 agent 全部做完再投递 |
| `!cmd` / `!!cmd` | 用户 bash（是否进 LLM context 不同） |
| `@file` | 模糊引用文件 |
| `Ctrl+L` / `Ctrl+P` | 模型选择 / 收藏模型循环 |
| `/tree` | Session 树导航、分支 |
| `/compact` | 上下文压缩 |
| `/reload` | 热重载 extensions/skills/prompts/themes/context |
| `/share` | 上传 gist 得可分享 HTML session |
| `AGENTS.md` | 全局 + 目录向上 + 项目 级指令 |
| `SYSTEM.md` / `APPEND_SYSTEM.md` | 替换或追加 system prompt |

### 2.5 配置目录

| 路径 | 用途 |
|---|---|
| `~/.pi/agent/` | 用户全局（settings、extensions、skills、sessions、npm/git 包） |
| `.pi/` | 项目本地（需 project trust 后才加载） |
| `~/.pi/agent/settings.json` | 全局设置 + packages 列表 |
| `~/.pi/agent/trust.json` | 项目信任记录 |

环境变量：`PI_CODING_AGENT_DIR`、`PI_OFFLINE`、`PI_SKIP_VERSION_CHECK`、`PI_TELEMETRY` 等。

### 2.6 Project Trust

交互启动时，若项目有 `.pi` 或 project skills 且无信任记录，会询问是否信任。  
**信任前只加载全局 extension / CLI `-e`**；项目 extension 与 settings 在信任后才加载。  
Extension 可用 `project_trust` 事件接管决策。

---

## 3. Extension 机制（实现逻辑）

### 3.1 本质

Extension = **用 jiti 加载的 TypeScript 模块**，默认导出：

```ts
export default function (pi: ExtensionAPI) { ... }
// 或 async factory：await 完成后再继续 startup
```

可做：

- `pi.registerTool` — 给 LLM 可调用工具
- `pi.registerCommand` — `/xxx` 命令
- `pi.registerShortcut` — 快捷键
- `pi.registerFlag` — CLI 标志
- `pi.on(event, handler)` — 生命周期钩子（可拦截 tool_call、改 context、改 provider payload…）
- `pi.sendMessage` / `pi.sendUserMessage` — 注入消息
- `pi.appendEntry` — 持久化 **不进 LLM context** 的 session 自定义条目
- `ctx.ui.*` — confirm/select/input/notify/setStatus/setWidget/custom TUI

### 3.2 放置位置与加载

| 位置 | 范围 |
|---|---|
| `~/.pi/agent/extensions/*.ts` | 全局 |
| `~/.pi/agent/extensions/*/index.ts` | 全局多文件 |
| `.pi/extensions/*` | 项目（需 trust） |
| `settings.json` 的 `packages` / `extensions` | npm/git/本地路径 |
| `pi -e ./path.ts` | 临时试跑（不适合 /reload 常态） |

**安全模型（重要）**：  
官方明确：**extension 以用户权限执行任意代码**。安装第三方包前应审源码。Core 不提供细粒度 sandbox；沙箱是 extension 或 container 的事。

### 3.3 生命周期事件（理解社区 extension 的钥匙）

```
project_trust
session_start → resources_discover
  user prompt
    input（可 transform/handled）
    before_agent_start（可改 systemPrompt / 注入 message）
    agent_start
    turn_start
      context（可改 messages）
      before_provider_headers / before_provider_request / after_provider_response
      tool_execution_start → tool_call（可 block / 改 input）
        → tool_result（可改输出）→ tool_execution_end
    turn_end
    agent_end → agent_settled
session_before_compact / session_compact
session_shutdown
```

官方示例 `permission-gate.ts` 的核心模式（社区几乎所有「安全/拦截」类 extension 都长这样）：

```ts
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName !== "bash") return;
  if (dangerous(event.input.command)) {
    if (!ctx.hasUI) return { block: true, reason: "..." };
    const choice = await ctx.ui.select("Allow?", ["Yes", "No"]);
    if (choice !== "Yes") return { block: true, reason: "Blocked by user" };
  }
});
```

### 3.4 状态与 Session

- Session 存 **JSONL 树**（`id` + `parentId`），支持分支而不复制文件。
- Extension 用 `pi.appendEntry(customType, data)` 写自定义条目；`session_start` 时遍历 `getEntries()` 恢复。
- Custom **message**（`sendMessage`）会进 LLM context；custom **entry** 默认不进。
- 可 `registerEntryRenderer` / `registerMessageRenderer` 做 TUI 渲染。

### 3.5 Package 分发

```bash
pi install npm:pi-web-access
pi install npm:@foo/bar@1.2.3   # 钉版本，update 跳过
pi install git:github.com/user/repo@v1
pi install -l npm:...           # 项目本地
pi list / pi update --extensions / pi config / pi remove ...
```

`package.json`：

```json
{
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

peer：`@earendil-works/pi-coding-agent`、`pi-ai`、`pi-tui`、`typebox` 等；runtime deps 放 `dependencies`（install 用 production install）。

Gallery：https://pi.dev/packages（按 downloads 排序，类型 extension/skill/theme/prompt）。

### 3.6 官方 examples（建议直接读）

仓库路径：`packages/coding-agent/examples/extensions/`

常见示例：`permission-gate.ts`、`protected-paths.ts`、`ssh.ts`、`sandbox/`、`subagent/`、`plan-mode/`、`custom-compaction.ts`、`dynamic-tools.ts`、`snake.ts`（以及著名的 Doom extension 演示）。

---

## 4. 社区 Extension 生态全景

### 4.1 发现渠道

| 渠道 | 说明 |
|---|---|
| https://pi.dev/packages | 官方 gallery，按下载量/新发布 |
| Discord | 官方社区讨论与分享 |
| X / Twitter | Mario、Nico Bailon（早期 core contributor）、Jeffrey Emanuel 等 |
| GitHub topics / 个人 repo | 大量 `pi-*` 包 |
| `qualisero/awesome-pi-agent` | 曾汇总生态，**2026-06 已 archive**（过时，被 gallery 取代） |
| Reddit `r/PiCodingAgent` | 非官方讨论、vim/VS Code 集成帖 |
| HuggingFace + `pi-share-hf` | 分享真实 coding session 轨迹 |

### 4.2 下载量靠前的包（Gallery 快照，2026-07-14）

> 单位约「/mo」为 gallery 展示；数字会变，作相对热度参考。

| 包 | 约 downloads/mo | 类型 | 作用 |
|---|---:|---|---|
| `@hypabolic/pi-hypa` | 198.9K | package | 压缩嘈杂 tool output，护 context |
| `pi-web-access` | 138.9K | extension | 搜索 / 抓取 / GitHub clone / YouTube / PDF / 视频理解 |
| `pi-mcp-adapter` | 124.5K | extension | 懒加载 MCP 代理，省 context |
| `context-mode` | 116.7K | package | 跨 harness 的 context 节省插件 |
| `pi-subagents` | 111.2K | package | 子代理编排（Nico 主流方案） |
| `@tintinweb/pi-subagents` | 38.6K | extension | Claude Code 风格 sub-agent 另一实现 |
| `@juicesharp/rpiv-ask-user-question` | 32.3K | extension | 结构化提问 |
| `pi-lens` | 29.6K | extension | LSP/linter/typecheck 实时反馈 |
| `@plannotator/pi-extension` | 28.9K | package | 计划注解/PR review UI |
| `@juicesharp/rpiv-todo` | 28.1K | extension | 持久 todo overlay |
| `@gotgenes/pi-permission-system` | 23.6K | extension | allow/ask/deny 权限层 |
| `@ff-labs/pi-fff` | 22.6K | extension | 模糊文件/内容搜索 |
| `pi-hermes-memory` | 15.3K | ext+skill | 持久记忆 + FTS5 + 密钥扫描 |
| `pi-messenger` | ~9.7K | package | 多 agent 聊天室 + crew 编排 |
| `@ollama/pi-web-search` | 13.5K | extension | Ollama 官方 web search 工具 |
| `pi-agent-browser-native` | 12.4K | extension | agent-browser 原生工具 |
| `pi-landstrip` | 11.6K | extension | Landlock 沙箱 |
| `@braintrust/pi-extension` | 9.7K | package | 会话/工具 tracing |
| `pi-powerline-footer` | ~10K | extension | 状态栏美化 |
| `@ogulcancelik/pi-ssh-tools` | （社区点名） | extension | SSH 到 VPS 用自然语言做 DevOps |

### 4.3 社区「常用组合」心智模型

X / Reddit / 博文里反复出现的装机清单可概括为：

```
核心
  pi-web-access          # 上网
  pi-mcp-adapter         # 需要时接 MCP 生态（代理模式省 token）
  pi-subagents           # 委托 / 并行 review / chain

上下文与质量
  @hypabolic/pi-hypa 或 pi-lean-ctx / context-mode
  pi-lens                # 静态反馈回灌

安全
  @gotgenes/pi-permission-system
  pi-landstrip / container / Gondolin

工作流 UI
  rpiv-todo + rpiv-ask-user-question
  plannotator / pi-soly / pi-task

多 agent
  pi-messenger 或 pi-subagents 的 chain/parallel
```

Armin 路线则更「少下载、多自建」：自写 `/answer`、`/todos`、`/review`，用 skill 代替 MCP，用 CDP skill 代替 browser MCP。

### 4.4 社区人物与代表分享

| 人 | 角色 | 贡献 |
|---|---|---|
| Mario Zechner | 作者 | 核心、哲学、`pi-share-hf`、HF 公开 session |
| Nico Bailon | early core contributor | `pi-web-access`、`pi-subagents`、`pi-mcp-adapter`、`pi-messenger`、`pi-powerline-footer`… |
| Armin Ronacher | 重度用户 + 布道 | OpenClaw 语境下解释 Pi；发布自用 extension 集 |
| Jeffrey Emanuel | `pi_agent_rust` | Rust 重写，声称兼容大量 extension + 更强安全宿主边界 |
| juicesharp | `rpiv-*` | todo / ask-user 等 overlay 交互范式 |
| gotgenes | permission + subagents fork | 权限策略层与 subagent 组合 |

---

## 5. 关键 Extension 实现解剖

### 5.1 `pi-web-access`（Nico）— 能力补全型

**安装**：`pi install npm:pi-web-access`  
**Repo**：https://github.com/nicobailon/pi-web-access  

**解决什么**：Core 故意不提供 web search/fetch；该扩展补上搜索、抓取、GitHub 克隆、PDF、YouTube/本地视频理解。

**实现要点（来自 README 与文件表）**：

| 模块 | 逻辑 |
|---|---|
| `index.ts` | 注册 tools/commands/widget/shortcuts |
| Provider 链 | OpenAI search → Exa（API 或 MCP 免 key）→ Brave/Parallel/Tavily/Perplexity/Gemini… |
| `fetch_content` 路由 | 视频 / GitHub / YouTube / PDF / HTML(Readability→RSC→Jina→Gemini) |
| Curator UX | `Ctrl+S`（可配置）中断搜索，人工筛选再注入 conversation |
| Storage | 长内容截断进 tool result，全文可 `get_search_content` 再取 |
| Config | `~/.pi/web-search.json` |

**钩子用法**：标准 `registerTool` + 可选 UI curator server；是「给模型新能力」范式的代表。

### 5.2 `pi-mcp-adapter`（Nico）— 哲学妥协型

**安装**：`pi install npm:pi-mcp-adapter`  
**Repo**：https://github.com/nicobailon/pi-mcp-adapter  

**解决什么**：Mario 反对把 MCP 工具 schema 全塞 system prompt；adapter 用 **单个 `mcp` 代理工具（~200 tokens）** + 懒连接 + 磁盘 metadata 缓存。

**实现要点**：

1. 读标准 MCP 配置：`~/.config/mcp/mcp.json`、`.mcp.json`，及 Pi 覆盖 `~/.pi/agent/mcp.json` / `.pi/mcp.json`。
2. Lifecycle：`lazy`（默认）/ `eager` / `keep-alive`；idle 超时断开。
3. 调用路径：`search` → `describe` → `tool`（args 为 JSON 字符串）。
4. `directTools`：把少量高频工具提升为真正的 Pi tools（每个 ~150–300 tokens）。
5. Output guard：对齐 bash 的截断策略，防 MCP 结果炸掉 context/session 文件。
6. 与 `pi-subagents` 集成：子 agent frontmatter 里 `mcp:server-name` 可直接声明工具。

**与官方哲学关系**：Core 仍「无 MCP」；社区用 extension 把 MCP 变成可选、按需的。

### 5.3 `pi-subagents`（Nico）— 编排型

**安装**：`pi install npm:pi-subagents`  
**Repo**：https://github.com/nicobailon/pi-subagents  

**解决什么**：Core 不内置 sub-agent；该包用 **子进程 Pi session** 做委托。

**实现逻辑概要**：

1. **Builtin agents**（markdown + YAML frontmatter）：`scout` / `researcher` / `planner` / `worker` / `reviewer` / `oracle` / `context-builder` / `delegate`。
2. **执行模型**：
   - 单 agent：`/run reviewer "…"`
   - 并行：`/parallel …`
   - 链式：`/chain a -> b -> c`，支持 `(a|b)` 组内并行
   - 动态 fanout：`.chain.json` + structured_output
   - 后台：`--bg` + `wait` tool（非交互 `-p` 必须 wait，否则子任务被丢弃）
3. **上下文策略**：默认窄上下文；`systemPromptMode`、`inheritProjectContext`、`context: fork|fresh` 可配。
4. **安全边界**：
   - 子会话默认 **不** 带 `subagent` 工具（除非 frontmatter 显式允许）
   - 过滤父会话 orchestration 痕迹
   - `maxSubagentDepth`
   - 可与 `@gotgenes/pi-permission-system` 叠两层：visibility（tools 列表）+ policy（allow/ask/deny）
5. **观测**：`status.json` / `events.jsonl` / fleet 视图；in-process event-bus RPC `subagents:rpc:v1:*` 供其它 extension 调用。
6. **Watchdog**：可选 `agent_end` 后对抗式 diff review + 可选 TS LSP diagnostics。

这是目前社区 **最完整的 multi-agent 方案之一**，也是「官方不内置 → 社区做成 package」的典型。

### 5.4 `pi-messenger`（Nico）— 多终端协作型

**安装**：`pi install npm:pi-messenger`  

**实现逻辑（README 明确点出 hook）**：

| Hook | 用途 |
|---|---|
| `tool_call` / `tool_result` | 追踪 edit/commit/test 写入 activity feed |
| `tool_call` 对 write/edit | 文件 reservation → `{ block: true }` |
| `session_start` / `session_shutdown` | 注册/清理 mesh |
| `agent_end` | 驱动 crew 下一波 ready tasks |
| `pi.sendMessage({ deliverAs: "steer", triggerTurn: true })` | 唤醒收信 agent |
| `ctx.ui.custom` + `setStatus` | chat overlay / 状态栏 |

**状态存储**：无 daemon，纯文件  
- 全局 mesh：`~/.pi/agent/messenger/`  
- 项目：`.pi/messenger/`（crew 计划与任务）

**Crew**：PRD → 依赖图 → 并行 wave；worker 是 `pi --mode json` 子进程，流式 JSONL 更新 progress。

### 5.5 官方 `permission-gate` — 最小可抄模板

路径：`packages/coding-agent/examples/extensions/permission-gate.ts`  

约 40 行：regex 匹配危险 bash → UI confirm / 无 UI 则 block。  
社区权限系统（gotgenes）是这一模式的「策略引擎化」升级版。

### 5.6 Armin 自用扩展集（设计参考，非 npm 热门）

Repo：https://github.com/mitsuhiko/agent-stuff  

| Extension | 思路 |
|---|---|
| `/answer` | 从 assistant 最后回复抽问题 → 结构化输入框（反对模型侧 question tool） |
| `/todos` | `.pi/todos` markdown，人机共改 |
| `/review` | 用 session 树 fork 出 review 分支（可观测） |
| `/control` | 简单 agent→agent 发 prompt 实验 |
| `/files` | session 内变更文件清单 + Finder/VS Code 联动 |

核心主张：**skill + 自建 extension > 下载黑盒**；浏览器用 CDP skill 而非 MCP。

### 5.7 其它值得顺藤摸瓜的实现

| 项目 | 看点 |
|---|---|
| `@gotgenes/pi-permission-system` | 策略层 + 子进程 ask 回传父 UI |
| `pi-share-hf` (badlogic) | Session → HF dataset；三层 PII 防护（用 agent 扫敏感信息，可能很耗 token） |
| `pi_agent_rust` (Dicklesworthstone) | 用 QuickJS + hostcall ABI 跑 JS extension；能力门控/配额/审计；声称兼容 224 extensions |
| `sdougbrown/pi-agents` | named agent profiles |
| `jayshah5696/pi-agent-extensions` | 早期扩展合集（sessions/ask_user/handoff） |
| Damocles（Reddit） | VS Code 侧 Pi 集成（社区周边） |

---

## 6. 源码层架构（顺藤摸瓜结论）

### 6.1 Core 分层

```
pi CLI (coding-agent)
  ├─ ResourceLoader：发现 extensions / skills / prompts / themes / packages
  ├─ Extension runtime：jiti 加载 TS → 调用 default export(ExtensionAPI)
  ├─ AgentSession：会话树、compaction、消息投递（steer/followUp）
  ├─ Tools：builtin + extension tools 合并为 active tool set
  └─ TUI / RPC / print 适配
       ↑
pi-agent-core：agent loop + events
       ↑
pi-ai：provider 适配 + stream + tool schema(TypeBox)
```

### 6.2 为何 extension 能做到「像改 core」

1. **事件几乎覆盖全链路**（含 `before_provider_request` 改 payload、`context` 改 messages）。
2. **工具可注册/可动态启用**（`setActiveTools`、运行时 `registerTool`）。
3. **Session 自定义 entry** 让 extension 有持久状态而不污染 LLM。
4. **UI 可编程**（`ctx.ui.custom`）→ curator、todo overlay、messenger chat、Doom 都成立。
5. **`/reload` + 自文档化**：agent 可读自己的 docs/examples 写 extension。

### 6.3 明确不在 core 的东西（官方 README 列表）

- No MCP  
- No sub-agents  
- No permission popups  
- No plan mode  
- No built-in todos  
- No background bash（用 tmux）  

社区用 package 把这些「全部补回来」——这是生态繁荣的结构性原因，也是学习成本来源。

---

## 7. 社区讨论中的用法模式（提炼）

### 7.1 「最小 Pi」党

- 只装 0–2 个 extension  
- 大量 skill + AGENTS.md  
- 需要时让 Pi 当场写 extension  
- 代表：Armin 文中实践  

### 7.2 「Claude Code 能力补齐」党

```bash
pi install npm:pi-web-access
pi install npm:pi-mcp-adapter
pi install npm:pi-subagents
pi install npm:@gotgenes/pi-permission-system
pi install npm:@juicesharp/rpiv-todo
pi install npm:@juicesharp/rpiv-ask-user-question
```

然后自然语言：  
*“Use reviewer to review this diff”* / *“Run parallel reviewers for correctness, tests, complexity”*。

### 7.3 「多 agent 工厂」党

- `pi-subagents` chain + worktree  
- 或 `pi-messenger` crew（PRD → waves）  
- 或 `pi-dynamic-workflows` 一类大编排包  
- 注意：token 成本高，社区建议 worker 用小模型  

### 7.4 「Context 抠门」党

- `pi-hypa` / `lean-ctx` / `context-mode`  
- MCP 坚持 proxy 模式，避免 directTools 爆炸  
- 自定义 compaction extension  

### 7.5 Session 开源数据

- Mario 推动用 `pi-share-hf` 把 OSS coding session 发到 HuggingFace  
- 数据集示例：`badlogicgames/pi-mono`  
- 目的：真实轨迹训练/评估 agent，而非 toy benchmark  

---

## 8. 自己写 Extension 的最短路径

```bash
# 1. 骨架
mkdir -p ~/.pi/agent/extensions
cat > ~/.pi/agent/extensions/hello.ts <<'EOF'
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}`, "info");
    },
  });

  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone",
    parameters: Type.Object({ name: Type.String() }),
    async execute(_id, params) {
      return { content: [{ type: "text", text: `Hello, ${params.name}!` }] };
    },
  });
}
EOF

# 2. 启动或 /reload
pi
# 或
pi -e ~/.pi/agent/extensions/hello.ts

# 3. 发布
# package.json keywords: ["pi-package"], pi.extensions: [...]
# npm publish → pi install npm:your-pkg
```

进阶：直接对 Pi 说  
「读 `packages/coding-agent/docs/extensions.md` 和 `examples/extensions/permission-gate.ts`，写一个拦截 `git push --force` 的 extension」——这是社区最推荐的扩展方式。

---

## 9. 风险与注意点

1. **第三方 extension = 任意代码执行**。先读源码再 `pi install`。  
2. **`pi-share-hf` 的 PII 扫描会烧 token**，且无法 100% 防泄漏。  
3. **Subagent / Crew 成本**：并行 worker 可快速消耗配额；务必设模型分层。  
4. **项目 trust**：不要对不信任仓库开 `always`。  
5. **package 生命周期**：生产依赖必须在 `dependencies`，否则 install 后运行缺模块。  
6. **命名/迁移**：旧 scope `@mariozechner/*` / `badlogic/pi-mono` 文档仍可能残留；以 `earendil-works` 与 `pi.dev` 为准。  
7. **awesome-pi-agent 已过时**；以 gallery + Discord 为准。

---

## 10. 推荐阅读清单（按优先级）

| 资源 | URL |
|---|---|
| 官网 | https://pi.dev |
| 文档首页 | https://pi.dev/docs/latest |
| Extensions 完整 API | https://pi.dev/docs/latest/extensions |
| Packages | https://pi.dev/docs/latest/packages |
| Package Catalog | https://pi.dev/packages |
| 主仓库 README | https://github.com/earendil-works/pi |
| coding-agent README | https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md |
| Mario 设计长文 | https://mariozechner.at/posts/2025-11-30-pi-coding-agent/ |
| Why no MCP | https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/ |
| Armin 使用心得 | https://lucumr.pocoo.org/2026/1/31/pi/ |
| Earendil 迁移公告 | https://pi.dev/news/2026/5/7/pi-has-a-new-home |
| pi-web-access | https://github.com/nicobailon/pi-web-access |
| pi-subagents | https://github.com/nicobailon/pi-subagents |
| pi-mcp-adapter | https://github.com/nicobailon/pi-mcp-adapter |
| pi-messenger | https://github.com/nicobailon/pi-messenger |
| pi-share-hf | https://github.com/badlogic/pi-share-hf |
| pi_agent_rust | https://github.com/Dicklesworthstone/pi_agent_rust |
| Armin agent-stuff | https://github.com/mitsuhiko/agent-stuff |
| OpenClaw | https://github.com/OpenClaw/OpenClaw |
| Discord | https://discord.com/invite/nKXTsAcmbT |
| Reddit | https://www.reddit.com/r/PiCodingAgent/ |

---

## 11. 附录：社区点名 extension 速查（非完整）

```
# 能力
pi-web-access
@ollama/pi-web-search
pi-deepseek-search
pi-agent-browser-native
@ff-labs/pi-fff
pi-shazam / pi-readseek / pi-hashline-edit-pro
pi-lens

# 编排
pi-subagents
@tintinweb/pi-subagents
@gotgenes/pi-subagents
pi-messenger
@quintinshaw/pi-dynamic-workflows
pi-crew
@mjasnikovs/pi-task
@narumitw/pi-goal

# MCP / 权限 / 沙箱
pi-mcp-adapter
@gotgenes/pi-permission-system
pi-landstrip
cc-safety-net

# 交互 UX
@juicesharp/rpiv-todo
@juicesharp/rpiv-ask-user-question
@josephyoung/pi-ask-user-question
@plannotator/pi-extension
pi-powerline-footer
@owlburtoe/pi-cc-tools
pi-btw
@ayulab/pi-rewind

# 记忆 / 上下文
pi-hermes-memory
gentle-engram
@hypabolic/pi-hypa
pi-lean-ctx
context-mode
@remnic/plugin-pi

# 工作流套件
gentle-pi
pi-soly
@nklisch/pi-agile-workflow
bigpowers / superpowers-zh / ponytail

# 分享 / 可观测
pi-share-hf
@braintrust/pi-extension
@raindrop-ai/pi-agent
@d3ara1n/pi-session-namer

# 远程
@ogulcancelik/pi-ssh-tools
pi-telegram-manager
```

---

## 12. 调研方法与局限

**方法**：

- 官网 / docs / monorepo README / packages.md / extensions.md  
- Package Catalog 下载量排序  
- X semantic/keyword 搜索（Mario、Nico 等）  
- Armin / Mario 长文  
- 代表性 extension README 与实现描述（web-access / mcp-adapter / subagents / messenger）  
- 官方 example 源码（permission-gate）  

**局限**：

- Discord 频道正文未完整爬取（gallery 与 X 已覆盖主流分享）  
- Gallery 下载量非安装用户数，仅相对热度  
- 源码级行级分析以文档与公开 README 结构为主；完整 monorepo 未本地 clone  
- 生态更新极快（每周大量新包），本报告以 2026-07-14 为切片  

---

## 13. 若你只想动手：30 分钟路径

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
export ANTHROPIC_API_KEY=...   # 或 pi 内 /login
pi

# 在另一个终端
pi install npm:pi-web-access
pi install npm:pi-subagents

# 回到 pi，/reload 后：
# “Search for how pi extensions register tools, then summarize”
# “Use scout to map this repo, then planner for a small improvement”
```

读完：

1. https://pi.dev/docs/latest/extensions  
2. https://github.com/nicobailon/pi-subagents（README 即百科）  
3. 官方 `examples/extensions/permission-gate.ts`  

即可同时理解 **用法** 与 **实现范式**。

---

*本文件保存路径：`~/Downloads/pi-agent-community-research-2026-07-14.md`*
