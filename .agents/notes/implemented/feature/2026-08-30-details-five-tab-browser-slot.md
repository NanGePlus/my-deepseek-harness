# Agent Note: Toolbox five-segment tab and browser slot

English | [中文](2026-08-30-details-five-tab-browser-slot.zh.md)

## Context

Embedded browser V4 needs a fifth toolbox segment beside Explorer, Git, Terminal, and Tool details ([ADR-0008](../../../../docs/adr/0008-embedded-browser-client-and-tools.md), [browser-v4 PRD](../../../../docs/prd/browser-v4.md) US-1~US-4). The four-tab shell from [details four-tab terminal slot](2026-08-29-details-four-tab-terminal-slot.md) had no browser occupant.

## Decision

`ui-conversation` expands the segmented tab bar to **资源管理器 | Git面板 | 终端 | 浏览器 | 工具详情**, declares `conversation.details.browser` (`kind: single`, `scope: `root`), and passes `visible` while the Browser segment is selected. Leaving Browser hides the panel without unmounting it; Host BrowserContext lifecycle stays in `ui-browser` (#96+). Browser uses the same flush content body as Terminal so the embedded-browser occupant can fill the toolbox column width.

## Rejected alternatives

**Mount embedded browser in `ui-conversation`.** Rejected by ADR-0008: screencast, navigation, and Host RPC belong in `@deepseek-ai/dsh-client-ui-browser`.

**Destroy Host BrowserContext when leaving the segment.** Rejected by US-3: only hide the view and pause screencast in the occupant.

## Verification

- `packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` — five labels, browser select/leave, slot `visible`.
- `packages/client/ui-conversation/tests/chat-apply.client.spec.tsx` — slot declaration.
- `apps/web/tests/details-segmented-tab.e2e.ts` + `tabs.expected.md` / `browser-selected.expected.md` — browser snapshot seam and details-column resize while Browser is selected.
