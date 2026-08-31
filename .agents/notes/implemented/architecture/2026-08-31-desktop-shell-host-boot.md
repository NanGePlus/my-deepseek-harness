# Desktop shell Host boot and dsh:// loading (Issue #115)

Electron Main owns integrated Host boot for the `desktop` profile: `DesktopHostController` wraps `runProfile` from `apps/cli` and tears down on `before-quit`. The Renderer loads the same `apps/web` SPA as browser delivery; production uses a privileged `dsh://app` protocol handler that maps dist assets and injects `window.__DSH_BOOT__` from a loader scan (`composeDesktopBootGraph`) instead of `dsh-host-webserver`. Development runs Vite with `DSH_DESKTOP_DEV=1` (boot graph file written by Main after Host boot) plus Electron loading the dev server URL. Attach mode reads `DSH_DESKTOP_ATTACH` and skips Main Host boot so the Renderer uses loopback `dsh web` and its injected manifest. Host boot failure injects `window.__DSH_HOST_BOOT__`; `AppWebEntry` renders a loud error and optional preload `retryHostBoot` before plugin boot. `dsh desktop` and `pnpm run dev:desktop` are thin launchers; live IPC RPC is Issue #116.

## Verification

- `apps/desktop/tests/host-boot.spec.ts` — Main Host boot + teardown
- `apps/desktop/tests/protocol-dsh.spec.ts` — `dsh://` dist + bundle mapping
- `apps/desktop/tests/load-url.spec.ts` — dev / production / attach load targets
- `apps/desktop/tests/host-boot-wire.spec.ts` — failure wire injection
- `packages/client/web/tests/app-root.client.spec.tsx` — Host boot failure UI
