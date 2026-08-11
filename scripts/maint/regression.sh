#!/usr/bin/env bash
# regression.sh — 全量回归入口(所有 pack)。
# 默认: 无权限测试(各 pack 的 node --test 单测 + computer-use 的 smoke/boundary/netcheck/proctree/permcheck)。
# --live : 追加动态 live + 真实模型闭环(computer-use,需权限;Motto TUI pack 的活体见各 pack reports)。
# 结尾: drift-check(部署位 vs 仓库)。
# 用法:
#   ./scripts/regression.sh                 # 全 pack 无权限回归
#   ./scripts/regression.sh --live          # 追加动态验收
#   ./scripts/regression.sh <pack-dir>      # 只跑指定 pack
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIVE=0
TARGET=""
for a in "$@"; do
  case "$a" in
    --live) LIVE=1 ;;
    *) TARGET="$a" ;;
  esac
done

export NODE_PATH=/opt/homebrew/lib/node_modules

PASS=0; FAIL=0

run_node_test() { # $1=pack_dir — 新式 pack 单测(node --test)
  local pack="$1" name
  name="$(basename "$pack")"
  if compgen -G "$pack/test/*.test.mjs" >/dev/null; then
    if ( cd "$pack" && node --test test/*.test.mjs ) >/tmp/regression-$name.log 2>&1; then
      echo "  PASS $name unit-tests"; PASS=$((PASS+1))
    else
      echo "  FAIL $name unit-tests (log: /tmp/regression-$name.log)"; FAIL=$((FAIL+1))
    fi
  fi
}

run_mts() { # $1=pack_dir, $2=test_file — computer-use 旧式 .mts(需固定二进制)
  local pack="$1" file="$2" name
  name="$(basename "$pack")"
  local bin
  bin="$(find "$pack/bin" -name peekaboo -type f 2>/dev/null | head -1)"
  if [[ -z "$bin" ]]; then
    echo "  SKIP $name $file (binary missing — run scripts/fetch-binaries.sh $name)" >&2
    return
  fi
  if PEEKABOO_BIN="$bin" PEEKABOO_EXPECTED_VERSION="$(cat "$pack/checksums/VERSION" 2>/dev/null)" \
      node --experimental-strip-types "$pack/test/$file" >/tmp/regression-$name-$file.log 2>&1; then
    echo "  PASS $name $file"; PASS=$((PASS+1))
  else
    echo "  FAIL $name $file (log: /tmp/regression-$name-$file.log)"; FAIL=$((FAIL+1))
  fi
}

run_gate() { # $1=pack_dir — gate.mts 是纯门禁单测,不需要固定二进制,无条件跑
  local pack="$1" name
  name="$(basename "$pack")"
  if [[ ! -f "$pack/test/gate.mts" ]]; then return; fi
  if node --experimental-strip-types "$pack/test/gate.mts" >/tmp/regression-$name-gate.log 2>&1; then
    echo "  PASS $name gate"; PASS=$((PASS+1))
  else
    echo "  FAIL $name gate (log: /tmp/regression-$name-gate.log)"; FAIL=$((FAIL+1))
  fi
}

for pack in "$REPO_ROOT"/extensions/*/; do
  [[ -d "$pack/test" ]] || continue
  name="$(basename "$pack")"
  if [[ -n "$TARGET" && "$name" != "$TARGET" ]]; then continue; fi
  echo "===== $name ====="
  run_node_test "$pack"
  run_gate "$pack"
  for t in smoke boundary netcheck proctree permcheck; do
    if [[ -f "$pack/test/$t.mts" ]]; then
      run_mts "$pack" "$t.mts"
    fi
  done
  if [[ "$LIVE" == 1 ]]; then
    if [[ -f "$pack/test/live.mts" ]]; then run_mts "$pack" "live.mts"; fi
    if [[ -f "$pack/test/pi-drive.sh" ]]; then
      if bash "$pack/test/pi-drive.sh" >/tmp/regression-pi-drive.log 2>&1; then
        echo "  PASS $name pi-drive"; PASS=$((PASS+1))
      else
        echo "  FAIL $name pi-drive"; FAIL=$((FAIL+1))
      fi
    fi
  fi
done

echo
if [[ -d "${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/extensions" ]]; then
  echo "== drift check(部署位 vs 仓库)== "
  if ! bash "$REPO_ROOT/scripts/drift-check.sh" "$TARGET" >/tmp/drift.log 2>&1; then
    echo "  FAIL drift-check:"; cat /tmp/drift.log | sed 's/^/    /'; FAIL=$((FAIL+1))
  else
    echo "  PASS drift-check"; PASS=$((PASS+1))
  fi
else
  echo "== drift check == "
  echo "  SKIP drift-check (deploy dir not present — 与 governance 同策略,无部署位即跳过)"
fi

echo
echo "regression: $PASS passed, $FAIL failed"
exit $((FAIL > 0 ? 1 : 0))
