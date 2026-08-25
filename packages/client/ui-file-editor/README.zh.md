# @deepseek-ai/dsh-client-ui-file-editor

[English](README.md) | 中文

Web details 栏 **文件编辑器** Tab 的编辑界面：注入 `conversation.details.editor` 的 `editor-surface` occupant。左栏是 Workspace 文件树（懒加载列表、文件名过滤、类型图标、只读 Git 徽章；资源管理器 Tab 从隐藏回到可见时重读 `gitStatus`）。右栏把文件打开为 Session 作用域 Tab：可编辑文本走 Monaco（Monaco 无法启动时回退为 textarea）、常见图片只读预览、或不可打开提示。dirty 文本只经显式 **保存** / ⌘S / Ctrl+S 落盘。

文件树绑定到 `sessionIds` 包含当前 Session 的 Workspace。已加载层展示 Host 返回的全部行，包括隐藏名、`.git` 与 `node_modules`。仅在展开文件夹时调用 `listWorkspaceEntries`；已缓存层会复用。文件名过滤对已加载名称做大小写不敏感匹配，并保留匹配项的祖先文件夹；不会因过滤而递归拉取。单击文件即打开；再次单击已打开路径只聚焦该 Tab，不再次 `readFile`。双击文件夹即展开。

打开模式在单击时按路径判定：图片扩展名（`.png`、`.jpg`、`.jpeg`、`.gif`、`.webp`、`.svg`）调用 `readFile(..., 'bytes')` 并预览；已知二进制扩展名（如 `.wasm`）显示「不支持打开此文件类型」且不得读取；其余调用 `readFile(..., 'text')`，语言 id 由扩展名决定。编辑缓冲与 dirty 活在独占 Client store，不进入 session 日志。

`apply` 从 `ctx.workspaces` 注入 `listWorkspaceEntries`、`gitStatus`、`readFile`、`writeFile`、路径变更与 `watchPath` 闭包，而不是整个 WorkspaceRuntime。Host 列表或 Git 失败时保留上次缓存的树并省略徽章，不在栏内抛出错误。打开与保存失败留在编辑区（「无法打开此文件」／「无法保存此文件」加 **重试**）。每个打开的文本 Tab 注册 `watchPath`；磁盘内容与编辑缓冲不一致时弹出对话框，提供 **重新加载** 或 **保留本地编辑**；关闭 Tab 会 abort 对应 watch。dirty Tab 在切换 Session 或关闭 Tab 前须经 **保存** / **丢弃** / **取消** 守卫；保存失败时守卫保持打开。

## 模型体验

无。编辑界面是浏览器 chrome；列表、Git 徽章、缓冲与 dirty 从不进入 session 日志。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- **栏内无列表错误态** — `listWorkspaceEntries` 被拒绝时保留上次缓存行；树没有重试 chrome。
