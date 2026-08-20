# @deepseek-ai/dsh-client-ui-file-editor

English | [中文](README.zh.md)

File editor surface for the Web details column **文件编辑器** tab: the `editor-surface` occupant injected into `conversation.details.editor`. The left pane is the Workspace file tree (lazy listings, filename filter, type icons, read-only Git badges); the right pane is the unopened-file empty state until a later issue opens buffers.

The tree binds to the Workspace whose `sessionIds` include the current Session. It lists every Host row at a loaded level, including hidden names, `.git`, and `node_modules`. Folders call `listWorkspaceEntries` only when expanded; a cached level is reused. Filename filter matches already-loaded names case-insensitively and keeps ancestor folders of matches; it does not recurse to fetch. Clicking a row selects it; double-clicking a folder expands it; clicking a file does not open content.

`apply` injects `listWorkspaceEntries` and `gitStatus` closures from `ctx.workspaces`, not the whole WorkspaceRuntime. Host listing and Git failures leave the last cached tree and omit badges; they do not raise an in-pane error. Toolbar New file / New folder actions and the empty-folder CTA stay disabled until a later file-operation issue.

## Model Experience

None, as the editor surface is browser chrome; listings and Git badges never enter the session log.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No file buffers** — selecting a file does not open content; Monaco and Host read/write land in follow-on issues.
- **Create actions are disabled** — New file / New folder in the tree toolbar and empty-folder CTA wait for the file-operation issue.
- **No in-pane listing error** — a refused `listWorkspaceEntries` keeps the last cached rows; there is no retry chrome in this slice.
