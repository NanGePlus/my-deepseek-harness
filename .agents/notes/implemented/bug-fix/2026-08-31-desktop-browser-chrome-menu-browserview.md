# Agent Note: Desktop chrome menus cannot paint over BrowserView

Status: implemented

English | [中文](2026-08-31-desktop-browser-chrome-menu-browserview.zh.md)

## Problem

Toolbox browser overflow and tab context menus are React portal lists. On desktop they open over `#browser-occupant`, whose pixels are an Electron `BrowserView`. Native views stack above the Renderer, so CSS `z-index` never shows the list. Detaching the view while the menu is open blanks the page. Opening `side="top"` still intersects the occupant: the nav bar is immediately above it, and viewport clamping pushes a tall list back down into the view.

## Decision

While a chrome menu is open, Renderer measures the portaled `[role="menu"]` rectangle and reports occupant bounds inset from the top to `overlay.bottom`. Main keeps the BrowserView attached below that edge. The menu paints in the Renderer gap; the rest of the page stays visible. Closing the menu reports the full occupant again. Overflow and tab menus open downward (`side="bottom"`).

## Alternatives considered

**Raise `z-index` on the portaled list.** Rejected: `BrowserView` is not in the Renderer stacking context.

**Detach BrowserView for the whole occupant while the menu is open.** Rejected: the page disappears, which is the failure the user reported after the first attempt.

**Keep the list above the nav bar (`side="top"`) and clamp it to the anchor.** Rejected: the chrome strip is shorter than Hard Reload + Copy URL + Zoom, so the list still enters occupant pixels, or the Zoom footer is clipped.

**Electron `Menu.popup` native menu.** Rejected for this change: the overflow footer is a custom Zoom control, not a native item list.

## Consequences

Opening a chrome menu crops the top of the guest to the menu bottom for the open duration; the page does not unmount. A menu that covers the full occupant height would report `visible: false` until close. Web delivery is unchanged (no occupant reporter).

## Testing

`insetOccupantBoundsForOverlay` unit cases in `packages/client/ui-browser/tests/browser-desktop-occupant.client.spec.ts`. `packages/client/ui-browser/tests/browser-panel-desktop.client.spec.tsx` opens 更多操作 and asserts bounds `y` equals the menu bottom with `visible: true`.
