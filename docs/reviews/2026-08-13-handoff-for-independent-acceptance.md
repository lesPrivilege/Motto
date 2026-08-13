# 2026-08-13 施工 handoff —— 供独立验收

> 施工方：Motto（agent）。验收方：用户（独立验收，写者与验收者分离）。
> 范围：`0f04695b5`（上轮返修轮 tag）→ `0323c1f04`（本轮 HEAD），15 commits，全部已推 origin/motto/main。
> 终验证据：governance PASS（含 pinned-deps/typecheck×5/TUI baseline --check 逐字节/drift-check）、
> motto pack 测试 82/82、工作树与部署位双干净、local == origin（0 0）。

## 一、改动清单（15 commits 分类）

### A. 产品代码

| commit | 内容 | 落点 | 验收入口 |
|---|---|---|---|
| `dab2db1ee` | tui-4-s2 补充：卡片小标签按显示宽度截断（I9-1，CJK 双列、`…`）+ cardLabel 槽非主 TUI 默认值 magenta→red（消除朱墨外第 4 色相）+ 端到端用例 | packages/tui markdown.ts、packages/coding-agent package-manager-cli.ts、test-themes.ts、cards.test.mjs | 真机：带超长标注的 `、、、` 卡片 × 窄宽；cards.test 33 用例 |
| `badbe2163` | tui-1-s1-r1：user 消息首行竖界栏改左上方短横衬线（3×U+2500 独立成行、脚注分隔线风格、muted；正文全部续行悬挂） | coding-agent user-message.ts + motto-layout.ts；基线 9 文件重生成 | 真机：发长文本 user 消息目验 `───` + 悬挂；baseline --check |
| `074bde780` | footer 单行增强：多 provider 括号段（同原生规则）+ **折叠优先级反转**（优先折叠模型信息以外：统计段→pwd 截断→最后才折 thinking/模型名）+ self-heal（session_info_changed 再注册，防 rebind 后回退原生两行） | motto 扩展 core.ts / index.ts | 真机：启动/窄宽 80/100/120 目验单行 `(deepseek) deepseek-v4-pro · max`；40 列看统计先折；/reload 与 session 恢复后仍单行 |

### B. 登记册

- `9da253e61` PATCHES 登记 width-guard + supportCommits 补 5 条
- `4acf8cd47` PATCHES 登记 tui-1-s1-r1-footnote-dash（叠改注后置先退）+ PI-BASE 12 patches + 凡例/TUI-THESIS 措辞同步
- `7640ee507` RELEASES 补 2026-08-12.2（10 core patches，mottoCommit 34b30ba80）+ PI-BASE patchset 同步

### C. 凡例 / 宪制 / 理念

- `aa62f787f` 发行与边界（凡例总纲第 7 条 + 宪制第 8 条）
- `bc5a0953b` 薄而自足 harness 定调（core 权限开放/折旧原则/coding is cheaper/版式学三不）+ ROADMAP 候选登记；`8a51871ea` INDEX
- `094b3d9b1` 工作方式分层（全局注入泛化最小 / 项目规范具体 / 元目录 dogfooding 路径）
- `0323c1f04` 凡例 Footer 节同步（模型信息最后折 + provider 括号）

### D. 改名工程

- `d95fe5cbd` 目录正名 `~/Projects/pi` → `~/Projects/Motto`（活文档全对齐，历史文档保留原貌）
- `6f97c369e` GitHub repo 改名引用全量更新

### E. 卫生

- `32c8ffff0` whitespace/EOF 清理（theme 基线 8 文件豁免：删除会破坏逐字节 baseline --check，留 CI 白名单待办）
- `581cb07af` image gen brief 投喂包（研究素材）

## 二、真机验收要点

1. **footer**（`074bde780`）：启动 motto → composer 下**仅一行**：左簇 `cwd · 统计段`、右簇 `(deepseek) deepseek-v4-flash · max`；窗口缩到 40 列时统计段先折（$→CH/W→TPS/R→↑↓→context%），模型信息最后折；`/reload`、`/exit` 重启恢复同一 session 后仍单行。
2. **衬线短横**（`badbe2163`）：发一条长文本 user 消息 → 首行左锚 `───`（muted），正文全部 2 空格悬挂；拖选复制随剪贴板（I6-4）。
3. **卡片标签截断**（`dab2db1ee`）：`、、、 超长标注` 卡片在窄宽下端到端零超宽、标签 `…]` 收尾。
4. **登记册核验**：`motto version` 输出 12 patches；PATCHES 逐条 commit 与 git log 对照；RELEASES 12.2 哈希现场重算比对。

## 三、环境侧改动（非仓内，供知悉）

- GitHub：`lesPrivilege/pi` → **`lesPrivilege/motto`**；旧双仓过渡仓归档为 `lesPrivilege/motto-legacy`。
- 本地：`~/.motto/agent → ~/.pi/agent` symlink + `~/.zshrc` export `PI_CODING_AGENT_DIR=~/.motto/agent`（configDir 改名 dogfooding 起点；验收通过后 configDir 默认值 1 行入 repo）。
- `~/.pi/agent/settings.json` defaultModel 已回 `deepseek-v4-flash`（部署位 git 干净）。
- 上游未吸收增量：**8 commits**（截至 2026-08-13）。

## 四、未闭合 / 待验收方裁决

- theme 基线 whitespace CI 白名单（`git diff --check` 豁免 `fixtures/tui/baseline/theme-*`）。
- I8-1「一处红」与 I7-2 流式期专测补强（下轮候选）。
- #7721/#7757/#7761/#7770 退役触发条件写入各 pack README（下轮候选）。
- upstream-check.sh 自动化 dist grep（人验升级门禁，下轮候选）。
- ChatGPT 图生成 loop（用户进行中）；产出后单独派重单做「参考图 → 凡例对照 → 逆向修正工单」。
- configDir 默认值入 repo 代码（dogfooding 验收通过后）。
