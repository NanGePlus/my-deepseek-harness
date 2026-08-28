# Agent Note: Git 预览不自动打开最新 Graph 提交

Status: implemented

[English](2026-08-28-git-preview-no-auto-select.md) | 中文

## Problem

进入 Git Tab 或重读 Graph 时，右栏总会打开最新一条 Graph 提交。已经打开更早提交或工作区文件的用户会丢掉该预览；首次进入也看不到空预览文案。

## Decision

`gitLog` 成功后不改 `selectedCommitHash`。右栏只展示用户上次点开的工作区文件或 Graph 提交。切走 Git Tab 会保留该选中，因为 occupant 仍挂载。绑定另一个 Workspace 会清掉两种选中。整页刷新从空预览开始。[Git Graph 提交差异预览](../feature/2026-08-27-git-graph-commit-diff.md) 仍拥有单击看差异的 RPC。

## Alternatives considered

**把上次打开的 hash 写入 Git 面板 store。** 本次修复否决：occupant 在切走 Git Tab 时已经还在；整页刷新显示空预览等同于从未选中，而不是自动打开 HEAD。

**当前 hash 不在已加载页时仍自动选 `commits[0]`。** 否决：`gitCommitDiff` 仍可按不在第一页的 hash 拉取；回落到最新提交会在 Graph 重读时抢走工作区文件预览。

## Consequences

第一条 Graph 行在用户单击之前不高亮。暂存或切换 Git Tab 后重读 Graph，不会把文件预览换成 HEAD。

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 加载两条 Graph 提交，断言空预览文案且单击前不调用 `gitCommitDiff`；切走再切回 Git Tab 仍保留上次打开的提交；工作区文件预览在 Graph 重读后不会被抢走。
