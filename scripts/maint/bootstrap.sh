#!/usr/bin/env bash
# bootstrap.sh — 新机器从零到可用(幂等,重复执行零副作用)。
#
# 步骤: 检查 pi 安装与钉版 → 拉取固定二进制(已校验则跳过) → deploy 全 pack + 主题
#       → 安装 launcher shim → 打印「人工项清单」(只打印不代写)。
#
# 用户环境文件的修改保持显式动作纪律(与 .motto 立域同族):settings.json / zshrc /
# ghostty 只在末尾打印键值与出处,绝不代写。足迹清单见 docs/MIGRATION.md。
#
# 用法:
#   ./scripts/maint/bootstrap.sh                          # 常规(部署位=~/.pi/agent, shim=~/bin/motto)
#   HOME=/tmp/sandbox PI_CODING_AGENT_DIR=/tmp/sandbox/.pi/agent ./scripts/maint/bootstrap.sh  # 沙盒验收
#   MOTTO_BIN_DIR=/tmp/sandbox/bin ./scripts/maint/bootstrap.sh                                 # 覆盖 shim 落点
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
BIN_DIR="${MOTTO_BIN_DIR:-$HOME/bin}"

PINNED_PI_VERSION="$(node -e "console.log(require('$REPO_ROOT/packages/motto/extensions/motto/package.json').dependencies['@earendil-works/pi-coding-agent'])")"

echo "== 1/4 检查 pi 安装与版本(钉版 $PINNED_PI_VERSION)=="
if ! command -v pi >/dev/null 2>&1; then
  echo "ERROR: pi 未安装。先按 pi 官方安装流程装好 pi,再跑本脚本。" >&2
  exit 1
fi
PI_ACTUAL="$(pi --version 2>&1 | tail -1)"
echo "  pi installed: $PI_ACTUAL"
if [[ "$PI_ACTUAL" != "$PINNED_PI_VERSION" ]]; then
  echo "  WARN: 版本与钉版不一致(期望 $PINNED_PI_VERSION)。继续部署;升级/回退按 MAINTENANCE 流程裁定。"
fi

echo "== 2/4 固定二进制(computer-use,两级校验 fail-closed)=="
PEEKABOO_BIN="$REPO_ROOT/packages/motto/extensions/motto-computer-use/bin/peekaboo-macos-universal/peekaboo"
PEEKABOO_SHA="$REPO_ROOT/packages/motto/extensions/motto-computer-use/checksums/binary.sha256"
if [[ -f "$PEEKABOO_BIN" && "$(shasum -a 256 "$PEEKABOO_BIN" | awk '{print $1}')" == "$(awk '{print $1}' "$PEEKABOO_SHA")" ]]; then
  echo "  binary 已就位且校验通过(幂等跳过): $PEEKABOO_BIN"
else
  bash "$REPO_ROOT/scripts/maint/fetch-binaries.sh" packages/motto/extensions/motto-computer-use
fi

echo "== 3/4 部署全 pack + 主题(部署位 $AGENT_DIR)=="
PI_CODING_AGENT_DIR="$AGENT_DIR" bash "$REPO_ROOT/scripts/maint/deploy.sh"

echo "== 4/4 launcher shim =="
mkdir -p "$BIN_DIR"
SHIM_TARGET="$BIN_DIR/motto"
if [[ -L "$SHIM_TARGET" && "$(readlink "$SHIM_TARGET")" == "$REPO_ROOT/scripts/maint/motto" ]]; then
  echo "  shim 已就位(幂等跳过): $SHIM_TARGET"
elif [[ -e "$SHIM_TARGET" || -L "$SHIM_TARGET" ]]; then
  echo "  WARN: $SHIM_TARGET 已存在且非本仓 shim,不覆盖(显式动作纪律,请人工处置)。"
else
  ln -s "$REPO_ROOT/scripts/maint/motto" "$SHIM_TARGET"
  echo "  已安装: $SHIM_TARGET -> $REPO_ROOT/scripts/maint/motto"
fi

echo
echo "== 人工项清单(只打印不代写,出处与依据见 docs/MIGRATION.md)=="
cat <<'EOF'
[A] ~/.pi/agent/settings.json 关键键(该文件归 ~/.pi/agent git 仓,迁移即 clone;仅列键名与依据)
    theme: "motto-light/motto-dark"     # 双值,牌记/footer 双宗
    hideThinkingBlock: true             # thinking 隐藏
    packages: [pi-rewind@0.5.0, pi-lsp@0.49.4, pi-subagents@0.14.3]  # 钉版,省视第五步核对
    (defaultProvider/defaultModel/defaultThinkingLevel/quietStartup 视个人偏好)

[B] ~/.zshrc 两条 MOTTO_COPY env(快捷键 env-gated,见 motto-canonical-copy)
    export MOTTO_COPY_ANSWER_SHORTCUT=alt+c   # ⌥C 复制最后一条 answer
    export MOTTO_COPY_CODE_SHORTCUT=alt+x     # ⌥X 复制最后一段 fenced code

[C] ghostty 配置 theme = light:/dark: 双值(双宗 auto,不跟随系统的终端须自声明外观与底色一致)
    theme = light:<…>/motto-light dark:<…>/motto-dark
    (motto 主题文件已在 ~/.config/ghostty/themes/)

[D] 各项目 .motto/agent.md — 随项目仓走,无需迁移动作。
EOF

echo
echo "bootstrap: done(幂等,可重复执行)"
