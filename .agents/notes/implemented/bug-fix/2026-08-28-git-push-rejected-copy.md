# Agent Note: Git rejected-push copy

Status: implemented

English | [中文](2026-08-28-git-push-rejected-copy.zh.md)

## Problem

First **Push** to a GitHub remote that already has commits (a README on create, for example) fails with a non-fast-forward. Git's stderr starts with `To https://…`. The push-row error uses CSS ellipsis, so the panel showed only `To https://github.com/NanG…` and hid `[rejected]` / `fetch first`.

## Decision

Host `gitFailureMessage` drops `To <url>` destination lines so the RPC message starts at the rejection. The panel maps `[rejected]`, `non-fast-forward`, and `(fetch first)` to 「远程已有提交，无法快进推送」 / 「The remote has commits that would not fast-forward」. The ellipsized error span keeps a `title` with the displayed text. This is the same product-copy pattern as [Git missing-remote push copy](2026-08-27-git-missing-remote-push.md).

## Alternatives considered

**Show Git's full stderr in a tooltip and leave the first line as `To <url>`.** Rejected: the on-screen label is what users read; the destination line is not the failure.

**Add Pull to the panel so a rejected push can integrate remote commits.** Rejected for this change: the request is readable copy for a failed first push. The panel still has no pull.

**Always `git push --force` on an unpublished branch.** Rejected: that would overwrite remote history the user just created on GitHub.

## Consequences

A GitHub repository created with a README still cannot fast-forward from an unrelated local root. The panel names that fact. Permission-denied and other push failures keep Git's own text after the `To <url>` lines are stripped.

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` pushes onto a remote that already has a different root commit and asserts `git-failed` whose message does not start with `To `.

`packages/client/ui-git/tests/git-error-copy.client.spec.ts` matches rejection phrases and not `[remote rejected]`.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` maps that stderr to the product copy on standalone **Push**.
