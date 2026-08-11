# motto-gemini-vision 验收报告 — PACK-VISION-1（含修订 2：凭据经 pi modelRegistry + 真实 live/runtime 验证）

- 日期：2026-08-08
- 验收方式：静态审计 + 无权限测试（61 项单测/集成，网络全 mock）+ 本地 provider stub E2E + 真实 Google live smoke（PASS）+ 真实 pi -e runtime dogfood（PASS）+ 部署位无回归
- 结论：**SHIPPED（ACCEPTED WITH LIMITATIONS）**（实现完成；离线、provider-stub、真实 provider、真实 Pi runtime、部署后回归均已验证）

## 状态（明确语义，避免误读）

```text
IMPLEMENTATED                      ✅
OFFLINE_VERIFIED                 ✅（61 项测试全绿，fetch 全 mock）
PROVIDER_STUB_E2E_VERIFIED       ✅（本地 HTTP 替身 + 真实工具代码路径）
RUNTIME_LOADING_SMOKE_VERIFIED   ✅（pi -e 无 key：发现/注册/路由/fail-closed/模型消费错误）
LIVE_PROVIDER_VERIFIED           ✅（真实 Google：gemini-3.6-flash，status=completed，回答正确）
PI_RUNTIME_DOGFOODED             ✅（pi -e 真实闭环：主模型自主调用→真实 Gemini→文本结果→继续）
DEPLOYED_AND_REGRESSED           ✅（已入 deploy.sh，部署位与仓库一致，部署后回归通过）
```

## 0. 凭据模型（修订 3：统一真源 + provider bridge）

单一真源 + provider bridge（不做持久副本）：

```text
~/.config/motto/credentials/google      ← 唯一真源，0600
  → ~/.local/bin/motto-credential google  ← 唯一 resolver
  → ~/.local/bin/motto-google-key         ← provider wrapper
  → ~/.pi/agent/models.json google.apiKey = "!motto-google-key"（wrapper 在 PATH；绝对路径为本机配置，不入仓库，迁移由 bootstrap 生成）
  → ctx.modelRegistry.getApiKeyForProvider("google")
```

- 运行时凭据**仅**经 `ctx.modelRegistry.getApiKeyForProvider("google")` 读取（index.ts 传 `env={}`，env 无 key 读取面）。
- **隔离验证（决定性）**：`PI_CODING_AGENT_DIR` 指向空 auth.json 的临时 agent 目录、google 仅经
  models.json `!motto-google-key` 配置 → vision 真实调用 Gemini 成功（返回 Red）→ 证明
  `getApiKeyForProvider` 确会解析 models.json 的 `!` 引用（无 stored credential 时走 ambient 路径）。
- 验证通过后已将 google 从 `~/.pi/agent/auth.json` 移除（备份 /tmp/auth.json.bak）；key 不再存于 auth.json。
- `GEMINI_API_KEY` env 仅保留为独立 live smoke / 测试回退，非运行时配置机制（README 注明）。
- 凭据缺失时抛标准 tool error（fail-closed，fetch 不调用）；未实现 Cookie 注入 / 浏览器代理；
  不扫描 .zshrc / 旧 vendor 路径。

## 1. 测试环境

- OS / 架构：macOS（darwin-arm64），Node v25.9.0（CI 锁定 Node 22，`node --test` + type-stripping 兼容）
- Pi/Motto 版本：`@earendil-works/pi-coding-agent` 0.84.1（与既有 pack 同锁）
- 固定运行时版本 + SHA-256：无外部二进制依赖（纯 fetch + Node 内置模块），故无 checksums
- 权限及承载进程：无系统权限需求；print/RPC/interactive 均不触 UI 路径

## 2. 架构边界

```
文本主模型 → motto_vision 工具调用 → image.ts 加载单图(路径/限额/魔数/base64)
  → gemini.ts 单次无状态 POST /v1/interactions → 纯文本结果 → 主模型继续
```

- 未进入 Pi core；未 fork 上游；未重注册/覆盖任何内置工具；未改 theme。
- 非 subagent：无 agent loop、无 session、无 transcript 继承、无工具、不读仓库上下文、
  不接收主 system prompt、不自动行动。
