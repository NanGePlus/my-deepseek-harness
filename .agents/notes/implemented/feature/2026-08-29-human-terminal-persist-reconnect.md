# Human terminal persist and hard-refresh reconnect (Issue #80)

`@deepseek-ai/dsh-client-ui-terminal` keeps the Host SSE subscription open when the toolbox **Terminal** segment hides (`visible=false`): the occupant does not call `terminalKill`, and live frames continue writing to the xterm viewport. A new stream connection clears the viewport with RIS (`\x1bc`) before scrollback replay. Hard refresh remounts with an empty store; the first visible entry calls `terminalList`, restores the tab bar, and reconnects SSE with scrollback then live output. Workspace-partitioned tab state survives session switches within the same Workspace and restores the other Workspace tab set when the bound Workspace changes.

## Verification

- Component seam: `packages/client/ui-terminal/tests/terminal-panel.client.spec.tsx` (`hidden-persist`, `workspace-switch`, `reconnect-loading`, `scrollback-replay`, `hard refresh`, `session-switch`)
- Viewport reset: `packages/client/ui-terminal/tests/xterm-viewport.client.spec.ts`
