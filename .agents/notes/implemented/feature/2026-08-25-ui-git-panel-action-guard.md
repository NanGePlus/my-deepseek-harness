# Agent Note: ui-git Git action guard

Status: implemented

English | [中文](2026-08-25-ui-git-panel-action-guard.zh.md)

## Problem

Dirty editor tabs and disk working-tree rows can share a path. Staging, discarding, or committing that path from the Git panel would rewrite disk while an unsaved edit buffer still owns it, or would create a HEAD commit whose index content is not what the developer is editing.

## Decision

`ui-conversation` holds a Host-absolute dirty-path list in `DetailsPanel` React state. The Explorer occupant publishes it through owner `setDirtyPaths`; the Git occupant reads `dirtyPaths`. The list is not a runtime object-layer fact and is not keyed by Session: it is the dirty text tabs of the currently bound Workspace, and `ui-file-editor` republishes when those tabs or the Workspace change.

A path in that list cannot be discarded, staged (whole file, hunk, or **全部暂存**), or included in a commit. Unstage (whole file, hunk, and **全部取消暂存**) is unrestricted. The panel never auto-saves.

The guard dialog reuses the discard overlay (`bg-layer-3`, not a full-viewport mask): title 「文件有未保存的编辑」, the Host-absolute path, body telling the user to save, discard that edit buffer, or close that tab, and a single **取消** control. There is no **保存** button.

Commit stays natively `disabled` when any staged row is dirty. Row and hunk stage/discard controls use `aria-disabled` with `label-caption` and `cursor: not-allowed`; the click still opens the dialog. A commit-message draft does not open this guard on Session switch.

## Alternatives considered

**Put the dirty set on the runtime object layer.** Rejected by [ADR-0004](../../../../docs/adr/0004-git-panel-client-plugin.md): it is human UI state, not model-visible data.

**Auto-save, then run the Git write.** Rejected by US-30: the guard must not save.

**Reuse the file-editor Session/tab dirty dialog (保存 / 丢弃 / 取消).** Rejected: that dialog mutates the edit buffer; the Git guard only blocks and must not import `ui-file-editor` internals.

**Key the list by Session id.** Rejected: dirty tabs already live per Workspace in the editor store; republishing the current Workspace's paths on Session switch is enough, and the commit-message draft already has its own Session-keyed store.

**Block unstage as well.** Rejected by US-28: unstage does not rewrite disk.

## Consequences

- The [three-tab Git slot](2026-08-25-details-three-tab-git.md) owns the owner fields. [Whole-file stage, discard, and commit](2026-08-25-ui-git-panel-stage-commit.md) and [diff preview and hunk operations](2026-08-25-ui-git-panel-diff-preview.md) still own the writes this guard intercepts.
- `ui-git` still does not import `ui-file-editor` internals.
- The `ui-git`, `ui-conversation`, and `ui-file-editor` client bundles must rebuild before `pnpm dsh web` shows the guard.

## Testing

`packages/client/ui-git/tests/git-panel.client.spec.tsx` asserts dirty stage/discard `aria-disabled`, native-disabled commit, the guard dialog for whole-file / hunk / stage-all, unrestricted unstage, and that a commit-message draft does not open this guard on Session switch.

`packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` asserts Explorer `setDirtyPaths` reaches Git `dirtyPaths`.

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` asserts the occupant publishes dirty tab paths and clears them after save.
