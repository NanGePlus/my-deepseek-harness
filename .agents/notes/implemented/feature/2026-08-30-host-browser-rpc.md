# Host browser RPC（Issue #94）

Status: implemented

## Decision

V4 内嵌浏览器在 Host 侧经 `packages/host/apiproxy` 暴露有类型的 `host.browser.*` RPC。Playwright `BrowserRegistry`（`browser-registry.ts`）按 **workspaceId** 索引；每个 Workspace 以 `launchPersistentContext` 映射 profile 目录 `.sessions/browser-profiles/<workspaceId>/`。Client 与 Agent 工具只消费 RPC，不直接 import Playwright。

## Screencast transport

`host.browserWatchScreencast` 经 SSE 推送 JPEG 帧。首版以 `page.screenshot({ type: 'jpeg' })` 约 200ms 轮询生成帧，而非 CDP `Page.startScreencast`：后者在 headless shell 上与订阅时序竞态，静态页首帧可能在 SSE 连接建立前丢失。轮询满足 PRD「收到 JPEG 帧」契约；后续可在隐藏 Tab 暂停推帧时改回 CDP 并缓冲首帧。

## Error codes

- `browser-unavailable`：`details.reason` 为 `chromium-missing`（缺 `playwright install chromium`）或 `context-start-failed`。
- `browser-tab-not-found`：Workspace 内未知 tabId。
- `workspace-not-found`：未注册 Workspace（与终端 RPC 一致）。

## Verification

- `packages/host/apiproxy/tests/api-proxy-browser.spec.ts`：Issue #94 验收标准集成 seam。
- `packages/client/runtime/tests/workspaces-service.client.spec.ts`：`browser*` RPC 与 screencast SSE 经 `WorkspaceRuntime` 转发。

Chromium 集成测试在缺浏览器时 self-skip（`chromium.executablePath()`）；`browser-unavailable` 用 injectable `chromiumExecutablePath` 断言。
