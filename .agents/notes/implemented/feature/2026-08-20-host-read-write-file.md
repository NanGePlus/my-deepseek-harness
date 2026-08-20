# Agent Note: Host readFile / writeFile for the file editor

Status: implemented

English | [中文](2026-08-20-host-read-write-file.zh.md)

## Problem

The Web file editor needs Host-mediated read and explicit save for editable text and image preview bytes inside a Session's bound Workspace. The browser must not touch disk directly ([ADR-0001](../../../../docs/adr/0001-file-editor-host-rpc.md)).

## Decision

`packages/host/apiproxy` adds `host.readFile` and `host.writeFile` on the existing Host RPC seam. Both take `{ workspaceId, path }` plus payload-specific fields; paths are Host-absolute and must stay within the registered Workspace root via the shared `pathWithinWorkspace` helper from `list-workspace-entries.ts`. Out-of-bounds paths fail with `workspace-path-out-of-bounds` without silent truncation.

`readFile` carries `kind: 'text' | 'bytes'`. Text reads return UTF-8; byte reads return canonical base64 and an image media type derived from the extension (`.png`, `.jpg`/`.jpeg`, `.gif`, `.webp`, `.svg`). Only regular files are readable; directories and missing paths map to `file-not-regular` and `file-not-found`. Other read failures use `file-unreadable`.

`writeFile` accepts UTF-8 text, creates the target file when absent, and returns the written absolute path. Write failures use `file-write-failed`.

Implementation lives in `read-write-file.ts`; wire types and zod schemas extend `HostApi` like `gitStatus` and `listWorkspaceEntries`.

## Alternatives considered

**Pass file bytes only and let the client decode text.** Rejected: editable text and preview bytes need distinct response fields; a request `kind` keeps one RPC with explicit contracts.

**Reuse `directory-unreadable` for file I/O errors.** Rejected: directory listing and file read/write are separate product failures; typed file codes keep client retry copy accurate.

**Client-side path joining from relative segments.** Rejected by ADR-0001: the Host owns absolute paths end-to-end.

## Consequences

- `ui-file-editor` open/save calls these RPCs through `WorkspaceRuntime` ([open / tabs / save](2026-08-20-editor-surface-open-tabs-save.md)).
- `deletePath`, `renamePath`, and `watchPath` remain separate issues.
- No file-size cap in V1; giant reads follow Node's memory behavior.

## Testing

`packages/host/apiproxy/tests/api-proxy-read-write-file.spec.ts` covers text read, PNG byte read, write persistence, and out-of-bounds read/write rejection through `createApiProxy`.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` covers Client forwarding of `readFile` / `writeFile` and `DirectoryBrowseError`.
