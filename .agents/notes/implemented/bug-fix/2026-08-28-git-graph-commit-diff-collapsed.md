# Agent Note: Git Graph commit-diff sections start collapsed

Status: implemented

English | [中文](2026-08-28-git-graph-commit-diff-collapsed.zh.md)

## Problem

Clicking a Graph commit with many files froze the page. `CommitDiffPane` treated an empty collapsed set as every section expanded, so one paint mounted `DiffPreviewContent` and synchronous shiki highlighting for every file (up to 80).

## Decision

`CommitDiffPane` tracks `expandedPaths`. File headers start collapsed. `DiffPreviewContent` mounts only while that path is in the set. Switching the selected commit clears the set. `host.gitCommitDiff` still returns every capped file in one RPC, as in [Git Graph commit diff preview](../feature/2026-08-27-git-graph-commit-diff.md).

## Alternatives considered

**Keep every section expanded and virtualize the stacked diffs.** Rejected: the first paint still tokenizes every mounted file; collapsed headers already match scanning a large commit.

**Fetch one file's preview from Host when the header expands.** Rejected for this change: Host request fields and Graph versus working-tree exclusivity stay as in the owning feature note. The freeze was simultaneous DOM and highlighting of every file, not the RPC wait behind the existing spinner.

**Expand the first file only.** Rejected: one large file can still hitch; a user who only needs the file list should not pay that cost.

## Consequences

A selected commit shows a file list first. Expanding a header still builds that file's preview rows, including `fileText` context, on the main thread.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` asserts a 24-file commit has zero `[data-diff-row]` nodes until a header expands, and that collapse unmounts those rows. The three-file Graph click test expands headers before asserting preview copy.
