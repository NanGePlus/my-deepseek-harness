# Agent Note: Git unpublished push requires a local commit

Status: implemented

English | [中文](2026-08-28-git-unborn-push-available.zh.md)

## Problem

Adding `origin` on a repository that has never been committed immediately showed 「尚未推送到远程」 / `Not pushed to remote yet` and **Push**. The CHANGES count can be non-zero from unstaged files; that is not an unpushed commit.

## Decision

`readPublishState` treats a missing `@{upstream}` as first-time push only after `git rev-parse --verify HEAD` succeeds. An unborn branch reports `pushAvailable` false. A named branch that already has commits and no upstream still reports `pushAvailable` true so the unpublished row in [Git panel unpushed copy and push row](../feature/2026-08-27-git-panel-unpushed-push-row.md) remains the first-publish control.

## Alternatives considered

**Hide the unpublished row whenever `origin` was just added.** Rejected: local commits waiting for a first `git push -u` still need that row.

**Keep `pushAvailable` true and change only the panel copy.** Rejected: there is nothing to push; Host must not advertise `gitPush`.

## Consequences

Adding a remote URL is not itself an unpushed state. **Commit & push** still creates HEAD first, then publishes.

## Testing

`packages/host/apiproxy/tests/api-proxy-git-working-tree.spec.ts` inspects an unborn branch.

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` adds `origin` with no commits and asserts `pushAvailable` false; adding `origin` after a local commit still reports `pushAvailable` true.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` keeps origin URL plus delete when `pushAvailable` is false, without unpublished copy or **Push**.
