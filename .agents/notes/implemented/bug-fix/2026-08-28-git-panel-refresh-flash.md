# Agent Note: Git panel keeps Graph and preview while re-reading

Status: implemented

English | [中文](2026-08-28-git-panel-refresh-flash.zh.md)

## Problem

Showing the Git tab again replaced Graph with 「加载提交历史…」 and the right column with a spinner, then painted the same content. The occupant stays mounted, so that loading placeholder was a flicker, not a first load.

## Decision

`gitLog` keeps a `ready` Graph while it re-fetches. File preview and commit diff keep a `ready` result when the selected path or hash is unchanged. A loading placeholder is only for the first Graph load or a new selection. Binding a different Workspace still clears Graph, preview, and commit diff.

## Alternatives considered

**Hide the Git occupant instead of `visible`.** Rejected: the toolbox already keeps the occupant mounted so drafts and selection survive; the flicker is the loading placeholder, not the hide/show shell.

**Drop `view` from the `gitLog` effect so becoming visible does not re-fetch.** Rejected: a successful commit still needs Graph to re-read; the refresh stays, the placeholder does not.

## Consequences

The first visit still shows Graph loading copy. Switching files or Graph commits still shows a spinner until that new payload arrives. Changing Workspace does not keep the previous repository's Graph.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` hangs `gitLog` / `gitDiffPreview` / `gitCommitDiff` after the Git tab is shown and asserts the previous Graph row, file hunk, or commit file stays on screen without the loading copy.
