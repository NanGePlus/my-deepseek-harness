# Agent Note: Git Graph 提交差异默认折叠

Status: implemented

[English](2026-08-28-git-graph-commit-diff-collapsed.md) | 中文

## Problem

Graph 单击文件很多的提交会卡住整页。`CommitDiffPane` 把空的 collapsed 集合当成全部展开，一次绘制就为每个文件（最多 80 个）挂上 `DiffPreviewContent` 并同步做 shiki 高亮。

## Decision

`CommitDiffPane` 跟踪 `expandedPaths`。文件头默认折叠。只有路径在该集合里时才挂载 `DiffPreviewContent`。切换选中提交会清空该集合。`host.gitCommitDiff` 仍一次 RPC 返回上限内的全部文件，与 [Git Graph 提交差异预览](../feature/2026-08-27-git-graph-commit-diff.md) 一致。

## Alternatives considered

**保持全部展开，对堆叠差异做虚拟滚动。** 否决：首次绘制仍会给已挂载的每个文件做分词；折叠文件头已符合浏览大提交时先看列表的用法。

**展开文件头时再向 Host 拉该文件预览。** 此次否决：Host 请求字段以及 Graph 与工作区选中互斥仍跟所属功能说明一致。卡住的是所有文件同时进 DOM 并高亮，不是已有 spinner 后面的 RPC 等待。

**只默认展开第一个文件。** 否决：单个大文件仍可能顿一下；只需要文件列表的用户不该付这份成本。

## Consequences

选中提交后先看到文件列表。展开文件头时仍在主线程为该文件构建预览行（含 `fileText` 上下文）。

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 断言 24 个文件的提交在展开文件头之前 `[data-diff-row]` 为零，折叠后这些行卸载。三文件 Graph 单击测试在断言预览文案之前先展开对应文件头。
