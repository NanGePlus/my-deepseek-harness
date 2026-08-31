# 文件编辑器、Git 面板、人类终端与内嵌浏览器

DeepSeek Harness Web 端面向人类的工具箱插件。V1 在绑定 Workspace 内提供文件树浏览与内容编辑；V2 在同一绑定 Workspace 上增加 Git 面板，与文件树的只读 Git 状态标记职责分离；V3 在工具箱增加人类终端，与 Agent 侧 PTY 工具完全分离；V4 在工具箱增加内嵌浏览器，与 Agent 浏览器工具共用同一浏览器实例。

## 领域语言

**文件编辑器 (File Editor)**：
面向人类开发者的 Web UI 插件；绑定当前 dsh Workspace 所代表的目录，提供文件树浏览与文本内容编辑，不面向 Agent 工具面。不可打开绑定 Workspace 之外的路径，即使该路径出现在 Git 面板。
*避免使用*: 多文件编辑器（作为正式术语）、IDE、代码编辑器

**绑定 Workspace (Bound Workspace)**：
文件编辑器与 Git 面板共同挂载的 dsh Workspace 实体。其 canonical 目录路径决定可浏览与可编辑文件的根范围；Git 面板的仓库根从该目录向上发现，可高于此路径。绑定规则：跟随当前选中 Session 所属 Workspace；切换 Session 即切换绑定 Workspace、文件树根目录与 Git 面板所发现的仓库根。
*避免使用*: 工作区（单独使用时易与 Session 语境混淆）、项目 (Project)

**文件树 (File Tree)**：
绑定 Workspace 根目录下的完整递归目录结构；V1 不做默认过滤，隐藏文件（`.` 开头）、`node_modules`、`.git` 等均可见。可见集合与 Git 面板变更列表不必相同。
*避免使用*: 项目树 (Project Tree)、目录浏览器 (Directory Browser)

**编辑缓冲 (Edit Buffer)**：
用户在文件编辑器中修改但尚未显式保存的内存副本；保存前磁盘内容不变，该文件标记为 dirty（未保存）。
*避免使用*: 草稿 (Draft)、缓存 (Cache)

**显式保存 (Explicit Save)**：
用户通过快捷键或保存操作将编辑缓冲写入磁盘；文件编辑器唯一落盘路径，无自动保存。保存成功后，Git 状态标记与 Git 面板按磁盘工作区同步刷新。
*避免使用*: 提交 (Commit)、同步 (Sync)

**文件类型图标 (File Type Icon)**：
文件树中每个条目旁显示与其扩展名/类型对应的图标，用于快速识别文件种类；V1 指 VS Code/Cursor 风格的类型图标，非图片内容的缩略图预览。
*避免使用*: 缩略图 (Thumbnail)（在本语境中指图片预览时）

**语法高亮 (Syntax Highlighting)**：
可编辑文本文件按语言或扩展名自动应用语法高亮；V1 覆盖常见源代码与配置文件格式。
*避免使用*: 代码着色 (Code Coloring)

### 文件打开策略

**可编辑文本 (Editable Text)**：
UTF-8 或可检测编码的文本文件；打开后进入编辑缓冲，支持语法高亮与显式保存。
*避免使用*: 源码文件 (Source File)

**只读预览 (Read-only Preview)**：
V1 仅覆盖常见图片格式（如 `.png`、`.jpg`、`.gif`、`.webp`、`.svg`）；打开后在编辑区展示内容，不可修改、不可保存。
*避免使用*: 预览模式 (Preview Mode)

**不可打开 (Non-openable)**：
除可编辑文本与只读预览以外的二进制文件；树中可见且有类型图标，点击后提示不支持，不加载内容。
*避免使用*: 二进制黑名单 (Binary Blocklist)

**编辑器标签页 (Editor Tab)**：
一个已打开文件的编辑会话；V1 支持同时打开多个 Tab 并在其间自由切换。可编辑文本 Tab 在未显式保存前标记 dirty；只读预览 Tab 无 dirty 状态。差异预览不是编辑器标签页。
*避免使用*: 窗口 (Window)、面板 (Panel)

**文件操作 (File Operation)**：
对绑定 Workspace 内路径的结构变更；V1 支持新建文件、新建文件夹、重命名、删除。删除须经确认对话框；V1 不含拖拽移动、回收站或右键菜单以外的进阶交互。
*避免使用*: 文件管理 (File Management)、资源管理器操作 (Explorer Action)

