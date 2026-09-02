# LSP stale diagnostics after rapid edits

## Symptom

Adding a blank line in a Python file showed a spurious error badge on the tab and file tree. Switching Session cleared it.

## Cause

Two races in the editor LSP path:

1. **Host (`EditorLspInstance`)** — `waitForDiagnostics` resolved on the **first** `publishDiagnostics`. Pyright often emits a transient batch while re-analyzing, then a final empty/correct batch; the client never saw the second one.
2. **Stale version / abort cache** — superseded syncs or late notifications could still surface diagnostics for an older document version.

Session switch cleared `lspDiagnostics` and re-synced from disk, masking the stale state.

## Fix

- Host: version-aware publish filtering, supersede on `didChange`, reject aborted waits, **100ms settle debounce** before resolving a sync waiter.
- Client: clear diagnostics on edit, apply only when version and buffer text still match the sync request.

## Files

- `packages/lsp/lsp-stdio/src/diagnostics.ts`
- `packages/lsp/lsp-stdio/src/editor-instance.ts`
- `packages/client/ui-file-editor/src/client/diagnostics-ui.ts`
- `packages/client/ui-file-editor/src/client/EditorSurface.tsx`
