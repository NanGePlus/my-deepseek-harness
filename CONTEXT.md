# 多文件编辑器

DeepSeek Harness Web 端的人类面向文件编辑插件（V1）。在当前 dsh Workspace 目录内提供文件树浏览与内容编辑。

## 领域语言

**文件编辑器 (File Editor)**：
面向人类开发者的 Web UI 插件；绑定当前 dsh Workspace 所代表的目录，提供文件树浏览与文本内容编辑，不面向 Agent 工具面。
_避免使用_: 多文件编辑器（作为正式术语）、IDE、代码编辑器

**绑定 Workspace (Bound Workspace)**：
文件编辑器所挂载的 dsh Workspace 实体；其 canonical 目录路径决定可浏览与可编辑文件的根范围。V1 绑定规则：跟随当前选中 Session 所属 Workspace；切换 Session 即切换绑定 Workspace 与文件树根目录。
_避免使用_: 工作区（单独使用时易与 Session 语境混淆）、项目 (Project)

**文件树 (File Tree)**：
绑定 Workspace 根目录下的完整递归目录结构；V1 不做默认过滤，隐藏文件（`.` 开头）、`node_modules`、`.git` 等均可见。
_避免使用_: 项目树 (Project Tree)、目录浏览器 (Directory Browser)

**编辑缓冲 (Edit Buffer)**：
用户在文件编辑器中修改但尚未显式保存的内存副本；保存前磁盘内容不变，该文件标记为 dirty（未保存）。
_避免使用_: 草稿 (Draft)、缓存 (Cache)

**显式保存 (Explicit Save)**：
用户通过快捷键或保存操作将编辑缓冲写入磁盘；V1 唯一落盘路径，无自动保存。
_避免使用_: 提交 (Commit)、同步 (Sync)

**文件类型图标 (File Type Icon)**：
文件树中每个条目旁显示与其扩展名/类型对应的图标，用于快速识别文件种类；V1 指 VS Code/Cursor 风格的类型图标，非图片内容的缩略图预览。
_避免使用_: 缩略图 (Thumbnail)（在本语境中指图片预览时）

**语法高亮 (Syntax Highlighting)**：
可编辑文本文件按语言或扩展名自动应用语法高亮；V1 覆盖常见源代码与配置文件格式。
_避免使用_: 代码着色 (Code Coloring)

### 文件打开策略

**可编辑文本 (Editable Text)**：
UTF-8 或可检测编码的文本文件；打开后进入编辑缓冲，支持语法高亮与显式保存。
_避免使用_: 源码文件 (Source File)

**只读预览 (Read-only Preview)**：
V1 仅覆盖常见图片格式（如 `.png`、`.jpg`、`.gif`、`.webp`、`.svg`）；打开后在编辑区展示内容，不可修改、不可保存。
_避免使用_: 预览模式 (Preview Mode)

**不可打开 (Non-openable)**：
除可编辑文本与只读预览以外的二进制文件；树中可见且有类型图标，点击后提示不支持，不加载内容。
_避免使用_: 二进制黑名单 (Binary Blocklist)

**编辑器标签页 (Editor Tab)**：
一个已打开文件的编辑会话；V1 支持同时打开多个 Tab 并在其间自由切换。可编辑文本 Tab 在未显式保存前标记 dirty；只读预览 Tab 无 dirty 状态。
_避免使用_: 窗口 (Window)、面板 (Panel)

**文件操作 (File Operation)**：
对绑定 Workspace 内路径的结构变更；V1 支持新建文件、新建文件夹、重命名、删除。删除须经确认对话框；V1 不含拖拽移动、回收站或右键菜单以外的进阶交互。
_避免使用_: 文件管理 (File Management)、资源管理器操作 (Explorer Action)

**外部变更 (External Change)**：
编辑缓冲打开期间，磁盘上同一文件被 Agent 工具或其他进程修改。V1 检测到后向用户提示，由用户选择重新加载（丢弃本地编辑缓冲）或保留本地编辑缓冲。
_避免使用_: 冲突 (Conflict)（作术语时易泛化；本语境专指缓冲与磁盘不一致）

**Session 切换守卫 (Session Switch Guard)**：
用户切换当前 Session 时，若存在 dirty 的编辑器标签页，须先逐文件保存、丢弃或取消切换；不允许静默丢失未保存编辑缓冲。
_避免使用_: 未保存提示 (Unsaved Prompt)

**Git 状态标记 (Git Status Badge)**：
文件树条目旁只读展示 Git 工作区状态（如 modified、untracked、deleted）；V1 不提供 stage、commit、push 等 Git 操作。
_避免使用_: 源代码管理 (Source Control)、版本控制面板 (Version Control Panel)

**文件名过滤 (Filename Filter)**：
文件树顶部的搜索框；按文件名实时收窄可见树节点。V1 仅过滤文件名，不含按文件内容搜索。
_避免使用_: 全局搜索 (Global Search)、Quick Open

**编辑界面 (Editor Surface)**：
文件编辑器的 V1 界面组成：文件树（含文件名过滤、文件类型图标、Git 状态标记）+ 多 Tab 编辑区（语法高亮、显式保存）。整体置于**右侧抽屉**中，不需要时可收起。不含 Terminal 面板与独立 Git 侧栏。
_避免使用_: IDE 布局 (IDE Layout)、工作区面板 (Workspace Panel)

**文件编辑器抽屉 (File Editor Drawer)**：
承载完整编辑界面的右侧面板；与 Tool 详情共用 details 栏，通过 Tab 在「Tool 详情」与「文件编辑器」间切换。收起/切回 Tool 详情即关闭编辑器视图。
_避免使用_: 侧栏 (Sidebar)、模态框 (Modal)
