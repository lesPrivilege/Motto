#!/usr/bin/env bash
# maint-lib.sh — 维护机制共享库(泛化,合并就绪)。
#
# 统一路径解析:env > 配置(MAINT_CONFIG,默认 ~/.pi/agent/maintenance/config.json) > 默认。
# 合并前(双仓)与合并后(harness 并产品单仓)同一套脚本可用:
#   - HARNESS_REPO  下游/harness 仓根(合并后 = 单仓)
#   - SCRIPTS_ROOT  维护脚本所在目录(自定位,随仓走)
#   - STATE_FILE    定期检查状态文件
# 用法: source "$(dirname "${BASH_SOURCE[0]}")/maint-lib.sh"

MAINT_CONFIG="${MAINT_CONFIG:-$HOME/.pi/agent/maintenance/config.json}"

maint_load_config() {
  HARNESS_REPO="${MOTTO_DOWNSTREAM_ROOT:-$HOME/Projects/Motto}"
  SCRIPTS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  STATE_FILE="$HOME/.pi/agent/maintenance/last-check.json"
  if [[ -f "$MAINT_CONFIG" ]]; then
    local val
    val="$(python3 -c "import json,sys;print(json.load(open('$MAINT_CONFIG')).get('harnessRepo',''))" 2>/dev/null)"
    [[ -n "$val" ]] && HARNESS_REPO="$val"
    val="$(python3 -c "import json,sys;print(json.load(open('$MAINT_CONFIG')).get('stateFile',''))" 2>/dev/null)"
    [[ -n "$val" ]] && STATE_FILE="$val"
  fi
  export HARNESS_REPO SCRIPTS_ROOT STATE_FILE
}
