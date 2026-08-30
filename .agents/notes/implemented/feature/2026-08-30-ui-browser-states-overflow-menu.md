# Agent Note: Embedded browser unavailable, nav error, external info, and overflow menu

Status: implemented

## Problem

Issue #98 completes the embedded-browser state variants and navigation overflow menu left out of the #96–#97 slices: Host-unavailable card + retry, navigation-failure inline error with canvas empty state, first-visit external-site info, and Hard Reload / Copy URL / Zoom controls.

## Decision

`@deepseek-ai/dsh-client-ui-browser` extends the Workspace-partitioned store with `browserUnavailable`, `navError`, `externalInfo`, and `seenExternalHosts`. `reportBrowserFailure` routes `browser-unavailable` to the card surface, navigation RPC failures to `navError`, and stream/screencast failures to `inlineError`. The nav bar adds a `…` Menu (Hard Reload, Copy Current URL, Zoom footer). Client Zoom uses `browser-zoom.ts` helpers (0.5–2.0, step 0.25) and does not change Host viewport RPCs.

## Alternatives considered

- **Reuse `inlineError` for navigation and unavailable states.** Rejected: PRD separates navigation failure copy + canvas empty state from stream errors and distinguishes browser-unavailable card from inline banners.
- **Modal for external-site warning.** Rejected: PRD requires inline info without blocking the shell.

## Consequences

Issue #99 shipped segment hide/resume SSE, hard-refresh reconnect, and Hard Reload loading semantics; zoom persistence uses `dsh.browser.panel.v1`.
