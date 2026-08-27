# Agent Note: Git Graph 提交差异预览

Status: implemented

[English](2026-08-27-git-graph-commit-diff.md) | 中文

## Problem

Graph 单击某一提交只会高亮，右栏仍是工作区空态或上一次暂存/未暂存文件。没有读取某次提交文件列表与差异的 Host RPC，因此无法只靠 `host.gitLog` 做出参考图里的主从详情。

## Decision

新增 `host.gitCommitDiff({ workspaceId, hash })`。Host 解析 hash，再用 `git diff --find-renames HASH^ HASH` 列出文件（没有父提交时用 `git diff-tree --root`）。每条 name-status 变成一份 `GitDiffPreview`（新增文本走 `untracked-text`，删除文本走 `deleted-text`，已跟踪改动复用 hunks 加 `fileText`）。列表上限 80 个文件并设 `truncated`。Git 不可用与不是仓库仍是产品判别值；未知 hash 为 `git-failed`。

面板里 Graph 选中与工作区文件选中互斥。选中提交后，右栏堆叠可折叠、只读的文件段（没有按块暂存/取消暂存/丢弃）。再点工作区行会清掉提交选中，回到原来的工作区预览。

## Alternatives considered

**给 `host.gitDiffPreview` 加 `side: 'commit'`，按路径多次调用。** 否决：工作区预览是单路径加 hunk 操作；一次提交需要一轮拿到文件列表，且不能暴露暂存/丢弃。

**合入提交用无 `--first-parent` 的 `git show`。** 否决：combined diff 混进所有父提交；GitLens 与本 Graph 的第一父提交主干都是相对第一父提交比较。

**用户展开文件头时再拉单个文件。** 第一版否决：常见提交足够小，一次 RPC 就能填满堆叠视图；若 80 个文件上限太粗，以后可以再分页。

## Consequences

合入提交只显示相对第一父提交的变化，因此合入侧独有的文件会出现，而不是三方 combined 视图。二进制与 `.DS_Store` 路径跟工作区预览同一套规则。特别大的提交在上限之后的文件只靠 `truncated` 提示。

## Testing

`packages/host/apiproxy/tests/parse-git-commit-diff.spec.ts` 解析 name-status，并用真实仓库驱动 `readGitCommitDiff`（根提交、改/增/删、merge 第一父提交、重命名、二进制、空提交、上限）。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 断言线上转发 `hash`。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 单击 Graph 行，断言堆叠文件与只读差异、折叠、空提交与错误文案。
