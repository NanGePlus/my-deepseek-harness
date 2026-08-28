# Agent Note: Git 面板重读时保留 Graph 与预览

Status: implemented

[English](2026-08-28-git-panel-refresh-flash.md) | 中文

## Problem

再次显示 Git Tab 时，Graph 会先换成「加载提交历史…」，右栏会先换成 spinner，然后再画出同样的内容。occupant 仍挂载，因此那次 loading 占位是闪烁，不是首次加载。

## Decision

`gitLog` 在重新拉取时保留 `ready` 的 Graph。文件预览与提交差异在选中路径或 hash 未变时保留 `ready` 结果。loading 占位只用于 Graph 首次加载或选中项变化。绑定另一个 Workspace 仍会清掉 Graph、预览与提交差异。

## Alternatives considered

**隐藏 Git occupant，而不是用 `visible`。** 否决：工具箱已经让 occupant 保持挂载，以便草稿和选中还在；闪烁来自 loading 占位，不是显隐壳层。

**从 `gitLog` effect 去掉 `view`，切回可见时不再重拉。** 否决：提交成功后 Graph 仍需重读；刷新保留，占位去掉。

## Consequences

首次进入仍显示 Graph 的加载文案。换文件或换 Graph 提交时，在新 payload 到达前仍显示 spinner。换 Workspace 不会留下上一个仓库的 Graph。

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 在 Git Tab 再次显示后挂起 `gitLog` / `gitDiffPreview` / `gitCommitDiff`，断言先前的 Graph 行、文件 hunk 或提交文件仍在屏幕上，且没有 loading 文案。
