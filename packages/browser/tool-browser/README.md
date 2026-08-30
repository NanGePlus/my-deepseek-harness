# @deepseek-ai/dsh-tool-browser

English | [中文](README.zh.md)

Model-facing embedded-browser tools — `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_scroll`, `browser_select_option`, and `browser_tabs` — over the Host Playwright registry (`host.browser.*` RPC). Each call is model-visible in the session log. Tools share tab ids with the toolbox **浏览器** segment; they never import Playwright.

## Tools

| Tool | Args | Behavior |
|---|---|---|
| `browser_navigate` | `url`, optional `tabId` | Navigate one Workspace tab to an http(s) URL. |
| `browser_snapshot` | optional `tabId` | Return the accessibility tree (`terminal` result card). |
| `browser_click` | `x`, `y`, optional `tabId` | Click viewport coordinates on the screencast canvas. |
| `browser_type` | `text`, optional `tabId` | Type into the focused element. |
| `browser_scroll` | `deltaY`, optional `deltaX`, optional `tabId` | Scroll by pixel deltas. |
| `browser_select_option` | `selector`, `values[]`, optional `tabId` | Select `<select>` option values. |
| `browser_tabs` | `action`, optional `tabId`, optional `url` | List, open, select, or close tabs. |

`browser_snapshot` uses a `terminal` render intent (collapsible accessibility tree); other tools use `generic` one-line summaries.

## Config

| Key | Default | Meaning |
|---|---|---|
| `snapshotMaxBytes` | `262144` | UTF-8 byte cap on one complete `browser_snapshot` model-facing result before spill policy. |

## Host errors

Host RPC failures surface as tool errors with the Host message text — notably `browser-unavailable` (Chromium missing or context start failed) and `browser-tab-not-found`. Tools require a session bound to a Workspace (`workspace-not-found` otherwise).

## Model Experience

Indirectly, through `@deepseek-ai/dsh-client-ui-tool` terminal cards for `browser_snapshot` and generic cards for the other tools.

#### Token effect

Each tool call appends one tool/result pair to the session log. `browser_snapshot` may spill large trees through the deployment spill policy.

#### KV Cache effect

Append-only tool results in the session log; no standing system-prompt prose beyond the fixed `tool:browser` guidance section.

## Known Limitations and Deferred Work

- **Coordinate clicks only** — Agent clicks use viewport x/y from the screencast, not accessibility refs; the model must derive coordinates from `browser_snapshot` text.
- **Web deployment only** — The tool consumer assumes Host `apiProxy` and Workspace binding; headless CLI profiles do not mount this package by default.
