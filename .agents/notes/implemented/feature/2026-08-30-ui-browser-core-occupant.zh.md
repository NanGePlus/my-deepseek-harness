---
title: ui-browser 浏览器段核心 occupant
kind: implemented
area: web
---

[English](2026-08-30-ui-browser-core-occupant.md) | 中文

`@deepseek-ai/dsh-client-ui-browser` 经 `ctx.slots.inject` 注册到 `conversation.details.browser`。Tab 行、选中项与 Client Zoom 按 `workspaceId` 分区持久化，不写 Session 日志。浏览器段可见且绑定 Workspace 尚无 Tab 时，面板先 `browserList` 再 `browserCreateTab('about:blank')` 并聚焦地址栏。内容区说明人在 Host 有头 Chromium 窗口操作，并提供 **显示窗口**（`browserShowWindow`）。段可见时轮询 `browserList`，以同步标题和历史。未绑定 Session 展示整页卡片「无法使用浏览器」，无 Tab/导航。切走浏览器段不关闭 Host Tab 与有头窗口。

验证：`packages/client/ui-browser/tests/browser-panel.client.spec.tsx` 覆盖未绑定空态、首次 Tab、显示窗口交接、Workspace/Session Tab 集持久化，以及 Host Tab 重建。
