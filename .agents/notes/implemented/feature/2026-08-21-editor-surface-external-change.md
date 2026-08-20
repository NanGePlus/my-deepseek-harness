# Agent Note: Editor-surface external change dialog

Status: implemented

English | [中文](2026-08-21-editor-surface-external-change.zh.md)

## Problem

US-25 requires that when an opened editable file changes on disk, the Web editor prompts the user to reload or keep the local buffer. [Host `watchPath`](2026-08-21-host-watch-path.md) already streams `host/path-changed` frames per path; the Client must subscribe per open text tab, compare disk text to the edit buffer, and release watches on tab close.

## Decision

`EditorSurface` registers one `watchPath` subscription per open **text** tab through an injected closure from `ctx.workspaces.watchPath` (which forwards the SSE stream and invokes a callback on each `host/path-changed` frame). On callback, the surface re-reads the file; when disk text differs from the tab buffer, it opens a `bg-layer-3` dialog (**文件已在磁盘上更改**, primary **重新加载**, secondary **保留本地编辑**). **重新加载** calls `readFile` and `reloadTextTab` (sets both `buffer` and `saved`). **保留本地编辑** dismisses the dialog and leaves the buffer unchanged. Closing a tab aborts that tab's `AbortController`, which ends the Host watch. Preview and non-openable tabs do not subscribe — they have no edit buffer to reconcile.

## Alternatives considered

**Watch the Workspace root recursively.** Rejected by PRD and [host watchPath](2026-08-21-host-watch-path.md): one `fs.watch` per opened path only.

**Auto-reload on every watch event without prompting.** Rejected by US-25: the user chooses reload vs keep local.

**Store pending external-change state in the tab store.** Rejected: the dialog is transient UI; only `reloadTextTab` mutates durable tab state.

## Consequences

- Session-switch and dirty-tab-close guards (US-26 / US-27) remain separate issues.
- A local explicit save that triggers `fs.watch` does not prompt when the re-read matches the buffer.
- `WorkspaceRuntime.watchPath` swallows stream transport errors after abort; the editor surface ignores read failures during change checks.

## Testing

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` covers the Issue #23 States matrix: fake watch → dialog copy, reload discards buffer, keep local preserves buffer and dirty, close tab stops watch delivery and never watches the Workspace root.

`packages/client/ui-file-editor/tests/stores.client.spec.ts` covers `reloadTextTab`.

`packages/client/ui-file-editor/tests/apply.client.spec.ts` forwards `watchPath` through `ctx.workspaces`.
