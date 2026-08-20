# Agent Note: Details column segmented tab for the file editor shell

Status: implemented

English | [中文](2026-08-20-details-segmented-tab.zh.md)

## Problem

File editor V1 places the editor surface in the existing Web details column beside Tool details ([ADR-0002](../../../../docs/adr/0002-file-editor-details-tab.md)). The column previously rendered only Tool output with no tab chrome and no occupant slot for an editor surface, so US-1~US-3 from the file-editor PRD had no integration point.

## Decision

`ui-conversation` owns the details **shell**: a segmented tab bar (`Tool 详情` | `文件编辑器`) in `DetailsPanel`, with Tool body extracted to `ToolDetailsBody` and tab selection in the shared per-session chat store (`detailsTab: 'tool' | 'editor'`). Selecting **文件编辑器** calls `layout.openDetails()` so a collapsed column opens without a separate fourth pane or overlay.

`ui-file-editor` injects `EditorSurface` into the new child slot `conversation.details.editor`. The [file-tree issue](2026-08-20-editor-surface-file-tree.md) owns Workspace binding, listings, filter, icons, and Git badges; [open modes, tabs, and save](2026-08-20-editor-surface-open-tabs-save.md) own buffers and Monaco.

`ui-layout` keeps the details drag handle mounted whenever a non-blank session owns the column (`detailsSession` defined), even at zero rendered width, so users can drag the column open after it auto-closed.

## Alternatives considered

**Replace the entire `details` occupant from `ui-file-editor`.** Rejected: Tool details registration and the shared chat store live in `ui-conversation`; ADR-0002 requires coordinating Tab shell ownership here while editor content stays injectable.

**Overlay drawer or fourth column.** Rejected by ADR-0002 and PRD app-shell spec.

## Consequences

- Tab choice persists in the chat store across remounts until Session guards reset it in later issues.
- Browser e2e targets the details tablist via `aria-label="Details panel"` to avoid capturing conversation view tabs.
- Bundles for `ui-conversation`, `ui-layout`, and `ui-file-editor` must rebuild before web e2e exercises the change.

## Testing

`packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` covers default labels, editor-tab selection (opens details + renders editor seat), and switching back to Tool details.

`packages/client/ui-file-editor/tests/*` covers slot injection, the file-tree states owned by [the file-tree note](2026-08-20-editor-surface-file-tree.md), and the open/save states owned by [the open/tabs/save note](2026-08-20-editor-surface-open-tabs-save.md).

`apps/web/tests/details-segmented-tab.e2e.ts` replays segmented-tab aria and the editor-surface snapshot (tree + unopened-file empty state).
