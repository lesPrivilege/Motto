#!/usr/bin/env bash
# fetch-binaries.sh — 拉取并校验某个 pack 的固定版本二进制。
# 用法: scripts/maint/fetch-binaries.sh packages/motto/extensions/<pack>
# 校验失败即 fail-closed（退出非 0），不静默使用未校验的二进制。
set -euo pipefail

PACK="${1:?usage: fetch-binaries.sh packages/motto/extensions/<pack>}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PACK_DIR="$REPO_ROOT/$PACK"
BIN_DIR="$PACK_DIR/bin"

# 每个 pack 在 checksums/ 下提供: VERSION, checksums.txt, binary.sha256, fetch 脚本
FETCH_SCRIPT="$PACK_DIR/checksums/fetch.sh"
if [[ -x "$FETCH_SCRIPT" ]]; then
  # pack 自带的 fetch 脚本负责下载 URL、解包与两级校验
  PACK_DIR="$PACK_DIR" BIN_DIR="$BIN_DIR" bash "$FETCH_SCRIPT"
  exit $?
fi

echo "ERROR: no checksums/fetch.sh in $PACK_DIR — cannot fetch pinned binary (fail closed)" >&2
exit 1
