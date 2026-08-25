# @deepseek-ai/dsh-client-ui-git

[English](README.md) | 中文

Web 工具箱 **Git** Tab 的 Git 面板：注入 `conversation.details.git` 的 occupant。面板跟随 `sessionIds` 包含当前 Session 的 Workspace，从该绑定目录向上发现 Git 仓库根，并列出只认磁盘的未暂存与已暂存工作区变更。不 import `ui-file-editor` 的内部符号。

左栏展示当前分支（或 Git 对空前 HEAD 的说明）、带禁用 **提交** 按钮的提交说明占位，以及 **更改** / **暂存的更改** 列表。右栏在后续切片填入差异预览前显示「选择一个文件以查看差异」。整文件暂存、丢弃、提交、按块操作与 Git 操作守卫不属于当前 occupant：本切片只做绑定、列表、刷新与初始化。

`apply` 从 `ctx.workspaces` 注入 `gitWorkingTree` 与 `gitInit` 闭包。产品态 `git-unavailable` 与 `not-a-repository` 走成功判别值，渲染互斥 overlay；仅 `not-a-repository` 提供 **初始化仓库**。干净仓库保留提交说明占位并显示「没有要提交的更改」。切走 Git Tab 时 occupant 保持挂载；在 Tab 变为可见、绑定 Workspace 变化、以及初始化成功后按磁盘重读。停在 Git Tab 期间不轮询。被忽略路径不会出现，因为 Host 本来就不返回它们。

## 模型体验

无。Git 面板是浏览器 chrome；工作区变更列表、分支名与提交说明草稿从不进入 session 日志。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- **无暂存、丢弃或提交** — 当前 occupant 列出磁盘变更并可初始化仓库；暂存与提交的写 RPC 由后续 git-panel 切片落地。
- **无差异预览** — 单击行尚不加载 `gitDiffPreview`；右栏停在未选中空态文案。
