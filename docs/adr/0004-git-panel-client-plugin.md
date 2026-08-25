# Git 面板为独立 Client 插件，工具箱 Tab 壳留在会话 UI

V2 Git 面板与文件编辑器职责分离，且 Web Client 约定一个 UI 功能一个插件包。我们决定新建 `@deepseek-ai/dsh-client-ui-git`，经槽位注入工具箱的 Git 段；`ui-conversation` 将工具箱 segmented Tab 扩为「资源管理器 | Git | 工具详情」并声明 Git 槽位。`ui-file-editor` 仍只承载资源管理器与只读 Git 状态标记。不把 Git 工作流做进 `ui-file-editor`，也不在本轮用树外插件承接 Host RPC 与 Tab 壳层改动。

**Considered Options**

- 做进 `ui-file-editor`：少一个包，但文件编辑与 Git 工作流绑死，徽章与可操作 Git 缠在一起。
- 树外独立插件、不改 `packages/`：Host RPC 与工具箱壳层必须改官方包，与 V1 文件编辑器同一限制。

**Consequences**

- ADR 0002 的「编辑界面进 details、不新开第四栏」仍然成立；Tab 从两段变为三段，Git 与资源管理器平级。
- `ui-git` 不得 import `ui-file-editor` 的内部符号。Git 操作守卫所需的 dirty 路径由 `ui-conversation` 提供会话级只读集合：`ui-file-editor` 写入，`ui-git` 只读。不把该集合放进 runtime 对象层（那是人类 UI 状态，不是模型可见数据）。
- `packages/bundle/web-app` 须注册新插件。
