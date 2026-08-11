#!/usr/bin/env bash
# fetch.sh — motto-computer-use 固定二进制拉取器（由 scripts/fetch-binaries.sh 调用）。
# 两级校验:
#   1) tar.gz 与官方 checksums.txt 比对
#   2) 解包二进制与 binary.sha256 比对
# 任何校验失败 -> 退出非 0（fail closed）。
set -euo pipefail

VERSION="$(cat "$(dirname "$0")/VERSION")"
CHECKSUMS="$(dirname "$0")/checksums.txt"
BINARY_SHA="$(dirname "$0")/binary.sha256"
ARTIFACT="peekaboo-macos-universal.tar.gz"
URL="https://github.com/openclaw/Peekaboo/releases/download/v${VERSION}/${ARTIFACT}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "fetch: ${ARTIFACT} (v${VERSION})"
curl -fsSL --max-time 180 -o "$TMP_DIR/$ARTIFACT" "$URL"

# 校验 1: tar.gz 与官方 checksums.txt
EXPECTED="$(awk -v a="$ARTIFACT" '$2==a {print $1}' "$CHECKSUMS")"
ACTUAL="$(shasum -a 256 "$TMP_DIR/$ARTIFACT" | awk '{print $1}')"
if [[ -z "$EXPECTED" ]]; then
  echo "ERROR: ${ARTIFACT} not listed in checksums.txt" >&2
  exit 1
fi
if [[ "$ACTUAL" != "$EXPECTED" ]]; then
  echo "ERROR: checksum mismatch for ${ARTIFACT}: expected ${EXPECTED}, got ${ACTUAL}" >&2
  exit 1
fi
echo "ok: tar.gz checksum verified (${ACTUAL})"

# 解包
mkdir -p "$BIN_DIR"
tar -xzf "$TMP_DIR/$ARTIFACT" -C "$BIN_DIR"

# 校验 2: 解包二进制
BINARY="$BIN_DIR/peekaboo-macos-universal/peekaboo"
EXPECTED_BIN="$(awk '{print $1}' "$BINARY_SHA")"
ACTUAL_BIN="$(shasum -a 256 "$BINARY" | awk '{print $1}')"
if [[ "$ACTUAL_BIN" != "$EXPECTED_BIN" ]]; then
  echo "ERROR: binary checksum mismatch: expected ${EXPECTED_BIN}, got ${ACTUAL_BIN}" >&2
  exit 1
fi
chmod +x "$BINARY"
echo "ok: binary checksum verified -> $BINARY"
