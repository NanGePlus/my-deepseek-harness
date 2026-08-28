# Agent Note: Git panel remove-remote

Status: implemented

English | [中文](2026-08-27-git-remove-remote.zh.md)

## Problem

After [adding origin](2026-08-27-git-add-remote.md), the panel had no way to delete that remote. Users who mistyped a URL, or who wanted to clear `origin` before adding another, had to leave the toolbox.

## Decision

`GitWorkingTreeResult` includes optional `originUrl` from `git remote get-url origin` (omitted when that name is missing, even if other remotes exist). When it is set, a line under the branch shows the URL (ellipsis; full URL as `title`) and **Remove remote URL**. Confirming runs `host.gitRemoveRemote({ workspaceId })`, which is `git remote remove origin` and returns the refreshed tree. The RPC does not fetch, push, or touch remotes with other names. When `origin` is missing, Git's own text rides `git-failed`.

After a successful remove, if no remotes remain, `hasRemote` is false and the add-remote entry appears. If another remote remains, `hasRemote` stays true and the add-remote entry stays hidden.

## Alternatives considered

**Remove every remote.** Rejected: add and first-push already pin `origin`. Deleting `upstream` would not match that fallback.

**`git remote set-url` instead of remove-then-add.** Rejected: changing an existing URL is a different product step; this control only deletes `origin`.

**Skip confirm.** Rejected: **Commit**, **Commit & push**, and **Push** already confirm; deleting a remote is the same class of write.

## Consequences

Repositories that only have a non-`origin` remote show neither add nor remove. The panel still does not list remotes or rename them.

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` reports `originUrl` on inspect, removes origin, leaves other remotes, and refuses remove when origin is missing.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` forwards `workspaceId` on the wire.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` shows the origin row, confirms remove, cancels without Host, and maps Host failures onto the row.
