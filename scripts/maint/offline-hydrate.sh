#!/usr/bin/env bash
# offline-hydrate.sh — 下游源码离线构建（MOTTO-DOWNSTREAM-0 机械门的一部分）。
#
# 背景：pi-ai 的 `generate-models` 在构建时从 models.dev 等远端拉取模型数据；
# 本机 HTTPS 代理无法到达 models.dev（环境限制，非 pi 缺陷）。离线路径：
#   1) 从已安装的同版本 npm 包（@earendil-works/pi-ai@0.84.1）拷贝 providers/data
#      （同一发行组合的构建输入，非产品改动，不入 git）；
#   2) 逐包按依赖序 build:offline（ai 用 offline，其余用 build）。
# 网络可达时，等价于根目录 `NODE_USE_ENV_PROXY=1 npm run build`。
#
# 用法：bash scripts/maint/offline-hydrate.sh   （在下游根 ~/Projects/pi 执行）

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOWNSTREAM="${MOTTO_DOWNSTREAM_ROOT:-$REPO_ROOT}"
INSTALLED_AI="/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai"
BASE_JSON="$REPO_ROOT/docs/maintenance/PI-BASE.json"
EXPECT_VER="$(python3 -c "import json;print(json.load(open('$BASE_JSON'))['upstream']['packageVersion'])" 2>/dev/null || echo 0.84.1)"

echo "== offline-hydrate: 数据水化 =="
SRC="$INSTALLED_AI/dist/providers/data"
DST="$DOWNSTREAM/packages/ai/src/providers/data"
if [[ ! -d "$SRC" ]]; then echo "FAIL: 未找到已安装 pi-ai 数据 ($SRC)"; exit 1; fi
mkdir -p "$DST"
cp "$SRC"/*.json "$DST"/
cp "$SRC"/.manifest.json "$DST"/ 2>/dev/null || true   # dotfile manifest 一并水化
echo "  copied $(ls "$DST" | wc -l | tr -d ' ') data files + .manifest.json (版本 $EXPECT_VER)"

echo "== ai (build:offline) =="
(cd "$DOWNSTREAM/packages/ai" && npm run build:offline) || exit 1

for p in tui telemetry agent session-backends/sqlite-node protocol client server coding-agent; do
  echo "== $p =="
  (cd "$DOWNSTREAM/packages/$p" && npm run build) || exit 1
done

CLI="$DOWNSTREAM/packages/coding-agent/dist/cli.js"
[[ -f "$CLI" ]] && echo "ALL_BUILD_OK: $CLI" || { echo "FAIL: cli.js 缺失"; exit 1; }
