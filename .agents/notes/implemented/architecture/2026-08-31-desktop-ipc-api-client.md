# Desktop IPC API carrier (Issue #116)

Integrated desktop delivery routes SPA RPC through `IpcApiClient` (`AbstractApiClient` subclass) instead of loopback `WebApiClient`. Renderer `callUnary` / `respond` POST bodies ride `ipcMain.handle('dsh:api-fetch')`; mux / host / watchPath / terminalStream / browserWatchScreencast downlinks are `ServerRequest` JSON frames on `dsh:api-stream-*` channels. Unary IPC fetch awaits `response.text()`, so SSE paths cannot use it — the Renderer `openStream`s and Main maps the pathname onto `ApiProxy`. Preload exposes a narrow `window.dsh` bridge (`contextIsolation: true`); attach mode (`DSH_DESKTOP_ATTACH`) omits the bridge so the connection plugin keeps `WebApiClient`. Main registers `registerIpcApiBridge(ctx.apiProxy)` after Host boot and disposes on quit.

## Verification

- `packages/client/connection/tests/ipc-api-client.client.spec.ts` — isomorphism vs `InProcessApiClient`, downlink order/schema, terminalStream / browserWatchScreencast over `openStream` (not hanging unary fetch), reconnect backoff, apply carrier selection
- `packages/client/connection/tests/ipc-bridge-fixture.client.ts` — fake Main handler for Renderer-side seam tests
- `apps/desktop/tests/ipc-downlink.spec.ts` — Main pathname routing including terminalStream query
