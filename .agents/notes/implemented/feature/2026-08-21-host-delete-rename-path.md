# Agent Note: Host deletePath / renamePath / createWorkspaceDirectory

Status: implemented

English | [中文](2026-08-21-host-delete-rename-path.zh.md)

## Problem

The Web file editor needs Host-mediated delete, same-parent rename, and new-folder creation inside a Session's bound Workspace ([ADR-0001](../../../../docs/adr/0001-file-editor-host-rpc.md)). The browser must not touch disk directly, and browse `host.createDirectory` must stay on the directory-picker seam.

## Decision

`packages/host/apiproxy` adds three Host RPC methods on the existing seam:

- `host.deletePath({ workspaceId, path })` — recursive delete of one file or directory tree; returns the deleted absolute path.
- `host.renamePath({ workspaceId, path, newName })` — rename within the same parent directory; returns the new absolute path.
- `host.createWorkspaceDirectory({ workspaceId, path, name })` — non-recursive child directory creation under an existing parent inside the Workspace; returns the created absolute path.

All three reuse `pathWithinWorkspace` from `list-workspace-entries.ts`. Out-of-bounds paths fail with `workspace-path-out-of-bounds` without silent truncation. Missing sources on delete/rename fail with `path-not-found`. An existing rename or create target fails with `directory-exists` (aligned with browse create semantics). Other delete/rename failures use `path-delete-failed` / `path-rename-failed`; other create failures use `directory-create-failed`.

Implementation lives in `workspace-path-mutations.ts`; wire types and zod schemas extend `HostApi` like `readFile` / `writeFile`. `WorkspaceRuntime` forwards the three methods through `DirectoryBrowseError`.

## Alternatives considered

**Extend browse `host.createDirectory` with `workspaceId`.** Rejected: would couple file-editor folder creation to the directory-picker capability kind and risk breaking the Miller browser contract.

**Reuse `file-not-found` for deleted directories.** Rejected: delete/rename apply to directories as well; `path-not-found` keeps one code for any missing path on these mutations.

## Consequences

- Downstream `ui-file-editor` file-operation toolbar can call these RPCs through `WorkspaceRuntime`.
- Cross-directory moves are owned by [explorer blank click and drag move](2026-08-28-explorer-blank-click-and-drag-move.md).
- External change detection is documented in [host watchPath](2026-08-21-host-watch-path.md).
- Recursive delete follows Node `fs.rm` semantics for directory trees.

## Testing

`packages/host/apiproxy/tests/api-proxy-delete-rename-path.spec.ts` covers delete (file and tree), rename success, rename target conflict, workspace directory create, directory-exists on create, and out-of-bounds rejection through `createApiProxy`.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` covers Client forwarding and error mapping for all three methods.
