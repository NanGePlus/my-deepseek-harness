# Agent Note: Explorer listing hangs when watchPath occupies HTTP/1.1 slots

Status: implemented

English | [中文](2026-08-26-explorer-listing-http-starvation.zh.md)

## Problem

Expanding several folders in the file tree showed a per-row spinner for tens of seconds, then a red `!` on every expanded folder. The same failure had already been fixed once for `events.mux` and `events.host` by moving those downlinks off HTTP SSE.

## Decision

`host.watchPath` in the browser carrier is a downlink-only WebSocket at `/api/host.watchPath`, same physical rule as mux/host ([WebSocket downlink carrier](../architecture/2026-08-04-websocket-downlink-carrier.md)). Each open text tab and the Workspace root still get their own socket; those sockets do not consume the six HTTP/1.1 connections, so `listWorkspaceEntries` unary POSTs are not queued behind long-lived SSE.

A listing that hits the 30 s client timeout is treated as a folder failure (`!`), not as a superseded abort that leaves the spinner forever. A superseded in-flight fetch (collapse, a newer fetch for the same path) still exits without painting `!`.

## Alternatives considered

**One recursive `fs.watch` on the Workspace root instead of per-path sockets.** Rejected here: it would still need ignore rules for `.git` / `.dsh` write storms, and it changes Host watch semantics beyond the connection-slot bug.

**Keep SSE and cap concurrent watches at five.** Rejected: the sixth tab, the Workspace-root watch, and HMR would still starve listings; the quota is a carrier fact, not a product cap.

## Consequences

- Network GET `/api/host.watchPath` returns 426; in-process tests keep SSE through `toFetchHandler`.
- Closing a file tab still aborts only that watch socket; mux/host generation is unchanged.

## Testing

`packages/client/connection/tests/client-apply.client.spec.ts` requires `host.watchPath` to open `ws:` and not call `fetch`.

`packages/client/connection/tests/node-half.host.spec.ts` registers the upgrade path and 426 on GET.

`packages/client/connection/tests/websocket-downlink.host.spec.ts` pumps a `host/path-changed` frame and rejects a missing query with HTTP 400.

`packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` advances the listing timer and requires `!` with no spinner.
