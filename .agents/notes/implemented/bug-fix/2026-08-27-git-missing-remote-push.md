# Agent Note: Git missing-remote push copy

Status: implemented

English | [中文](2026-08-27-git-missing-remote-push.zh.md)

## Problem

A newly initialized workspace has no remotes. **Commit & push** and **Push** still invoked `git push`, and Git answered `fatal: No configured push destination.` The Git panel showed that English stderr beside **Commit**; CSS ellipsis cut it to `fatal: No config...`. Combined commit-and-push also ran `git commit` first, so a push failure could leave a new HEAD while the RPC still failed.

## Decision

Host lists remotes with `git remote` before any push. Empty output fails with `git-failed` `no remote configured`. **Commit & push** runs that check before `git commit`, so a missing remote does not create the commit. The panel maps that token and Git's `No configured push destination` / `No such remote` text to 「没有配置远程仓库地址」 / 「No remote repository is configured」.

## Alternatives considered

**Show Git's full stderr in a tooltip.** Rejected: the request is product copy that names the missing remote, not a longer fatal dump.

**Disable Commit & push until a remote exists.** Rejected for this change: a clear error is the immediate fix. Standalone **Commit** stays available. Adding a remote from the panel is [Git panel add-remote entry](../feature/2026-08-27-git-add-remote.md).

## Consequences

Users add `origin` from the panel when `hasRemote` is false; see [Git panel add-remote entry](../feature/2026-08-27-git-add-remote.md). Non-fast-forward rejections are [Git rejected-push copy](2026-08-28-git-push-rejected-copy.md). Other push failures keep Git's own text.

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` refuses `gitPush` and `gitCommit({push:true})` with `no remote configured` and asserts HEAD and the index stay put.

`packages/client/ui-git/tests/git-error-copy.client.spec.ts` matches Host and Git phrases.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` asserts the product copy on commit-and-push and standalone Push.
