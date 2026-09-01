# Agent Note: 桌面 BrowserView 销毁后重新挂载

Status: implemented

[English](2026-08-31-desktop-browserview-destroyed-reattach.md) | 中文

## Problem

切到工具箱 **浏览器** 段时 Main 抛未捕获异常：`Can't add a destroyed child view to a parent view`。栈是 occupant bounds IPC 上的 `applyBrowserOccupantBounds` → `addBrowserView`。guest `webContents` 关闭或崩溃后 Electron 会删掉原生 WebContentsView；`DesktopBrowserViewManager` 仍握着该 view 并尝试再挂上去。`DesktopBrowserSurface` 没有 `closeTab`，Host 经 CDP 的 `page.close()` 销毁 guest 后，map 里还留着死 view。

## Decision

occupant 挂载不会对已销毁的 guest 调用 `addBrowserView`。`applyBrowserOccupantBounds` 在 `isDestroyed()` 为真时跳过 attach，并抓住 Electron 的 destroyed-child 拒绝，避免一次 bounds 上报打垮 Main。IPC handler 也吞掉 apply 失败。`DesktopBrowserSurface.closeTab` 在 Playwright `page.close()` **之前**丢掉 BrowserView。若当前选中 Tab 的 guest 已经没了，manager 新建 BrowserView、`loadURL` 上次 URL，再挂上这个 view。

## Alternatives considered

**把异常留给用户、让他们重启。** 否决：切到 **浏览器** 是正常的隐藏/显示；Main 不得弹出未捕获异常对话框。

**只跳过 attach、不重建。** 否决：guest `window.close()`、CDP `page.close()` 或 renderer 崩溃后 occupant 会一直空白，等于再出现一次 0×0 空面板。

**`webContents.close()` 之后继续用同一个 BrowserView 对象。** 否决：Electron 的原生 child 已经没了；`addBrowserView` 就是这次报错。

## Consequences

活着的 guest 隐藏/显示不变。死掉的 guest 会多一个新 BrowserView，并重载上次 URL。Host 桌面 `closeTab` 现在依赖 surface 方法；web 交付不调用它。

## Testing

`apps/desktop/tests/browser-view-bounds.spec.ts` 在 `addBrowserView` 调用点复现 Electron 拒绝并断言不抛。`apps/desktop/tests/browser-view-manager.spec.ts` 覆盖活 view 的隐藏/显示、`webContents.close()` 后重建、以及 `closeTab` 后丢弃。`apps/desktop/tests/browser-bounds-ipc.spec.ts` 吞掉 apply 抛错。`packages/host/apiproxy/tests/browser-registry-desktop.spec.ts` 在 `page.close()` 之前关掉 surface。
