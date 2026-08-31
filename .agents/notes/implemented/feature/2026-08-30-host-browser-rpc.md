# Host browser RPC（Issue #94）

Status: implemented

## Decision

V4 内嵌浏览器在 Host 侧经 `packages/host/apiproxy` 暴露有类型的 `host.browser.*` RPC。Playwright `BrowserRegistry`（`browser-registry.ts`）按 **workspaceId** 索引；每个 Workspace 以 `launchPersistentContext` 映射 profile 目录 `.sessions/browser-profiles/<workspaceId>/`。产品默认有头（`headless: false`）；测试经 `internals.headless` 保持无头。`host.browserShowWindow` 与选中/导航会 `page.bringToFront()`。Client 与 Agent 工具只消费 RPC，不直接 import Playwright。人类主表面见 [headed human surface](../architecture/2026-08-31-headed-browser-human-surface.md)。

## Screencast transport

`host.browserWatchScreencast` 仍经 SSE 推送 JPEG 帧（`page.screenshot` 轮询），但不再是人类操作面。Client 工具箱不订阅该流。

## Error codes

- `browser-unavailable`：`details.reason` 为 `chromium-missing`（缺 `playwright install chromium`）或 `context-start-failed`。
- `browser-tab-not-found`：Workspace 内未知 tabId。
- `workspace-not-found`：未注册 Workspace（与终端 RPC 一致）。

## Verification

- `packages/host/apiproxy/tests/api-proxy-browser.spec.ts`：Issue #94 验收标准集成 seam。
- `packages/client/runtime/tests/workspaces-service.client.spec.ts`：`browser*` RPC 与 screencast SSE 经 `WorkspaceRuntime` 转发。

Chromium 集成测试在缺浏览器时 self-skip（`chromium.executablePath()`）；`browser-unavailable` 用 injectable `chromiumExecutablePath` 断言。
