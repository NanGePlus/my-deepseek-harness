# Agent Note: Toolbox three-tab Git slot

Status: implemented

English | [中文](2026-08-25-details-three-tab-git.zh.md)

## Problem

Git panel V2 needs a third toolbox segment beside the explorer and Tool details ([ADR-0004](../../../../docs/adr/0004-git-panel-client-plugin.md), US-1~US-4). The two-tab shell from [the file-editor details segmented tab](2026-08-20-details-segmented-tab.md) had no Git occupant and no way to hide a Git view without unmounting it.

## Decision

`ui-conversation` owns the toolbox tab chrome: `DetailsPanel` renders **资源管理器 | Git | 工具详情**, and the per-session chat store `detailsTab` is `'editor' | 'git' | 'tool'`. Only one segment is selected. Selecting **资源管理器** or **Git** calls `layout.openDetails()` so a collapsed column opens; the shell does not add a fourth column or overlay.

The Git occupant is child slot `conversation.details.git` (`kind: 'single'`, `scope: 'root'`, owner `{ visible }`). `ui-git` injects here. All three tabpanels stay mounted; an unselected panel is `display: none` (`aria-hidden`). `visible` is true only while Git is selected so the occupant can re-read disk when the user returns. Leaving Git does not unstage and does not clear a commit-message draft — those belong to the Git occupant, and hiding the panel is what preserves them.

`ui-git` registers the occupant into this seat. Right-column drag and concession stay in `ui-layout`.

## Alternatives considered

**Fold the Git panel into `ui-file-editor`.** Rejected by ADR-0004: file editing and the Git workflow stay separate packages; the shell only declares the slot.

**Unmount the Git panel when the tab is not selected.** Rejected by US-3: unmounting would drop occupant state, including the per-session commit-message draft.

**Hide the Git tab until `ui-git` injects.** Rejected: this slice owns the chrome and the slot; later issues own the panel body.

**Open a fourth column or overlay for Git.** Rejected by ADR-0002 and the Git panel PRD app-shell spec.

## Consequences

- `ui-git` must inject `conversation.details.git` and must not import `ui-file-editor` internals.
- Switching tabs never issues a Git write RPC; unstaging is not a shell behavior.
- Browser e2e `details-segmented-tab` includes the Git tab label. Git-panel body coverage lives with [`ui-git` bind/list](2026-08-25-ui-git-panel-bind-list.md).
- The `ui-conversation` client bundle must rebuild before web e2e or `pnpm dsh web` shows the third tab.

## Testing

`packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` covers default order, single selection, Git selection opening the toolbox, and leaving Git while the occupant and draft stay mounted.

`packages/client/ui-conversation/tests/chat-apply.client.spec.tsx` covers the `conversation.details.git` declaration and its collapse on fiber dispose.

`apps/web/tests/details-segmented-tab.e2e.ts` replays the three-tab aria snapshot and asserts selecting Git keeps the details column open. The editor-empty golden records the assembled explorer chrome (hide-tree, refresh, resize).
