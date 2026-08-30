# @deepseek-ai/dsh-tool-browser

[English](README.md)

面向模型的内嵌浏览器工具集：`browser_navigate`、`browser_snapshot`、`browser_click`、`browser_type`、`browser_scroll`、`browser_select_option`、`browser_tabs`，经 Host Playwright Registry（`host.browser.*` RPC）操作。每次调用均 model-visible 写入 Session 日志。工具与工具箱 **浏览器** 段共用 tabId，不直接 import Playwright。

## 工具

| 工具 | 参数 | 行为 |
|---|---|---|
| `browser_navigate` | `url`、可选 `tabId` | 将 Workspace Tab 导航到 http(s) URL。 |
| `browser_snapshot` | 可选 `tabId` | 返回 accessibility 树（`terminal` 结果卡）。 |
| `browser_click` | `x`、`y`、可选 `tabId` | 在 screencast 画布坐标处点击。 |
| `browser_type` | `text`、可选 `tabId` | 向焦点元素输入文本。 |
| `browser_scroll` | `deltaY`、可选 `deltaX`、可选 `tabId` | 按像素增量滚动。 |
| `browser_select_option` | `selector`、`values[]`、可选 `tabId` | 选择 `<select>` 选项。 |
| `browser_tabs` | `action`、可选 `tabId`、可选 `url` | 列出、新建、选中或关闭 Tab。 |

`browser_snapshot` 使用 `terminal` render intent（可折叠 accessibility 树）；其余工具为 `generic` 一行摘要。

## 配置

| 键 | 默认 | 含义 |
|---|---|---|
| `snapshotMaxBytes` | `262144` | 单次 `browser_snapshot` 模型可见结果的 UTF-8 字节上限（spill 策略之前）。 |

## Host 错误

Host RPC 失败以 Host 文案作为工具错误返回 — 含 `browser-unavailable`（Chromium 缺失或 Context 启动失败）与 `browser-tab-not-found`。工具要求 Session 已绑定 Workspace（否则 `workspace-not-found`）。

## Model Experience

经 `@deepseek-ai/dsh-client-ui-tool` 间接呈现：`browser_snapshot` 为 terminal 卡，其余为 generic 卡。

#### Token 效应

每次工具调用向 Session 日志追加一对 tool/result。`browser_snapshot` 大树可能经部署 spill 策略溢出。

#### KV Cache 效应

Session 日志中工具结果为 append-only；除固定 `tool:browser` 指引段外无额外 standing system-prompt 文案。

## Known Limitations and Deferred Work

- **仅坐标点击** — Agent 点击使用 screencast 视口 x/y，非 accessibility ref；模型须从 `browser_snapshot` 文本推断坐标。
- **仅 Web 部署** — 本 Consumer 依赖 Host `apiProxy` 与 Workspace 绑定；headless CLI profile 默认不挂载。
