---
title: ui-browser core occupant for embedded browser segment
kind: implemented
area: web
---

[English](2026-08-30-ui-browser-core-occupant.md) | [中文](2026-08-30-ui-browser-core-occupant.zh.md)

`@deepseek-ai/dsh-client-ui-browser` registers into `conversation.details.browser` via `ctx.slots.inject`. Tab rows, selection, and Client zoom scale persist in a workspace-partitioned store keyed by `workspaceId`; nothing is written to the Session log. When the Browser segment becomes visible and the bound Workspace has no tabs, the panel calls `browserList` then `browserCreateTab('about:blank')` and focuses the address bar. Screencast JPEG frames arrive through `browserWatchScreencast` SSE and paint into a dedicated viewport that forwards pointer and keyboard events through `browserSendPointer` / `browserSendKeyboard`. Viewport pixel size debounces to `browserResizeViewport` on content-area resize. An unbound Session shows the full-page card「无法使用浏览器」with no tab or navigation chrome. Leaving the Browser segment aborts SSE without closing Host tabs.

Verification: `packages/client/ui-browser/tests/browser-panel.client.spec.tsx` and sibling unit specs cover unbound empty/disabled states, first-tab bootstrap, loading overlay, workspace/session tab-set persistence, viewport sync, and input forwarding.
