# browser/ — embedded browser tools

English | [中文](README.zh.md)

Agent-facing browser automation tools for the embedded browser V4 Host Playwright registry.

| Package | Role | ctx key |
|---|---|---|
| [`tool-browser/`](tool-browser/README.md) | Exposes `browser_*` tools to the model | registers on `ctx.tools` |

Tools call `host.browser.*` RPC on the Workspace-scoped `BrowserRegistry`; they never import Playwright. Human navigation in the toolbox UI does not write session events.
