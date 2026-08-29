# Human terminal minimal path (Issue #77)

`@deepseek-ai/dsh-client-ui-terminal` injects into `conversation.details.terminal`: workspace-scoped tab store, auto-spawn on first visible entry, xterm viewport wired to `host.terminal.*`, unbound empty state, Harness light/dark theme follow, and multi-tab `+`/Kill (#78). Unavailable card, inline errors, and spawn-disabled `+` ship in #79. Segment-hide SSE persistence, hard-refresh `list` reconnect, and scrollback replay ship in #80.

## Verification

- Component seam: `packages/client/ui-terminal/tests/terminal-panel.client.spec.tsx`
- Workspaces face: `packages/client/runtime/tests/workspaces-service.client.spec.ts`
- Browser snapshot: `apps/web/tests/snapshots/details-segmented-tab/terminal-default.expected.md`
