# THIRD-PARTY NOTICES — motto-computer-use

本 pack 的运行时依赖与上游引用清单。**上游源码、二进制、下载包与构建产物不随本仓分发**；固定版本依赖在需要时通过 `scripts/fetch-binaries.sh` 从官方出处拉取并做两级校验（详见 `checksums/README.md`）。

## Peekaboo (openclaw/Peekaboo) v3.10.0

| 项 | 值 |
|---|---|
| 上游 | https://github.com/openclaw/Peekaboo |
| 版本 | v3.10.0（本 pack 固定，不随上游自动升级） |
| 主仓 commit（tag v3.10.0） | `99209e374e8a6cd35c9705190a214ef42b68eecb` |
| License | MIT |
| 发布页 | https://github.com/openclaw/Peekaboo/releases/tag/v3.10.0 |
| 官方 checksums.txt | https://github.com/openclaw/Peekaboo/releases/download/v3.10.0/checksums.txt（本仓 `checksums/checksums.txt` 与之逐字节一致） |

### 五个 submodule（gitlink SHA @ v3.10.0）

| Submodule | 上游 | SHA |
|---|---|---|
| AXorcist | https://github.com/openclaw/AXorcist.git | `dbafbe3a73a46f2d889fdbec53d550f8df919061` |
| Tachikoma | https://github.com/openclaw/Tachikoma.git | `2ba00c869abb195209bd2a6633b0df6612ba17ea` |
| Commander | https://github.com/steipete/Commander.git | `0cef08a6187efac47b968072f1789804a374ed5e` |
| TauTUI | https://github.com/steipete/TauTUI.git | `91eebd2cb0a84dd54e11f4aa7e0b9b28b39e4501` |
| Swiftdansi | https://github.com/steipete/Swiftdansi.git | `62adad4a2f33ea8e62f2b2ca8ea3adfad9c40089` |

### 固定产物校验值

| 产物 | SHA-256 |
|---|---|
| `peekaboo-macos-universal.tar.gz` | `87af985e9617b9b6bc3f21036b5cc7d42c99293bd2df614b6d4e6872162787b3` |
| `steipete-peekaboo-3.10.0.tgz` | `c737d60b36a7cbd832f2aa3c39049f33eec069c484200d2fba9c74f9684e9fa4` |
| `Peekaboo-3.10.0.app.zip` | `1ca3d5101a6ee47cecf0ee362c9550899fa16b0316419102cdab6a6545087261` |
| `Peekaboo-3.10.0.dmg` | `7c94e9bf6b6039d8e0f44f8d9f84afbcbf7aa1751442012dba09134aa95e45e0` |
| 解包后可执行文件 `peekaboo` | `6a41bd8723326f02fa2006e3b4f67925ff2e36ea66c14e90cdf340058f2e046e` |

### 边界声明

- 本仓**不包含** Peekaboo 源码 checkout、二进制、压缩包或任何构建产物（`.gitignore` 与 CI 二进制入库防线双重保证）。
- 本 pack 与 Peekaboo 之间只有 stdio MCP 协议交互；Peekaboo 是固定版本、可替换的外部设备层。
- 上游许可：MIT（见 https://github.com/openclaw/Peekaboo 与各 submodule 上游）。

## 本仓自身依赖

- 运行时零第三方依赖（`mcp-client.ts` 为手写 newline-delimited JSON-RPC，无 runtime deps）。
- 开发/测试：`@earendil-works/pi-coding-agent`（运行时宿主，不打包）、`typebox`（schema）、`typescript`、`@types/node`（见 `package.json`）。
