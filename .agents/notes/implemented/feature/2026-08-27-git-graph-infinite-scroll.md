# Agent Note: Git graph infinite scroll

Status: implemented

English | [中文](2026-08-27-git-graph-infinite-scroll.zh.md)

## Problem

`host.gitLog` returned at most fifty commits (schema max 200) in one shot. The Graph section called it once and never asked for older history, so a repository with hundreds of commits looked truncated.

## Decision

Each `host.gitLog` call is one page. The Host runs `git log --max-count=limit+1` (and `--skip` when the offset is positive) and sets `hasMore` from the probe row. The Graph section observes a sentinel at the bottom of its own list (the Graph pane scrolls independently of Changes); when that sentinel intersects, the panel requests the next page with `skip` equal to the commits already shown and appends by hash. The first page resets when the Workspace, visibility, or reload epoch changes. Per-request `limit` stays capped at 200; the panel uses page size 50.

## Alternatives considered

**Raise the single-shot cap and fetch everything.** Rejected: a large history would stall the Host and freeze layout of the overlay SVG on first paint.

**Cursor by commit hash (`git log hash..`).** Rejected: `--topo-order` paging by skip matches `git log` itself and does not need a stable cursor across rewrites.

**Pull-to-refresh at the top of the list.** Rejected: older commits sit below the newest tip; the load trigger belongs at the bottom.

## Consequences

A page boundary can split a merge from its parents until the next page arrives, so lanes at the bottom of a partial graph may look incomplete until `hasMore` is false. Duplicate hashes from overlapping pages are dropped; a page that adds no new hashes clears `hasMore` so the sentinel cannot loop.

## Testing

`packages/host/apiproxy/tests/parse-git-log.spec.ts` asserts paging argv and `sliceGitLogPage` `hasMore`.

`packages/client/runtime/tests/workspaces-service.client.spec.ts` forwards `limit` and `skip` on the wire.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` mounts a two-page `gitLog` stub, fires the IntersectionObserver, and asserts the second page appends and the load-more control disappears.
