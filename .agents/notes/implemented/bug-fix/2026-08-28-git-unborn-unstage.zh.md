# Agent Note: Git 未提交时移出提交

Status: implemented

[English](2026-08-28-git-unborn-unstage.md) | 中文

## Problem

从未提交过的仓库上点 **移出提交** 会失败，错误为 `fatal: could not resolve HEAD`。文件仍留在 **待提交**。`git add` 之后、尚无 HEAD 时，CHANGES 仍可列出已暂存的未跟踪文件。

## Decision

整文件 `host.gitUnstage` 在 `HEAD` 指向一次提交时仍用 `git restore --staged`。没有 HEAD 时 Host 对该路径执行 `git rm --cached -f`，从 index 去掉已添加的 blob，工作区文件留在磁盘上变成未跟踪。写 RPC 的归属见 [Host Git working-tree write RPCs](../feature/2026-08-25-host-git-write.md)。

## Alternatives considered

**把 `could not resolve HEAD` 映射成产品文案，index 不动。** 否决：首次提交前移出提交是合法操作；面板已经列出了这些已暂存行。

**在有 HEAD 之前禁用移出。** 否决：用户把文件选入就是为了还能移出；藏掉控件和列表对不上。

**一律使用 `git rm --cached -f`。** 否决：首次提交之后，已跟踪修改要走从 HEAD 还原 index 的 `git restore --staged`。

## Consequences

取消暂存仍不改写磁盘。按块取消暂存仍用 `git apply --cached --reverse`。

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` 在未出生分支上移出已添加路径（含工作区随后与 index 不一致），并保留已有的从 HEAD 还原用例。
