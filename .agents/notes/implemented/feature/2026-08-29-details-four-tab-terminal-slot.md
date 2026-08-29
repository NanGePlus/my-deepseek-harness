# Agent Note: Toolbox four-segment tab and terminal slot

## Context

Human terminal V3 needs a fourth toolbox segment beside Explorer, Git, and Tool details ([ADR-0006](../../../../docs/adr/0006-human-terminal-client-plugin.md), [terminal-v3 PRD](../../../../docs/prd/terminal-v3.md) US-1~US-4). The three-tab shell from [details three-tab Git](2026-08-25-details-three-tab-git.md) had no terminal occupant.

## Decision

`ui-conversation` expands the segmented tab bar to **资源管理器 | Git | 终端 | 工具详情**, declares `conversation.details.terminal` (`kind: single`, `scope: root`), and passes `visible` while the Terminal segment is selected. Leaving Terminal hides the panel without unmounting it; Host PTY lifecycle stays in `ui-terminal` (#77+). Git segment label aligns with the PRD (`Git`, not `Git面板`).

## Rejected alternatives

**Mount terminal in `ui-conversation`.** Rejected by ADR-0006: xterm and PTY reconnect belong in `@deepseek-ai/dsh-client-ui-terminal`.

**Kill Host PTY when leaving the segment.** Rejected by US-3: only hide the view.

## Verification

- `packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` — four labels, terminal select/leave, slot `visible`.
- `packages/client/ui-conversation/tests/chat-apply.client.spec.tsx` — slot declaration.
- `apps/web/tests/details-segmented-tab.e2e.ts` + `tabs.expected.md` — browser snapshot seam.
