# @deepseek-ai/dsh-client-ui-file-editor

English | [中文](README.zh.md)

File editor surface for the Web details column **文件编辑器** tab: the `editor-surface` occupant injected into `conversation.details.editor`. The left pane is the Workspace file tree (lazy listings, filename filter, type icons, read-only Git badges that re-read `gitStatus` when the Explorer tab becomes visible after being hidden; nested untracked files show `U`, and ancestor folders inherit the stronger descendant letter). The right pane opens files into session-scoped tabs: editable text in Monaco (textarea fallback when Monaco cannot start; canvas uses `bg-base` for every language, matching Markdown), read-only image preview, or a non-openable hint. Dirty text saves only through an explicit **保存** / ⌘S / Ctrl+S. The occupant publishes Host-absolute dirty tab paths through owner `setDirtyPaths` for the Git action guard; that list is not a runtime object-layer fact.

The tree binds to the Workspace whose `sessionIds` include the current Session. It lists every Host row at a loaded level, including hidden names, `.git`, and `node_modules`. Folders call `listWorkspaceEntries` only when expanded; a cached level is reused. Filename filter matches already-loaded names case-insensitively and keeps ancestor folders of matches; it does not recurse to fetch. Clicking a file opens it; clicking an already-open path focuses that tab without a second `readFile`. Double-clicking a folder expands it. Clicking blank tree chrome clears the row selection so toolbar **New file** / **New folder** create at the Workspace root. Dragging a file or folder onto another directory row or blank tree chrome moves it (blank chrome is the root); a directory cannot move into itself or a descendant.

Open mode is decided from the path at click time: image extensions (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`) call `readFile(..., 'bytes')` and preview; known binary extensions (for example `.wasm`) show 「不支持打开此文件类型」 and must not read; everything else calls `readFile(..., 'text')` with a language id from the extension. Edit buffers and dirty live in the exclusive Client store and never enter the session log.

`apply` injects `listWorkspaceEntries`, `gitStatus`, `readFile`, `writeFile`, path mutations, and `watchPath` closures from `ctx.workspaces`, not the whole WorkspaceRuntime. Host listing and Git failures leave the last cached tree and omit badges; they do not raise an in-pane error. Open and save failures stay in the editor pane (`无法打开此文件` / `无法保存此文件` plus **重试**). Each open text tab registers `watchPath`; when disk content diverges from the edit buffer, **no confirmation dialog** appears: open tabs reload from disk (including dirty tabs; external disk wins). Explicit save refreshes Git badges silently without re-listing the tree; external create/rename/delete still refreshes listings via tree mutations, workspace-root watch, or watches on expanded folders. The toolbar **刷新** control re-lists the workspace root and every expanded folder. Returning to the Explorer tab or a segment disk-refresh epoch also re-lists visible folders. Git-panel discard reloads open tabs from disk. Closing the tab aborts that watch. Dirty tabs require **保存** / **丢弃** / **取消** before Session switch or tab close; save failure keeps the guard open.

## Model Experience

None, as the editor surface is browser chrome; listings, Git badges, buffers, and dirty never enter the session log.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No in-pane listing error** — a refused `listWorkspaceEntries` keeps the last cached rows; there is no retry chrome for the tree.
