# PACK-COMPUTER-USE-1 — 动态验收报告（最终轮）

- 日期：2026-08-08
- 验收方式：真实二进制捕获 + 动态验收脚本 `test/live.mts` + 真实 Pi 模型闭环 `test/pi-drive.sh` + 补充回归（smoke / boundary / netcheck / proctree / permcheck）
- 结论：**ACCEPTED WITH LIMITATIONS**

---

## 1. 测试环境

| 项目 | 值 |
|---|---|
| macOS | 26.5.2（Build 25F84） |
| 硬件架构 | arm64（Apple Silicon） |
| Pi / Motto | `pi` 0.84.1（`@earendil-works/pi-coding-agent` 0.84.1），模型 `deepseek-v4-flash` |
| Peekaboo | v3.10.0，路径 `bin/peekaboo-macos-universal/peekaboo` |
| Peekaboo 二进制 SHA-256 | `6a41bd8723326f02fa2006e3b4f67925ff2e36ea66c14e90cdf340058f2e046e`（与固定 tar.gz 解包产物逐字节一致；tar.gz SHA-256 `87af985e…` 与 `bin/checksums.txt` 相符） |
| 授予权限 | Screen Recording + Accessibility（用户在 System Settings 授权） |
| 实际承载进程 | Ghostty（终端）→ zsh → pi → bash → node → `peekaboo mcp`。TCC 身份链：Ghostty 承载 Screen Recording 与 Accessibility。 |
| 显示器 | 单屏（逻辑 1470×956，native 2940×1912，scale=2）——多屏未覆盖 |

## 2. 架构边界

```
Pi model (deepseek-v4-flash)
  └─ extensions/motto-computer-use/index.ts   （8 个 cu_ 工具注册，无状态薄层）
       └─ core.ts                              （allowlist / 权限 preflight / isError→throw / 内容转换）
            └─ mcp-client.ts                   （零依赖 MCP stdio 客户端）
                 └─ peekaboo mcp  (v3.10.0, stdio)
                      └─ macOS API（Accessibility / ScreenCaptureKit）
```

- **未修改 Pi core**（只读使用其扩展 API）。
- **未使用 KimiCU / pi-mcp-adapter**。
- 唯一暴露面：`cu_see, cu_image, cu_click, cu_type, cu_scroll, cu_hotkey, cu_set_value, cu_perform_action`。
- 未申请 Automation / Full Disk Access / 其他额外权限（TCC 数据库读取被拒即证明本机无 Full Disk Access，也未尝试申请）。

## 3. 九项验收结果

### #1 cu_see — PASS
- `cu.runTool("see", {app_target:"TextEdit", max_elements:80})` 返回结构化 AX 树：**80 个元素 ID**、含 `at (x,y) size w×h` 定位、含 textField/scroll area、非纯图片渲染。
- `details.coordinate_context` 携带 `reference_id`、`logical_bounds`、`delivered_image_size`、`native_scale`、`output_scale`、`version`。
- 观察路径为结构化优先（工具描述与 promptGuidelines 均要求先看 AX 树，仅当不清晰才用截图）。

### #2 cu_image — PASS
- `format:"data"` 返回真实 **image content block**（`type:"image"`，`mime=image/png`），base64 解码后 PNG magic `89504e470d0a1a0a` 校验通过（14823 bytes）。
- 非文件路径、非 text 块内 base64、非仅终端渲染——是 pi 可见的 `ImageContent`。
- 真实截图内容校验：2940×1912、1.37MB、全帧亮度 stddev≈94.6（非空白/非脱敏占位）。
- 传输结果记录在 `reports/PACK-COMPUTER-USE-1-live.log`。

### #3 后台操作 — PASS（含一条已记录限制）
| 动作 | 实际路径 | 鼠标移动 | 焦点抢占 | 结果 |
|---|---|---|---|---|
| set_value | AX `AXSetValue`（纯 AX，无合成事件） | 否（(948,503)→(948,503)） | 否（Terminal 保持前台） | 成功 `[ok] Set value on elem_2` |
| click | AX hit-test 后台点击（对 textField 命中 (474,295)） | 否（0px） | 否（Terminal 保持前台） | 成功 `[ok] Clicked on textField …` |

