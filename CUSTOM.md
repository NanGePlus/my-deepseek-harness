# 相对官方的定制说明

## 基线
- 上游仓库：https://github.com/deepseek-ai/deepseek-harness
- 跟做基线分支：master（developer preview，会有破坏性变更）
- **集成分支**：`custom/main`（本 fork 的功能集成线；相对 upstream `master` 约 +48 commits，截至 2026-08-22）
- 运行方式：从源码 `pnpm install` / `pnpm run build:lib:host` + client bundle + `pnpm run build:web` / `pnpm dsh web`
- Node：^22.19 或 >=24；pnpm@11.7.0（Corepack）
- 扩展策略：V1 文件编辑器因需改 Host RPC 与 **工具箱**（details 栏）壳层，**直接改 `packages/`**；长期仍优先树外插件 / 组合包，不改 `vendor/`
- 领域与决策：`CONTEXT.md`、`docs/adr/0001–0002`（文件编辑器）、`docs/adr/0003–0004`（Git 面板）、`docs/adr/0005–0006`（人类终端 V3）、`docs/adr/0007–0008`（内嵌浏览器 V4）、`docs/adr/0009–0010`（桌面壳 V5）、`docs/prd/file-editor-v1.md`、`docs/prd/git-panel-v2.md`、`docs/prd/terminal-v3.md`、`docs/prd/browser-v4.md`、`docs/prd/desktop-v5.md`

