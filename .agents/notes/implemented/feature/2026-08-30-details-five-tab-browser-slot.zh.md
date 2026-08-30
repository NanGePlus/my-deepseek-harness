# Agent Note：工具箱五段 Tab 与浏览器槽位

[English](2026-08-30-details-five-tab-browser-slot.md) | 中文

## 背景

内嵌浏览器 V4 需要在资源管理器、Git、终端与工具详情旁增加第五段工具箱 Tab（[ADR-0008](../../../../docs/adr/0008-embedded-browser-client-and-tools.md)、[browser-v4 PRD](../../../../docs/prd/browser-v4.md) US-1~US-4）。[details 四段终端槽位](2026-08-29-details-four-tab-terminal-slot.md) 尚无浏览器 occupant。

## 决策

`ui-conversation` 将 segmented Tab 扩为 **资源管理器 | Git面板 | 终端 | 浏览器 | 工具详情**，声明 `conversation.details.browser`（`kind: single`、`scope: root`），并在选中 **浏览器** 段时传入 `visible`。切走 **浏览器** 只隐藏面板、不卸载；Host BrowserContext 生命周期由 `ui-browser`（#96+）负责。浏览器段与终端段共用 flush 内容区，以便 embedded-browser occupant 占满工具箱列宽。

## 否决方案

**在 `ui-conversation` 内挂载内嵌浏览器。** ADR-0008 否决：screencast、导航与 Host RPC 属于 `@deepseek-ai/dsh-client-ui-browser`。

**切走 **浏览器** 段时销毁 Host BrowserContext。** US-3 否决：只隐藏视图，由 occupant 暂停 screencast。

## 验证

- `packages/client/ui-conversation/tests/details-panel-tabs.client.spec.tsx` — 五段标签、浏览器选中/切走、槽位 `visible`。
- `packages/client/ui-conversation/tests/chat-apply.client.spec.tsx` — 槽位声明。
- `apps/web/tests/details-segmented-tab.e2e.ts` + `tabs.expected.md` / `browser-selected.expected.md` — 浏览器快照 seam，以及选中 **浏览器** 时拖宽 details 列。