- 运行时零新增 npm 依赖：`fetch` / `node:fs/promises` / `node:path` / `node:os` /
  `AbortSignal`；仅 `typebox`（schema）与 pi 公开 extension API。
- Gemini API 细节集中在 `gemini.ts` 单文件；endpoint / 默认模型 / timeout / 文件上限集中定义。

## 3. 验收项（逐项 PASS / PARTIAL / FAIL / NOT TESTED）

| 项 | 结果 | 证据（命令 + 关键输出） |
|---|---|---|
| 文本主模型经普通 tool call 查看本地图片 | PASS | `index.ts` registerTool `motto_vision`；execute → `runTool`（与测试同边界） |
| Gemini 仅执行一次无状态 multimodal inference | PASS | request.test.mjs：endpoint 精确 `/v1/interactions`、`store:false`、无 agent/tools/background/stream/sampling、无 previous_interaction_id |
| 主 transcript 只留路径/问题/纯文本结果，无 base64 | PASS | run.test.mjs「details 不含 key/base64」「content 仅 text」；response 侧只拼 text blocks |
| 不存在第二个 agent loop | PASS | 静态审计 §2；无任何 agent/loop/session 代码 |
| 不修改 Pi core | PASS | 仓库 diff 无 core 改动；`git diff --check` 干净 |
| 不使用 Antigravity auth / Pro quota | PASS | 仅 header `x-goog-api-key`；无 OAuth；README 明确 |
| 不新增运行时依赖 | PASS | package.json 仅 `@earendil-works/pi-coding-agent` + `typebox` |
| `store: false` | PASS | request.test.mjs / dogfood.test.mjs 均断言 `store === false` |
| 用户取消与 timeout 均有效且可区分 | PASS | run.test.mjs「abort → /request aborted/；timeout → /timed out after 1s/」 |
| 默认测试离线可跑 | PASS | `node --test test/*.test.mjs` → 61 pass / 0 fail（无外网；provider stub / fetch mock） |
| 真实 harness 发现/注册/路由/fail-closed（无 key） | PASS | `pi -p -e extensions/motto-gemini-vision/index.ts`：主模型确认工具注册并实际调用；无 pi 本地 Google credential 时返回标准 tool error `Google Gemini API key is not configured`（key 检查先于路径检查）；其余 extension 正常加载退出 |
| 既有全量回归通过 | PASS | `./scripts/regression.sh motto-gemini-vision` → 2 passed 0 failed（含 drift-check） |
| README 明确隐私、限额与非目标 | PASS | README.md Privacy / Quotas / Current limitations 节 |
| 对现有 theme / review flow / copy 无回归 | PASS | 未触碰 motto / themes / review-flow / canonical-copy；drift-check PASS |
| live 测试：真实 Google 请求 | PASS | `NODE_USE_ENV_PROXY=1 node --experimental-strip-types test/live.mts` → LIVE SMOKE: PASS；model=gemini-3.6-flash status=completed durationMs=2729 usage={total_input_tokens:1245,total_output_tokens:1,total_tokens:1246}；模型回答 "Red"（8×8 实心红 PNG） |
| 真实 Pi runtime dogfood（完整闭环） | PASS | `pi -p -e ./extensions/motto-gemini-vision/index.ts`：主模型自主调用 motto_vision（16×8 左红右蓝 PNG）→ 真实 Gemini 返回左右颜色与边界观察 → 文本 tool result → 主模型消费并继续作答；会话文件无 key/base64 |
| `git diff` 无 secret / base64 fixture / 产物 / 无关重构 | PASS | 无提交；fixture 为程序化生成（无 base64 字面量）；无缓存/日志入库 |

## 4. 能力矩阵