**外部变更 (External Change)**：
编辑缓冲打开期间，磁盘上同一文件被 Agent 工具或其他进程修改。V1 检测到后向用户提示，由用户选择重新加载（丢弃本地编辑缓冲）或保留本地编辑缓冲。
*避免使用*: 冲突 (Conflict)（作术语时易泛化；本语境专指缓冲与磁盘不一致）

**Session 切换守卫 (Session Switch Guard)**：
用户切换当前 Session 时，若存在 dirty 的编辑器标签页，须先逐文件保存、丢弃或取消切换；不允许静默丢失未保存编辑缓冲。不因非空提交说明草稿而阻断切换。**不因运行中的人类终端 PTY 而阻断切换**；**不因打开中的浏览器 Tab 而阻断切换**；切换至绑定 Workspace 不同的 Session 时，原 Workspace 的 PTY 与浏览器页面可仍在 Host 后台运行。
*避免使用*: 未保存提示 (Unsaved Prompt)

**Git 状态标记 (Git Status Badge)**：
文件树条目旁只读展示 Git 工作区状态（如 modified、untracked、deleted）。V2 仍只做速览，不在文件树上提供暂存、提交等 Git 操作；操作收敛到 Git 面板，状态变化后两边同步刷新。
*避免使用*: 源代码管理 (Source Control)、版本控制面板 (Version Control Panel)、Git 面板（指徽章本身时）

**Git 面板 (Git Panel)**：
工具箱中与资源管理器、工具详情平级的一段。与文件编辑器挂载同一绑定 Workspace，但变更列表跟随 **Git 仓库根**（可高于绑定 Workspace）。V2 只含工作区变更的查看与操作，以及差异预览；列表与预览只认磁盘，不含未显式保存的编辑缓冲。变更列表分 **更改** 与 **暂存的更改** 两段。向上找不到 Git 仓库根且 Git 可用时，面板仍可打开并提供初始化仓库；Git 不可用时说明原因且不提供初始化。不提供发布到 GitHub。不含提交历史图，不含对 diff 做自动找问题（Agent Review），不含合并编辑器与 abort/continue。不替代文件树的 Git 状态标记。切走 Git Tab 只隐藏视图，不取消暂存。只读展示当前分支，不提供切换或创建分支。不发明 Git 版外部变更对话框；在切到 Git Tab、Git 面板自身操作完成、显式保存成功、切换 Session 完成后按磁盘重读。停在 Git Tab 期间不保证被 Agent 或终端改写后立刻刷新。
*避免使用*: 源代码管理 (Source Control)、版本控制面板 (Version Control Panel)、SCM、独立 Git 侧栏

**工作区变更 (Working-tree Change)**：
已落盘的 Git 工作区或暂存区相对 HEAD 的一份文件级差异；路径相对于 Git 仓库根，可落在绑定 Workspace 之外。含未完成合并留下的冲突文件。不含被 Git 忽略的路径。更改与暂存的更改列表中一行仍是一个路径。同一路径可因部分差异块已暂存而同时出现在两段。不是编辑缓冲的 dirty，也不是外部变更。
*避免使用*: 未保存、外部变更、冲突（作此条目的代称时）

**更改 (Unstaged Changes)**：
已落盘但尚未进入暂存区的工作区变更集合（含仅部分差异块未暂存的路径）。
*避免使用*: Changes（作中文界面代称）、未保存

**暂存的更改 (Staged Changes)**：
已进入 Git 暂存区、等待提交的工作区变更集合（含仅部分差异块已暂存的路径）。
*避免使用*: Index（对用户）、暂存区（作列表段标题时）

**差异块 (Hunk)**：
一份已跟踪文本工作区变更里连续的一组行级差异；差异预览中的可操作单位。未跟踪、二进制、删除不适用按块操作。
*避免使用*: 片段、chunk、部分提交（作此单位的代称时）

**暂存 (Stage)**：
将更改收入暂存区；不改变「已落盘」这一事实。可整文件暂存，也可在差异预览中按差异块暂存。目标路径存在 dirty 编辑器标签页时不可暂存。
*避免使用*: 添加 (Add)（对用户）、加入提交

**取消暂存 (Unstage)**：
将暂存的更改退回更改列表；不改磁盘工作区内容。可整文件或按差异块取消暂存。暂存的更改（含已暂存差异块）只提供取消暂存，不提供丢弃。取消暂存不受 Git 操作守卫限制。
*避免使用*: 重置 (Reset)（对用户；易与丢弃工作区内容混淆）

