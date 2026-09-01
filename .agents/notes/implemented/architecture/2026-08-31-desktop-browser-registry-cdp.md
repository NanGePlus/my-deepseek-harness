# Desktop BrowserRegistry CDP fork and BrowserView bounds IPC

Desktop delivery keeps `host.browser.*` RPC signatures while swapping the human surface from a headed Playwright OS window to Electron `BrowserView` webContents attached through Playwright `connectOverCDP`. Web delivery keeps ADR-0007 behavior. Session and in-page `http(s)` popups (`target=_blank` / `window.open`) are denied at `web-contents-created` and forwarded to the toolbox browser; the nav-bar **在外部浏览器打开** control still uses `shell.openExternal`.

## Decision

`BrowserRegistry` reads a `browserDelivery` config (`web` | `desktop`) from `@deepseek-ai/dsh-host-apiproxy`. Desktop mode connects over CDP through an injectable `DesktopBrowserSurface` registered by Electron Main before Host boot. `revealTab` and `showWindow` skip `bringToFront` and instead call required `DesktopBrowserSurface.selectTab`, which attaches the selected `BrowserView` and applies occupant bounds; omitting that call leaves the guest document at a 0×0 viewport. Host desktop `closeTab` calls `DesktopBrowserSurface.closeTab` before Playwright `page.close()`. Occupant attach skips a destroyed WebContentsView and recreates the BrowserView at the last URL so a toolbox **浏览器** segment tick cannot throw Electron's destroyed-child error. Electron Main owns `DesktopBrowserViewManager` (BrowserView lifecycle + bounds) and exposes occupant bounds IPC (`dsh:browser-occupant-bounds`) to the Renderer; preload forwards `reportBrowserOccupantBounds`. `@deepseek-ai/dsh-client-ui-browser` detects the preload reporter, renders `#browser-occupant`, and publishes screen bounds through `ResizeObserver` while the toolbox **浏览器** segment is visible; the web path keeps the headed-window handoff card. Before Host tabs finish bootstrapping, desktop occupant shows inline **正在准备浏览器…**; navigation shows a spinner overlay without the web **连接中…** copy. `pageForTab` matches existing CDP pages after normalizing Electron `getURL() === ''` with Playwright `about:blank`, and `ensureTab` always `loadURL` (including blank) so a fresh BrowserView is visible to CDP without waiting for a new `page` event that will not fire.

## Verification

- `packages/host/apiproxy/tests/browser-registry-desktop.spec.ts` — desktop CDP seam + web regression
- `apps/desktop/tests/desktop-browser-cdp.spec.ts` — empty URL / about:blank match; unmatched URL returns undefined
- `apps/desktop/tests/browser-bounds-ipc.spec.ts` — bounds payload parsing + handler; apply throw contained
- `apps/desktop/tests/browser-view-manager.spec.ts` — hide/show live view; recreate after destroyed webContents; drop after closeTab
- `apps/desktop/tests/browser-view-manager.spec.ts` — hide/show live view; recreate after destroyed webContents; drop after closeTab
- `apps/desktop/tests/browser-view-bounds.spec.ts` — destroyed-child `addBrowserView` does not throw
- [Desktop BrowserView destroyed-child reattach](../bug-fix/2026-08-31-desktop-browserview-destroyed-reattach.md)
- `packages/bundle/desktop-app/tests/desktop-profile.spec.ts` — `browserDelivery: desktop` in composed profile
- `apps/desktop/tests/window-open-policy.spec.ts` — http(s) popups embed; other schemes deny
- `packages/client/ui-browser/tests/embedded-browser-open.client.spec.ts` — blank tab reuse vs create
- `packages/client/ui-browser/tests/browser-panel-desktop.client.spec.tsx` — embedded-browser States matrix + bounds IPC + session URL routing
- `packages/client/ui-browser/tests/browser-desktop-occupant.client.spec.ts` — bounds bridge helpers

## References

- Issue #118 / #122 / PRD `desktop-v5.md` implementation + test decisions for BrowserRegistry fork, bounds IPC, and embedded-browser occupant States matrix
- ADR-0010
