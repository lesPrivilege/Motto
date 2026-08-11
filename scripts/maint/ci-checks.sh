#!/usr/bin/env bash
# ci-checks.sh — 确定性仓库治理检查(CI 与本地通用,macOS)。
# 子命令:
#   governance    pack 结构 / registry 一致性 / checksum 元数据 / 二进制入库防线 / 类型检查 / drift-check
#   regression    拉取固定二进制 + 无需权限回归(全部 pack 单测 + computer-use smoke/boundary/...)
#   verify-upstream  拉取固定上游 release 并做两级 checksum 验证(不改仓库)
# 不包含: --live / pi-drive / TCC / 桌面 GUI / 需要模型凭据的测试。
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CMD="${1:-governance}"
cd "$REPO_ROOT"

FAIL=0
note() { echo "== $*"; }
ok() { echo "   ok: $*"; }
bad() { echo "   FAIL: $*"; FAIL=$((FAIL+1)); }

# ---------------------------------------------------------------- governance
if [[ "$CMD" == "governance" ]]; then
  note "pack structure + registry consistency + checksum metadata + binary guard + typecheck + drift"

  REG="packages/motto/extensions/REGISTRY.md"
  for packdir in packages/motto/extensions/*/; do
    [[ -d "$packdir" ]] || continue
    name="$(basename "$packdir")"
    grep -q "| \`$name\`" "$REG" && ok "registry lists $name" || { bad "registry missing $name"; }

    # --- 主题 pack(motto-themes):声明式 JSON,无 index.ts / checksums / test
    if [[ -d "$packdir/../motto-themes" ]] && [[ "$name" == "motto-themes" ]]; then
      for f in README.md reports docs/usage-log; do
        [[ -e "$packdir/$f" ]] || bad "$name missing $f"
      done
      for f in motto.json motto-dark.json motto-light.json; do
        python3 -c "import json,sys; json.load(open('$packdir/$f'))" && ok "$name/$f valid JSON" || bad "$name/$f invalid JSON"
      done
      [[ -f "$packdir/index.ts" ]] && bad "$name should not have index.ts (theme pack)" || ok "$name no index.ts"
      continue
    fi

    # --- 扩展 pack
    for f in index.ts README.md test reports docs/usage-log; do
      [[ -e "$packdir/$f" ]] || bad "$name missing $f"
    done
    # --- checksum 元数据:仅对声明二进制依赖的 pack(有 checksums/ 目录)
    if [[ -d "$packdir/checksums" ]]; then
      [[ -s "$packdir/checksums/VERSION" ]] || bad "$name checksums/VERSION empty"
      [[ -s "$packdir/checksums/checksums.txt" ]] || bad "$name checksums.txt empty"
      if [[ -f "$packdir/checksums/binary.sha256" ]]; then
        grep -Eq '^[0-9a-f]{64}[[:space:]]+[^ ]+$' "$packdir/checksums/binary.sha256" || bad "$name binary.sha256 format"
      fi
    fi
    # --- 类型检查
    if [[ -f "$packdir/tsconfig.json" ]]; then
      ( cd "$packdir" && npx tsc --noEmit >/tmp/tsc-$name.log 2>&1 ) && ok "typecheck $name" || { bad "typecheck $name"; tail -5 /tmp/tsc-$name.log; }
    fi
  done
  # REGISTRY 里出现的包必须真实存在
  while read -r p; do
    [[ -d "packages/motto/extensions/$p" ]] || bad "registry references missing pack $p"
  done < <(grep -oE '^\| `[a-z0-9-]+`' "$REG" | sed -E 's/^\| `([a-z0-9-]+)`/\1/')

  # --- 二进制入库防线
  BAD_TRACKED="$(git ls-files | grep -E '(^|/)(bin|node_modules)/|\.(tar\.gz|zip|dmg|tgz|dylib)$' || true)"
  if [[ -n "$BAD_TRACKED" ]]; then
    bad "binaries/build artifacts tracked:"; echo "$BAD_TRACKED" | sed 's/^/      /'
  else
    ok "no binaries/build artifacts tracked"
  fi

  # --- TUI 无头基线门禁(P0-3,2026-08-11):--check 与已提交基线逐字节比对 + 逐宽度零超宽
  if command -v node >/dev/null 2>&1 && [[ -f "fixtures/tui/render-baseline.mjs" ]]; then
    if ( cd "$REPO_ROOT" && node --experimental-strip-types fixtures/tui/render-baseline.mjs --check ) >/tmp/baseline-ci.log 2>&1; then
      ok "TUI baseline --check PASS"
    else
      bad "TUI baseline --check"; tail -8 /tmp/baseline-ci.log | sed 's/^/      /'
    fi
  else
    note "node or render-baseline missing — skip TUI baseline check"
  fi

  # --- drift-check(部署位 vs 仓库;本地有部署时执行,CI 无部署位则跳过)
  if [[ -d "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/extensions" ]]; then
    if bash scripts/maint/drift-check.sh >/tmp/drift-ci.log 2>&1; then
      ok "drift-check PASS"
    else
      bad "drift-check:"; cat /tmp/drift-ci.log | sed 's/^/      /'
    fi
  else
    note "deploy dir not present — skip drift-check"
  fi

  if [[ "$FAIL" == 0 ]]; then echo "GOVERNANCE: PASS"; else echo "GOVERNANCE: $FAIL FAILED"; fi
  exit $((FAIL>0?1:0))
fi

# ---------------------------------------------------------------- regression
if [[ "$CMD" == "regression" ]]; then
  note "fetch pinned binaries + no-permission regression"
  for packdir in packages/motto/extensions/*/; do
    [[ -d "$packdir" ]] || continue
    name="$(basename "$packdir")"
    [[ -f "$packdir/checksums/fetch.sh" ]] || continue
    if ! bash scripts/maint/fetch-binaries.sh "$packdir" >/tmp/fetch-$name.log 2>&1; then
      bad "fetch binary $name"; tail -5 /tmp/fetch-$name.log; continue
    fi
    ok "binary verified $name"
  done
  if ! ./scripts/maint/regression.sh >/tmp/regression-ci.log 2>&1; then
    bad "no-permission regression"; tail -20 /tmp/regression-ci.log
  else
    tail -3 /tmp/regression-ci.log
  fi
  if [[ "$FAIL" == 0 ]]; then echo "REGRESSION: PASS"; else echo "REGRESSION: $FAIL FAILED"; fi
  exit $((FAIL>0?1:0))
fi

# ---------------------------------------------------------------- verify-upstream
if [[ "$CMD" == "verify-upstream" ]]; then
  note "fetch pinned upstream release + two-level checksum verification"
  ALLOK=1
  for packdir in packages/motto/extensions/*/; do
    [[ -d "$packdir" ]] || continue
    name="$(basename "$packdir")"
    [[ -f "$packdir/checksums/fetch.sh" ]] || continue
    TMP="$(mktemp -d)"
    if PACK_DIR="$packdir" BIN_DIR="$TMP/bin" bash "$packdir/checksums/fetch.sh" >/tmp/up-$name.log 2>&1; then
      ok "upstream v$(cat "$packdir/checksums/VERSION") checksums verified for $name"
    else
      bad "upstream verification $name"; tail -5 /tmp/up-$name.log; ALLOK=0
    fi
    rm -rf "$TMP"
  done
  if [[ "$ALLOK" == 1 ]]; then echo "UPSTREAM: PASS"; else echo "UPSTREAM: FAIL"; fi
  exit $((ALLOK==1?0:1))
fi

echo "unknown cmd: $CMD (governance|regression|verify-upstream)" >&2
exit 2
