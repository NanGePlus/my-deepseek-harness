#!/usr/bin/env bash
# 有人参与的复现循环脚本
# 复制此文件，编辑下方步骤，然后运行。
# agent 运行脚本；用户在终端中按提示操作。
#
# 用法：
#   bash hitl-loop.template.sh
#
# 两个辅助函数：
#   step "<instruction>"          → 显示指令，等待 Enter
#   capture VAR "<question>"      → 显示问题，将回答读入 VAR
#
# 结束时，捕获的值以 KEY=VALUE 形式打印，供 agent 解析。

set -euo pipefail

step() {
  printf '\n>>> %s\n' "$1"
  read -r -p "    [完成后按 Enter] " _
}

capture() {
  local var="$1" question="$2" answer
  printf '\n>>> %s\n' "$question"
  read -r -p "    > " answer
  printf -v "$var" '%s' "$answer"
}

# --- 在下方编辑 ---------------------------------------------------------

step "在 http://localhost:3000 打开应用并登录。"

capture ERRORED "点击「Export」按钮。是否抛出错误？(y/n)"

capture ERROR_MSG "粘贴错误信息（或输入 'none'）："

# --- 在上方编辑 ---------------------------------------------------------

printf '\n--- 已捕获 ---\n'
printf 'ERRORED=%s\n' "$ERRORED"
printf 'ERROR_MSG=%s\n' "$ERROR_MSG"
