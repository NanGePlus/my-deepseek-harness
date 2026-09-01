# Agent Note: Desktop BrowserView destroyed-child reattach

Status: implemented

English | [中文](2026-08-31-desktop-browserview-destroyed-reattach.zh.md)

## Problem

Switching to the toolbox **浏览器** segment threw an uncaught Main exception: `Can't add a destroyed child view to a parent view`. The stack was `applyBrowserOccupantBounds` → `addBrowserView` from the occupant-bounds IPC tick. Electron deletes the native WebContentsView when guest `webContents` closes or crashes; `DesktopBrowserViewManager` still held that view and tried to reattach it. `DesktopBrowserSurface` had no `closeTab`, so Host `page.close()` via CDP destroyed the guest while the map kept the dead view.

## Decision

Occupant attach never calls `addBrowserView` on a destroyed guest. `applyBrowserOccupantBounds` skips attach when `isDestroyed()` is true and catches Electron's destroyed-child refusal so a bounds tick cannot take down Main. The IPC handler also contains apply failures. `DesktopBrowserSurface.closeTab` drops the BrowserView **before** Playwright `page.close()`. If the selected tab's guest is already gone, the manager creates a new BrowserView and `loadURL`s the last URL, then attaches that view.

## Alternatives considered

**Leave the throw and tell the user to restart.** Rejected: switching to **浏览器** is a normal hide/show; Main must not show an uncaught-exception dialog.

**Only skip attach, never recreate.** Rejected: the occupant would stay blank after a guest `window.close()`, CDP `page.close()`, or renderer crash, repeating the 0×0 empty panel.

**Keep using the same BrowserView object after `webContents.close()`.** Rejected: Electron's native child is gone; `addBrowserView` is the throw in this bug.

## Consequences

Hide/show of a live guest is unchanged. A dead guest costs one new BrowserView and a reload of the last URL. Host desktop `closeTab` now depends on the surface method; web delivery does not call it.

## Testing

`apps/desktop/tests/browser-view-bounds.spec.ts` reproduces the Electron refusal at the `addBrowserView` call and asserts no throw. `apps/desktop/tests/browser-view-manager.spec.ts` hide/show of a live view, recreate after `webContents.close()`, and drop after `closeTab`. `apps/desktop/tests/browser-bounds-ipc.spec.ts` contains apply throws. `packages/host/apiproxy/tests/browser-registry-desktop.spec.ts` closes the surface before `page.close()`.
