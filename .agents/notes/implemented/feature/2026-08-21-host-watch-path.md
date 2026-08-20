# Agent Note: Host watchPath for the file editor

Status: implemented

English | [中文](2026-08-21-host-watch-path.zh.md)

## Problem

The Web file editor must detect when an opened file changes on disk (Agent tools or another process) so the UI can prompt to reload or keep the local buffer ([ADR-0001](../../../../docs/adr/0001-file-editor-host-rpc.md), US-25). The browser cannot watch the filesystem directly.

## Decision

`packages/host/apiproxy` adds `host.watchPath` on the existing Host RPC seam. The client opens `GET /api/host.watchPath?workspaceId=…&path=…` as an SSE stream; each external change yields one `host/path-changed` frame with the absolute path. Aborting the stream closes the Host `fs.watch` handle for that path only — no recursive Workspace-root watch and no mtime polling ([PRD watchPath slice](../../../../docs/prd/file-editor-v1.md)).

Paths must lie within the registered Workspace root via `pathWithinWorkspace`; unknown workspaces and out-of-bounds paths answer with a `stream/error` frame before or instead of change events. Implementation lives in `watch-path.ts`; wire types extend `HostApi` like other file-editor RPCs.

## Alternatives considered

**Push path-changed frames on the global `events.host` stream.** Rejected: mixes session/workspace lifecycle traffic with per-tab file watches and complicates reconnect baselines.

**Unary long-poll or mtime polling.** Rejected by PRD: V1 follows Host `fs.watch` signals only.

**Client-side `fs.watch` in the browser.** Impossible; Host owns disk access.

## Consequences

- Downstream `ui-file-editor` external-change dialogs subscribe through the Client carrier's `host.watchPath` opener; one subscription per open tab, released on tab close.
- Network filesystems may miss events; V1 accepts `fs.watch` coverage as-is without content-hash reconciliation.
- `watchPath` shares the browser carrier trust fence with other `/api` routes.

## Testing

`packages/host/apiproxy/tests/watch-path.spec.ts` covers injected `fs.watch` delivery and abort cleanup.

`packages/host/apiproxy/tests/api-proxy-watch-path.spec.ts` covers external rewrite and post-abort silence through `createApiProxy`.
