# Agent Note: Git preview does not auto-open the newest Graph commit

Status: implemented

English | [中文](2026-08-28-git-preview-no-auto-select.zh.md)

## Problem

Entering the Git tab or re-reading Graph always opened the newest Graph commit in the right column. Users who had opened a later commit or a working-tree file lost that preview; a first visit never showed the empty-preview copy.

## Decision

`gitLog` success leaves `selectedCommitHash` unchanged. The right column shows only the last user-opened working-tree file or Graph commit. Hiding the Git tab keeps that selection because the occupant stays mounted. Binding a different Workspace clears both selections. A full page reload starts from the empty preview. [Git Graph commit diff preview](../feature/2026-08-27-git-graph-commit-diff.md) still owns the click-to-diff RPC.

## Alternatives considered

**Persist the last-opened hash in the Git-panel store.** Rejected for this fix: the occupant already survives hiding the Git tab; a full reload showing the empty preview is the same as never having selected, not an auto-open of HEAD.

**Keep auto-selecting `commits[0]` when the current hash is missing from the loaded page.** Rejected: `gitCommitDiff` can still load a hash that is off the first page, and falling back to the newest commit would steal a working-tree file preview whenever Graph reloads.

## Consequences

The first Graph row is not highlighted until the user clicks it. Reloading Graph after staging or switching the Git tab does not replace a file preview with HEAD.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` loads two Graph commits and asserts the empty-preview copy with no `gitCommitDiff` until a click; hiding then showing the Git tab keeps the last opened commit; a working-tree file preview survives a Graph reload.
