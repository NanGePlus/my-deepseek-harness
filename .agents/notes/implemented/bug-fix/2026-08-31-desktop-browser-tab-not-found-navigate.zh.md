# Agent Note: 桌面浏览器导航 tab-not-found

Status: implemented

[English](2026-08-31-desktop-browser-tab-not-found-navigate.md) | 中文

## Problem

工具箱浏览器地址栏提交后，导航栏出现红色 **browser tab not found: &lt;uuid&gt;** 和 **重试**。刷新已经会恢复缺失的 Host Tab；导航不会。Electron / Host 重启后 Client store 仍握着旧 UUID，bootstrap 异步 remap。在这段窗口里按 Enter，或之后 Host 丢掉同一 Tab，都会带上过期 id。重试捕获的是仍点名该 id 的 navigate 闭包，所以 **重试** 会重复失败。

## Decision

地址栏提交、会话 / popup 打开、后退 / 前进与刷新走同一条恢复后重试路径：遇到 `browser-tab-not-found` 时 `list` 或按 store 重建，再用活着的 tab id 重复该 RPC。Host Tab 尚未就绪时到达的提交先排队，remap 后再刷出。导航重试读取当前的 `handleNavigate`，而不是失败时的闭包。

## Alternatives considered

**只把地址栏禁用到 `hostTabsReady`。** 不能作为唯一修复：Host 之后丢掉 Tab 仍会画出同一条红条，而且刷新已经有恢复路径。

**让 Host `createTab` 沿用 Client 的 UUID。** 否决：`list` 后 remap 已是重启约定；再让 Host 接收持久 id 是重复。

**重试仍走失败时的闭包。** 否决：bootstrap remap 选中项之后，**重试** 仍会用过期 UUID 调用 `navigate`。

## Consequences

键入的 URL 要等 bootstrap remap 后才发给活着的 Tab。就绪之后 Host Tab 消失时，会 remap store 并重试一次。准备期间到达的会话链接等同一条就绪边。

## Testing

`packages/client/ui-browser/tests/browser-panel-desktop.client.spec.tsx`：地址栏在 `browser-tab-not-found` 后恢复；`list` 挂起时的提交刷到 remap 后的 Tab；准备期间的会话 URL 等待；后退会恢复。
