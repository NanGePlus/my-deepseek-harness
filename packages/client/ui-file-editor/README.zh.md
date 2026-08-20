# @deepseek-ai/dsh-client-ui-file-editor

[English](README.md) | 中文

Web details 栏 **文件编辑器** Tab 的编辑界面：注入 `conversation.details.editor` 的 `editor-surface` occupant。左栏是 Workspace 文件树（懒加载列表、文件名过滤、类型图标、只读 Git 徽章）；右栏在后续 issue 打开缓冲区之前保持未打开文件空态。

文件树绑定到 `sessionIds` 包含当前 Session 的 Workspace。已加载层展示 Host 返回的全部行，包括隐藏名、`.git` 与 `node_modules`。仅在展开文件夹时调用 `listWorkspaceEntries`；已缓存层会复用。文件名过滤对已加载名称做大小写不敏感匹配，并保留匹配项的祖先文件夹；不会因过滤而递归拉取。单击行即选中；双击文件夹即展开；单击文件不会打开内容。

`apply` 从 `ctx.workspaces` 注入 `listWorkspaceEntries` 与 `gitStatus` 闭包，而不是整个 WorkspaceRuntime。Host 列表或 Git 失败时保留上次缓存的树并省略徽章，不在栏内抛出错误。工具栏「新建文件／新建文件夹」与空目录 CTA 保持 disabled，直至后续文件操作 issue。

## 模型体验

无。编辑界面是浏览器 chrome；列表与 Git 徽章从不进入 session 日志。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- **无文件缓冲区** — 选中文件不会打开内容；Monaco 与 Host 读／写由后续 issue 完成。
- **创建操作保持 disabled** — 文件树工具栏的新建文件／新建文件夹与空目录 CTA 等待文件操作 issue。
- **栏内无列表错误态** — `listWorkspaceEntries` 被拒绝时保留上次缓存行；本切片没有重试 chrome。
