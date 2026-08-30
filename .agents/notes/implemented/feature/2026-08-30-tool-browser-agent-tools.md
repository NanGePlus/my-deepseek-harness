# tool-browser Agent 工具（Issue #100）

Status: implemented

## Decision

V4 Agent 经 `@deepseek-ai/dsh-tool-browser` 注册七个 `browser_*` 工具，实现调用 Host `host.browser.*` RPC（共用 Workspace 级 Playwright `BrowserRegistry`），不在 Agent 进程内另起 Playwright。工具从 `exec.agent` 解析绑定 Workspace，默认使用 `browserList` 选中 Tab（无 Tab 时 `browserCreateTab`）。`browser_snapshot` 使用 `terminal` render intent；其余工具为 `generic` 一行摘要。

## Presentation

- `browser_snapshot`：`presentResult` 返回 `card: 'terminal'`，对话区可折叠 accessibility 树；`finalizeContent` 以 `snapshotMaxBytes`（默认 256KiB）截断，更大输出由部署 spill 策略溢出至工具详情。
- Host `browser-unavailable` / `browser-tab-not-found` / `workspace-not-found` 以 RPC message 原文作为工具错误返回，与 ui-browser 空态文案一致。

## Registration

- Web agent preset（`standard` / `code` / `cordis`）挂载 `tool-browser`。
- `apps/cli` 与 `packages/bundle/web-app` 声明 workspace 依赖以供 Loader 解析。

## Verification

- `packages/browser/tool-browser/tests/tool-browser.spec.ts`：Host RPC seam、terminal 卡、tabId 共用、V4 工具面、不可用错误、snapshot 截断。
- `packages/browser/tool-browser/tests/integration.spec.ts`：经 agent loop 的 `tool/call` + `tool/result` Session 日志。
