# PACK-THEMES-2 验收报告 — mdHeading 明度分层（深宗亮一档 / 浅宗深一档）

- 日期：2026-08-08
- 验收方式：对比度数学复核 + 真实 pi-tui Markdown 渲染器双宗样张（`/tmp/sample-*.ansi`，探针已清理）
- 结论：**ACCEPTED**
- 依据：usage-log 2026-08 条目 + `docs/research/MOTTO-MARKDOWN-HEADING-2026-08-08.md` 核查记录第四节（档一成案）

## 1. 改动

三主题 `mdHeading`：`"text"` → `"dim"`（各一处，共三处）。

| 文件 | 改动 |
|---|---|
| `motto.json` | `mdHeading`: `"text"` → `"dim"` |
| `motto-dark.json` | `mdHeading`: `"text"` → `"dim"` |
| `motto-light.json` | `mdHeading`: `"text"` → `"dim"` |

## 2. 选值理由（色值按双宗真实渲染对比度取定）

### 2.1 为什么是 `dim` 而非新值

- **规格约束**：深宗亮一档、浅宗深一档；禁用 accent（朱记三用不容稀释）；不引入新色相。
- motto 语义契约中 `dim` 槽恰为「相对 `mid` 的明度偏移一档」：
  - 深宗（motto / motto-dark）：`dim` = `#a8adb2`（亮度 0.414）**亮于** `mid` `#8a9095`（0.317）→ 深宗亮一档 ✓
  - 浅宗（motto-light）：`dim` = `#5c6166`（亮度 0.118）**深于** `mid` `#8a9095`（0.317）→ 浅宗深一档 ✓
- 灰阶同族（无彩度），不引入新色相；非 accent。用现有语义槽，不扩 schema、不改 vars。
- 渲染器侧无改动：h1/h2 无前缀（bold/underline）、h3+ 保留 `### ` 前缀（设计特性），本次只改色。

### 2.2 对比度复核（WCAG 相对亮度）

| 项 | 深宗（bg `#26282b`） | 浅宗（bg `#f2f3f4`） |
|---|---|---|
| heading `mdHeading=dim` vs bg | **6.54:1** | **5.63:1** |
| 正文 `text` vs bg（对照） | 13.30:1 | 13.30:1 |
| heading vs 正文（同屏相邻可辨） | 2.04:1 | 2.36:1 |
| **浅宗 dimmer 复核**（`#b8bdc2`，最弱灰） | — | **1.70:1（未触碰，不回归）** |

- heading 对比度双宗均 >4.5:1（AA 大字/正常标准），正文远高于 heading → 明度分层成立。
- 浅宗 dimmer 未在本次改动范围内（改的是 mdHeading，dimmer 槽原样），对比度 1.70:1 与改动前一致 → **不回归**。
- heading(5.63:1) 显著强于 dimmer(1.70:1)，语义梯度「heading > 正文 > 次级灰 > 最弱灰」保持。

## 3. 双宗样张（真实渲染器输出，标注主色）

### 深宗 motto-dark（heading 全为 dim `#a8adb2`，正文 `#f2f3f4`）

```
L00 [fg=#a8adb2]  一级标题 收工 review 总览        ← h1（无前缀，bold+underline）
L02 [fg=#a8adb2]  二级标题 本轮改动清单            ← h2（无前缀，bold）
L04 [fg=#a8adb2]  ### 三级标题 明细与验证          ← h3（保留 ### 前缀）
L06 [fg=#a8adb2]  #### 四级标题 子项               ← h4（保留 #### 前缀）
L08 [fg=#f2f3f4]  这是正文段落。粗体正文与 斜体 与 行内代码 混排…
L17 [fg=#a8adb2]  ### 规格约束                     ← 长文档节内 heading 同色
L19 [fg=#8a9095]  - 深宗亮一档…                    ← 列表（listBullet=mid）
L31 [fg=#f2f3f4]  │ 引用块也用于观察…               ← 引用（text 斜体）
L33 [fg=#8a9095]  ┌─────┬─────────┬─────────┐      ← 表格边框（mid）
```

### 浅宗 motto-light（heading 全为 dim `#5c6166`，正文 `#26282b`）

```
L00 [fg=#5c6166]  一级标题 收工 review 总览
L02 [fg=#5c6166]  二级标题 本轮改动清单
L04 [fg=#5c6166]  ### 三级标题 明细与验证
L06 [fg=#5c6166]  #### 四级标题 子项
L08 [fg=#26282b]  这是正文段落。粗体正文与 斜体 与 行内代码 混排…
```

（完整样张含长文档一屏，见 `/tmp/sample-motto-dark.ansi` / `/tmp/sample-motto-light.ansi` 生成脚本逻辑；探针与样张已清理。）

## 4. 验收项

| 项 | 结果 | 证据 |
|---|---|---|
| 三 JSON 合法、仅 mdHeading 一处变更 | PASS | python3 json.load + diff |
| 深宗亮一档（dim 相对 mid 亮度） | PASS | 0.414 > 0.317 |
| 浅宗深一档（dim 相对 mid 亮度） | PASS | 0.118 < 0.317 |
| 禁用 accent、无新色相 | PASS | 取值 `dim`，灰阶无彩度 |
| heading 对比度双宗 >4.5:1 | PASS | 6.54:1 / 5.63:1 |
| 浅宗 dimmer 对比度不回归 | PASS | 1.70:1 与改动前一致（未触碰） |
| 双宗样张 h1/h2/h3+ 各一 + 长文档一屏 | PASS | 真实渲染器输出（见第 3 节） |
| regression | PASS | 10 passed, 0 failed |
| drift-check（deploy 同步后） | PASS | 三主题部署位与仓库一致 |
| 双宗目视终验 | 用户侧遗留 | 同 PACK-THEMES-1（Ghostty） |

## 5. 未覆盖 / 残余风险

- 单一 `mdHeading` 槽无法逐级区分 h1/h2/h3 内部明度（h1 靠 underline、h2 靠 bold、h3+ 靠前缀）——此为上游逐级槽候选，**ROADMAP 档二保持挂账不动**（本次明确不改）。
- Ghostty 目视终验（用户侧，同 PACK-THEMES-1 遗留）。

## 6. 结论

ACCEPTED。mdHeading 由正文字色改为 `dim`，双宗明度分层成立，全部约束满足，零回归。
