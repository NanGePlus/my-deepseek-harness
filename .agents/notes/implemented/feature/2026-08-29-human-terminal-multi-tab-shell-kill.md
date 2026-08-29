# Human terminal multi-tab, shell dropdown, and Kill (Issue #78)

`@deepseek-ai/dsh-client-ui-terminal` adds segment Tab chrome: `+` opens a Host-profile dropdown (bash/zsh only; no Split/Debug), Kill calls `host.terminalKill` and removes the row, Tab titles follow SSE `host/terminal-title`, and killing every Tab sets `deferAutoSpawn` until the Terminal segment is hidden and shown again.

## Verification

- Component seam: `packages/client/ui-terminal/tests/terminal-panel.client.spec.tsx` (`spawn-via-dropdown`, `kill-tab`, `no-split-menu`)
- Store: `packages/client/ui-terminal/tests/stores.client.spec.ts` (`removeTab`)
- Workspaces face: `packages/client/runtime/tests/workspaces-service.client.spec.ts` (`terminalKill`)