- 未把“动作成功”自动解释为“后台输入成功”：焦点/鼠标以独立 osascript/Quartz 采样为准，且与动作前后做差值；动作前将宿主重新置前台后再测。
- **已记录限制**：`cu_see` 观察步骤本身会把目标应用激活到前台（Peekaboo v3.10.0 行为，见 §6-2）。动作路径（set_value/click）不抢焦点、不动鼠标，但“观察”这一环会破坏后台性。测试方法学上已通过在观察后重置前台再测量动作环来解决。
- 未使用 foreground synthetic input；未测试 pid-routed 键盘（type/hotkey 后台路径，不在本轮安全动作集内）。

### #4 坐标契约 — PASS（多屏 NOT TESTED）
- Retina/逻辑点映射：`native_scale=2`，native 投递 1312×844 = 逻辑 656×422 × 2（误差 <2px）；`delivered ≈ logical × output_scale`（300 vs 300.0）一致。
- max_dimension 缩放定位：以 300px 缩放截图 + `output_scale=0.4573` 换算，经 `image_pixels` + `coordinate_reference` 派发，服务器命中**精确逻辑点 (474,295) == 目标**（文本域中心）。
- 旧 reference 失效：创建 snapshot 后把窗口从 (146,71) 移到 (90,90)（已独立确认移动），用旧 reference 点击 → **明确拒绝**“Coordinate reference is stale because its captured window moved or resized”，未派发点击。
- 伪造 reference → 拒绝；越界 image_pixels → 拒绝（“outside the delivered image bounds”）。
- 前台全局越界坐标：服务器不校验（接受并交给 OS 钳制）——已记录为限制（§6-4）。
- 多显示器：**本机仅单屏，明确标记 NOT TESTED，未伪造通过**。

### #5 动作闭环 — PASS
- `see → set_value(SCRATCH) → see`：第二次观察的 AX 树中确实包含 SCRATCH 标记（`#5 see->action->see loop: new state reflects the action` PASS）。
- 判定依据是第二次观察结果，而非 cu_set_value 的返回文本。

### #6 权限退化 — PASS
- wrapper 层静态/无权限测试结果可引用：`test/smoke.mts`（无权限状态历史全过）与 `test/boundary.mts`（本次过）。
- 动态阶段真实服务端错误经 `isError→throw` 正确传播（bogus reference / stale / OOB 三类错误均以 Error 抛出，消息含服务端原文）。
- boundary.mts 模拟撤销权限：`image`/`click` 在 preflight 阶段 fail-closed，消息给出授权路径；未切换到更高风险路径。
- 未撤销用户刚授予的系统权限（按指令，不主动撤销）。

### #7 工具边界 — PASS
- 服务端实际广告 27 个工具；wrapper 仅注册/暴露 8 个 `cu_` 白名单工具。
- 19 个非白名单工具（agent, browser, clipboard, paste, analyze, shell, capture, list, sleep, inspect_ui, app, window, menu, dock, dialog, space, move, swipe, drag）经 `runTool` 直呼全部被拒（defense in depth，报“not in the motto-computer-use allowlist”），无法通过名称猜测、MCP search、direct call 或底层 runTool 绕过。

### #8 生命周期与网络 — PASS（含一条 CLI 侧发现，§6-3）
- MCP 活跃期子进程树：`peekaboo mcp` 为**叶子进程**（无自身子进程）。
- 动态截图/操作期间子进程 TCP/UDP socket：**0 条**（netcheck 在 session 中与 image 调用后均 NONE clean），仅有 stdio 管道与本地 unix 管道。
- 既有宿主连接与 Peekaboo 子进程区分：基线中无任何 peekaboo 进程/socket；子进程 lsof 单独枚举。
- session shutdown 后：MCP 子进程回收、无孤儿、`pgrep peekaboo` 为空、无 daemon socket 遗留（MCP 路径）。
- 真实 Pi 闭环 shutdown 后同样干净。

