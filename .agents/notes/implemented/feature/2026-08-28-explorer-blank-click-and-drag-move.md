# Agent Note: Explorer blank click and drag-move

Status: implemented

English | [中文](2026-08-28-explorer-blank-click-and-drag-move.zh.md)

## Problem

The Web file-tree lists Workspace children, not a root row. After a file or folder is selected, there is no way to restore the Workspace root as the toolbar create parent. `host.renamePath` only changes the base name inside the same parent, so a selected path cannot move into another directory.

## Decision

Clicking file-tree chrome that is not a `treeitem` or `button` clears `selectedPath`. `parentDirectoryForCreate` already uses the Workspace root when nothing is selected, so toolbar **New file** / **New folder** create at the root. The toolbar title is not highlighted as a root row.

`host.movePath({ workspaceId, path, destinationDirectory })` moves a path into an existing directory inside the same Workspace and keeps the base name. Implementation lives in `moveWorkspacePath` beside delete/rename. The Workspace root cannot move. The destination must already be a directory. A directory cannot move into itself or a descendant. A source already in the destination returns the original path without `rename`. An existing same-kind target fails with `directory-exists`; other failures use `path-move-failed`. Out-of-bounds and missing paths reuse `workspace-path-out-of-bounds` / `path-not-found`.

The file tree uses HTML5 drag-and-drop. Dropping onto a directory row moves into that directory. Dropping onto blank tree chrome moves to the Workspace root. Dropping onto a file row, the source itself, the current parent, or a descendant of a dragged directory is ignored and does not call Host. Same-window drags keep the source in `dragSourceRef` because jsdom `DataTransfer` is not a reliable payload. `dragEnd` sets `suppressClickAfterDragRef` so the click that follows a drop does not change selection. Open tabs remap through the existing `onPathRenamed` path.

Same-parent rename, delete, context menus, and create-into-the-selected-folder stay on their previous seams.

## Alternatives considered

**Extend `host.renamePath` with a destination directory.** Rejected: same-parent rename validates a single new name; cross-directory move validates an existing directory and forbids moving a tree into itself. One method would mix those checks.

**Client copy then delete.** Rejected: two Host round-trips and a partial-failure window. Host `rename` is one filesystem step.

**Render a Workspace root row in the tree.** Rejected: it would change selection chrome and empty-state snapshots. Clearing `selectedPath` on blank click restores root create without a new row.

**Trust `DataTransfer` alone for the drag payload.** Rejected: jsdom does not round-trip custom MIME types; `dragSourceRef` is the same-window source of truth.

## Consequences

- Blank click is the only way to re-select the Workspace root as the create parent.
- A root-level file dropped on blank chrome is a no-op, because it is already in the root.
- Host owns the move; the Client pre-checks sibling names then calls `movePath`.
- Same-parent rename remains `host.renamePath`. Cross-directory move remains `host.movePath`. The split is recorded with [Host delete/rename/create](2026-08-21-host-delete-rename-path.md).

## Testing

`packages/client/ui-file-editor/tests/file-tree-parent.client.spec.ts` covers drop destination resolution, including file/self/parent/descendant/out-of-workspace no-ops.

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` covers blank-click restoring root create, drag onto a folder, drag onto blank chrome, ignored file/self drops, client-side name conflict, and Host `directory-exists` / generic move errors.

`packages/host/apiproxy/tests/workspace-path-mutations.spec.ts` and `packages/host/apiproxy/tests/api-proxy-delete-rename-path.spec.ts` cover Host move success, conflict, self-move, abort, and out-of-bounds.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` covers Client forwarding and error mapping for `movePath`.