## 产品
- 产品名：（待填写）
- 默认 profile：`web`
- 模型提供方：DeepSeek / 其它 / 自定义 OpenAI 兼容端点
- **V1 定制重点**：Web **工具箱**（原 details 栏）内嵌 Workspace 文件编辑器（文件树 + Monaco 多 Tab），与 Agent 对话并列、不占用中栏
- **V2 定制重点（进行中）**：工具箱增加 **Git 面板**（工作区变更 + 差异预览 + Git 操作守卫）；PRD 见 `docs/prd/git-panel-v2.md` 与 Issue [#51](https://github.com/NanGePlus/my-deepseek-harness/issues/51)。Host Git 只读 RPC 见 Issue [#53](https://github.com/NanGePlus/my-deepseek-harness/issues/53)；写 RPC（暂存 / 取消暂存 / 丢弃 / 提交）见 Issue [#54](https://github.com/NanGePlus/my-deepseek-harness/issues/54)；工具箱三段 Tab 见 Issue [#55](https://github.com/NanGePlus/my-deepseek-harness/issues/55)；Git 面板绑定/列表/空态/初始化见 Issue [#56](https://github.com/NanGePlus/my-deepseek-harness/issues/56)；整文件暂存/丢弃/提交见 Issue [#57](https://github.com/NanGePlus/my-deepseek-harness/issues/57)；差异预览与按块操作见 Issue [#58](https://github.com/NanGePlus/my-deepseek-harness/issues/58)；Git 操作守卫见 Issue [#59](https://github.com/NanGePlus/my-deepseek-harness/issues/59)
- **V3 定制重点（进行中，分支 `feat/v3`）**：工具箱增加 **人类终端**（多 Tab + Shell 选择 + xterm；与 Agent PTY 分离）；PRD 见 `docs/prd/terminal-v3.md` 与 Issue [#73](https://github.com/NanGePlus/my-deepseek-harness/issues/73)。`#D-global` 见 [#74](https://github.com/NanGePlus/my-deepseek-harness/issues/74)；Host `host.terminal.*` RPC 见 [#75](https://github.com/NanGePlus/my-deepseek-harness/issues/75)；工具箱四段 Tab 见 [#76](https://github.com/NanGePlus/my-deepseek-harness/issues/76)；`ui-terminal` 最小通路见 [#77](https://github.com/NanGePlus/my-deepseek-harness/issues/77)；多 Tab / Shell / Kill 见 [#78](https://github.com/NanGePlus/my-deepseek-harness/issues/78)；不可用 / 错误态见 [#79](https://github.com/NanGePlus/my-deepseek-harness/issues/79)；切走持久 / 硬刷新重连见 [#80](https://github.com/NanGePlus/my-deepseek-harness/issues/80)；改盘刷新协调见 [#81](https://github.com/NanGePlus/my-deepseek-harness/issues/81)
- **V4 定制重点（规格已锁定，分支 `feat/v4`）**：工具箱增加 **内嵌浏览器**（多 Tab + 导航顶栏；人类在 Host 有头 Chromium 窗口操作；Agent `browser_*` 工具与人类共用同一 Playwright 实例）；PRD 见 `docs/prd/browser-v4.md`；ADR 见 `docs/adr/0007-embedded-browser-host-playwright.md`、`docs/adr/0008-embedded-browser-client-and-tools.md`。工具箱五段 Tab：**资源管理器 | Git面板 | 终端 | 浏览器 | 工具详情**。实现切片：GitHub [#92](https://github.com/NanGePlus/my-deepseek-harness/issues/92)（#93–#100）。
- **V5 定制重点（规格已锁定，分支 `feat/v5`）**：将现有 Web GUI **包装为桌面壳**（Electron），与 **浏览器交付** 并存、功能对等；首版 macOS + Windows。PRD 见 `docs/prd/desktop-v5.md` 与 Issue [#111](https://github.com/NanGePlus/my-deepseek-harness/issues/111)。ADR 见 `docs/adr/0009-desktop-shell-electron-delivery.md`、`docs/adr/0010-desktop-browser-electron-cdp.md`；领域词汇见 `CONTEXT.md`（**桌面壳**、**面板内 WebView** 等）。实现切片：GitHub [#111](https://github.com/NanGePlus/my-deepseek-harness/issues/111)（#113–#122；#112 重复已关闭）。**`desktop` profile**（`dsh --profile desktop --dump-config`）已落地：Host 能力与 web 对等（apiproxy、Playwright、终端/Git/浏览器 client roster），**不含** `dsh-host-webserver` 与 loopback HTTP 传输行。**Issue [#116](https://github.com/NanGePlus/my-deepseek-harness/issues/116)**：`IpcApiClient` 统一 IPC carrier（`callUnary`/`respond` + mux/host/watchPath 下行）；integrated 模式 preload 暴露 `window.dsh` IPC 桥；attach 模式仍用 `WebApiClient`。**Issue [#117](https://github.com/NanGePlus/my-deepseek-harness/issues/117)**：**标准壳**：`requestSingleInstanceLock` 二次启动聚焦主窗口；关窗/Quit **关闭即退出**（attach 模式仅退出 GUI）；dirty 编辑器 **退出守卫** 复用 Session 切换守卫对话框；`desktop.windowBounds.v1` 窗口几何持久化；About / Settings / Quit 应用菜单；Dock/Taskbar 图标。**Issue [#119](https://github.com/NanGePlus/my-deepseek-harness/issues/119)**：桌面 **浏览器** 段 occupant 为 `#browser-occupant` 面板内 WebView 占位，经 preload `reportBrowserOccupantBounds` 驱动 Main BrowserView bounds；无「显示窗口」卡片；切走段 `visible=false` detach 且不关 Host Tab（已合并 PR [#130](https://github.com/NanGePlus/my-deepseek-harness/pull/130)）。
## 已实现定制功能（相对上游 master）

### 工具箱与壳层（details 栏，PR #28–29 及后续）
- 产品文案：**详情栏 / 详情面板** 统一表述为 **工具箱**（`packages/client/ui-conversation` locales；Tab 内「工具详情」仍指 Tool 输出内容）
- 会话头入口：**图标 +「工具箱」** capsule 按钮（与 Session log 同高 32px）；tooltip / `aria-label` 仍为「打开 / 收起工具箱」
- 工具箱 segmented Tab：**资源管理器 | Git面板 | 终端 | 浏览器 | 工具详情**；Tab 条样式与对话区 **对话 / 轨迹** 一致（左对齐、13px、`state-business-primary` 选中下划线）；**浏览器** 段由 `@deepseek-ai/dsh-client-ui-browser` 注入 `conversation.details.browser`：按 **workspaceId** 持久 Tab、选中项与 Client Zoom 至 `dsh.browser.panel.v1`（不进 Session 日志）；硬刷新 dsh Web 后 Tab 栏与 Zoom 从 store 恢复、Host `browserList` 同步并 `browserShowWindow` 唤起本机窗口；首次进入且无 Tab 时自动 `about:blank` 且地址栏获焦；段内 Tab 栏 32px + 底边 2px 选中线 + 20×20 **×**（至少保留 1 Tab）；Tab 右键菜单支持**关闭 / 关闭其他 / 关闭左侧 / 关闭右侧 / 关闭全部**（最后一 Tab 隐藏 ×、禁用「关闭 / 关闭全部」）；导航栏 ← → ↻ + 地址栏（Enter 导航 http(s)；无历史时 ← → disabled）+ **在外部浏览器打开**当前 Tab URL；**…** 溢出菜单含 Hard Reload、Copy Current URL、Zoom（− / 百分比 / + / 重置）；Hard Reload 走 Host `reload({hard})`；Client Zoom 仍按 workspaceId 持久，不改变有头窗口内容缩放；Host `browser-unavailable` 时卡片「浏览器不可用」+ 原因 + **重试**（有 store Tab 时 Tab 栏仍可见）；导航失败导航栏下 `semantic-error` + **重试**、内容区「无法加载此页」且不关 Tab；非 localhost 首次访问 inline info「正在访问外部站点」（无 modal）；Tab 标题取自 `document.title` 或 URL 主机名；内容区说明「在本机浏览器窗口中查看」+ **显示窗口**（`host.browserShowWindow` / `page.bringToFront`）；关掉本机窗口后 Registry 丢掉死 Context，`+` / × / **显示窗口** 会重建并按 store URL 恢复；人类在有头 Chromium 窗口内直接操作（与系统浏览器同一套 caret / IME）；未绑定 Workspace 整页空态「无法使用浏览器」且无 Tab/导航；切走 **浏览器** 段只隐藏工具箱视图、不销毁 Host BrowserContext 与有头窗口；切换绑定 Workspace 不同的 Session 展示该 Workspace Tab 集（Session 切换守卫不因浏览器 Tab 阻断）；Git 段槽位 `conversation.details.git` 供 `ui-git` 注入；**终端** 段槽位 `conversation.details.terminal` 供 `@deepseek-ai/dsh-client-ui-terminal` 注入：按 **workspaceId** 持久 Tab 与选中项（不进 Session 日志）；首次进入且无 Tab 时自动 spawn 默认 Shell；段内 Tab 栏样式与**资源管理器文件 Tab** 对齐（32px、底边 2px 选中线、20×20 **×** 关闭按钮）；Tab 右键菜单支持**关闭 / 关闭其他 / 关闭左侧 / 关闭右侧 / 关闭全部**；关闭时若 Host 标题报告前台命令（非 idle Shell 名）则弹框确认后再 `host.terminalKill`；**`+`** 24×24 ghost 展开 Host Shell 下拉（bash/zsh 等，无 Split/Debug）；spawn 进行中 **`+` 禁用**；关闭后选中相邻 Tab，**最后一个 Tab 不可关闭**（隐藏 ×、禁用「关闭 / 关闭全部」）；Tab 标题仅显示命令或 Shell 名（如 `python py_env.py`、`zsh`；Host 仍轮询 cwd + 命令行，Client 不展示路径前缀）；**xterm 内容区 scroll-reveal 滚动条**（默认隐藏、滚动时显示）；xterm 键盘输入 / resize / Harness light/dark 主题；未绑定 Workspace 时整页空态「无法使用终端」且不可 spawn；Host `terminal-unavailable` 时居中卡片「终端不可用」+ Host 原因 + **重试**（Tab 栏仍可见）；其它 spawn / write / 重连失败在 xterm 区顶 inline `semantic-error` + **重试**，不 Kill 其它 Tab；切走 **终端** 段只隐藏、保持 SSE 订阅、不 Kill Host PTY；硬刷新后 `terminalList` 恢复 Tab 栏并重连 SSE（scrollback 回放再接 live 输出）；切换绑定 Workspace 不同的 Session 时展示该 Workspace 的 Tab 集（Session 切换守卫不因运行中 PTY 阻断）；**终端内改盘**不实时刷新资源管理器 / Git，离开 **终端** 段或进入 **资源管理器 / Git** 段时壳层 `segmentDiskRefreshEpoch` 触发 Git 徽章与 Git 列表重读、已打开 Tab 按磁盘 reload（与 Git Tab 不轮询对称）
- **Git 面板变更列表**：段标题可收起/展开（左侧 chevron）；右侧显示文件数量；段头「全部选入/全部移出」与单行操作不变；未暂存按内容高度撑开，「待提交」跟在其后，在 Changes body 内滚动
- **Git 面板 Graph**：待提交下方可折叠提交历史（主干 + 合入弧、分页 50）；每一行说明紧挨该行最右侧的点或线；引用胶囊 14px、长名省略，有引用时放在说明下一行靠右；悬停固定定位详情卡（完整引用、作者、相对/绝对时间、说明、正文、短 hash）；Changes 打开时钉在操作列底部；**单击某一提交在右栏列出该提交相对第一父提交的文件**（只读文件头默认折叠，展开后才渲染该文件差异；最多 80 个文件）；进入面板或重读 Graph 不自动打开最新提交，右栏只保留用户上次点开的工作区文件或 Graph 提交（切走 Git Tab 因 occupant 仍挂载而恢复；整页刷新从空预览开始）；切回 Git Tab 时 Graph 与右栏保持已展示内容，后台重读不换成 loading
- **Git 面板 Changes / Graph**：操作列两个同级可折叠组；**CHANGES** / **GRAPH** 段头 13px 加粗全大写；**CHANGES** 标题右侧显示未暂存加待提交行数（干净仓库为 0），与 GRAPH 已加载提交数同一套灰色数字；Changes 打开时 Graph 钉在底部（上限约半高）；Changes body（分支、提交区、两段变更列表）与 Graph 列表相对文件夹标题缩进 14px；**CHANGES body 与 GRAPH 列表** scroll-reveal 滚动条（默认隐藏、滚动时显示）
- **Git 面板提交区**：备注输入单行起步、内容增多自动增高（最高约 120px、无内滚动条）；placeholder「请填写提交备注信息」；说明为空时在输入框下方 inline 提示、不发起 Host 提交；主按钮「提交」+ 右侧下拉「提交 / 提交并推送」；**提交、提交并推送、推送、删除远程地址** 点击后在该按钮右下角弹出带描边与阴影的确认框；本地有未推送提交时，分支名下一行显示「有 N 个提交尚未推送」或「尚未推送到远程」及独立 **推送** 按钮（`host.gitPush`，无需新暂存）；没有未推送提交时该行隐藏，从未提交（无 HEAD）时即使刚添加 origin 也不显示；**推送** 按钮 hover 提示区分「尚未推送的提交」与「首次推送」；提交/推送 RPC 进行中时备注框外圈旋转高亮 loading（`--dsw-alias-state-business-primary`）、输入框禁用，按钮仅 disabled 不改文案；Host 返回后在**对应按钮旁**显示成功/失败（提交 / 提交并推送 / 推送 文案区分），无 remote 时显示「没有配置远程仓库地址」而非 Git 的 `fatal: No configured push destination`，并提供 **添加远程地址**（`host.gitAddRemote`，写入 `origin`）；推送因远程已有提交无法快进时显示「远程已有提交，无法快进推送」而非截断的 `To https://…`；没有 remote 时分支名下一行显示该入口、不显示 **推送**；已配置 `origin` 时分支名下一行显示该 URL 与 **删除远程地址**（`host.gitRemoveRemote`）；成功 4s 自动消失；暂存/撤销/丢弃错误显示在变更列表上方；**撤销更改** 图标仍走既有确认弹框；不阻塞暂存/撤销等其它 Git 操作；选入/移出/撤销进行中不把提交、推送按钮置为 disabled（避免闪一下）；左侧操作区默认宽度 260px；`host.gitCommit` 可选 `push: true`（无 upstream 时 Host 自动 `-u origin HEAD`；带 push 的 RPC 不使用 30 秒一元超时）
- 文件编辑器 Tab 注入 `@deepseek-ai/dsh-client-ui-file-editor`（`cordis.patch.yml` 注册）
- 工具箱可拖宽；Tool 行点击可跳转工具详情并保持面板存活（PR #38 前后续修复）

### Host RPC 扩展（`packages/host/apiproxy`，ADR-0001）
| RPC | 作用 |
|-----|------|
| `host.listWorkspaceEntries` | Workspace 内单层目录 listing（上限 1000 条/层，`truncated` 标记） |
| `host.gitStatus` | `git status --porcelain --untracked-files=all` 只读徽章（列出未跟踪目录内的文件；非仓库返回空） |
| `host.gitWorkingTree` | 向上发现仓库根与当前分支；返回未暂存 / 已暂存两段磁盘变更（忽略路径不出现；路径相对仓库根，可在绑定 Workspace 外） |
| `host.gitInit` | 仅当无祖先仓库时在绑定 Workspace 根 `git init` |
| `host.gitDiffPreview` | 只认磁盘的差异预览（`text` 含 hunks + `fileText` 全文件正文；`untracked-text` / `binary` / `deleted-text` / `deleted-binary`） |
| `host.gitStage` | 整文件或按块暂存一条未暂存变更；返回刷新后的工作树 |
| `host.gitUnstage` | 整文件或按块取消暂存；不改写磁盘；无 HEAD 时整文件走 `git rm --cached -f` |
| `host.gitDiscard` | 整文件或按块丢弃未暂存变更（已跟踪还原 / 未跟踪删除）；不碰已暂存 |
| `host.gitCommit` | 用暂存区新建 HEAD 提交；说明可为空（`--allow-empty-message`）；可选 `push: true` 在提交后执行 `git push`；作者只取 Git 配置；不 amend |
| `host.gitPush` | 推送当前分支；无 upstream 时 `-u origin HEAD`；无 remote 时 `git-failed` `no remote configured` |
| `host.gitAddRemote` | 添加 `origin`（`git remote add -- origin <url>`）；空 URL 为 `git-failed` `empty remote url`；返回刷新后的工作树（含 `hasRemote`、`originUrl`） |
| `host.gitRemoveRemote` | 删除 `origin`（`git remote remove origin`）；`origin` 不存在时 `git-failed` 带 Git 原文；返回刷新后的工作树 |
| `host.gitLog` | 分页读取提交历史（每页默认 50 条，`skip` + `hasMore`，`--topo-order`）：hash、父提交、说明、作者、作者时间 `%aI`、正文 `%b`、分支/标签引用；解析时去掉 git `--format` 记录后的换行；远程引用保留 `origin/` 前缀 |
| `host.gitCommitDiff` | 只读：某一提交相对第一父提交（根提交相对空树）的文件差异；复用 `GitDiffPreview`；最多 80 个文件；`truncated` 标记截断 |
| `host.terminalProfiles` | 可用 Shell 列表 + login shell 默认（bash/zsh 或平台等价） |
| `host.terminalSpawn` | 在绑定 Workspace 根 spawn 交互式 PTY（`terminal-unavailable` / `workspace-not-found`） |
| `host.terminalWrite` / `host.terminalResize` / `host.terminalKill` / `host.terminalList` | stdin、resize、Kill、列举 Workspace 级 session |
| `host.terminalStream` | SSE：scrollback 快照（含 `truncated`）、增量输出、Tab `title`；Client 断开不 Kill PTY |
| `host.browserList` / `host.browserCreateTab` / `host.browserCloseTab` / `host.browserSelectTab` / `host.browserShowWindow` | Workspace 级 Playwright Tab 池列举 / 新建 / 关闭 / 选中；`showWindow` 与选中/导航会 `bringToFront` 有头窗口 |
| `host.browserNavigate` / `host.browserGoBack` / `host.browserGoForward` / `host.browserReload` | 导航与历史；响应含 `canGoBack` / `canGoForward`；`reload` 可选 `hard` |
| `host.browserSnapshot` | accessibility 树（`ariaSnapshot`） |
| `host.browserClick` / `host.browserType` / `host.browserScroll` / `host.browserSelectOption` | Agent 页面交互（同一有头 Context） |
| `host.browserResizeViewport` / `host.browserSendPointer` / `host.browserSendKeyboard` | 遗留 viewport / 指针键盘 RPC；人类主路径不再使用 |
| `host.browserWatchScreencast` | 遗留 SSE JPEG；人类主路径不再订阅 |
| `host.readFile` / `host.writeFile` | 文本 UTF-8 读写；图片 `bytes` + base64 预览 |
| `host.deletePath` / `host.renamePath` / `host.movePath` / `host.createWorkspaceDirectory` | 文件树增删改与跨目录移动 |
| `host.watchPath` | 浏览器走 WebSocket、进程内仍 SSE；监听已打开路径的外部磁盘变更；文件目标监视父目录以覆盖 Agent 原子 write |
| LSP（`lspSyncDocument` / `lspHoverDocument` / `lspCloseDocument`） | 编辑器内诊断与 hover（经 `lsp-editor` + `lsp-stdio`） |

### 文件编辑器 Client（`packages/client/ui-file-editor`）
- 绑定当前 Session 的 Workspace；文件树**懒加载** + **虚拟滚动** + 文件名过滤
- Material Icon Theme 文件类型图标；Git 行尾徽章（M/U/D 等）；未跟踪目录内的文件显示 U，祖先文件夹上卷同一徽章
- 打开三档：**可编辑文本**（Monaco / textarea fallback）、**图片只读预览**、**已知二进制不可打开**
- 多 Tab、dirty 标记、**显式保存**（⌘S / Ctrl+S）；Markdown **预览 / 源码**切换（**默认源码**）
- Markdown **预览态可编辑**（TipTap + `@tiptap/markdown` 双向序列化）：段落 + 行内 **B/I/U/S/Code/Link**；选区浮动工具栏；**链接**为同一 BubbleMenu 内切换的胶囊输入框（点「链接」即显）；预览内 **链接可点击**（新标签页打开）；**代码块 / Mermaid 只读**（`readOnlyFencedBlock` atom + `MarkdownText` 渲染）；**中文 IME** 组合输入期间不回写 buffer；**单击仅定位光标**（误选区自动折叠，双击/拖拽选区不受影响）
- Markdown **源码（Monaco）** 与预览同样保护 **IME 组合输入**：聚焦/拼音组合期间不 `setValue` 重载模型；**默认 soft wrap**；Markdown 使用 `wrappingStrategy: simple` + `accessibilitySupport: off` 以保持 CJK IME preedit 紧跟光标（不再组合期间切换 wrap）；**单击仅定位光标**（误选区自动折叠）；**任意可编辑文本文件（含 Markdown 源码与其他语言 Monaco 编辑器）** 选区 **Add to Chat** 插入 composer 可见 pill chip（13/20，与输入框同字重以免长英文宽于光标；光标落在胶囊外空格上，可继续输入；发送时展开行内容进 prompt；**已发送用户气泡**同样投影为 pill、可点击打开编辑器，session log 仍保留展开全文）
- 文件树工具栏：新建文件/文件夹、重命名、删除（确认对话框）；**右键菜单**（文件/文件夹分类型操作）；点击树空白处取消行选中，工具栏新建回到 Workspace 根；拖拽文件或文件夹到另一目录或树空白处移动（空白处即根）
- **Tab 栏批量关闭**（关闭当前 / 其它 / 全部 / 左侧 / 右侧，VS Code 风格）
- **文件夹重命名**时同步更新已打开子文件 Tab 路径；**删除文件夹**时关闭子树 Tab 并清理树缓存
- 同名冲突：文件↔文件、文件夹↔文件夹分别提示；Host 层拦截路径类型冲突
- 外部变更：`watchPath` 检测到 Agent 等外部改盘时**无确认框、自动重新加载**已打开 Tab（含未保存编辑；磁盘内容优先）；Git 面板撤销仍直接 reload
- **文件树自动刷新**：新建/重命名/删除及 Workspace 根目录外部监听后重载 listing；**显式保存仅静默刷新 Git 徽章**，不重载目录 listing
- Session 切换 / 关闭 dirty Tab **守卫**（保存 / 丢弃 / 取消）
- Session 内文件路径链接可在 details 编辑器中打开
- Monaco / 主题跟随 Harness light/dark；编辑画布（含非 Markdown）使用与 Markdown 相同的 `bg-base`
- 多 Tab 横向滚动、树切换时保持可用；**编辑区 scroll-reveal 滚动条**（Monaco / Markdown 预览 / textarea fallback：默认隐藏、滚动时显示，圆角 pill 与会话区一致）
- 未打开文件**空状态**：设计系统图标 + 与文件树一致的轻量排版

### Agent browser 工具（`@deepseek-ai/dsh-tool-browser`，Issue #100）
- 注册 `browser_navigate` / `browser_snapshot` / `browser_click` / `browser_type` / `browser_scroll` / `browser_select_option` / `browser_tabs`；经 `host.browser*` 与人类 UI 共用 Workspace Tab
- 每次 Agent 调用写入 Session 日志；`browser_snapshot` 对话区 **terminal** 卡（可折叠 accessibility 树；`snapshotMaxBytes` 截断 + 部署 spill 策略溢出至工具详情）
- Host `browser-unavailable` / `workspace-not-found` 等错误与 UI 一致的用户可见文案；V4 范围外能力（截图菜单、清 Cookie 等）未注册

### Markdown / 预览增强（PR #37–38，`ui-primitives` 等）
- Mermaid 代码块渲染 + **可缩放 lightbox**
- Markdown / 图片 **ZoomPanLightbox**（与会话消息区共用组件）
- 抑制空白 inline-code 芯片与 Monaco unicode 高亮噪声

### 性能与边界（分支 `fix/file-editor-v1-verify-fix`，已合并入 `custom/main`）
- **`host.readFile` 5 MB 上限**：超出返回 `file-too-large`，编辑器提示「文件过大」
- **大文件 / minified 单行**：Monaco `largeFileOptimizations`、超长行关闭 word wrap、跳过 LSP 全量同步，避免页面卡死
- **目录 listing 优化**：symlink 分类 32 并发；dirent 扫描上限 10 000；Client 每目录 **30 s 超时**、独立 AbortController
- 目录加载失败行尾 **!** 标记（可折叠后再展开重试，含 30 s 超时）；超大目录 **…** 表示 listing 截断

## 我的插件与组合包
| 名称 | 形态 | 作用 | 日期 |
|------|------|------|------|
| `@deepseek-ai/dsh-client-ui-file-editor` | `packages/bundle/web-app/cordis.patch.yml` 行 `ui-file-editor` | 工具箱内文件编辑器 surface | 2026-08 |
| `@deepseek-ai/dsh-client-ui-git` | `packages/bundle/web-app/cordis.patch.yml` 行 `ui-git` | 工具箱 Git 面板：仓库绑定、两段列表、空态、刷新与初始化；整文件暂存 / 取消暂存 / 丢弃（须确认）/ 提交；提交说明草稿按 Session；单击行在面板内差异预览；单击 Graph 提交在右栏只读多文件差异（文件头默认折叠；不自动打开最新提交）；已跟踪文本可按块暂存 / 取消暂存 / 丢弃；Git 操作守卫拦住 dirty 路径的暂存 / 丢弃 / 提交，取消暂存不受限；无 remote 时可添加 `origin` | 2026-08 |
| `@deepseek-ai/dsh-client-ui-terminal` | `packages/bundle/web-app/cordis.patch.yml` 行 `ui-terminal` | 工具箱 **终端** 段：Workspace 级 Tab store、自动 spawn、多 Tab + Shell 下拉 + Kill、xterm 画布、未绑定空态、Host **终端不可用** 卡片 + inline 错误 + 重试、spawn 中禁用 `+`、SSE 连接 loading；切走段保持 SSE（不 Kill PTY）；硬刷新 `list` 恢复 Tab 栏并重连 scrollback→live；按 Workspace 切换 Session 展示对应 Tab 集 | 2026-08 |
| `@deepseek-ai/dsh-client-ui-browser` | `packages/bundle/web-app/cordis.patch.yml` 行 `ui-browser` | 工具箱 **浏览器** 段：Workspace Tab store；导航遥控有头 Chromium 窗口 + 多 Tab + 空态/不可用 | 2026-08 |
| `@deepseek-ai/dsh-tool-browser` | Web agent preset（`standard` / `code` / `cordis`）行 `tool-browser` | Agent `browser_navigate` / `browser_snapshot` / `browser_click` / `browser_type` / `browser_scroll` / `browser_select_option` / `browser_tabs`；经 `host.browser*` 与人类 UI 共用 Tab；`browser_snapshot` 为 terminal 卡 + spill | 2026-08 |

## 我改过的官方文件（尽量为空）
| 文件/目录 | 改了什么 | 日期 |
|-----------|----------|------|
| `packages/bundle/desktop-app/` | **新包**（#114）：`desktop` profile 组合包；`cordis.patch.yml` 挂载与 web 对等的 Host + client roster，**不含** webserver / connection / modules / client-hmr；目录选取改 `-native`（`-auto` 依赖 webServer） | 2026-08-31 |
| `packages/boot/app-boot/src/profile.ts` | **2026-08-31** `PROFILE_TEMPLATES.desktop` | 2026-08-31 |
| `apps/cli/package.json` | **2026-08-31** 声明 `@deepseek-ai/dsh-desktop-app` 依赖；**2026-08-31**（#115）`electron` devDependency + `dsh desktop` 启动器 | 2026-08-31 |
| `apps/cli/src/args.ts` | **2026-08-31**（#115）`dsh desktop` 子命令 | 2026-08-31 |
| `apps/cli/src/bin.ts` | **2026-08-31**（#115）desktop 模式 spawn Electron | 2026-08-31 |
| `apps/cli/src/desktop-launcher.ts` | **新文件**（#115）：解析 Electron 可执行文件与 Main 入口并 spawn | 2026-08-31 |
| `apps/desktop/` | **新包**（#115）：Electron Main Host boot / teardown、`dsh://` SPA 加载、preload 骨架、`DSH_DESKTOP_ATTACH`、Host 启动失败 loud error + 重试；**#116** `registerIpcApiBridge` + preload IPC carrier；**#117** 单实例聚焦、退出守卫 IPC、窗口 bounds 持久化、About/Settings/Quit 菜单、Dock/Taskbar 图标；**#118** `BrowserRegistry` desktop CDP 分叉、`DesktopBrowserViewManager`、occupant bounds IPC（`dsh:browser-occupant-bounds`） | 2026-08-31 |
| `packages/host/apiproxy/src/browser-delivery.ts` | **新文件**（#118）：`DesktopBrowserSurface` + Main 注册 hook | 2026-08-31 |
| `packages/host/apiproxy/src/browser-registry.ts` | **#118**：`browserDelivery` web/desktop 分叉；desktop 走 `connectOverCDP`，跳过 `bringToFront` | 2026-08-31 |
| `packages/host/apiproxy/src/index.ts` | **#118**：`browserDelivery` config + 导出 desktop surface hooks | 2026-08-31 |
| `packages/bundle/desktop-app/cordis.patch.yml` | **#118**：`api-gateway.config.browserDelivery: desktop` | 2026-08-31 |
| `packages/client/connection/src/client/ipc-api-client.ts` | **新文件**（#116）：`IpcApiClient` desktop carrier | 2026-08-31 |
| `packages/client/connection/src/client/ipc-bridge.ts` | **新文件**（#116）：preload 桥类型 + `readDesktopIpcBridge` | 2026-08-31 |
| `packages/client/connection/src/client/index.ts` | **#116**：integrated desktop 选用 `IpcApiClient` | 2026-08-31 |
| `apps/web/vite.config.ts` | **2026-08-31**（#115）`DSH_DESKTOP_DEV=1` 时允许 Vite serve（dev:desktop） | 2026-08-31 |
| `apps/web/vite.desktop-dev.config.ts` | **新文件**（#115）：dev:desktop 注入 boot graph | 2026-08-31 |
| `packages/client/web/src/boot.tsx` | **2026-08-31**（#115）`__DSH_HOST_BOOT__` 失败路径 + preload 重试 | 2026-08-31 |
| `packages/client/web/src/AppRoot.tsx` | **2026-08-31**（#115）Host 启动失败变体 UI | 2026-08-31 |
| `packages/client/modules/src/client/manifest.ts` | **2026-08-31**（#115）`__DSH_HOST_BOOT__` wire 类型 | 2026-08-31 |
| `pnpm-workspace.yaml` | **2026-08-31**（#115）`allowBuilds.electron` | 2026-08-31 |
| `scripts/dev-desktop.ts` | **新文件**（#115）：并行 Vite + Electron | 2026-08-31 |
| `package.json` | **2026-08-31**（#115）`dev:desktop` script | 2026-08-31 |
| `packages/host/apiproxy/` | **2026-08-26** `watchPath` 文件目标监视父目录；Git / 终端 / 浏览器 Host RPC（V2–V4）；**2026-08-31** 有头浏览器人类操作面与关窗恢复 | 2026-08 |
| `packages/client/ui-file-editor/` | **新包**：文件树 + Monaco 编辑器 surface；**2026-08-23** Markdown 预览 WYSIWYG（TipTap）；**2026-08-23** 全语言 Monaco 选区 Add to Chat；**2026-08-23** 保存/外部变更后文件树自动刷新；**2026-08-25** 资源管理器 `visible` 切回后重读 Git 徽章；**2026-08-25** 经 `setDirtyPaths` 发布 dirty Tab 路径供 Git 操作守卫；**2026-08-26** 编辑区 scroll-reveal 滚动条对齐会话区；**2026-08-26** Git 徽章上卷到未跟踪目录的祖先文件夹；**2026-08-26** 非 Markdown 编辑画布与 Markdown 同用 `bg-base`；**2026-08-26** listing 超时显示 **!** 而非卡住 spinner；**2026-08-28** 树空白点击回到根、拖拽移动；**2026-08-31**（#117）`requestExit` / `waitForExitDecision` 桌面退出守卫 + `desktop-shell.ts` IPC 接线 | 2026-08 |
| `packages/client/ui-settings-general/src/client/SettingsRoot.tsx` | **2026-08-31**（#117）应用菜单 Settings 经 `dsh:focus-settings` 打开设置面板 | 2026-08-31 |
| `packages/client/connection/` | **2026-08-26** `host.watchPath` 浏览器下行改 WebSocket，避免 HTTP/1.1 六连接占满后文件树 listing 排队超时；**2026-08-30** connection schema 与 fetch client 扩展 `host.browser*`；**2026-08-31** `host.browserShowWindow` | 2026-08 |
| `packages/client/ui-git/` | **新包**：工具箱 Git 面板 occupant（绑定 Workspace、两段变更列表、四种空态、初始化）；**2026-08-25** 整文件暂存 / 取消暂存 / 丢弃确认 / 提交与按 Session 草稿；**2026-08-25** 单击行差异预览与按块暂存 / 取消暂存 / 丢弃；**2026-08-25** Git 操作守卫；**2026-08-25** 左侧操作区与差异预览分栏；**2026-08-25** 差异预览 VS Code 化；**2026-08-26** 提交区 UX（单行自动增高、可空说明、split 提交按钮）；**2026-08-26** 图标 tooltip / discard 尺寸；**2026-08-27** 未暂存长列表不再与「待提交」叠层；**2026-08-27** 未推送文案与 **推送** 放在分支名下一行，无未推送时隐藏；**2026-08-27** 选入/移出/撤销不再闪提交按钮；**2026-08-27** 待提交下方 Graph（主干 + 节点到节点合入弧、侧道换色、`origin/` 橙色胶囊）；**2026-08-27** Graph 每页 50 条，列表滚到底部继续加载直至全部；**2026-08-27** Graph 引用胶囊收窄省略，有引用时放在说明下一行靠右，悬停打开提交详情卡；**2026-08-27** Changes 与 Graph 同级可折叠，Changes 包住分支/提交/两段列表；**2026-08-27** CHANGES/GRAPH 全大写加粗，Graph 钉底，Changes body 与 Graph 列表缩进 14px；**2026-08-27** Graph 每行说明紧挨该行点或线；**2026-08-27** 单击 Graph 提交在右栏只读多文件差异；**2026-08-28** Graph 提交文件头默认折叠，展开后才渲染该文件预览；**2026-08-28** 进入面板 / 重读 Graph 不自动打开最新提交；**2026-08-28** 切回 Git Tab 时 Graph 与右栏不闪 loading；**2026-08-27** 提交/推送确认框贴触发按钮右下角并加描边阴影；**2026-08-27** CHANGES 段头右侧显示未暂存加待提交行数；**2026-08-27** 无 remote 时提交/推送显示「没有配置远程仓库地址」；**2026-08-27** 无 remote 时分支下行 **添加远程地址**；已有 `origin` 时显示 URL 与 **删除远程地址**；**2026-08-28** 无 HEAD 时添加 origin 不显示尚未推送到远程；**2026-08-28** 推送非快进拒绝显示「远程已有提交，无法快进推送」 | 2026-08 |
| `packages/subprocess/subprocess-local/` | **2026-08-29** `LocalTerminalHandle` / `LinuxProcessInspector` / `PosixProcessInspector` 构造函数改为显式字段赋值，兼容 Node strip-only 加载 terminal 依赖链（web e2e） | 2026-08 |
| `packages/client/ui-terminal/` | **新包**（#77 最小通路；#78 多 Tab + Shell 下拉 + Kill + Tab 标题；#79 终端不可用卡片 + inline 错误 + 重试 + spawn 中禁用 `+`）；**2026-08-30** Tab 样式对齐文件编辑器、右键批量关闭、运行中命令关闭确认；`conversation.details.terminal` occupant；Workspace 级 Tab store；`host.terminal*` 经 `WorkspaceRuntime` 转发；xterm.js 画布 + 自动 spawn + 未绑定空态 + loading | 2026-08 |
| `packages/client/ui-browser/` | **新包**（#96–#98）：`conversation.details.browser` occupant；Workspace 级 Tab store；首次进入 `about:blank` + 地址栏 focus；Tab 栏 + 右键批量关闭 + 导航栏；**2026-08-31** 人类主表面改为有头 Chromium：内容区「显示窗口」调用 `browserShowWindow`，不再订阅 screencast 或转发指针/键盘；不可用卡片 + 导航错误 + 外部站点 info；未绑定空态；`packages/bundle/web-app` 注册；**2026-08-31** Host 池空时 `+` 先按 store URL 重建再开新 Tab，`browser-tab-not-found` 关 Tab 仍从 store 去掉；**2026-08-31 #119** 桌面交付检测 preload `reportBrowserOccupantBounds`：occupant 改 `#browser-occupant` + `ResizeObserver` bounds 上报，移除「显示窗口」主路径；浏览器交付路径不变 | 2026-08 |
| `packages/client/ui-conversation/` | 工具箱 segmented Tab 壳层；**2026-08-30** #95 扩为五段 **资源管理器 | Git面板 | 终端 | 浏览器 | 工具详情**；声明 `conversation.details.browser`；向浏览器段传入 `visible`（切走只隐藏、不卸载） | 2026-08 |
| `packages/client/runtime/` | **2026-08-29** Workspaces face 增加 `terminalKill`（#78）；**2026-08-29** `terminalStream` 可选 `onError`（#79 重连失败 inline） | 2026-08 |
| `packages/client/ui-primitives/` | **2026-08-25** 导出 `highlightLines` / `subscribeGrammarLoaded` / `HighlightSpan` 供 Git 差异预览复用 shiki 高亮；**2026-08-26** 新增 `IconDiscardOutline16`（撤销工作区更改，非 refresh） | 2026-08 |
| `packages/client/web/` | **2026-08-25** seed 显式 pin `highlightLines` / `grammarLoadCount` / `subscribeGrammarLoaded`，供 Git 差异预览等平台插件消费 | 2026-08 |
| `packages/client/runtime/` | `WorkspaceRuntime` 转发新 Host RPC；**2026-08-25** 转发 Git 面板只读 RPC；**2026-08-25** 转发 Git 面板写 RPC；**2026-08-27** `gitLog` 转发 `limit`/`skip` 与 `hasMore`；**2026-08-27** `gitCommitDiff`；**2026-08-27** `gitAddRemote`；**2026-08-27** `gitRemoveRemote`；**2026-08-28** `movePath`；**2026-08-29** 转发 `host.terminal*`（profiles/spawn/write/resize/list/stream）；**2026-08-30** 转发 `host.browser*`；**2026-08-31** `browserShowWindow`；**2026-08-31** `browserScroll` 增加可选 `x`/`y`（坐标进 payload，不当作 AbortSignal） | 2026-08 |
| `packages/client/ui-primitives/` | Mermaid 块、ZoomPanLightbox、Markdown 图片 | 2026-08 |
| `packages/client/ui-tool/` | Tool 行 selection → details 跳转 | 2026-08 |
| `packages/client/ui-layout/` | 工具箱栏宽度 / AppFrame 微调 | 2026-08 |
| `packages/lsp/lsp-editor/` | **新包**：编辑器 LSP 类型与接线 | 2026-08 |
| `packages/lsp/lsp-stdio/` | 编辑器实例诊断推送 | 2026-08 |
| `packages/browser/tool-browser/` | **新包**（#100）：Agent `browser_*` 工具 Consumer；`host.browser*` 桥接 + terminal/generic render intent | 2026-08 |
| `apps/cli/config/agent-presets/*/agent.cordis.yml` | **2026-08-30** 注册 `tool-browser` | 2026-08 |
| `apps/cli/package.json`、`packages/bundle/web-app/package.json` | **2026-08-30** 声明 `@deepseek-ai/dsh-tool-browser` 依赖 | 2026-08 |
| `tsconfig.base.json` | 为 `ui-file-editor` / `ui-git` / `ui-terminal` 增加 source-plane `paths`（tsx 启动不依赖 built `lib/`） | 2026-08 |
| `apps/web/` | Vite 构建含 Monaco workers / material icons 同步；**2026-08-29** 浏览器快照 `terminal-default.expected.md` 与 shell profile 名 `{{shell-profile}}` 归一化；**2026-08-30** #95 五段 Tab 快照 `tabs.expected.md` / `browser-selected.expected.md` | 2026-08 |
| `CONTEXT.md`、`docs/adr/0001–0002`、`docs/prd/file-editor-v1.md` | 文件编辑器 V1 领域与 PRD | 2026-08 |
| `CONTEXT.md`、`docs/adr/0005–0006`、`docs/prd/terminal-v3.md` | 人类终端 V3 领域、PRD 与 ADR（`feat/v3`） | 2026-08-29 |
| `CONTEXT.md`、`docs/adr/0007–0008`、`docs/prd/browser-v4.md` | 内嵌浏览器 V4 领域、PRD 与 ADR（`feat/v4`） | 2026-08-30 |
| `CONTEXT.md`、`docs/adr/0009–0010`、`docs/adr/0007`（Consequences 分叉引用） | 桌面壳 V5 领域与 ADR（`feat/v5`） | 2026-08-31 |
| `docs/prd/desktop-v5.md` | 桌面壳 V5 PRD（`feat/v5`） | 2026-08-31 |
| `AGENTS.md`（Agent skills 块） | Issue 跟踪 / triage / domain / wiki 工作流说明 | 2026-08 |
| `scripts/translation-pairing.manifest.json`、`scripts/build-exe-for-python-sdk.ts`、`scripts/verify-translation-prompt.ts` | 根 README 排除 upstream 双语配对 / 部署文档列表 | 2026-08-22 |
| `scripts/agent-note-tree.ts` | Agent Note 生命周期根 allowlist 仅保留 `AGENTS.md` | 2026-08-22 |

## 我故意不跟的上游行为
| 点 | 原因 |
|----|------|
| 在 `packages/` 内联实现文件编辑器 V1 | Host RPC 与工具箱壳层必须改官方包；树外插件留待后续拆分 |
| `custom/main` 长期领先 upstream `master` | 自研功能集成线，合并 upstream 时需手动 reconcile |
| 文件树 listing 单层上限 1000 + dirent 扫描上限 10 000 | 防止 monorepo 大目录拖垮 Host / 浏览器 |
| `readFile` 5 MB 硬上限 | 防止 minified bundle 等超大文件经 RPC + Monaco 卡死主线程 |
| 根 `README.md` / `README_EN.md` 不走 upstream 双语配对（`README.zh.md`、`README.i18n.yaml` 已删） | fork 对外交付文档；中文主文档 + 独立英文版 |
| 全仓库无 `CLAUDE.md` symlink（`packages/`、`examples/`、`vendor/`、`.agents/notes/implemented/` 已删） | 本 fork 以 Cursor 为主；规则真源为各目录 `AGENTS.md` |
| CI：部分 push/PR 工作流已禁用（PR #25） | 定制开发阶段减少噪声；见 commit `a43e450eb9` |

## 合并官方记录
| 日期 | 官方提交/标签 | 有没有冲突 | 备注 |
|------|---------------|------------|------|
| 2026-08 | upstream `master` @ 文件编辑器开工前 | — | 自 `7672080d88` 起维护本文件 |
| — | deepseek-ai/deepseek-harness `master` | 未定期合并 | `custom/main` 为功能线；合并时需跑 build + `test:gui` |

## 待合并 / 进行中
| 分支 | 内容 | 状态 |
|------|------|------|
| `fix/file-editor-v1-qa-validation` | PR [#48](https://github.com/NanGePlus/my-deepseek-harness/pull/48)：**工具箱**文案与 capsule 入口、Tab 样式对齐对话区；**Markdown 预览 WYSIWYG**（TipTap）与 IME/wrap 修复；**Add to Chat file-context pill**（Markdown 源码 + 全语言 Monaco → composer pill；发送展开进 prompt；**已发送用户气泡** pill 投影并可点击打开编辑器） | 已合并入 `custom/main` |
| `fix/file-editor-v1-qa` | Tab 批量关闭、删除/重命名/同名冲突、文件夹重命名 Tab 同步、Markdown 默认源码、空状态 UI | 已并入 `custom/main` 或与本线并行，合并前需 reconcile |
| `fix/file-editor-v1-verify-fix` | 大文件 + 目录 listing 性能修复 | 已合并入 `custom/main` |
| `docs/git-panel-v2-prd` | Git 面板 V2：父 PRD [#51](https://github.com/NanGePlus/my-deepseek-harness/issues/51)；切片 #52–#59 | PR [#60](https://github.com/NanGePlus/my-deepseek-harness/pull/60) 已合并入 `custom/main` |
| `issue/52-d-global-git-panel-design-close` | [#52](https://github.com/NanGePlus/my-deepseek-harness/issues/52) `#D-global`：验收关闭 Git 面板 DESIGN.md | 进行中 |
| `issue/53-host-git-rpc-inspect` | [#53](https://github.com/NanGePlus/my-deepseek-harness/issues/53) Host Git RPC：仓库发现、变更列表、差异预览与初始化 | 已合并入 `custom/main`（PR [#62](https://github.com/NanGePlus/my-deepseek-harness/pull/62)） |
| `issue/54-host-git-rpc-write` | [#54](https://github.com/NanGePlus/my-deepseek-harness/issues/54) Host Git RPC：暂存、取消暂存、丢弃与提交 | 已合并入 `custom/main`（PR [#63](https://github.com/NanGePlus/my-deepseek-harness/pull/63)） |
| `issue/55-app-shell-details-three-tab` | [#55](https://github.com/NanGePlus/my-deepseek-harness/issues/55) app-shell：工具箱三段 Tab 与 Git 槽位 | 已合并入 `custom/main`（PR [#64](https://github.com/NanGePlus/my-deepseek-harness/pull/64)） |
| `issue/56-git-panel-bind-list` | [#56](https://github.com/NanGePlus/my-deepseek-harness/issues/56) `ui-git`：仓库绑定、两段列表、空态、刷新与初始化 | 已合并入 `custom/main`（PR [#65](https://github.com/NanGePlus/my-deepseek-harness/pull/65)） |
| `issue/57-git-panel-stage-commit` | [#57](https://github.com/NanGePlus/my-deepseek-harness/issues/57) `ui-git`：整文件暂存、丢弃、提交说明与提交 | 已合并入 `custom/main`（PR [#66](https://github.com/NanGePlus/my-deepseek-harness/pull/66)） |
| `issue/58-git-panel-diff-preview` | [#58](https://github.com/NanGePlus/my-deepseek-harness/issues/58) `ui-git`：差异预览与按块操作 | 已合并入 `custom/main`（PR [#67](https://github.com/NanGePlus/my-deepseek-harness/pull/67)） |
| `issue/59-git-panel-action-guard` | [#59](https://github.com/NanGePlus/my-deepseek-harness/issues/59) `ui-git`：Git 操作守卫 | 已合并入 `custom/main`（PR [#68](https://github.com/NanGePlus/my-deepseek-harness/pull/68)） |
| `feat/issue-80-terminal-persist-reconnect` | [#80](https://github.com/NanGePlus/my-deepseek-harness/issues/80) 切走持久 / 硬刷新重连 | 已合并入 `custom/main` |
| `feat/issue-81-terminal-disk-refresh` | [#81](https://github.com/NanGePlus/my-deepseek-harness/issues/81) 改盘刷新协调 | 已合并入 `custom/main`（PR [#90](https://github.com/NanGePlus/my-deepseek-harness/pull/90)） |
| `feat/v3` | V3 人类终端：父 PRD [#73](https://github.com/NanGePlus/my-deepseek-harness/issues/73)；切片 #74–#81 | 进行中；基线 `origin/custom/main` |
| `issue/74-d-global-human-terminal-design-close` | [#74](https://github.com/NanGePlus/my-deepseek-harness/issues/74) `#D-global`：验收关闭人类终端 DESIGN.md | 进行中 |
| `feat/v4` | V4 内嵌浏览器：父 PRD [#92](https://github.com/NanGePlus/my-deepseek-harness/issues/92)；切片 #93–#100 | 规格已锁定；基线 `origin/custom/main` |
| `issue/93-d-global-browser-design-close` | [#93](https://github.com/NanGePlus/my-deepseek-harness/issues/93) `#D-global`：验收关闭内嵌浏览器 DESIGN.md | 进行中 |
| `issue/94-host-browser-rpc` | [#94](https://github.com/NanGePlus/my-deepseek-harness/issues/94) Host browser RPC | 已合并入 `custom/main` |
| `issue/95-app-shell-browser-tab` | [#95](https://github.com/NanGePlus/my-deepseek-harness/issues/95) app-shell：五段 Tab + 浏览器槽位 | 已合并入 `custom/main` |
| `issue/96-ui-browser-core` | [#96](https://github.com/NanGePlus/my-deepseek-harness/issues/96) `ui-browser`：about:blank + screencast + 未绑定空态 | 已合并入 `custom/main` |
| `issue/97-ui-browser-tabs-nav` | [#97](https://github.com/NanGePlus/my-deepseek-harness/issues/97) `ui-browser`：多 Tab + 导航顶栏 | 已合并入 `custom/main` |
| `issue/98-ui-browser-states-menu` | [#98](https://github.com/NanGePlus/my-deepseek-harness/issues/98) `ui-browser`：不可用 + 错误 + 溢出菜单 | 已合并入 `custom/main` |
| `issue/99-ui-browser-lifecycle` | [#99](https://github.com/NanGePlus/my-deepseek-harness/issues/99) `ui-browser`：SSE 生命周期 + Zoom + viewport | 已合并入 `custom/main`（PR [#108](https://github.com/NanGePlus/my-deepseek-harness/pull/108)） |
| `issue/100-tool-browser` | [#100](https://github.com/NanGePlus/my-deepseek-harness/issues/100) `tool-browser`：Agent `browser_*` 工具 | 已合并入 `custom/main`（PR [#109](https://github.com/NanGePlus/my-deepseek-harness/pull/109)） |
| `fix/browser-v4-qa-validation` | V4 内嵌浏览器：有头窗口人类主表面 + 关窗恢复 | 开 PR 合并入 `custom/main`；分支保留；基线 `origin/custom/main`（`000ca32d56`） |
| `feat/v5` | V5 桌面壳：父 PRD [#111](https://github.com/NanGePlus/my-deepseek-harness/issues/111)；切片 #113–#122 | 规格已锁定；基线 `origin/custom/main`（`3da88bbaa8`） |
| `issue/113-d-global-desktop-design-close` | [#113](https://github.com/NanGePlus/my-deepseek-harness/issues/113) `#D-global`：验收关闭桌面壳 V5 DESIGN.md | 已合并入 `custom/main`（PR [#124](https://github.com/NanGePlus/my-deepseek-harness/pull/124)）；分支保留 |
| `issue/114-desktop-profile` | [#114](https://github.com/NanGePlus/my-deepseek-harness/issues/114) desktop profile + bundle | 已合并入 `custom/main`（PR #125） |
| `issue/115-apps-desktop-boot` | [#115](https://github.com/NanGePlus/my-deepseek-harness/issues/115) apps/desktop Host boot + dsh:// + dev:desktop | 已合并入 `custom/main`（PR [#126](https://github.com/NanGePlus/my-deepseek-harness/pull/126)）；分支保留 |
| `issue/116-ipc-api-client` | [#116](https://github.com/NanGePlus/my-deepseek-harness/issues/116) IpcApiClient + preload | 已合并入 `custom/main`（PR [#127](https://github.com/NanGePlus/my-deepseek-harness/pull/127)）；分支保留 |
| `issue/117-standard-shell` | [#117](https://github.com/NanGePlus/my-deepseek-harness/issues/117) 单实例 / 退出守卫 / 窗口持久化 / 菜单 | 已合并入 `custom/main`（PR [#128](https://github.com/NanGePlus/my-deepseek-harness/pull/128)）；分支保留 |
| `issue/118-browser-registry-cdp` | [#118](https://github.com/NanGePlus/my-deepseek-harness/issues/118) BrowserRegistry 桌面 CDP + bounds IPC | 已合并入 `custom/main`（PR [#129](https://github.com/NanGePlus/my-deepseek-harness/pull/129)）；分支保留 |
| `issue/119-ui-browser-desktop-occupant` | [#119](https://github.com/NanGePlus/my-deepseek-harness/issues/119) ui-browser 桌面 occupant | 已合并入 `custom/main`（PR [#130](https://github.com/NanGePlus/my-deepseek-harness/pull/130)）；分支保留 |
| `issue/120-electron-builder` | [#120](https://github.com/NanGePlus/my-deepseek-harness/issues/120) electron-builder + Chromium 捆绑 | 待领取 |
| `issue/121-desktop-app-shell` | [#121](https://github.com/NanGePlus/my-deepseek-harness/issues/121) `[desktop] app-shell` | 待领取 |
| `issue/122-desktop-embedded-browser` | [#122](https://github.com/NanGePlus/my-deepseek-harness/issues/122) `[desktop] embedded-browser` | 待领取 |

## 近期操作记录
| 日期 | 操作 | 备注 |
|------|------|------|
| 2026-08-31 | 分支 `issue/119-ui-browser-desktop-occupant` 合并入 `custom/main` | PR [#130](https://github.com/NanGePlus/my-deepseek-harness/pull/130)；Closes [#119](https://github.com/NanGePlus/my-deepseek-harness/issues/119)；分支保留 |
| 2026-08-31 | 分支 `issue/119-ui-browser-desktop-occupant`：Issue [#119](https://github.com/NanGePlus/my-deepseek-harness/issues/119) ui-browser 桌面 occupant | `#browser-occupant` + bounds IPC；桌面移除「显示窗口」；8 项 seam 测试全绿 |
| 2026-08-31 | 分支 `issue/118-browser-registry-cdp` 合并入 `custom/main` | PR [#129](https://github.com/NanGePlus/my-deepseek-harness/pull/129)；Closes [#118](https://github.com/NanGePlus/my-deepseek-harness/issues/118)；分支保留 |
| 2026-08-31 | 分支 `issue/118-browser-registry-cdp`：Issue [#118](https://github.com/NanGePlus/my-deepseek-harness/issues/118) BrowserRegistry desktop CDP + bounds IPC | `BrowserRegistry` delivery 分叉；`DesktopBrowserViewManager`；bounds IPC + 21 项 seam 测试 |
| 2026-08-31 | 分支 `issue/117-standard-shell` 合并入 `custom/main` | PR [#128](https://github.com/NanGePlus/my-deepseek-harness/pull/128)；Closes [#117](https://github.com/NanGePlus/my-deepseek-harness/issues/117)；分支保留 |
| 2026-08-31 | 分支 `issue/117-standard-shell`：Issue [#117](https://github.com/NanGePlus/my-deepseek-harness/issues/117) 标准壳 | 单实例聚焦、退出守卫 IPC + dirty guard、窗口 bounds、About/Settings/Quit 菜单、Dock 图标；18 项 seam 测试 |
| 2026-08-31 | 分支 `issue/116-ipc-api-client`：Issue [#116](https://github.com/NanGePlus/my-deepseek-harness/issues/116) IpcApiClient + preload IPC carrier | `IpcApiClient` / Main `registerIpcApiBridge` / preload `window.dsh`；5 项 seam 测试 |
| 2026-08-31 | 分支 `issue/115-apps-desktop-boot` 合并入 `custom/main` | PR [#126](https://github.com/NanGePlus/my-deepseek-harness/pull/126)；Closes [#115](https://github.com/NanGePlus/my-deepseek-harness/issues/115)；分支保留 |
| 2026-08-31 | 分支 `issue/115-apps-desktop-boot`：Issue [#115](https://github.com/NanGePlus/my-deepseek-harness/issues/115) apps/desktop Host boot + dsh:// + dev:desktop + attach | `DesktopHostController`；`dsh desktop`；18 项 seam 测试全绿 |
| 2026-08-31 | 分支 `issue/114-desktop-profile`：Issue [#114](https://github.com/NanGePlus/my-deepseek-harness/issues/114) desktop profile + `@deepseek-ai/dsh-desktop-app` | `dsh --profile desktop --dump-config`；Node boot + `host.describe` seam 测试 |
| 2026-08-31 | 分支 `issue/113-d-global-desktop-design-close` 合并入 `custom/main` | PR [#124](https://github.com/NanGePlus/my-deepseek-harness/pull/124)；Closes [#113](https://github.com/NanGePlus/my-deepseek-harness/issues/113)；分支保留 |
| 2026-08-31 | 从最新 `origin/custom/main` 创建分支 `issue/113-d-global-desktop-design-close` | Issue [#113](https://github.com/NanGePlus/my-deepseek-harness/issues/113) `#D-global` 验收关闭；桌面壳 SPA 消费既有品牌板，原生 chrome 不在 DESIGN 范围 |
| 2026-08-31 | `/to-issues`：V5 Issue 切片发布 | 父 PRD [#111](https://github.com/NanGePlus/my-deepseek-harness/issues/111)；子 Issue #113–#122（`ready-for-agent`）；重复 #112 已关闭 |
| 2026-08-31 | 分支 `feat/v5`：V5 PRD 落地 | 新增 `docs/prd/desktop-v5.md`（桌面壳、双页 UI、实现/测试决策定位词） |
| 2026-08-31 | 分支 `feat/v5`：`grill-with-docs` + ADR 落地 | 更新 `CONTEXT.md` 交付形态；新增 `docs/adr/0009-desktop-shell-electron-delivery.md`、`docs/adr/0010-desktop-browser-electron-cdp.md`；`0007` Consequences 增加交付形态分叉引用 |
| 2026-08-31 | 从 `origin/custom/main` 创建并推送 `feat/v5` | V5 迭代线；基线 PR #110 合并后 `3da88bbaa8` |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：关有头窗口后 Tab 全废 | Context `close` 后 Registry 仍持死实例，`newPage`/`page.close` 报 Target closed，`showWindow` 还当成功。改为 evict + `createTab` 重建、`closeTab` 幂等、`showWindow` 走 tab-not-found 让 Client 按 store 恢复 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：画布无法输入中文 | JPEG 画布是普通 div，拼音第一键 `isComposing=false` 被当成英文并 `preventDefault`，IME 起不来。增加隐藏 textarea 承接组合输入，只在 `compositionend` / 非组合 `input` 转发 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：打开网页后无法点击/输入 | 抬起若落在 JPEG 外不发 `mouseReleased`，Host 卡在按下；`sendPointer` 每次（含 move）`page.evaluate` 读光标，点击排在后面。改为 window 配对抬起、点击替换排队 move、人类指针/键盘走 Playwright `page.mouse` / `page.keyboard`，光标只在 move 时读取 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：画布无法输入 | 点击 JPEG 时 `preventDefault` 阻止 stage 获焦，按键落到地址栏；mousedown 后 `focus` 画布。`char` 改走 CDP `Input.insertText`；IME `compositionend` 作为一段文字转发 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：导航栏 tooltip 盖住图标 | 浏览器段 `Tooltip` 未指定 `side`，默认 `right`，靠右的「在外部浏览器打开」气泡滑回后盖住按钮；改为 `side="bottom"` 与资源管理器工具栏一致 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：page.evaluate `__name` | `dsh web` 走 `tsx`，会给 `canScroll` 注入 `__name`；Playwright 把函数源码 eval 进页面后报 ReferenceError。`browserScroll` / 光标读取改为字符串脚本 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：强制刷新红条 | Client 在 `browser-tab-not-found` 时对账 Host `list` 或按 store URL 重建并重试；恢复过程中 abort 不再当成失败红条；Host 重建 Context（DPR）期间 screencast 等待，避免误报 tab 丢失 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：滚动链式带动其它区域 | Host `browserScroll` 改为对光标下第一个 overflow 容器 `scrollBy`，不再用 CDP `mouseWheel` 链式滚祖先/兄弟 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：screencast 卡顿 | 指针/滚轮 in-flight 合并（移动只留最新、滚轮累加 delta）；JPEG 用 blob URL 且跳过相同帧；Host 复用 Tab CDP、scroll 不再同步 metadata |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：screencast 套用页面 CSS 光标 | `browserSendPointer` 回传 `elementFromPoint` 计算 `cursor`；画布 `<img>` 在悬停时套用，离开恢复 `auto` |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：滚轮 AbortSignal.any 报错 | UI 把 `(x,y)` 传给 runtime，但已构建 runtime 仍是旧 5 参签名，数字坐标被当成 `signal`；重建 runtime 后坐标进 payload |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：screencast 内部滚动容器 | Host `browserScroll` 按 `(x,y)` 找到光标下第一个 overflow 容器并 `scrollBy`（不链式）；Client 按 **JPEG 图像**（非 stage 容器）映射指针坐标 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：screencast 滚轮转发 | Client `wheel` → `browserScroll`（可选坐标），修复内嵌页面无法滚动 |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：Host 重启后浏览器 Tab 重建 | Client store 有 Tab 但 Host `list` 空时按 store URL 重建 Host Tab，并等 bootstrap 完成后再连 screencast/resize |
| 2026-08-31 | 分支 `fix/browser-v4-qa-validation`：screencast HiDPI 修复 | Client `browserResizeViewport` 上报 `devicePixelRatio`；Host 以 `deviceScaleFactor` 超采样 JPEG（`scale: 'device'`），DPR 变化时重建 Context 并恢复 Tab |
| 2026-08-31 | 从最新 `origin/custom/main` 创建分支 `fix/browser-v4-qa-validation` | V4 内嵌浏览器功能验证测试；基线含 PR #108–#109（#99–#100 已合并） |
| 2026-08-30 | 从最新 `origin/custom/main` 创建分支 `issue/100-tool-browser` | Issue [#100](https://github.com/NanGePlus/my-deepseek-harness/issues/100)：`@deepseek-ai/dsh-tool-browser` Agent `browser_*` 工具 + Session 日志 + preset 注册 |
| 2026-08-30 | 从最新 `origin/custom/main` 创建分支 `issue/99-ui-browser-lifecycle` | Issue [#99](https://github.com/NanGePlus/my-deepseek-harness/issues/99)：切走暂停 SSE + 硬刷新 list 重连 + Zoom 不改 Host viewport + Hard Reload 不 dim |
| 2026-08-30 | 从最新 `origin/custom/main` 创建分支 `issue/98-ui-browser-states-menu` | Issue [#98](https://github.com/NanGePlus/my-deepseek-harness/issues/98)：浏览器不可用卡片 + 导航错误 + 外部站点 inline info + 溢出菜单（Hard Reload / Copy URL / Zoom） |
| 2026-08-30 | 从最新 `origin/custom/main` 创建分支 `issue/97-ui-browser-tabs-nav` | Issue [#97](https://github.com/NanGePlus/my-deepseek-harness/issues/97)：Tab 右键批量关闭、导航历史 disabled、外部打开、http(s) 地址栏；Host `BrowserPageMetadata` / list 增 `canGoBack` / `canGoForward` |
| 2026-08-30 | 从最新 `origin/custom/main` 创建分支 `issue/96-ui-browser-core` | Issue [#96](https://github.com/NanGePlus/my-deepseek-harness/issues/96)：`@deepseek-ai/dsh-client-ui-browser` 包注册 + 首次 `about:blank` + screencast + 未绑定空态 |
| 2026-08-30 | 从最新 `origin/custom/main` 创建分支 `issue/95-app-shell-browser-tab` | Issue [#95](https://github.com/NanGePlus/my-deepseek-harness/issues/95)：工具箱五段 Tab + `conversation.details.browser` 槽位 |
| 2026-08-30 | 从最新 `origin/custom/main` 创建分支 `issue/94-host-browser-rpc` | Issue [#94](https://github.com/NanGePlus/my-deepseek-harness/issues/94)：`host.browser*` Playwright Registry + SSE screencast + WorkspaceRuntime 转发 |
| 2026-08-30 | 从最新 `origin/custom/main` 创建分支 `issue/93-d-global-browser-design-close` | Issue [#93](https://github.com/NanGePlus/my-deepseek-harness/issues/93) `#D-global` 验收关闭；内嵌浏览器消费既有品牌板，不新增 §5 原语 |
| 2026-08-30 | V4 内嵌浏览器 `/to-issues` 垂直切片 | 父 PRD [#92](https://github.com/NanGePlus/my-deepseek-harness/issues/92)；子 Issue #93–#100 |
| 2026-08-30 | 终端 Tab 栏/内容区背景对齐资源管理器 | Tab 栏 `--dsw-specific-sidebar-fill`；xterm 内容区 `--dsw-alias-bg-base` |
| 2026-08-30 | 终端 Tab 标题去掉路径前缀，仅显示命令/Shell 名 | Client 仍消费 Host `titleCommand`；路径不再渲染 |
| 2026-08-30 | 终端最后一个 Tab 禁止关闭 | `ui-terminal` 仅剩 1 个 Tab 时隐藏 ×，禁用「关闭 / 关闭全部」，底层拦截 kill |
| 2026-08-30 | 修复终端硬刷新后 scrollback 每行提示符前多余 `%` 黑块 | 根因：login zsh 的 `PROMPT_SP` 序列是 `ESC[1m ESC[7m%ESC[27m…` 而非先前假设的 `ESC[7m%ESC[0m`；回放前按真实 PTY 字节剥离 |
| 2026-08-30 | 修复终端中文 IME 拼音空格泄漏 | `ui-terminal` composition 期间不转发 PTY；提交时合并 `l s` → `ls` |
| 2026-08-30 | 修复终端硬刷新后 OSC/CSI 应答泄漏到 shell 输入 | `ui-terminal` 过滤 xterm `onData` 协议流量；scrollback 回放前禁用 stdin |
| 2026-08-30 | 工具箱 Git 段 Tab 文案 **Git** → **Git面板** | `ui-conversation` locales；英文 **Git Panel** |
| 2026-08-30 | 终端 Tab 对齐文件编辑器样式 + 右键批量关闭 + 运行中命令关闭确认 | 分支 `test/custom-main-functional-verification`；`ui-terminal` Tab × 按钮、VS Code 风格右键菜单、前台命令确认 Modal |
| 2026-08-29 | Issue #79：`ui-terminal` 终端不可用 + inline 错误 + 重试 | 分支 `feat/issue-79-terminal-unavailable-errors`；`terminalStream` 增加 `onError` |
| 2026-08-26 | Agent 二次 write 编辑器不刷新 | Host `watchPath` 改为监视文件父目录（原子 rename 后 inode 失效）；关闭再开能看到是因为重新订阅 |
| 2026-08-26 | 文件编辑器保存不再闪目录树 | 显式保存仅静默刷新 Git 徽章；内容变更不 invalidate listing |
| 2026-08-22 | 从最新 `origin/custom/main` 创建分支 `fix/file-editor-v1-qa-validation` | 用于 V1 验证测试与 BUG 修复；开工前 stash 了未提交 WIP |
| 2026-08-22 | 用户可见文案：详情栏 / 详情面板 → **工具箱** | `ui-conversation` locales；e2e `details-segmented-tab` 快照英文 `Toolbox` |
| 2026-08-22 | 会话头工具箱入口改为 **图标 +「工具箱」** capsule | `DetailsPanelToggle`；改 client 插件后需 `pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle` 并硬刷新 `pnpm dsh web` |
| 2026-08-22 | 工具箱 Tab 条样式对齐对话区 Tab | `DetailsPanel.module.css`：左对齐、蓝色选中态、2px 下划线 |
| 2026-08-22 | 新增 Cursor 规则 `.cursor/rules/custom-md-changelog.mdc` | 定制改动须同步更新 `CUSTOM.md` |
| 2026-08-22 | 移除 `.claude/skills` symlink | 仅 Claude Code 用；本 fork 以 Cursor 为主，skills 见 `.agents/skills` |
| 2026-08-22 | 删除根 `CLAUDE.md`、`README.i18n.yaml` | 根 README 改用 `README.md` + `README_EN.md`；配对 gate 排除见 `translation-pairing.manifest.json` |
| 2026-08-22 | 删除全仓库 `CLAUDE.md` symlink | `examples/`、`packages/`、`vendor/`、`.agents/notes/implemented/`；与 `.claude/skills` 移除一致 |
| 2026-08-23 | Markdown 预览态 WYSIWYG（TipTap H1） | `EditableMarkdownPreview` + 选区工具栏 B/I/U/S/Code/Link；代码块 / Mermaid 只读；依赖 `@tiptap/*` |
| 2026-08-23 | 修复 Markdown 预览 IME 无法输入 | 组合输入期间跳过 buffer 回写 / `setContent` 重载，避免打断中文输入法 |
| 2026-08-23 | 修复预览编辑器每次按键重建 TipTap 实例 | 稳定 `codeLabels` / extensions memo；聚焦时跳过 props 回写；工具栏 portal 到 `document.body` |
| 2026-08-23 | 修复 Markdown 源码（Monaco）IME 被 props 回写打断 | 聚焦/组合输入期间跳过 `setValue`；组合结束再提交 buffer |
| 2026-08-23 | Markdown 链接改为内联弹框 | 工具栏「链接」弹出胶囊输入框（图1）；Enter/✓ 确认、Esc 关闭 |
| 2026-08-23 | 修复链接弹框延迟 / 预览链接不可点 | 单 BubbleMenu 内切换表单与链接输入；`openOnClick: true` + `target=_blank` |
| 2026-08-23 | 修复预览工具栏选区状态 | 链接确认后折叠选区隐藏工具栏；`useEditorState` 按当前选区刷新 B/I/U 等激活态 |
| 2026-08-23 | 修复 Markdown 源码 IME 组合排版 | `monacoWordWrapForLanguage('markdown')` 强制 `wordWrap: off`；预览区 `overflow-wrap: break-word` |
| 2026-08-23 | Markdown 源码恢复软换行 | 移除 markdown 专用 `wordWrap: off`；与普通文本同样随宽度 wrap |
| 2026-08-23 | Markdown 源码 wrap + IME 兼得 | 默认 soft wrap；`compositionstart/end` 临时 `wordWrap: off` 保持 preedit 内联 |
| 2026-08-23 | Markdown 源码 CJK IME + soft wrap | 移除组合期间 wrap 切换；Markdown 用 `accessibilitySupport: off` + simple wrap |
| 2026-08-23 | 修复单击误选文本 | 预览（TipTap）与源码（Monaco）在简单单击后折叠非空选区；拖拽与多击选词/选行保留 |
| 2026-08-23 | Markdown 源码 Add to Chat pill 交互 | 圆角胶囊 pill（适度 padding）；backdrop 点击跳转；chip 点击后在 buffer 同步完成后再选中 Monaco 行范围 |
| 2026-08-23 | Add to Chat pill 光标与输入 | 单层 13/20 regular 胶囊（勿用 500，长英文会宽于光标）；光标在尾随空格后 |
| 2026-08-23 | Markdown 源码 Add to Chat → composer file-context pill | `e9a619f`；Monaco 选区浮动 **Add to Chat**；`file-context` input trigger；提交时读文件展开行内容进 prompt |
| 2026-08-23 | 已发送用户消息 file-context pill 展示投影 | `b15cd147`；`ui-conversation` `project-user-text`；气泡显示 pill 非全文 excerpt；可点击打开编辑器；session log 仍保留展开全文 |
| 2026-08-23 | 全语言 Monaco 选区 Add to Chat | `8c624b4a`；TS/Python 等可编辑文本与 Markdown 源码同链路；改 `ui-file-editor` 后需 `run bundle` |
| 2026-08-23 | 开 PR [#48](https://github.com/NanGePlus/my-deepseek-harness/pull/48) → `custom/main` | 分支 `fix/file-editor-v1-qa-validation`；7 commit（预览/IME + Add to Chat 全链路） |
| 2026-08-23 | PR #48 合并入 `custom/main` | 保留分支 `fix/file-editor-v1-qa-validation` |
| 2026-08-23 | 文件树自动刷新 | 保存 / `watchPath` 外部变更 / Workspace 根监听后重载 listing；改 `ui-file-editor` 后需 `run bundle` |
| 2026-08-25 | 起草 Git 面板 V2 PRD | `docs/prd/git-panel-v2.md`；领域见 `CONTEXT.md`，ADR-0003/0004 |
| 2026-08-25 | 发布 Git 面板 V2 Issue | 父 PRD [#51](https://github.com/NanGePlus/my-deepseek-harness/issues/51)；#52 `#D-global`；#53/#54 Host Git RPC；#55 app-shell 三段 Tab；#56–#59 `git-panel` 四刀 |
| 2026-08-25 | 提交 Git 面板 V2 规格 | 分支 `docs/git-panel-v2-prd`：PRD、ADR-0003/0004、`CONTEXT.md`、DESIGN 多行/禁用原语；PR [#60](https://github.com/NanGePlus/my-deepseek-harness/pull/60) 已合并 |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/52-d-global-git-panel-design-close` | Issue [#52](https://github.com/NanGePlus/my-deepseek-harness/issues/52) `#D-global` 验收关闭；Git 面板消费既有品牌板，不新增 §5 原语 |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/53-host-git-rpc-inspect` | Issue [#53](https://github.com/NanGePlus/my-deepseek-harness/issues/53) Host Git 只读 RPC；不改 V1 `gitStatus`，不暴露任意 argv |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/54-host-git-rpc-write` | Issue [#54](https://github.com/NanGePlus/my-deepseek-harness/issues/54) Host Git 写 RPC：暂存 / 取消暂存 / 丢弃 / 提交；按块 patch 由 Host 拼装；不暴露任意 argv |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/55-app-shell-details-three-tab` | Issue [#55](https://github.com/NanGePlus/my-deepseek-harness/issues/55) 工具箱三段 Tab（资源管理器 \| Git \| 工具详情）；声明 `conversation.details.git`；切走 Git 只隐藏不卸载 |
| 2026-08-25 | PR [#64](https://github.com/NanGePlus/my-deepseek-harness/pull/64) 合并入 `custom/main` | 关闭 Issue [#55](https://github.com/NanGePlus/my-deepseek-harness/issues/55)；保留分支 `issue/55-app-shell-details-three-tab` |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/56-git-panel-bind-list` | Issue [#56](https://github.com/NanGePlus/my-deepseek-harness/issues/56) `ui-git`：仓库绑定、两段列表、空态、刷新与初始化；切走只隐藏不卸载 |
| 2026-08-25 | 实现 Issue #56 Git 面板 1/4 切片 | 新包 `@deepseek-ai/dsh-client-ui-git`；工具箱 Git 槽传入 `visible`；e2e `git-empty` 快照 |
| 2026-08-25 | PR [#65](https://github.com/NanGePlus/my-deepseek-harness/pull/65) 合并入 `custom/main` | 关闭 Issue [#56](https://github.com/NanGePlus/my-deepseek-harness/issues/56)；保留分支 `issue/56-git-panel-bind-list` |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/57-git-panel-stage-commit` | Issue [#57](https://github.com/NanGePlus/my-deepseek-harness/issues/57) 整文件暂存、丢弃、提交说明与提交；按块与守卫留待后续切片 |
| 2026-08-25 | 实现 Issue #57 Git 面板 2/4 切片 | 整文件暂存 / 取消暂存 / 丢弃确认 / 提交；草稿按 Session；Host `GitWorkingTreeChange.kind`；资源管理器切回后重读 Git 徽章 |
| 2026-08-25 | PR [#66](https://github.com/NanGePlus/my-deepseek-harness/pull/66) 合并入 `custom/main` | 关闭 Issue [#57](https://github.com/NanGePlus/my-deepseek-harness/issues/57)；保留分支 `issue/57-git-panel-stage-commit` |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/58-git-panel-diff-preview` | Issue [#58](https://github.com/NanGePlus/my-deepseek-harness/issues/58) 差异预览与按块操作；Git 操作守卫留待后续切片 |
| 2026-08-25 | 实现 Issue #58 Git 面板 3/4 切片 | 单击行在面板内预览；已跟踪文本按块暂存 / 取消暂存 / 丢弃确认；未跟踪 / 二进制 / 删除仅整文件操作 |
| 2026-08-25 | PR [#67](https://github.com/NanGePlus/my-deepseek-harness/pull/67) 合并入 `custom/main` | 关闭 Issue [#58](https://github.com/NanGePlus/my-deepseek-harness/issues/58)；保留分支 `issue/58-git-panel-diff-preview` |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/59-git-panel-action-guard` | Issue [#59](https://github.com/NanGePlus/my-deepseek-harness/issues/59) Git 操作守卫；dirty 路径由工具箱壳层持有，不进 runtime 对象层 |
| 2026-08-25 | 实现 Issue #59 Git 面板 4/4 切片 | dirty 路径禁止暂存 / 丢弃 / 包含该路径的提交；取消暂存不受限；守卫对话框无自动保存 |
| 2026-08-25 | PR [#68](https://github.com/NanGePlus/my-deepseek-harness/pull/68) 合并入 `custom/main` | 关闭 Issue [#59](https://github.com/NanGePlus/my-deepseek-harness/issues/59)；保留分支 `issue/59-git-panel-action-guard` |
| 2026-08-25 | Git 面板 Tab 与左侧操作区 UX 微调 | Tab 文案 **Git面板**；左侧操作区背景对齐资源管理器文件树、默认 180px、可拖拽调整宽度；分支 `fix/git-panel-v2-qa-validation` |
| 2026-08-25 | Git 面板变更列表路径修复 | Host 正确解码 porcelain 引号路径中的 UTF-8 八进制转义；变更列表与 Git 徽章过滤 `.DS_Store` |
| 2026-08-25 | Git 面板变更列表 VS Code 布局 | 行内显示 **文件名 + 灰色父目录 + M/U/D 状态字母**，预览栏仍显示完整路径 |
| 2026-08-25 | Git 面板段标题文案 | **更改 / 暂存的更改** → **未选入提交 / 已选入提交** |
| 2026-08-25 | Git 面板差异预览 VS Code 布局 | 行号 + ± 前缀 + 行背景色；块操作改为 gutter 图标（aria 仍用暂存块/丢弃块） |
| 2026-08-25 | Git 面板差异预览增强 | 展示 `@@` hunk 头、用 `fileText` 补齐 hunk 间未改行、相邻 -/+ 行字符级高亮、右侧 minimap 与滚动同步；大文件预览限 2000 行并压缩 minimap，避免布局撑爆白屏 |
| 2026-08-25 | Git 面板差异预览修复 | `fileText` 按文件行号从第 1 行起补齐 hunk 前/后未改行；minimap 按文件行号分桶（不再按渲染行 index），色块位置与改动行对齐；Host 未返回 `fileText` 时用 `readFile` 回退补齐 |
| 2026-08-25 | Git 面板差异预览换行 | 预览行 `pre-wrap` 按宽度自动折行，不再单行截断 |
| 2026-08-25 | Git 面板 minimap 对齐 | 每处改动一对标记：红块左上（8×3px）、绿块在其右下错开；单独增删同色块 |
| 2026-08-25 | Git 面板分支文案 | **分支** → **提交到分支** |
| 2026-08-25 | Git 面板差异预览 polish | minimap 红绿标记放大（12×5px）；预览区 scroll-reveal 滚动条对齐资源管理器；编程语言文件 shiki 语法高亮（与 read 卡片同链路），字符级 diff 高亮叠加其上 |
| 2026-08-25 | Git 面板差异预览白屏修复 | web seed 显式 pin `highlightLines` 等平台导出，避免 tree-shake 后插件 `require` 得到 `undefined`；`ui-primitives` 需 tsc+tsdown；预览高亮缺导出时降级为纯文本 |
| 2026-08-25 | Git 面板变更列表光标 | 文件行悬浮/点击用手势指针，对齐资源管理器文件树 |
| 2026-08-25 | Git 面板差异预览去掉 hunk 头 | 不再展示 `@@` 行；按块暂存/丢弃仍用 hunk 头调用 Host |
| 2026-08-25 | Git 面板图标按钮 tooltip | 列表行/预览 gutter/区块头图标 hover 显示与资源管理器一致的底部文字提示（500ms 延迟） |
| 2026-08-26 | Git 面板提交说明校验 | 空说明不再在按钮下展示 Git 报错；输入框下方 inline 提示「请填写提交备注信息后再提交」
| 2026-08-26 | Git 面板提交区 UX | 备注框单行起步自动增高、无内滚动条、placeholder「请填写提交备注信息」；主按钮「提交」+ 下拉「提交 / 提交并推送」；左侧操作区默认 260px；Host `gitCommit` 支持 `push` |
| 2026-08-26 | Git 面板变更列表段头 | 「未选入提交 / 已选入提交」可收起展开（chevron）；最右侧显示文件数量
| 2026-08-26 | Git 面板段标题文案 | **未选入提交 / 已选入提交** → **已更改，暂未选入提交 / 待提交**
| 2026-08-26 | Git 面板文件行布局 | 状态标记（M/U/D）移至行尾；暂存/撤销/移出按钮默认隐藏，悬浮或选中行时显示
| 2026-08-26 | Git 提交 AbortSignal 修复 | 提交时不传 `push: false`，避免旧 runtime 把布尔值误当作 AbortSignal；需 rebuild runtime client bundle
| 2026-08-26 | Git 推送端到端 | Host `gitCommit` push 集成测试；无 upstream 时 `-u origin HEAD`；提交/推送成功 inline 提示；带 push 的 RPC 取消 30s 超时
| 2026-08-26 | Git 提交按钮 loading | 提交/推送等待时按钮组水波纹动画；等待期间不阻塞暂存/撤销等其它 Git 操作
| 2026-08-26 | Git 提交下拉修复 | 提交菜单改 portal 渲染，避免 loading 样式 `overflow:hidden` 裁切「提交并推送」选项
| 2026-08-26 | Git 提交 loading 输入框边框 | 等待反馈移至备注框外圈旋转高亮（tab 选中色）；按钮保持「提交」仅 disabled；Host 返回后才显示成功
| 2026-08-26 | Git 面板独立推送 | `host.gitPush` + 工作树 `ahead`/`pushAvailable`；暂存区空时可推送已提交 commit；分支行显示领先数
| 2026-08-26 | Git push Host 构建修复 | `pnpm dsh web` 加载 Host `lib/index.js`；改 apiproxy 源码后须 `pnpm run build:lib:host` 否则 `gitCommit` 忽略 `push`、仅本地 commit
| 2026-08-26 | Git 面板 minimap 点击跳转 | 点击红/绿标记或 minimap 轨道可定位到对应改动行；修正滚动比例与 marker 点击坐标
| 2026-08-26 | Git 面板 hunk 图标 tooltip | 差异预览 gutter「+」提示由「选入此块」改为「选入提交」 |
| 2026-08-26 | Git 提交区操作反馈 | 成功/失败提示贴对应按钮（提交 / 提交并推送 / 推送），成功 4s 自动消失；暂存/撤销/丢弃错误移至变更列表上方 |
| 2026-08-26 | Git 面板干净空态 | 移除列表区中央「没有要提交的更改」文案；干净仓库仍保留提交区与空的两段列表 |
| 2026-08-26 | Git 未跟踪目录展开为文件 | Host porcelain `--untracked-files=all`；资源管理器徽章上卷祖先文件夹；Git 面板列出目录内文件而非目录行 |
| 2026-08-26 | 文件树 listing 卡住后失败 | `watchPath` 仍走 HTTP SSE，多 Tab 占满六连接；浏览器改 WebSocket；listing 超时显示 **!** |
| 2026-08-26 | 编辑器外部改盘 | Agent/`watchPath` 改盘无确认框，已打开 Tab 一律自动 reload（含 dirty）；Git 撤销仍自动 reload |
| 2026-08-26 | Git 推送按钮 loading | 推送等待时沿用提交区边框高亮旋转动画，不再显示按钮内 spinner |
| 2026-08-27 | Git 面板「待提交」叠层 | 未暂存段不再被 flex 压矮；长列表把「待提交」顶到后面，整列滚动 |
| 2026-08-27 | Git 面板未推送行 | 「领先 N」改为「有 N 个提交尚未推送」；与 **推送** 同列放在分支名下方；无未推送时整行隐藏 |
| 2026-08-27 | Git 面板 Graph 段 | `host.gitLog` 只读 RPC；待提交下方可折叠 Graph：第一父提交主干 + 彩色侧枝弧线合入；merge 空心圆点；`--topo-order` |
| 2026-08-27 | Git Graph 彩虹竖线 | `git log --format` 记录后带换行，从第二条起 hash 对不上 parent，每条提交新开泳道；`parseGitLogOutput` trim 记录后线性历史回到一条主干 |
| 2026-08-27 | Git Graph 按 GitLens 复刻 | 节点到节点 overlay 弧；侧点落在弧上（控制点在外侧泳道）；侧道释放后复用换色；`origin/` 橙色胶囊；merge 空心加点 |
| 2026-08-27 | Git Graph 逐行贴字 | 每行说明按该行最右侧的点或穿过该行的线留 gutter，不再按整页最宽泳道对齐 |
| 2026-08-27 | Git Graph 分页加载 | 默认每页 50 条；列表滚到底部（IntersectionObserver）继续 `skip` 加载，直到 `hasMore` 为 false；全部加载完显示「已显示全部提交」 |
| 2026-08-27 | Git Graph 引用胶囊 | 胶囊收窄并省略长分支名；有引用时放在说明下一行靠右，不挡作者；悬停固定定位详情卡（完整引用、作者、时间、说明、正文、短 hash）；`gitLog` 增加 `%aI`/`%b` |
| 2026-08-27 | Git 面板 Changes 目录 | 操作列 Changes 与 Graph 同级可折叠；Changes 包住分支、提交区、两段变更列表，内部逻辑不变 |
| 2026-08-27 | Git 面板文件夹 chrome | CHANGES/GRAPH 全大写加粗；顶距收紧；Changes 打开时 Graph 钉底；Changes body 与 Graph 列表缩进 14px |
| 2026-08-27 | Git 推送 tooltip 被备注框遮住 | Tooltip 改包在 `pushButtonShell` 外，避免 `isolation` 把气泡压在提交备注框下面 |
| 2026-08-27 | Git 选入时提交按钮闪一下 | 选入/移出/撤销进行中不再 disabled 提交与推送；行内仍显示 spinner 并互斥其它行操作 |
| 2026-08-27 | Git Graph 单击提交看差异 | `host.gitCommitDiff`；右栏堆叠第一父提交文件差异（只读、可折叠）；与工作区行选中互斥 |
| 2026-08-27 | Git 提交确认框贴按钮 | 确认框带描边与阴影，固定定位在触发按钮右下角，不再居中盖住右栏预览 |
| 2026-08-27 | Git CHANGES 段头数量 | 与 GRAPH 一样在标题右侧显示未暂存加待提交行数（干净仓库为 0） |
| 2026-08-27 | Git 无 remote 推送文案 | 初始化后未配置远程时，提交并推送/推送显示「没有配置远程仓库地址」，不再截断 Git fatal |
| 2026-08-27 | Git 添加远程地址 | 无 remote 时分支下行提供入口；`host.gitAddRemote` 写入 `origin`；错误旁同一入口 |
| 2026-08-27 | Git 删除远程地址 | 已有 `origin` 时分支下行显示 URL 与删除；`host.gitRemoveRemote` 删除 `origin` |
| 2026-08-28 | Git 无提交不显示首次推送 | 未出生分支（无 HEAD）即使刚添加 origin 也不显示「尚未推送到远程」；`pushAvailable` 要求本地已有 commit |
| 2026-08-28 | Git 未提交时移出提交 | 无 HEAD 时 `git restore --staged` 报 `could not resolve HEAD`；整文件改走 `git rm --cached -f`，文件回到未跟踪且不改磁盘 |
| 2026-08-28 | Git 推送被拒绝文案 | 远程已有提交导致无法快进时，不再把截断的 `To https://…` 当成错误；显示「远程已有提交，无法快进推送」 |
| 2026-08-28 | Git 右栏不默认打开最新提交 | `gitLog` 成功后不再把 `selectedCommitHash` 设为 `commits[0]`；右栏只展示用户上次点开的文件或 Graph 提交 |
| 2026-08-28 | Git 切回 Tab 不闪 Graph/预览 | 已有 Graph 与右栏内容在重读时保持；`loading` 只用于首次加载或换选中项 |
| 2026-08-28 | 资源管理器空白选根与拖拽移动 | 点击文件树空白取消行选中，工具栏新建回到 Workspace 根；拖拽到目录或空白处走 `host.movePath` |
| 2026-08-28 | Git Graph 多文件提交默认折叠 | 点提交后右栏只渲染文件头；展开某一头才挂载该文件 `DiffPreviewContent`，避免几十份差异同时高亮卡死页面 |
| 2026-08-29 | 从最新 `origin/custom/main` 创建分支 `feat/v3` | V3 版本迭代线；基线 `c037bbd`（#72 Graph 提交差异默认折叠） |
| 2026-08-29 | V3 人类终端规格锁定 | `grill-with-docs` 拷问完成；更新 `CONTEXT.md`；新增 `docs/prd/terminal-v3.md`、`docs/adr/0005-human-terminal-host-rpc.md`、`docs/adr/0006-human-terminal-client-plugin.md` |
| 2026-08-29 | 发布人类终端 V3 Issue | 父 PRD [#73](https://github.com/NanGePlus/my-deepseek-harness/issues/73)；#74 `#D-global`；#75 Host terminal RPC；#76 app-shell 四段 Tab；#77–#80 `human-terminal` 四刀；#81 改盘刷新协调 |
| 2026-08-29 | Issue #75 Host terminal RPC | 分支 `issue/75-host-terminal-rpc`：`host.terminalProfiles/Spawn/Write/Resize/Kill/List/Stream`；Workspace 级 PTY 池 + SSE scrollback/title；集成测试 `api-proxy-terminal.spec.ts` |
| 2026-08-29 | Issue #76 工具箱四段 Tab | 分支 `issue/76-app-shell-terminal-tab`：`DetailsPanel` 扩为 **资源管理器 | Git | 终端 | 工具详情**；声明 `conversation.details.terminal` 槽位；Git Tab 文案对齐 PRD 为「Git」；浏览器快照 `tabs.expected.md` 更新 |
| 2026-08-29 | Issue #77 人类终端最小通路 | 分支 `issue/77-ui-terminal`：新包 `@deepseek-ai/dsh-client-ui-terminal`；`WorkspaceRuntime` 转发 `host.terminal*`；自动 spawn + xterm + 未绑定空态；浏览器快照 `terminal-default.expected.md`；`subprocess-local` 去除构造函数参数属性以修复 web e2e 源码加载 |
| 2026-08-29 | Issue #79 人类终端不可用 / 错误态 | 分支 `feat/issue-79-terminal-unavailable-errors`：终端不可用卡片 + 重试、inline 错误、spawn 中禁用 `+` |
| 2026-08-29 | Issue #80 切走持久 / 硬刷新重连 | 分支 `feat/issue-80-terminal-persist-reconnect`：切走 **终端** 段保持 SSE 不 Kill；硬刷新 `list` 恢复 Tab + scrollback 回放；Workspace 切换展示对应 Tab 集 |
| 2026-08-29 | Issue #81 改盘刷新协调 | 分支 `feat/issue-81-terminal-disk-refresh` 已合并 PR [#90](https://github.com/NanGePlus/my-deepseek-harness/pull/90)；`DetailsPanel` `segmentDiskRefreshEpoch` 协调 Explorer / Git 重读 |
| 2026-08-29 | 从最新 `origin/custom/main` 创建分支 `issue/74-d-global-human-terminal-design-close` | Issue [#74](https://github.com/NanGePlus/my-deepseek-harness/issues/74) `#D-global` 验收关闭；人类终端消费既有品牌板，不新增 §5 原语 |
| 2026-08-30 | 从最新 `origin/custom/main` 创建分支 `feat/v4` | V4 版本迭代线；基线 PR #91 merge commit `5ca6576365` |
| 2026-08-30 | V4 内嵌浏览器规格锁定 | `grill-with-docs` 拷问完成；更新 `CONTEXT.md`；新增 `docs/prd/browser-v4.md`、`docs/adr/0007-embedded-browser-host-playwright.md`、`docs/adr/0008-embedded-browser-client-and-tools.md` |