**丢弃工作区变更 (Discard Working-tree Change)**：
仅作用于未暂存内容、且须确认的磁盘操作。可整文件丢弃；已跟踪文本还可按未暂存差异块丢弃。已跟踪修改：将对应磁盘内容恢复为暂存区（无暂存则为 HEAD）。已跟踪删除的整文件丢弃：把文件恢复到磁盘。未跟踪整文件丢弃：从磁盘删除该路径。目标路径存在 dirty 编辑器标签页时不可丢弃。不是取消暂存，也不是文件编辑器的删除。
*避免使用*: 还原 (Revert)（易与回退某次提交混淆）、重置 (Reset)

**提交 (Commit)**：
将当前暂存区做成一次新的 Git 提交。须有非空提交说明；暂存区为空时不可提交。暂存区中任一路径存在 dirty 编辑器标签页时不可提交。作者只取 Git 配置（仓库或全局的 user.name / user.email），面板不提供填写身份，也不用 Session 或系统用户顶替。失败时向用户展示 Git 的失败原因。不做 amend，不在提交时推送远程。不是显式保存。
*避免使用*: 保存、同步、推送 (Push)、Amend

**提交说明 (Commit Message)**：
用户为一次提交填写的说明文本；空则不可提交。未提交的说明草稿按 Session 保存，不是编辑缓冲；切走 Git Tab 或切换 Session 都不清空该草稿，也不走 Session 切换守卫。提交成功后清空该 Session 的草稿。V2 不做说明模板编辑器。
*避免使用*: 提交信息、changelog

**合并冲突 (Merge Conflict)**：
未完成的 merge / rebase / cherry-pick 留在工作区的冲突文件。V2 把它当作工作区变更：可看差异预览、可按既有规则暂存或丢弃；用户在文件编辑器中编辑并显式保存后再暂存（路径须在绑定 Workspace 内）。不做合并编辑器，不提供 abort / continue。
*避免使用*: 冲突（单独使用；易与外部变更混淆）、三方合并

**Git 仓库根 (Repository Root)**：
从绑定 Workspace 根向上发现的 Git 仓库顶层目录；可高于绑定 Workspace 根。文件树徽章与 Git 面板共用此发现结果。
*避免使用*: 绑定 Workspace（当两者不是同一目录时）、项目根 (Project Root)

**当前分支 (Current Branch)**：
Git 面板只读展示的当前 HEAD 分支名；无分支时按 Git 对空前 HEAD 的说明展示。V2 不可 checkout、创建或合并分支。提交打在当前 HEAD 上。
*避免使用*: 分支切换、检出 (Checkout)

**初始化仓库 (Initialize Repository)**：
仅当 Git 可用、且从绑定 Workspace 根向上找不到 Git 仓库根时，在绑定 Workspace 根目录创建 Git 仓库。V2 不发布到 GitHub，也不绑定其它远程。
*避免使用*: 发布 (Publish)、克隆 (Clone)

**Git 不可用 (Git Unavailable)**：
找不到可用的 git 可执行文件。Git 面板展示此状态，不提供初始化仓库；不把磁盘上已有的 `.git` 当成「不是 Git 仓库」。
*避免使用*: 不是 Git 仓库（当实际是缺 git 时）

**Git 操作守卫 (Git Action Guard)**：
某路径存在 dirty 编辑器标签页时，禁止对该路径丢弃工作区变更（整文件或按块）、整文件或按块暂存，以及包含该路径的提交。须先显式保存、丢弃该编辑缓冲或关闭该 Tab。不自动保存。
*避免使用*: 未保存提示、外部变更（此守卫不是磁盘被他人改写）

**差异预览 (Diff Preview)**：
Git 面板内、选中一条工作区变更后展示的差异；不是编辑器标签页，也不自动打开文件编辑器。已跟踪文本：行级差异，可按差异块暂存、取消暂存；未暂存差异块可按块丢弃。未跟踪文本：整文件视为新增，仅整文件操作。二进制：提示有差异，仅整文件操作。删除：若旧内容可当文本则展示删除内容，仅整文件操作。可选中 Git 仓库根内、绑定 Workspace 之外的路径（仅预览与 Git 操作，不打开文件编辑器）。不是文件编辑器里图片的只读预览。
*避免使用*: 只读预览（指 Git diff 时）、对比视图 (Compare View)

