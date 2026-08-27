# Agent Note: Git Graph commit diff preview

Status: implemented

English | [中文](2026-08-27-git-graph-commit-diff.zh.md)

## Problem

The Graph section highlighted a clicked commit but the right column still showed the working-tree empty state or the last staged/unstaged file. There was no Host RPC for a commit's file list and diffs, so the master-detail pattern from the GitLens-style reference could not be built on `host.gitLog` alone.

## Decision

Add `host.gitCommitDiff({ workspaceId, hash })`. The Host resolves the hash, then lists files with `git diff --find-renames HASH^ HASH` (or `git diff-tree --root` for a commit with no parents). Each name-status row becomes one `GitDiffPreview` (added text uses `untracked-text`; deleted text uses `deleted-text`; tracked edits reuse hunks plus `fileText`). The list is capped at 80 files and sets `truncated`. Git missing and not-a-repository stay product discriminants; an unknown hash is `git-failed`.

The panel treats Graph selection and working-tree file selection as mutually exclusive. A selected commit stacks collapsible, read-only file sections in the right column (no hunk stage/unstage/discard). Clicking a working-tree row clears the commit and restores the existing preview.

## Alternatives considered

**Reuse `host.gitDiffPreview` per path with a new `side: 'commit'`.** Rejected: the working-tree preview is one path plus hunk actions; a commit needs a file list in one round trip and must not expose stage/discard.

**`git show` without `--first-parent` on merges.** Rejected: combined diffs mix every parent; GitLens and this Graph's first-parent trunk both compare against the first parent.

**Fetch one file at a time as the user expands a header.** Rejected for the first version: typical commits are small enough that one RPC fills the stacked view; a later change can page files if the 80-file cap is too coarse.

## Consequences

Merge commits show only what changed versus the first parent, so files unique to the merged side appear, not a combined three-way view. Binary and `.DS_Store` paths follow the working-tree preview rules. Very large commits hide files past the cap behind `truncated`.

## Testing

`packages/host/apiproxy/tests/parse-git-commit-diff.spec.ts` parses name-status and drives `readGitCommitDiff` against real repositories (root, modify/add/delete, merge first-parent, rename, binary, empty, cap).

`packages/client/runtime/tests/workspaces-service.client.spec.ts` forwards `hash` on the wire.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` clicks a Graph row, asserts stacked files and read-only diffs, collapse, empty commit, and error copy.
