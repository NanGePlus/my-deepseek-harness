# Agent Note: 桌面浏览器导航一元超时

Status: implemented

[English](2026-08-31-desktop-browser-nav-unary-timeout.md) | 中文

## Problem

工具箱浏览器打开外部站点时，导航栏出现红色 **signal timed out** 和 **重试**，而 guest 文档其实已经能看见。Chromium 的 `AbortSignal.timeout` 用的就是这句文案。`host.browserCreateTab` / `host.browserNavigate` 在默认 30 秒一元截止时间内等待 Playwright `domcontentloaded`。RPC 一中止，Client 拿不到新 `tabId`，Tab 栏仍停在上一个 Tab，Main 却已经把新的 BrowserView 挂上去了。

## Decision

会等页面加载的浏览器 RPC（`browserCreateTab`、`browserNavigate`、`browserGoBack`、`browserGoForward`、`browserReload`）改用 `caller-signal-only`，与 `host.pickDirectory`、`host.gitPush` 相同（[一元时限策略](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md)）。桌面 `createTab` 在 `ensureTab` 已经 `loadURL` 之后不再调用 Playwright `goto`。会话和 popup 打开会在揭示工具箱 **浏览器** 段之前，对新建或复用的 Tab 调用 `setSelectedTab` 和 `browserSelectTab`。

## Alternatives considered

**保留 30 秒截止，只把 `signal timed out` 换成更好懂的文案。** 否决：guest 文档已经在屏幕上；RPC 中止仍会让新 `tabId` 进不了 Client store。

**把等待从 `domcontentloaded` 改成 `commit`。** 否决：桌面已经在 `ensureTab` 里开始加载文档；第二次 Playwright 等待才是多余的延迟。

**揭示后再靠 Host `list` 选中 Tab。** 否决：bootstrap 仍会抢选中项；打开方必须点名它刚创建或导航的 Tab。

## Consequences

页面加载卡住时不再踩一元截止；调用方或连接仍可中止。桌面 create 在 CDP 附着后返回，title/url 经 `framenavigated` 元数据同步补上。

## Testing

`packages/host/apiproxy/tests/fetch-carrier.spec.ts` 在 30 秒后完成 create/navigate 且不调用 `AbortSignal.timeout`。`packages/host/apiproxy/tests/browser-registry-desktop.spec.ts` 断言桌面 `createTab` 不 `page.goto`。`packages/client/ui-browser/tests/browser-panel-desktop.client.spec.tsx` 断言会话打开会对当前或新建 Tab 调用 `browserSelectTab`。