**文件名过滤 (Filename Filter)**： 文件树顶部的搜索框；按文件名实时收窄可见树节点。V1 仅过滤文件名，不含按文件内容搜索。*避免使用*: 全局搜索 (Global Search)、Quick Openha h

**人类终端 (Human Terminal)**：
工具箱「终端」段内、面向人类开发者的交互式 Shell 视图；与 Agent 侧 `terminal_*` 工具 PTY **完全分离**——独立会话池、独立 Host 通路，不共享 session id，默认不进 Session 日志与 Agent 工具面。启用前提与资源管理器相同：须有 Session 且已 **绑定 Workspace**；未满足时 **终端** 段可见但仅展示说明空态，不可 spawn。终端 Tab 与 PTY 进程按 **绑定 Workspace** 归属：同一绑定 Workspace 下的多个 dsh Session 共用一套终端 Tab；切换到绑定 Workspace 不同的 Session 时，切换到该 Workspace 的终端状态（进程可仍在后台运行）。新建终端 Tab 的初始 cwd 为绑定 Workspace 根目录；之后用户可在 Host 可访问范围内自由 `cd`（V3 不做人工 chroot）。切走 **终端** 段（至资源管理器 / Git / 工具详情）只隐藏视图，不终止 PTY；切回时恢复 Tab 集合、滚动位置与实时输出。某 Workspace 尚无终端 Tab（或已全部 Kill）时，**首次进入终端段**自动 spawn 一个默认 Shell Tab（默认 Shell 为 Host login shell；`+` 下拉可显式选 bash / zsh 等 Host 可用 profile）。V3 支持多 Tab、`+` 下拉选择 Shell（如 bash / zsh）、Tab 级 Kill；**不含** Split、Debug Terminal 与底部面板类能力（Problems / Output 等）。终端内改盘后：**离开终端段**或**进入资源管理器 / Git 段**时按磁盘重读 Git 徽章与 Git 列表；已打开文件的编辑缓冲走**外部变更**；停在终端段期间不保证资源管理器 / Git 实时刷新。
*避免使用*: PTY（单独指 Agent 终端时）、Agent 终端、集成终端（作与 Agent PTY 混称时）、Session 终端（本语境指按 dsh Session 隔离时）

**终端 Tab (Terminal Tab)**：
人类终端段内的一个 Shell 会话视图，对应一个 Host PTY。Tab 栏可并存多个；用户通过 Kill 显式终止。Tab 标题：能检测到前台进程时显示其短名（如 `node`）；否则显示 spawn 用的 Shell 名（如 `bash` / `zsh`）。不是编辑器标签页，也不是 Git 差异预览。
*避免使用*: 终端窗口 (Terminal Window)、Shell 面板（作 Tab 代称时）

**终端不可用 (Terminal Unavailable)**：
Host 无法 spawn 交互式 PTY（如无可用 Shell、PTY 创建失败、权限不足）。**终端** 段仍可见；内容区展示 Host 返回的原因与可选「重试」；不隐藏 Tab、不降级为非交互输出。
*避免使用*: Shell 不可用（作与缺 Workspace 空态混淆时）

