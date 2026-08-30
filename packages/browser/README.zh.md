# browser/ — 内嵌浏览器工具

[English](README.md)

面向 Agent 的内嵌浏览器 V4 Host Playwright Registry 工具族。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`tool-browser/`](tool-browser/README.md) | 向模型暴露 `browser_*` 工具 | 注册于 `ctx.tools` |

工具调用 Workspace 级 `BrowserRegistry` 的 `host.browser.*` RPC，不直接 import Playwright。工具箱 UI 中的人类导航不会写入 Session 事件。
