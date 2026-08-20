# @deepseek-ai/dsh-client-ui-file-editor

English | [中文](README.zh.md)

File editor surface for the Web details column **文件编辑器** tab: the `editor-surface` occupant injected into `conversation.details.editor`. The left pane is the Workspace file tree (lazy listings, filename filter, type icons, read-only Git badges). The right pane opens files into session-scoped tabs: editable text in Monaco (textarea fallback when Monaco cannot start), read-only image preview, or a non-openable hint. Dirty text saves only through an explicit **保存** / ⌘S / Ctrl+S.

The tree binds to the Workspace whose `sessionIds` include the current Session. It lists every Host row at a loaded level, including hidden names, `.git`, and `node_modules`. Folders call `listWorkspaceEntries` only when expanded; a cached level is reused. Filename filter matches already-loaded names case-insensitively and keeps ancestor folders of matches; it does not recurse to fetch. Clicking a file opens it; clicking an already-open path focuses that tab without a second `readFile`. Double-clicking a folder expands it.

Open mode is decided from the path at click time: image extensions (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`) call `readFile(..., 'bytes')` and preview; known binary extensions (for example `.wasm`) show 「不支持打开此文件类型」 and must not read; everything else calls `readFile(..., 'text')` with a language id from the extension. Edit buffers and dirty live in the exclusive Client store and never enter the session log.

`apply` injects `listWorkspaceEntries`, `gitStatus`, `readFile`, `writeFile`, path mutations, and `watchPath` closures from `ctx.workspaces`, not the whole WorkspaceRuntime. Host listing and Git failures leave the last cached tree and omit badges; they do not raise an in-pane error. Open and save failures stay in the editor pane (`无法打开此文件` / `无法保存此文件` plus **重试**). Each open text tab registers `watchPath`; when disk content diverges from the edit buffer, a dialog offers **重新加载** or **保留本地编辑**; closing the tab aborts that watch.

## Model Experience

None, as the editor surface is browser chrome; listings, Git badges, buffers, and dirty never enter the session log.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No dirty-close or Session-switch guard** — closing a dirty tab discards the buffer; US-27 / US-26 own the dialogs.
- **No in-pane listing error** — a refused `listWorkspaceEntries` keeps the last cached rows; there is no retry chrome for the tree.