**内嵌浏览器 (Embedded Browser)**：
工具箱「浏览器」段内、面向人类开发者的 Web 浏览视图；与 Agent 浏览器工具 **共用同一浏览器实例**——同一 **绑定 Workspace** 下共享 Tab 集合、导航状态与同源存储（Cookie / localStorage / sessionStorage 等）。人类手动导航与人类侧交互默认不进 Session 日志；Agent 触发的浏览器操作按 model-visible 规则写入 Session 日志。Agent 浏览器工具 V4 覆盖四类操作：**导航**（打开 URL、后退、前进、刷新）、**感知**（当前页结构快照）、**交互**（点击、输入、滚动、选择）、**Tab 管理**（新建 / 切换 / 关闭，与人类 Tab 栏同一套）；V4 不做截图写入 Session、任意 JS 执行或清 Cookie / 缓存 / 历史。Agent 与人类可同时看见并操作同一 Tab，**不加全局锁**，以浏览器原生事件顺序为准。启用前提与资源管理器相同：须有 Session 且已 **绑定 Workspace**；未满足时 **浏览器** 段仍可见，但内容区展示 **「无法使用浏览器」** 说明空态，不渲染 Tab 栏、不自动打开 Tab，地址栏与导航不可用；Agent 浏览器工具同样不可用。与人类终端不同：不是独立会话池，Agent 与人类看见并操作同一组 Tab。V4 支持多 Tab、`+` 新建、`×` 关闭与 Tab 切换；**不含** Split 视图、独立窗口拖拽与书签管理器。始终至少保留 1 个浏览器 Tab：仅剩最后一个时隐藏 `×`、禁用「关闭 / 关闭全部」；关闭后选中相邻 Tab；Tab 右键菜单支持 **关闭 / 关闭其他 / 关闭左侧 / 关闭右侧 / 关闭全部**（受最后一 Tab 规则约束）。Agent 浏览器工具默认操作当前选中 Tab，亦可通过参数指定 Tab。同一绑定 Workspace 下多个 dsh Session 共用一套浏览器 Tab；切换到绑定 Workspace 不同的 Session 时，切换到该 Workspace 的 Tab 集（页面可仍在后台）。某 Workspace 尚无浏览器 Tab 时，**首次进入浏览器段**自动打开一个 Tab，默认 URL 为 **`about:blank`** 且地址栏获焦；不自动猜测 dev server 端口。若该 Workspace 已有 Tab 记录（切回或硬刷新后从 store 恢复），则恢复上次 Tab 集合与 URL，不走首次逻辑。人类操作面是 Host 有头 Chromium 窗口（与 Agent 同一 Playwright Context / profile），不是工具箱内 JPEG。切走 **浏览器** 段只隐藏工具箱视图，不销毁有头窗口与页面；切回时恢复 Tab 集合、选中 Tab，并再次把窗口提到前台。硬刷新 dsh Web 后从 Workspace 级持久 store 恢复 Tab 栏并按 URL 重载各 Tab。**Session 切换守卫** 不因打开中的浏览器 Tab 阻断切换。
*避免使用*: WebView（作正式术语时）、Agent 浏览器（单独指 Agent 工具面时）

**浏览器 Tab (Browser Tab)**：
内嵌浏览器段内的一个 Web 浏览视图，对应一个可导航页面实例。Tab 栏可并存多个；Tab 标题取自页面 `document.title`（过长省略），无标题时回退为 URL 主机名。不是编辑器标签页，也不是终端 Tab 或 Git 差异预览。可导航范围为 **`http://` 与 `https://` 任意可达地址**（含 localhost / 127.0.0.1 与公网）；V4 不支持 `file://` 与自定义协议。首次导航到非 localhost 域名时，段内顶部 inline 提示「正在访问外部站点」，不阻断、不弹模态。段顶栏提供后退、前进、刷新、地址栏；溢出菜单含 Hard Reload、Copy Current URL、Zoom（− / 百分比 / + / 重置）；**在外部浏览器打开**当前 Tab URL。V4 **不含** Take Screenshot、Capture Area Screenshot、Clear Browsing History / Cookies / Cache，以及顶栏跳转 **终端** 的快捷图标。
*避免使用*: 网页窗口 (Web Window)、标签页（单独使用且易与编辑器 Tab 混淆时）

**浏览器不可用 (Browser Unavailable)**：
Host 或运行时无法创建浏览器视图（如 Chromium 未安装、Playwright Context 启动失败、沙箱拒绝、资源不足）。**浏览器** 段仍可见；Tab 栏仍渲染（若 store 中有 Tab 记录）；内容区展示 **「浏览器不可用」** 卡片 + Host 原因 + **重试**；不隐藏段、不降级为纯文本链接。Agent 浏览器工具返回相同不可用原因。
*避免使用*: 浏览器未启用（作与未绑定 Workspace 空态混淆时）

**工具箱 (Toolbox)**：
Web 右侧可收起栏。V4 五段为 **资源管理器 | Git面板 | 终端 | 浏览器 | 工具详情**，同时只显示一段。
*避免使用*: 详情栏、详情面板、侧栏 (Sidebar)

**编辑界面 (Editor Surface)**：
资源管理器一段的界面组成：文件树（含文件名过滤、文件类型图标、Git 状态标记）+ 多 Tab 编辑区（语法高亮、显式保存）。切到 Git面板、终端、浏览器或工具详情即隐藏该视图。不含 Git 操作（Git 操作在 Git 面板）；人类终端在独立的 **终端** 段；内嵌浏览器在独立的 **浏览器** 段。
*避免使用*: IDE 布局 (IDE Layout)、工作区面板 (Workspace Panel)

**文件编辑器抽屉 (File Editor Drawer)**：
工具箱中承载编辑界面的一段，即资源管理器。勿用此词指 Git 面板。
*避免使用*: 侧栏 (Sidebar)、模态框 (Modal)
