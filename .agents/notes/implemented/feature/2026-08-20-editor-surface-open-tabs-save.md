# Agent Note: Editor-surface open modes, tabs, and explicit save

Status: implemented

English | [中文](2026-08-20-editor-surface-open-tabs-save.zh.md)

## Problem

The [file-tree slice](2026-08-20-editor-surface-file-tree.md) listed Workspace paths but did not open them. US-13~US-19 and US-28~US-30 need three open modes (editable text, read-only image preview, non-openable hint), multiple tabs, explicit save of dirty text, in-pane open/save loading and retry, and Monaco/UI following `body[data-ds-dark-theme]`, without writing buffers into the session log.

## Decision

`ui-file-editor` classifies a click with `openKindForPath` before any Host I/O: image extensions call `readFile(..., 'bytes')` and preview; known binary extensions (for example `.wasm`) open a hint tab and must not read; every other path calls `readFile(..., 'text')` and mounts Monaco with a language id from the extension. An already-open path focuses that tab. Tabs, buffers, and dirty (`buffer !== saved`) live in the exclusive per-Session `defineStore` and never enter the session log. Dirty text saves only through **保存** or ⌘S / Ctrl+S; preview and non-openable tabs cannot save. Open/save status is component-local, not store state; failures stay in the editor pane with **重试**. Closing a tab drops its buffer (US-27 owns the dirty-close dialog).

`apply` injects `readFile` / `writeFile` closures from `ctx.workspaces` beside the existing listing verbs. [Host `readFile` / `writeFile`](2026-08-20-host-read-write-file.md) already define the RPC; `WorkspaceRuntime` forwards them and wraps business failures as `DirectoryBrowseError`.

Monaco loads through `loadMonacoEditor()` (`import('monaco-editor')`). jsdom uses a Vitest alias to `tests/monaco-editor.stub.ts` whose `create` throws, so the widget keeps a code-font textarea whose accessible name still carries file, language, and theme. The client bundle inlines monaco-editor into the single `lib/client.js` factory (`outputOptions.codeSplitting: false`); the CSS Modules plugin also inlines monaco's plain `.css` as `<style>` tags so tsdown's css-guard never requires `@tsdown/css`.

## Alternatives considered

**Write buffers into the session log.** Rejected: they are human UI state, not model-visible input; the PRD and [file-tree note](2026-08-20-editor-surface-file-tree.md) keep the editor store Client-only.

**Auto-save on every keystroke.** Rejected by US-16: the user decides when the buffer hits disk.

**Filter non-text rows out of the tree.** Rejected by the PRD: the tree lists every Host row; open-mode runs at click time.

**Leave monaco-editor as extra `lib/*.cjs` chunks.** Rejected: the plugin loader fetches only `lib/client.js`.

**Install `@tsdown/css` for monaco stylesheets.** Rejected: the existing virtual-module CSS pipeline already injects `<style data-plugin>` tags; extending it to plain `.css` avoids a second CSS toolchain.

## Consequences

- Closing a dirty tab discards the buffer until US-27.
- `watchPath` / external-change dialogs are documented in [host watchPath](2026-08-21-host-watch-path.md).
- The ui-file-editor client factory includes monaco-editor (multi-megabyte); that cost is accepted in the PRD.
- Monaco workers are a dummy `Worker` in this slice; tokenization still runs from the inlined language contributions.

## Testing

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` covers the States matrix: editable text, image preview, non-openable without `readFile`, empty pane, dirty/save and ⌘S, disabled save, in-pane loading/error/retry, theme follow, tab switch without re-read, and abort-after-unmount.

`packages/client/ui-file-editor/tests/monaco-editor.client.spec.tsx` drives the Monaco success path through a fake `loadMonacoEditor`.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` covers `readFile` / `writeFile` forwarding.

`scripts/client-bundle-css.spec.ts` covers plain `.css` inlining.

`apps/web/tests/details-segmented-tab.e2e.ts` still replays the unopened-file empty state; this slice does not put Monaco pixels into that snapshot.
