# Agent Note: Editor-surface file tree binds the Session Workspace

Status: implemented

English | [中文](2026-08-20-editor-surface-file-tree.zh.md)

## Problem

The details **文件编辑器** tab from [the segmented-tab shell](2026-08-20-details-segmented-tab.md) only showed the unopened-file empty state. US-4~US-12 need a left-pane tree over the Session's bound Workspace: full Host listings, lazy folder expansion, filename filter, type icons, and read-only Git badges, without opening file content.

## Decision

`ui-file-editor` owns the tree inside `EditorSurface`. Binding is `useWorkspaces` membership (`sessionIds.includes(sessionId)`); a missing Session id leaves the pane unbound. `apply` injects `listWorkspaceEntries` and `gitStatus` closures from `ctx.workspaces` so the occupant does not take the whole WorkspaceRuntime. `WorkspaceRuntime` forwards those Host unaries and wraps business failures as `DirectoryBrowseError`.

The tree lists every Host row at a loaded level (hidden names, `.git`, `node_modules` included). Only an expanded folder fetches that level; a cache hit does not refetch. Filename filter is case-insensitive containment on already-loaded names and keeps ancestor folders; it does not recurse to fetch. Git letters are a path map on the rows; a non-repository or thrown `gitStatus` omits badges and does not raise an alert. Click selects; double-click expands a folder; a file click does not open content. New-file actions stay disabled for the file-operation issue.

`DetailsPanel` uses a flush editor tab body so the filter row sits at the pane top with no extra details padding.

## Alternatives considered

**Filter hidden / `.git` / `node_modules` like a default IDE explorer.** Rejected by the PRD full-visibility rule; the agent and the user must see the same tree the Host listed.

**Eager recursive listing or filter-driven fetch.** Rejected: large directories must stay scrollable without walking the whole Workspace; filter only narrows what is already loaded.

**Pass `ctx.workspaces` into the occupant.** Rejected: slot inject faces close over the verbs the surface needs; the test runtime can substitute those two callbacks.

**In-pane listing error / retry.** Rejected for this slice: a refused listing keeps the last cache, matching the PRD's tree-usable-without-Git and no-alert non-repo posture rather than inventing a third error chrome.

**Stage an empty `.git` in the web snapshot workspace.** Rejected: Host `git status` would treat that as a repository and make badge chrome non-deterministic.

## Consequences

- Monaco and Host read/write remain later issues; selecting a file is selection only.
- Web e2e seeds `README.md`, `.gitignore`, `src/`, and `node_modules/` under the connected workspace and must not create `.git`.
- `ui-file-editor` and `ui-conversation` client bundles must rebuild before that scenario.

## Testing

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` covers default binding and visibility, empty workspace, filename filter, lazy expand cache, Git loading and non-repo, large-directory scroller, listing/Git abort after unmount, and selection without open.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` covers unary forwarding and `DirectoryBrowseError`.

`apps/web/tests/details-segmented-tab.e2e.ts` replays the assembled tree plus unopened-file empty state.