### #9 安全范围 — PASS
- 全程仅操作 TextEdit 临时草稿（`/tmp/motto-cu-*`、`/tmp/motto-pi-*`）；无支付/账户/密码/发布/真实消息/删除文件等不可逆动作。
- 所有动作可逆：set_value 仅改草稿文本；点击仅移动光标；草稿 `saving no` 关闭并删除。

## 4. 后台能力矩阵

| 应用 | 动作 | 实际输入路径 | 移动鼠标 | 抢焦点 | 成功 | 已知限制 |
|---|---|---|---|---|---|---|
| TextEdit（后台） | set_value | AX `AXSetValue` | 否 | 否 | ✅ | 元素须可写（textField，非 scroll area） |
| TextEdit（后台） | click（元素） | AX hit-test 后台点击 | 否 | 否 | ✅ | 观察步骤 see 会激活目标应用 |
| TextEdit | see / image | AX + ScreenCaptureKit（观察） | 否 | **是（see）** | ✅ | see 激活目标应用；image 不激活 |
| — | type/hotkey 后台 pid-routed | 未测试 | — | — | — | 不在本轮低风险动作集内，未覆盖 |
| 前台全局坐标点击 | click fg | 合成全局事件 | 是 | 是 | ✅ | 越界坐标不校验（OS 钳制） |

## 5. 安全与供应链

- **白名单边界**：8 工具白名单双层强制（注册层 + runTool 层），19 非白名单工具拒绝（见 #7）。
- **权限 fail-closed**：preflight 缺失即抛错并给授权路径；服务端错误 isError→throw；不自动授权、不静默降级路径。
- **snapshot stale rejection**：伪造/过期/窗口移动后的 reference 全部拒绝且不派发。
- **网络观测**：MCP 子进程 0 TCP/UDP；无遥测外联。CLI 桥接 daemon 仅本地 unix socket，无网络。
- **进程回收**：MCP 路径干净（start→单子进程→stop→无孤儿）；CLI 路径残留 daemon（见 §6-3，已手工清理）。
- **版本与 checksum**：二进制 SHA-256 `6a41bd87…` 与固定 tar.gz 一致；`PEEKABOO_EXPECTED_VERSION=3.10.0` 校验通过；tools/list 含全部白名单工具。

## 6. 已发现问题

| # | 问题 | 严重度 | 影响 | 是否修复 | 残余风险 |
|---|---|---|---|---|---|
| 1 | **permissions 工具报告与真实能力**：本轮 `screenRecording:true` 与真实截图成功**一致**，未观察到误报。但按验收纪律，未采信该报告，一律以真实截图（exit 0 + 有效 PNG + 内容方差）为准。若未来出现误报，凭据为 §2 中的真实捕获流程。 | 低 | 无（本轮一致） | 无需修复 | 该工具不可作为唯一判据 |
| 2 | **`cu_see` 观察会激活目标应用**（by 名称或 PID；`frontmost`/`screen` 目标不激活）。根因在 Peekaboo v3.10.0 观察路径，超出本工作包修复范围（不修改 Peekaboo）。 | 中 | 后台工作流的“观察”环节会抢占焦点；动作环节本身干净 | 否（受版本约束） | 纯后台、绝不抢焦点的场景需在 wrapper 层未来加 pre-observation 前台恢复策略或换观察目标 |
| 3 | **CLI `peekaboo image` 会拉起持久 bridge daemon**（PPID=1，`daemon run --mode auto … --idle-timeout-seconds 300`），退出后 15+ 分钟未自退，遗留 unix socket（daemon.sock + 随机名）。**MCP 路径已证实不拉起 daemon**（session 前/中/后均无）。 | 中低 | 仅本地 unix socket、无网络；测试轮内已人工清理 | 否（Peekaboo CLI 行为） | 若用户日后直接跑 CLI，会残留后台 daemon；MCP wrapper 不受影响 |
| 4 | **前台全局坐标点击不校验越界**：`coords:999999,999999, foreground:true` 返回 `[ok]` 并交 OS 钳制。**绑定 reference 的 image_pixels 路径则严格 fail-closed**。 | 低 | 越界前台点击最多落点在屏边/被忽略，无越权 | 否（文档化） | 依赖 OS 钳制语义 |
| 5 | **多显示器坐标契约未验证** | — | 环境无第二显示器 | 否 | 单屏 2940×1912/scale2 已验证；多屏映射待有环境时补测 |

