# MOTTO-TUI-3 P1 — atomic footer replacement 验收

- 日期：2026-08-13
- 终态：**ACCEPTED WITH LIMITATIONS**
- 范围：custom footer 原子替换、reload 最终帧、Motto 单行 status/TPS 退化

## 结论

```text
ATOMIC_FOOTER_REPLACEMENT   PASS
RELOAD_FINAL_FRAME_FLUSH    PASS
CUSTOM_FOOTER_HEIGHT_1      PASS
TPS_STATUS_PRIORITY         PASS
60/80 RELOAD_STABILITY      PASS
120/200 STATUS+TPS          PASS
CANONICAL                   UNCHANGED BY IMPLEMENTATION
```

此前 dogfood 曾报告 reload 后 footer 需下一次输入才出现。定位为 reload 强制中间帧后，未变的
footer 行被 differential baseline 跳过。最终实现以 `dismissReloadBox()` 对最终 tree
`invalidate()` + `requestRender(true)`；定向 mutation 恢复旧非强制请求时，footer 行回写断言
失败。旧 reload regression handoff 因而被本报告取代。

## 自动证据

- `tui3-p0-rebind-frame.test.ts` + `interactive-tui.test.ts`：18/18 PASS。
- Motto `tps.test.mjs` + `footer-degrade.test.mjs` + `motto.test.mjs`：22/22 PASS。
- footer 拓扑：custom→custom、custom→native、native→custom、bind 失败/取消 fallback。
- reload：清除 footer terminal row 后，生产收尾 helper 无输入即强制写回。
- width：single/multi status × 40/60/80/120/200；120 保 TPS、先降 status；200
  TPS/status/model 同见；所有行不超宽。

## Ghostty 证据

本机证据：`/private/tmp/motto-tui3-p1-evidence/`。

- 启动门禁：Motto 牌记、单行 footer、`deepseek-v4-flash · max`；无 `unknown`、
  `No models available`、原生 `[Extensions]`/`[Themes]` 画面。
- 80 列 `/reload`：6/6 footer 可见，组内 PNG hash 一致。
- 60 列 `/reload`：6/6 footer 可见，组内 PNG hash 一致。
- 120 列：`alpha working`、`zeta ready` 同 footer 行可见。
- 200 列 settled：`100 t/s`、两个 status 与模型信息同时可见。
- streaming 连拍：footer 未消失、未闪烁。

## 限制

- 80/120/200 的完整 fresh→reload→resume 矩阵未全部重复。
- native→custom、custom→native 未做 Ghostty 实机转换。
- 40 列未做 Ghostty；自动矩阵已覆盖。
- 未对探针 session 与 canonical JSONL 做逐字基线比较。
- Ghostty composer rect 仅由连续帧目验确认无跳动，未机械读取像素坐标。
- 完整 runtimeHost→rebind→bindExtensions→真实 Motto session_start 链仍为 NOT TESTED。

这些限制不否定已覆盖的 footer replacement、reload flush 与 TPS/status 结论。
