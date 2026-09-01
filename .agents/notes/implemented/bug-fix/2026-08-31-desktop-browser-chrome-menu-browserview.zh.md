# Agent Note: 桌面壳 chrome 菜单无法画在 BrowserView 之上

Status: implemented

[English](2026-08-31-desktop-browser-chrome-menu-browserview.md) | 中文

## Problem

工具箱浏览器的溢出菜单和 Tab 右键菜单是 React portal 列表。桌面壳下它们会落到 `#browser-occupant` 上，该区域像素由 Electron `BrowserView` 绘制。原生视图叠在 Renderer 之上，CSS `z-index` 无法让列表露出来。菜单打开时整段 detach 会让网页消失。改为 `side="top"` 仍会进入 occupant：导航栏紧贴 occupant 上沿，视口 clamp 还会把过高的列表推回 BrowserView 区域。

## Decision

chrome 菜单打开时，Renderer 测量 portaled `[role="menu"]` 矩形，并把 occupant bounds 从上沿缩到 `overlay.bottom`。Main 让 BrowserView 继续附着在该边以下。菜单画在 Renderer 空出的区域，网页其余部分仍可见。关闭菜单后重新上报满格 occupant。溢出菜单和 Tab 菜单仍向下展开（`side="bottom"`）。

## Alternatives considered

**提高 portal 列表的 `z-index`。** 否决：`BrowserView` 不在 Renderer 叠层上下文里。

**菜单打开时 detach 整块 occupant 的 BrowserView。** 否决：网页整页空白，正是第一次尝试后用户报告的失败。

**把列表开在导航栏上方（`side="top"`）并夹到锚点。** 否决：chrome 条高度不够 Hard Reload + Copy URL + Zoom，列表仍进入 occupant，或 Zoom 页脚被裁切。

**Electron `Menu.popup` 原生菜单。** 本次否决：溢出菜单页脚是自定义 Zoom 控件，不是原生菜单项。

## Consequences

chrome 菜单打开期间，guest 顶部会裁到菜单底边，页面不卸载。若菜单盖住整个 occupant 高度，关闭前会上报 `visible: false`。浏览器交付不变（没有 occupant reporter）。

## Testing

`packages/client/ui-browser/tests/browser-desktop-occupant.client.spec.ts` 覆盖 `insetOccupantBoundsForOverlay`。`packages/client/ui-browser/tests/browser-panel-desktop.client.spec.tsx` 打开「更多操作」并断言 bounds 的 `y` 等于菜单底边且 `visible: true`。
