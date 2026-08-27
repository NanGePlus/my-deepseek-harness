# @deepseek-ai/dsh-client-ui-git

[English](README.md) | 中文

Web 工具箱 **Git** Tab 的 Git 面板：注入 `conversation.details.git` 的 occupant。面板跟随 `sessionIds` 包含当前 Session 的 Workspace，从该绑定目录向上发现 Git 仓库根，并列出只认磁盘的未暂存与已暂存工作区变更（含未跟踪目录内的文件）。不 import `ui-file-editor` 的内部符号。

左栏是两个同级可折叠组。**CHANGES** 里是当前分支（或 Git 对游离 HEAD 的说明）、未推送行与 **推送**（没有未推送时该行不出现）、提交说明与 **提交**，以及 **已更改，暂未选入提交** / **待提交** 列表；整块 body 相对文件夹标题缩进 14px。**GRAPH** 在 Changes 打开时钉在操作列底部，列表同样缩进 14px，提交历史每页 50 条，Graph 自己的列表滚到底部继续加载直至全部。Graph 左侧是第一父提交主干；额外父提交占用彩色侧道，合入时从子节点画到父节点的回弯弧；每一行说明紧挨该行最右侧的点或线。同一侧道被后续 merge 复用时换色；merge commit 用空心圆点；远程引用保留 `origin/` 前缀并画成橙色胶囊。胶囊高 14px、宽上限 80–88px，标签省略；悬停用固定定位打开 GitLens 风格详情卡（完整引用、作者、相对/绝对时间、说明、正文、短 hash）。内侧变更列表按内容高度排列，Changes body 自己滚动，因此未暂存行多时「待提交」被顶到后面，不会盖住 Graph。未暂存行提供整文件暂存与丢弃（丢弃须先确认）；已暂存行只提供取消暂存。提交要求非空说明与非空暂存列表；下拉可选 **提交并推送**（Host 在提交后执行 `git push`，无 upstream 时自动 `-u origin HEAD`）。草稿按 Session 存在槽位 store，切走 Git Tab 或切换 Session 都还在；提交成功后清空该 Session 草稿并显示 inline 成功提示。单击行在右栏加载只认磁盘的差异预览，不打开编辑器标签页。已跟踪文本可按差异块暂存、取消暂存或丢弃（丢弃须确认）；未跟踪文本、二进制与删除预览仅整文件操作。dirty 编辑器标签页会拦住丢弃、暂存（整文件、按块或 **全部暂存**）以及包含该路径的提交；取消暂存不受限。守卫对话框提示先显式保存、丢弃该编辑缓冲或关闭该标签页，不会自动保存。

`apply` 从 `ctx.workspaces` 注入 `gitWorkingTree`、`gitInit`、`gitDiffPreview`、`gitStage`、`gitUnstage`、`gitDiscard`、`gitCommit`、`gitPush` 与 `gitLog` 闭包。产品态 `git-unavailable` 与 `not-a-repository` 走成功判别值，渲染互斥 overlay；仅 `not-a-repository` 提供 **初始化仓库**。干净仓库保留提交说明输入，两段变更列表为空。切走 Git Tab 时 occupant 保持挂载；在 Tab 变为可见、绑定 Workspace 变化、以及初始化成功后按磁盘重读。写 RPC 返回刷新后的列表，并在选中路径仍在时重读预览。停在 Git Tab 期间不轮询。被忽略路径不会出现，因为 Host 本来就不返回它们。

## 模型体验

无。Git 面板是浏览器 chrome；工作区变更列表、分支名与提交说明草稿从不进入 session 日志。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- **无独立 pull/fetch/分支控件** — 面板不 pull、fetch、amend 或切换分支；可选 **提交并推送** 在提交后 push 当前分支；本地有未推送提交时在分支名下一行显示 **推送**（`host.gitPush`）。
- **Graph 悬停卡没有 GitHub 链接** — 卡片展示 `host.gitLog` 里的作者、时间、说明与短 hash，不解析远程 HTML URL。
