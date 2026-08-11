# Research — Peekaboo v3.10.0 固定审计记录

> 目的：记录 motto-computer-use 固定运行时（Peekaboo v3.10.0）的**可复核出处**。这是 2026-08-08 验收（PACK-COMPUTER-USE-1，ACCEPTED WITH LIMITATIONS）所依赖的审计资料。
>
> 依据上游政策（见 `AGENTS.md` / `CONTRIBUTING.md`）：**上游源码 checkout、二进制、下载包与构建产物不迁入本仓**。本文件仅记录固定信息与验证方法。

## 出处与固定信息（2026-08-08 经上游 API 复核）

- 上游：https://github.com/openclaw/Peekaboo
- 固定版本：v3.10.0（tag）
- 主仓 commit（tag 指向）：`99209e374e8a6cd35c9705190a214ef42b68eecb`
- 五个 submodule gitlink（@ v3.10.0）：
  - AXorcist `dbafbe3a73a46f2d889fdbec53d550f8df919061`（openclaw/AXorcist）
  - Tachikoma `2ba00c869abb195209bd2a6633b0df6612ba17ea`（openclaw/Tachikoma）
  - Commander `0cef08a6187efac47b968072f1789804a374ed5e`（steipete/Commander）
  - TauTUI `91eebd2cb0a84dd54e11f4aa7e0b9b28b39e4501`（steipete/TauTUI）
  - Swiftdansi `62adad4a2f33ea8e62f2b2ca8ea3adfad9c40089`（steipete/Swiftdansi）
- 官方 release：https://github.com/openclaw/Peekaboo/releases/tag/v3.10.0
- 官方 checksums.txt：`https://github.com/openclaw/Peekaboo/releases/download/v3.10.0/checksums.txt`
  （本仓 `extensions/motto-computer-use/checksums/checksums.txt` 与之逐字节一致，已验证）

## 静态审计要点（2026-08-08 验收，来源见 docs/decisions/ spike 记录）

- 背景输入 `BackgroundInputDriver.swift`：键盘 pid-routed CGEvents；点击 AX hit-test + accessibility action；进程存活检查、窗口 pinning、stale/moved-window 拒绝、`AXIsProcessTrusted` fail-closed。
- MCP 面 ~27 工具，含高权限工具（agent/browser/clipboard/paste/analyze）——wrapper 白名单是真正的安全边界。
- MCP `{type:image}` 块与 pi `ImageContent` 1:1 映射（已验证）。
- 网络：MCP 子进程运行时零 TCP/UDP（动态验证）。
- 依赖：AXorcist / Tachikoma / Commander / TauTUI / Swiftdansi，均 MIT。

## 已知版本限制（来自验收报告 §6/§8）

- `see` 观察会激活目标应用。
- CLI `peekaboo image` 会残留本地 bridge daemon（仅 CLI 路径；MCP 路径无此问题）。
- 前台全局越界坐标不校验（reference-bound 路径严格 fail-closed）。

## 复核方法（可重复）

```bash
# 1) 版本与产物校验
shasum -a 256 <artifact>          # 对照 checksums.txt / binary.sha256
scripts/fetch-binaries.sh extensions/motto-computer-use   # 两级校验拉取

# 2) 上游 commit / submodule SHA 复核
curl -sL https://api.github.com/repos/openclaw/Peekaboo/git/ref/tags/v3.10.0
curl -sL "https://api.github.com/repos/openclaw/Peekaboo/git/trees/<commit>?recursive=1" \
  # 过滤 type == "commit" 的 tree 项即为 submodule gitlink
```
