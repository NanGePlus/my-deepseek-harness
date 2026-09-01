# Agent Note: Desktop browser navigation unary timeout

Status: implemented

English | [中文](2026-08-31-desktop-browser-nav-unary-timeout.zh.md)

## Problem

Navigating the toolbox browser to an external site showed a red **signal timed out** bar with **重试** while the guest document was already visible. Chromium's `AbortSignal.timeout` uses that message. `host.browserCreateTab` / `host.browserNavigate` waited for Playwright `domcontentloaded` under the default 30s unary deadline. When the RPC aborted, the Client never received the new `tabId`, so the Tab bar stayed on the previous tab even though Main had attached the new BrowserView.

## Decision

Page-load browser RPCs (`browserCreateTab`, `browserNavigate`, `browserGoBack`, `browserGoForward`, `browserReload`) use `caller-signal-only`, same as `host.pickDirectory` and `host.gitPush` ([unary deadline policy](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md)). Desktop `createTab` does not call Playwright `goto` after `ensureTab` already `loadURL`s. Session and popup opens call `setSelectedTab` and `browserSelectTab` for the created or reused tab before revealing the toolbox **浏览器** segment.

## Alternatives considered

**Keep the 30s deadline and map `signal timed out` to friendlier copy.** Rejected: the guest document is already on screen; aborting the RPC still drops the new `tabId` from the Client store.

**Wait for `commit` instead of `domcontentloaded`.** Rejected: desktop already started the document in `ensureTab`; a second Playwright wait is the extra delay.

**Select the tab only from Host `list` after reveal.** Rejected: reveal's bootstrap can still race; the opener must name the tab it just created or navigated.

## Consequences

A hung page load no longer trips the unary deadline; the caller or connection can still abort. Desktop create returns after CDP attach, and title/url catch up through `framenavigated` metadata sync.

## Testing

`packages/host/apiproxy/tests/fetch-carrier.spec.ts` completes create/navigate after 30s without calling `AbortSignal.timeout`. `packages/host/apiproxy/tests/browser-registry-desktop.spec.ts` asserts desktop `createTab` does not `page.goto`. `packages/client/ui-browser/tests/browser-panel-desktop.client.spec.tsx` asserts session opens `browserSelectTab` the live or new tab.
