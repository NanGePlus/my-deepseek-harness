# Desktop BrowserRegistry CDP fork and BrowserView bounds IPC

Desktop delivery keeps `host.browser.*` RPC signatures while swapping the human surface from a headed Playwright OS window to Electron `BrowserView` webContents attached through Playwright `connectOverCDP`. Web delivery keeps ADR-0007 behavior.

## Decision

`BrowserRegistry` reads a `browserDelivery` config (`web` | `desktop`) from `@deepseek-ai/dsh-host-apiproxy`. Desktop mode connects over CDP through an injectable `DesktopBrowserSurface` registered by Electron Main before Host boot; `revealTab` and `showWindow` skip `bringToFront`. Electron Main owns `DesktopBrowserViewManager` (BrowserView lifecycle + bounds) and exposes occupant bounds IPC (`dsh:browser-occupant-bounds`) to the Renderer; preload forwards `reportBrowserOccupantBounds`. `@deepseek-ai/dsh-client-ui-browser` detects the preload reporter, renders `#browser-occupant`, and publishes screen bounds through `ResizeObserver` while the toolbox **浏览器** segment is visible; the web path keeps the headed-window handoff card. Before Host tabs finish bootstrapping, desktop occupant shows inline **正在准备浏览器…**; navigation shows a spinner overlay without the web **连接中…** copy.

## Verification

- `packages/host/apiproxy/tests/browser-registry-desktop.spec.ts` — desktop CDP seam + web regression
- `apps/desktop/tests/browser-view-bounds.spec.ts` — attach/setBounds/detach
- `apps/desktop/tests/browser-bounds-ipc.spec.ts` — bounds payload parsing + handler
- `packages/bundle/desktop-app/tests/desktop-profile.spec.ts` — `browserDelivery: desktop` in composed profile
- `packages/client/ui-browser/tests/browser-panel-desktop.client.spec.tsx` — embedded-browser States matrix + bounds IPC
- `packages/client/ui-browser/tests/browser-desktop-occupant.client.spec.ts` — bounds bridge helpers

## References

- Issue #118 / #122 / PRD `desktop-v5.md` implementation + test decisions for BrowserRegistry fork, bounds IPC, and embedded-browser occupant States matrix
- ADR-0010