| 动作 | 实际路径 | 结果 | 备注 |
|---|---|---|---|
| 相对路径 | `runTool` → `loadImage(ctx.cwd)` | PASS | 单测覆盖 |
| 绝对路径 / `~/` | `node:path` resolve / homedir 展开 | PASS | 单测覆盖 |
| PNG/JPEG/WEBP 魔数识别 | `detectMime`（内容优先于扩展名） | PASS | 单测覆盖（含「.png 装 JPEG 按 JPEG 发送」） |
| 10 MiB 上限 | stat 前置检查 + 读后 TOCTOU 复查 | PASS | 单测覆盖 |
| 单次 POST + 纯文本结果 | `runVision` | PASS | 61 项测试 + provider-stub E2E + 真实 live |
| 错误映射（400/401/403/404/413/429/5xx） | `httpError` | PASS | 单测覆盖；429/5xx 不重试 |
| 取消/超时 | `AbortSignal.any` | PASS | 单测覆盖 |
| live 真实 Google 调用 | `test/live.mts` | PASS | gemini-3.6-flash completed，回答正确；请求体已按真实 API 修正（input 为单个 content 消息，text 在前 image 在后） |

## 5. 安全与供应链

- **凭据**：key 只出现在 `x-goog-api-key` header；不进 URL / 工具结果 / details / 日志 / 错误消息（单测断言）。
- **泄漏面**：details 仅 model / imagePath / mimeType / bytes / durationMs / status / usage（数值字段按存在性摘取）；错误消息截断 ~500 字符，不回显 header / base64 / request body。
- **fail-closed**：key 缺失立即失败且不发网络请求；目录 / 缺失 / 不可读 / 空文件 / 未知魔数 / 超限均有可行动错误。
- **外部依赖**：无二进制、无 checksums（无固定版本依赖）；第三方供应链面为零。
- **网络（无 endpoint 注入面）**：仅指向 `https://generativelanguage.googleapis.com/v1/interactions`（单端点常量）。
  Pi 运行路径通过 `ctx.modelRegistry.getApiKeyForProvider("google")` 读取 pi 的本地凭据，
  standalone `runTool`/live smoke 才读取 `GEMINI_API_KEY` fallback；模型/timeout 读取
  `MOTTO_VISION_MODEL` / `MOTTO_VISION_TIMEOUT_MS`，不读任何 endpoint/base-URL 环境变量。
  provider stub 的重定向只存在于测试的 fetch 包装器内，生产路径永远使用固定常量
  （run.test.mjs「hostile endpoint env vars are ignored」锁定）。
- **并发语义**：不设 `executionMode`，沿用 pi 默认并行批处理——motto_vision 是无状态一次性
  调用；标记 sequential 会让同批无关工具一并串行化，且只限单个 batch、不是 quota limiter，
  故按最小扰动原则省略（index.ts 注释留痕）。

## 6. 已发现问题

| 严重度 | 影响 | 是否修复 | 残余风险 |
|---|---|---|---|
| 低 | live 首次请求返回 HTTP 400：真实 v1 API 不接受顶层 `input[]` 内直接 `{type:"image"}`（枚举含 content/user_input 等）；正确形状为单个 `{type:"content", content:[text,image]}` 消息 | **已修**（buildRequest + 相关测试断言更新） | 无；已被真实 live PASS 复核 |

## 7. 最终结论与理由

**SHIPPED（ACCEPTED WITH LIMITATIONS）**：离线全套绿（61 项测试 + provider-stub E2E + 类型检查
+ 回归 + drift-check），真实 provider 与真实 Pi runtime 闭环均已 PASS；已纳入 deploy.sh，
部署后回归通过，部署位与仓库一致。

## 未覆盖 / 残余风险

- 多模型/模型不存在（404）的真实行为由 live 请求形状验证覆盖了主要路径，但未对多个模型逐个枚举。
- 部署后每日真实使用尚未发生（usage-log 只有验收与 dogfood 记录）；按 MAINTENANCE 第 1 层，
  进入维护态后需以真实使用摩擦驱动后续修订。

## 注册文字（建议采用）

```text
PACK-VISION-1 — SHIPPED（ACCEPTED WITH LIMITATIONS）

Implementation complete. Offline tests, provider-stub E2E, real Gemini live
verification, and a real pi -e runtime dogfood all passed. Deployment and
post-deploy regression passed; daily dogfooding remains ongoing. The pack implements one stateless text-result
vision tool with credentials read only through pi's modelRegistry (pi /login),
and introduces no Pi core, theme, session, or Antigravity dependency.
```
