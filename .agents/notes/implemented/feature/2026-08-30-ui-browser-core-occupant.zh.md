# Agent Note：ui-browser 浏览器段核心 occupant

[English](2026-08-30-ui-browser-core-occupant.md) | 中文

## 背景

内嵌浏览器 V4 在 #95 已声明 `conversation.details.browser` 槽位，但尚无 occupant（[browser-v4 PRD](../../../../docs/prd/browser-v4.md) US-5~US-8、US-16、US-21；Issue #96）。

## 决策

新建 `@deepseek-ai/dsh-client-ui-browser`，经 `ctx.slots.inject` 注册 `BrowserPanel`。Tab 与 Client Zoom 按 **workspaceId** 保存在 store，不写 Session 日志。首次进入浏览器段且无 Tab 时 `browserList` → `browserCreateTab('about:blank')` 并聚焦地址栏。screencast 经 `browserWatchScreencast` SSE 贴图，指针/键盘经 `browserSendPointer` / `browserSendKeyboard` 转发。内容区 resize debounce 调用 `browserResizeViewport`。未绑定 Workspace 时整页空态「无法使用浏览器」，无 Tab/导航。切走浏览器段 abort SSE，不关闭 Host Tab。

## 验证

- `packages/client/ui-browser/tests/browser-panel.client.spec.tsx` — States 矩阵与 US-5~US-8、US-16、US-21 行为。
- `packages/client/ui-browser/tests/apply.client.spec.ts` — 槽位注册与 Host 回调桥接。
