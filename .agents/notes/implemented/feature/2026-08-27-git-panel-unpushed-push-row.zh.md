# Agent Note: Git 面板未推送文案与推送行

Status: implemented

[English](2026-08-27-git-panel-unpushed-push-row.md) | 中文

## 问题

Git 面板把 Git 行话（`领先 N` / `N ahead`）和「提交到分支」放在同一行。普通用户看不出这表示本地提交还没到远程。独立 **推送** 按钮又在提交工具栏里，计数和动作不是同一控件。

## 决策

`pushAvailable` 为真时，分支名下一行用白话文案加上 **推送**（`host.gitPush`）。相对上游超前时用「有 {count} 个提交尚未推送」/ `{count} commits not pushed yet`。从未推送过的分支用「尚未推送到远程」/ `Not pushed to remote yet`。`pushAvailable` 为假时整行不渲染，包括按钮。

推送成功/失败提示仍贴在该行的 **推送** 旁。推送成功后未推送文案和按钮隐藏，成功提示仍留在第二行直到超时。提交工具栏只保留 **提交** 以及提交 / 提交并推送的反馈。**推送** 的 Tooltip 包在 `.pushButtonShell` 外面：该壳用 `isolation: isolate` 约束 pending 描边的层叠，若气泡画在壳内会被备注输入框盖住。

## 曾考虑的方案

**保留「领先 N」，用 tooltip 解释。** 否决：用户先读到的是行内标签，行话仍贴在分支名旁边。

**推送留在提交工具栏，只挪文案。** 否决：需求是未推送事实与推送动作同一行。

**`ahead` 缺失（含首次推送）时也隐藏第二行。** 否决：Host 对首次推送只报 `pushAvailable`、不报 `ahead`；隐藏该情况会拿掉唯一的独立推送控件。

## 后果

提交工具栏不再放独立 **推送**。首次推送仍走第二行的尚未推送文案。

## 测试

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 断言超前文案与 **推送** 共用分支名下方的 `data-git-push-row`、从未推送分支显示尚未推送文案、干净仓库没有未推送行。

`packages/client/ui-git/tests/git-panel-icon-sizing.client.spec.ts` 要求 `.branchRow` 纵向排列、`.pushRow` 为横向 flex。

`packages/client/ui-git/tests/icon-button-hover.client.spec.ts` 要求 **推送** Tooltip 包在 `.pushButtonShell` 外，气泡才能叠在备注框之上。
