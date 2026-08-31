# 内嵌浏览器为独立 Client 插件与 Agent 工具包，工具箱扩为五段 Tab

V4 内嵌浏览器与文件编辑器、Git 面板、人类终端职责分离；Agent 工具与人类 UI 须共用 Host `BrowserRegistry`（ADR-0007）。我们决定新建 `@deepseek-ai/dsh-client-ui-browser`，经槽位 `conversation.details.browser` 注入工具箱 **浏览器** 段；段内渲染 Tab 栏、导航顶栏与「显示窗口」说明，经 `host.browser.*` RPC 遥控同一有头 Chromium；人类在该窗口内直接操作。新建 `@deepseek-ai/dsh-tool-browser` 注册细粒度 Agent 工具（`browser_navigate`、`browser_snapshot`、`browser_click`、`browser_type`、`browser_scroll`、`browser_select_option`、`browser_tabs`），工具实现调用同一 Host Registry，**不**在 Agent 进程内另起 Playwright。`ui-conversation` 将工具箱 segmented Tab 扩为「资源管理器 | Git面板 | 终端 | 浏览器 | 工具详情」并声明浏览器槽位。Tab 与 Zoom 比例按 **workspaceId** 保存在 Client store（非 Session id）。Zoom 菜单仍持久化，不缩放有头窗口（窗口内使用 Chromium 自身缩放）。视觉复用 `docs/design/DESIGN.md`，V4 不扩 §5 原语（与人类终端同策略）。

**Considered Options**

- 做进 `ui-conversation`：浏览器生命周期与壳层耦合，违反 client domain graph（ADR-0006 先例）。
- 合并为单个 `browser` Agent 大工具：参数复杂，模型易错；Cursor 对标为细粒度工具集。
- mockup-driven 并重写 DESIGN.md：浏览器 chrome 与终端 Tab 栏、导航栏同构，spec-driven + Token 引用即可。
- Host viewport 随人类 Zoom 变化：Agent snapshot 语义混乱；Zoom 限定为 Client 视觉层。

**Consequences**

- ADR-0002「人类工具进工具箱、不新开第四栏」仍然成立；Tab 从四段变为五段，浏览器与资源管理器、Git面板、终端平级。
- `ui-browser` 不得 import `ui-terminal` / `ui-file-editor` / `ui-git` 内部符号；Host 调用经 `WorkspaceRuntime` 与 connection bundle schema。
- `packages/bundle/web-app` 须注册 `ui-browser` 与 `tool-browser`；connection bundle 须扩展 `host.browser.*` schema。
- 切走 **浏览器** 段只隐藏工具箱视图、不销毁 Host Context 与有头窗口；硬刷新后 `list` + `showWindow` + 恢复 Tab store。
- Agent 工具 render intent：`browser_snapshot` 为 `terminal`（可 spill）；其余 `browser_*` 为 `generic` 一行摘要。
- `web_search` / `web_fetch` 保留不变，与内嵌浏览器无关。
