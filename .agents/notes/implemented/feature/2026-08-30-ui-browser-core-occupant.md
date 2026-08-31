---
title: ui-browser core occupant for embedded browser segment
kind: implemented
area: web
---

English | [中文](2026-08-30-ui-browser-core-occupant.zh.md)

`@deepseek-ai/dsh-client-ui-browser` registers into `conversation.details.browser` via `ctx.slots.inject`. Tab rows, selection, and Client zoom scale persist in a workspace-partitioned store keyed by `workspaceId`; nothing is written to the Session log. When the Browser segment becomes visible and the bound Workspace has no tabs, the panel calls `browserList` then `browserCreateTab('about:blank')` and focuses the address bar. The content area explains that humans operate the Host headed Chromium window and offers **显示窗口** (`browserShowWindow`). While visible, the panel polls `browserList` so titles and history stay current. An unbound Session shows the full-page card「无法使用浏览器」with no tab or navigation chrome. Leaving the Browser segment does not close Host tabs or the headed window.

Verification: `packages/client/ui-browser/tests/browser-panel.client.spec.tsx` covers unbound empty/disabled states, first-tab bootstrap, show-window handoff, workspace/session tab-set persistence, and Host tab recreate.