## 7. 最终结论

**ACCEPTED WITH LIMITATIONS**

理由：
- 核心 capability contract 全部通过：真实视觉链路（真实 PNG + 内容验证）、结构化 AX 观察、AX 后台动作（不动鼠标/不抢焦点）、坐标契约（Retina/缩放/过期 reference 拒派发）、观察-动作-再观察闭环、权限 fail-closed、8 工具白名单边界、生命周期/网络干净、真实 Pi 模型闭环（see→set_value→see→image 全程模型驱动且独立验证）。
- 未发现安全边界、视觉链路、坐标契约或生命周期方面的阻断问题。
- 存在的限制均为**明确、可接受、已记录**的环境/应用限制：
  1. `cu_see` 观察步骤会激活目标应用（Peekaboo v3.10.0 行为，动作环节不受影响）；
  2. 多屏未覆盖（单屏环境）；
  3. 前台全局越界坐标不 fail-closed（reference 路径已严格 fail-closed）；
  4. CLI 命令会残留本地 bridge daemon（MCP 路径干净，已清理）。

## 本轮修改文件

| 文件 | 修改 | 原因与行为变化 |
|---|---|---|
| `extensions/motto-computer-use/mcp-client.ts` | `callTool` 将 JSON-RPC 保留字段 `_meta` 归一化为 `meta` | 修复：Peekaboo 把 `coordinate_context` 放在 `_meta`，原代码读 `.meta` 导致坐标上下文在 wrapper/测试全链路丢失（坐标契约断裂）。行为变化：`details.coordinate_context` 现正确透传。 |
| `test/live.mts` | 重写：snapshot reference 贯通、AX 值内换行的续行解析、排除窗口控制按钮、缩放/Retina/越界/窗口移动 stale 断言、后台动作测量方法学、进程/socket 现场记录 | 修复：元素点击缺 snapshot、误点关闭按钮关闭窗口、`delivered_image_size` 形状断言错误、Retina 被 max_dimension 截断、越界断言路径错误。 |
| `test/smoke.mts` | 按权限状态断言（未授权→fail-closed；已授权→真实 PNG） | 适配已授权环境，保留无权限状态的服务器侧验证可引用。 |
| `test/pi-drive.sh` | 提示词精确化（指定 textField/First Text View，禁止 scroll area） | 避免模型误选不可写元素导致闭环失败。 |
| 新增 `reports/PACK-COMPUTER-USE-1-acceptance.md`、`reports/PACK-COMPUTER-USE-1-live.log` | 本报告与现场日志 | 可复核证据。 |

## 尚未覆盖 / 仍存在的风险

- 多显示器坐标映射（NOT TESTED，单屏）。
- pid-routed 后台键盘输入（type/hotkey）与 pid 路由坐标点击（未在低风险集内执行）。
- `cu_see` 激活目标应用的长期策略（受 Peekaboo 版本约束；wrapper 层未自动前台化掩盖）。
- CLI 桥接 daemon 残留（MCP 路径已验证无此问题）。

---

## 8. 正式签收与结案记录（2026-08-08）

**状态：ACCEPTED WITH LIMITATIONS — closed**

