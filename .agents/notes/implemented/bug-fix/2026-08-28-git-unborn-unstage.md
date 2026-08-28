# Agent Note: Git unstage on an unborn branch

Status: implemented

English | [中文](2026-08-28-git-unborn-unstage.zh.md)

## Problem

**Remove from commit** on a repository that has never been committed failed with `fatal: could not resolve HEAD`. The files stayed in **Ready to commit**. The CHANGES list can show staged untracked files after `git add` with no HEAD.

## Decision

Whole-file `host.gitUnstage` keeps `git restore --staged` when `HEAD` names a commit. When it does not, Host runs `git rm --cached -f` for that path so the index drops the added blob and the worktree file stays on disk as untracked. The write RPC owner is [Host Git working-tree write RPCs](../feature/2026-08-25-host-git-write.md).

## Alternatives considered

**Show product copy for `could not resolve HEAD` and leave the index unchanged.** Rejected: unstage is a valid action before the first commit; the panel already listed the staged rows.

**Disable unstage until HEAD exists.** Rejected: users stage files in order to unstage them; hiding the control would not match the list.

**Always use `git rm --cached -f`.** Rejected: after the first commit, `git restore --staged` is the restore-from-HEAD path for tracked modifications.

## Consequences

Unstage still does not rewrite disk. Hunk unstage still uses `git apply --cached --reverse`.

## Testing

`packages/host/apiproxy/tests/api-proxy-git-write.spec.ts` unstages an added path on an unborn branch, including when the worktree later diverges from the index, and keeps the existing restore-from-HEAD case.
