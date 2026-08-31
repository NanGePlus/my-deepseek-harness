# Agent Note: Headed Chromium is the human browser surface

Status: implemented

英文 | [English](2026-08-31-headed-browser-human-surface.md)

## Problem

V4 工具箱浏览器把 Host Playwright 的 JPEG 画进 Client `<img>`，再把指针和键盘合成回同一 `Page`。人和 Agent 共用 Context，但人类路径是远程桌面截图：截图不画 caret，IME 候选不能贴在插入点，对 `mousedown` 做 `preventDefault` 的组件库也得不到真焦点。产品要求是：Agent 打开一页后，人能在同一页上用系统浏览器那套输入来操作。

`pnpm dsh web` 无法在 SPA 里再嵌一块 Chromium WebView。完整桌面壳是下一版产品，不是这次改动。

## Decision

`BrowserRegistry` 以有头方式启动 Workspace 持久 Context（`headless: false`，`viewport: null`）。新建、选中、导航、刷新、Agent 的 click/type/select，以及 `host.browserShowWindow`，都会调用 `page.bringToFront()`。人在可见的 Chromium 窗口里用原生 caret 和 IME 操作。工具箱 **浏览器** 段保留 Tab 栏和地址栏遥控，展示「显示窗口」卡片，并在段可见时轮询 `browserList` 以同步标题和历史。JPEG screencast 与 `sendPointer` / `sendKeyboard` 仍留在线上但不再被人类路径使用；Client occupant 不再订阅或转发输入。集成测试传入 `internals.headless: true`，避免 CI 弹出窗口。

## Alternatives considered

- **继续打磨 JPEG 遥控器。** 否决：截图无法在 caret、IME 和真焦点上达到外部浏览器的保真度。
- **先做完整 Electron IDE。** 否决：有头 Playwright 窗口现在就能满足「同一实例 + 真输入」；嵌进工具箱矩形的 WebView 等下一版桌面包装（`connectOverCDP`）。
- **用 Client iframe 当人类视图。** ADR-0007 已否：框架头会挡住任意站点，iframe 也无法与 Agent Context 共用存储。

## Consequences

- 本机 `dsh web` 的操作者会在跑 Host 的机器上看到一扇 Chromium 窗口。浏览器在远程、Host 在服务器时，操作者看不到这扇窗。
- 之后的桌面包装可以保留这套控制面，再用面板内 WebView 替换独立 OS 窗口，而不必重写 Tab 或 Agent 工具。
- Host 集成测试必须显式选择 headless；产品默认保持有头。
- 关掉有头窗口会关掉持久 Context。Registry 丢掉该池；下一次 `createTab` 会重新拉起，`closeTab` 对已消失的 Tab 视为成功，`showWindow` 抛出 `browser-tab-not-found` 以便 Client 按 store URL 恢复。
