# Desktop BrowserRegistry CDP fork and BrowserView bounds IPC

Desktop delivery keeps `host.browser.*` RPC signatures while swapping the human surface from a headed Playwright OS window to Electron `BrowserView` webContents attached through Playwright `connectOverCDP`. Web delivery keeps ADR-0007 behavior.

## Decision

`BrowserRegistry` reads a `browserDelivery` config (`web` | `desktop`) from `@deepseek-ai/dsh-host-apiproxy`. Desktop mode connects over CDP through an injectable `DesktopBrowserSurface` registered by Electron Main before Host boot; `revealTab` and `showWindow` skip `bringToFront`. Electron Main owns `DesktopBrowserViewManager` (BrowserView lifecycle + bounds) and exposes occupant bounds IPC (`dsh:browser-occupant-bounds`) to the Renderer; preload forwards `reportBrowserOccupantBounds`.

## Verification

- `packages/host/apiproxy/tests/browser-registry-desktop.spec.ts` — desktop CDP seam + web regression
- `apps/desktop/tests/browser-view-bounds.spec.ts` — attach/setBounds/detach
- `apps/desktop/tests/browser-bounds-ipc.spec.ts` — bounds payload parsing + handler
- `packages/bundle/desktop-app/tests/desktop-profile.spec.ts` — `browserDelivery: desktop` in composed profile

## References

- Issue #118 / PRD `desktop-v5.md` implementation + test decisions for BrowserRegistry fork and bounds IPC
- ADR-0010
