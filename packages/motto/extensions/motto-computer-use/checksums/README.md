# checksums/ — 固定版本依赖策略

二进制**不入库**。本目录只存官方出处与校验值；运行时用 `scripts/fetch-binaries.sh` 拉取并校验，**校验失败即 fail-closed，不静默使用**。

## 文件

| 文件 | 内容 | 来源 |
|---|---|---|
| `checksums.txt` | 官方 release 全部产物 SHA-256（tar.gz / npm tgz / app.zip / dmg） | 与 `https://github.com/openclaw/Peekaboo/releases/download/v3.10.0/checksums.txt` **逐字节一致**（已验证） |
| `binary.sha256` | 解包后可执行文件的 SHA-256 | 由 tar.gz 解包后本地计算（`6a41bd87…`，与验收报告一致） |
| `VERSION` | 固定版本号 `3.10.0` | 官方 tag |

## 拉取与校验

```bash
scripts/fetch-binaries.sh extensions/motto-computer-use
# → bin/peekaboo-macos-universal/peekaboo（解包后），两级校验：
#   1) tar.gz 与官方 checksums.txt 比对
#   2) 解包二进制与 binary.sha256 比对
```

## 升级流程

上游发新版本 → 从官方 release 拉新 `checksums.txt` + 解包计算新 `binary.sha256` + 更新 `VERSION` → 全量回归（见 `docs/MAINTENANCE.md` 第 3 层）→ 更新验收报告。只有全部通过才升级。
