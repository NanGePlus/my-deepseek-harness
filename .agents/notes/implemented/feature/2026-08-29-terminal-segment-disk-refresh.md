# Terminal segment disk refresh coordination (Issue #81)

`ui-conversation` `DetailsPanel` bumps a shared `segmentDiskRefreshEpoch` when the toolbox leaves **终端** or enters **资源管理器** / **Git**. The Explorer occupant re-fetches Git badges and reloads open text tabs from disk; the Git occupant bumps its internal reload epoch so the working tree re-reads on the next visible fetch (or immediately when Git is already shown). Terminal-side disk writes do not realtime-refresh Explorer or Git while **终端** stays selected.

## Verification

- `packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` — `terminal-leave-disk-refresh`, `terminal-enter-git-disk-refresh`, `terminal-stay-no-refresh`
- `packages/client/ui-file-editor/tests/editor-surface.client.spec.tsx` — `segment-disk-refresh-hidden`, `segment-disk-refresh-open-tab`
- `packages/client/ui-git/tests/git-panel.client.spec.tsx` — `segment-disk-refresh-visible`, `segment-disk-refresh-hidden`
