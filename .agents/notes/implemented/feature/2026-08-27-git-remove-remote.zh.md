# Agent Note: Git 面板删除远程地址

Status: implemented

[English](2026-08-27-git-remove-remote.md) | 中文

## Problem

[添加 origin](2026-08-27-git-add-remote.md) 之后，面板没有入口删除这条远程。URL 填错、或想清掉 `origin` 再加另一条时，只能离开工具箱。

## Decision

`GitWorkingTreeResult` 增加可选 `originUrl`，来自 `git remote get-url origin`（没有名为 `origin` 的远程时省略，即使还有其它 remote）。有值时，分支名下一行显示该 URL（过长省略，完整地址作 `title`）和 **删除远程地址**。确认后调用 `host.gitRemoveRemote({ workspaceId })`，即 `git remote remove origin`，并返回刷新后的工作树。该 RPC 不 fetch、不 push、不碰其它名字的 remote。`origin` 不存在时，Git 原文走 `git-failed`。

删除成功后，若已经没有任何 remote，`hasRemote` 为 false，添加入口出现。若还剩其它 remote，`hasRemote` 仍为 true，添加入口保持隐藏。

## Alternatives considered

**删掉全部 remote。** 否决：添加和首次推送已经钉死 `origin`。删 `upstream` 对不上那条回落。

**用 `git remote set-url` 代替先删后加。** 否决：改已有 URL 是另一步产品操作；本控件只删除 `origin`。

**跳过确认。** 否决：**提交**、**提交并推送**、**推送** 已经确认；删远程同属写操作。

## Consequences

只有非 `origin` 的 remote 时，面板既不显示添加也不显示删除。面板仍不列出或重命名 remote。

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` 在 inspect 上报告 `originUrl`、删除 origin、保留其它 remote，并在 origin 缺失时拒绝删除。

`packages/client/runtime/tests/workspaces-service.client.spec.ts` 在线上转发 `workspaceId`。

`packages/client/ui-git/tests/git-panel.client.spec.tsx` 显示 origin 行、确认删除、取消不发 Host，并把 Host 失败映射到该行。
