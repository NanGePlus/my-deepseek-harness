# 人类终端为独立 Client 插件，工具箱扩为四段 Tab

V3 人类终端与文件编辑器、Git 面板职责分离，且 Web Client 约定一个 UI 功能一个插件包。我们决定新建 `@deepseek-ai/dsh-client-ui-terminal`，经槽位 `conversation.details.terminal` 注入工具箱的 **终端** 段；段内用 **xterm.js** 渲染 PTY 输出并处理键盘与 resize。`ui-conversation` 将工具箱 segmented Tab 扩为「资源管理器 | Git | 终端 | 工具详情」并声明终端槽位。终端 Tab 状态与 SSE 订阅按 **workspaceId** 保存在 Client store（非 Session id）；同一绑定 Workspace 下多个 dsh Session 共用一套 Tab。`ui-file-editor` 与 `ui-git` 仍各承载其段；不把 xterm 做进 `ui-conversation` 或 `ui-file-editor`。视觉完全复用现有 `docs/design/DESIGN.md`，V3 不扩 §5 原语（与 Git 面板同策略）。

**Considered Options**

- 做进 `ui-conversation`：壳层与 xterm 生命周期、测试与 bundle 边界缠在一起，违反 client domain graph。
- 做进 `ui-file-editor`：终端与编辑界面职责不同，且终端按 Workspace 而非 Session 归属，与编辑器 Session 级 Tab 模型不一致。
- mockup-driven 并重写 DESIGN.md：V3 终端 chrome 与文件 Tab 栏、工具箱 segmented 同构，spec-driven + Token 引用即可。

**Consequences**

- ADR 0002「人类工具进工具箱、不新开第四栏」仍然成立；Tab 从三段变为四段，终端与资源管理器、Git 平级。
- `ui-terminal` 不得 import `ui-file-editor` / `ui-git` 的内部符号；改盘后的刷新通过 `ui-conversation` 既有 `notifyDiskPathsChanged` / `diskPathsChanged` 等壳层回调协调，不把 PTY 状态放进 runtime 对象层。
- `packages/bundle/web-app` 须注册新插件；connection bundle 须扩展 `host.terminal.*` schema。
- 切走 **终端** 段只隐藏 xterm 视图，不 Kill Host PTY；硬刷新后须自动 `list` 并重连。
