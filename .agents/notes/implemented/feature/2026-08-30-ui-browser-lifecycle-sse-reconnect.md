# Agent Note: Embedded browser segment lifecycle, hard-refresh reconnect, and Hard Reload loading

Status: implemented

## Problem

Issue #99 completes embedded-browser lifecycle polish left out of #96–#98: pause screencast SSE when the Browser segment hides (without destroying Host Context), hard-refresh tab/zoom restore with Host `list` resync and SSE reconnect, Client Zoom that never changes Host viewport RPCs, and Hard Reload loading that keeps the previous frame visible.

## Decision

`@deepseek-ai/dsh-client-ui-browser` persists durable Workspace partitions under `dsh.browser.panel.v1` (tabs, selection, zoom, seen external hosts). Bootstrap always calls Host `browserList` while the segment is visible, merges live rows when present, and clears transient fields before sync. The screencast effect aborts SSE when `visible=false` and resubscribes on re-entry. `hardReloading` suppresses the dim loading overlay while the ↻ control still spins; soft reload and SSE connect keep the PRD dim overlay.

## Alternatives considered

- **Keep SSE open while the Browser segment is hidden (terminal pattern).** Rejected: browser-v4 PRD requires pausing screencast frames when the segment hides to limit CPU use.
- **Reuse `navigating` for Hard Reload dim overlay.** Rejected: PRD explicitly forbids dimming the previous frame on Hard Reload.

## Consequences

`packages/client/ui-browser/tests/browser-panel.client.spec.tsx` covers the Issue #99 States-matrix rows (`segment-hidden`, `loading-reconnect`, `zoom-client`, `loading-hard-reload`). Viewport debounce resize remains in the #96 slice.