```text
PACK-COMPUTER-USE-1 accepted with limitations.

Accepted contract:
- single-display macOS environment
- AX-first structured observation
- MCP image-content delivery
- reference-bound and stale-safe coordinate actions
- safe set_value action loop
- strict eight-tool allowlist
- permission and server-error fail-closed behavior
- clean MCP process lifecycle
- no observed Peekaboo child-process TCP/UDP sockets

Known limitations:
- multi-display behavior not tested
- observation may activate the target application
- PID-routed background type/hotkey not tested
- bare global coordinates do not provide reference-bound stale protection
- Peekaboo CLI Bridge lifecycle is outside the accepted MCP path
```

### 验收范围的精确限定

“核心 capability contract 全部通过”仅限定为：

> **单显示器环境下，通过 Motto 白名单 MCP 路径进行的 AX-first 观察、语义值写入、reference-bound 点击、截图回传、状态验证、权限失败和生命周期管理。**

本次验收**不等于**以下更强声明：

- ≠ Peekaboo 全部 27 个工具均通过验收；
- ≠ 所有动作都能完全后台执行；
- ≠ 多显示器坐标已受保证；
- ≠ `type/hotkey` 的 PID-routed 后台键盘输入已验证；
- ≠ 裸全局坐标具有 reference-bound 路径相同的安全保证；
- ≠ 与 KimiCU 的全部产品行为等价。

### 已知限制处置（不阻塞结案）

| 限制 | 处置 |
|---|---|
| 多显示器未覆盖 | 保持 `NOT TESTED`，后续在真实多屏环境单独验收 |
| `cu_see` 会激活目标应用 | 产品行为定位为“动作可后台，观察未必后台”，不得宣传为全程静默 |
| 后台 `type/hotkey` 未测试 | 不纳入本次已承诺能力；后续单独建立低风险测试 |
| CLI 残留 Bridge daemon | 与正式 MCP 路径隔离；测试与生产说明避免用 CLI 路径代替 MCP |
| 裸全局越界坐标由 OS 钳制 | 自主操作优先或强制使用 snapshot/reference-bound 路径；不将裸坐标称为 fail closed |

### 发布与集成边界

作为**可选实验性扩展**保留，继续遵守：默认不启用；不进入 Pi core；固定 Peekaboo 版本与 SHA-256；不自动申请额外权限；不扩大 8 工具白名单；高风险应用与不可逆操作不进入默认使用范围；本报告与现场日志作为该版本验收依据一并保留。

> **编者注（2026-08-08 省并裁定，不改史）**：以上「默认不启用」为 PACK-1 验收当次原样措辞。现行姿态为**默认加载 + 会话级门禁 fail-closed**（经 PACK-2 载明，REGISTRY/README/正典为现行），本报告不改史，仅在注补史。

## 9. 集成状态：扩展形态实现 vs Motto 仓库正式随附 extension

两个状态必须区分：

| 状态 | 定义 | 当前事实 |
|---|---|---|
| **扩展形态实现** | 已具备独立 extension 结构（index.ts / core.ts / mcp-client.ts / 8 工具注册 / 生命周期 / 安全边界），以可加载、可测试的工作包存在 | ✅ 已达到：`~/Projects/motto-computer-use/extensions/motto-computer-use/` |
| **Motto 仓库正式随附 extension** | 已复制或以 package/submodule 方式纳入 Motto 主仓，随 Motto 发布/同步 | ❌ **未达到**：本机 `~/Projects/` 中不存在 Motto 主仓；`@earendil-works/pi-coding-agent` 仅以只读 npm 安装存在 |

定位结论：

> `motto-computer-use` 是 Motto-owned 的能力扩展；Peekaboo 是固定版本、可替换的运行时依赖。

当前为**扩展形态实现（独立工作包）**，尚未成为 **Motto 仓库内正式随附的 extension**。若后续纳入 Motto 主仓，建议结构：

```text
motto/
├── extensions/
│   └── motto-computer-use/
│       ├── index.ts
│       ├── core.ts
│       ├── mcp-client.ts
│       ├── README.md
│       └── checksums/
└── ...
```

纳入方式（复制 / package / submodule）与时机属独立决策项，不阻塞本 pack 结案；本 pack 以**独立工作包形态**验收并归档。
