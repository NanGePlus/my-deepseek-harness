# PRD：人类终端 V3

面向 DeepSeek Harness Web 人类开发者的人类终端：在工具箱中与资源管理器、Git 平级，对当前绑定 Workspace 提供交互式 Shell（多 Tab、Shell 选择、Kill），交互对标 Cursor 集成终端的 Tab 栏与 xterm 区，但不复制其底部面板布局。

领域词汇见 [`CONTEXT.md`](../../CONTEXT.md)。架构决策见 [`docs/adr/0005-human-terminal-host-rpc.md`](../adr/0005-human-terminal-host-rpc.md)、[`docs/adr/0006-human-terminal-client-plugin.md`](../adr/0006-human-terminal-client-plugin.md)；壳层先例见 [`docs/adr/0002-file-editor-details-tab.md`](../adr/0002-file-editor-details-tab.md)。品牌视觉 Token 与原语见 [`docs/design/DESIGN.md`](../design/DESIGN.md)；本 PRD 只引用，不重写色板或字号表，V3 **不扩** DESIGN §5（与 Git 面板同策略）。资源管理器与 Git 行为分别以 [`docs/prd/file-editor-v1.md`](./file-editor-v1.md)、[`docs/prd/git-panel-v2.md`](./git-panel-v2.md) 为准，本 PRD 不重写编辑界面或 Git 面板。

## 问题陈述

人类开发者在 dsh Web 里与 Agent 并排改代码时，已在工具箱内编辑文件、提交 Git，但跑 `pnpm dsh web`、执行构建或临时 shell 命令仍须切到 Cursor / 系统终端。Agent 侧 `terminal_*` 工具面向模型、行级交互，不是人类全交互 PTY；且其 Session 沙箱与所有权模型不适合作为集成终端。用户需要在同一工具箱 column 内开 Shell、保留长跑进程，并在切换资源管理器 / Git / 对话时不必 Kill dev server。

## 解决方案

在现有工具箱 segmented Tab 增加与资源管理器、Git、工具详情平级的 **终端** 段。选中后展示人类终端：段内终端 Tab 栏 + xterm 画布。PTY 与 Tab 状态按 **绑定 Workspace** 归属（同一 Workspace 下多个 dsh Session 共用）；新建 Tab 初始 cwd 为 Workspace 根，之后可在 Host 可访问范围内自由 `cd`。V3 支持多 Tab、`+` 下拉选择 Shell（bash / zsh 等 Host 可用 profile，默认 login shell）、Tab 级 Kill；**不含** Split、Debug Terminal、Problems / Output 等底部面板能力。切走 **终端** 段只隐藏视图，不终止 PTY；硬刷新后 Host PTY 持久，Client 自动重连。终端内改盘后：**离开终端段**或**进入资源管理器 / Git 段**时按磁盘重读 Git 徽章与 Git 列表；已打开文件走**外部变更**；停在终端段期间不保证资源管理器 / Git 实时刷新。Session 切换守卫**仅**管 dirty 编辑器标签页，不因运行中 PTY 阻断。人类终端与 Agent `ctx.terminals` **完全分离**。

## 用户故事

仅 Web 端。序号在全文唯一递增。

US-1：作为 Web 开发者，我想在工具箱打开「终端」分段 Tab，以便在对话旁运行 Shell 命令。

US-2：作为 Web 开发者，我想在「资源管理器 | Git | 终端 | 工具详情」四段之间切换且同时只显示一段，以便终端与既有段平级共存。

US-3：作为 Web 开发者，当我切走 **终端** 段时，我想只隐藏视图、不 Kill PTY，以便 dev server 等进程继续跑。

US-4：作为 Web 开发者，我想拖宽工具箱，以便给 xterm 更多水平空间。

US-5：作为 Web 开发者，我想让人类终端 Tab 与 PTY 跟随当前 **绑定 Workspace**，以便同一 Workspace 下换 Session 仍看到同一套终端。

US-6：作为 Web 开发者，当我切换到绑定 Workspace **不同**的 Session 时，我想看到该 Workspace 的终端 Tab 集合，且原 Workspace 的 PTY 仍在 Host 后台运行。

US-7：作为 Web 开发者，当我切换 Session 时，我想 **Session 切换守卫** 不因运行中 PTY 拦住我，以便换会话不必先 Kill dev server。

US-8：作为 Web 开发者，当某 Workspace **首次进入终端段**且尚无 Tab 时，我想自动 spawn 一个默认 Shell Tab，以便点开就能输入。

US-9：作为 Web 开发者，我想通过 `+` 新建终端 Tab，并在下拉中显式选择 bash / zsh 等 Shell；未选时用 Host **login shell**，以便控制 Shell 类型。

US-10：作为 Web 开发者，我想 Kill 某个终端 Tab 以终止对应 PTY，以便释放资源。

US-11：作为 Web 开发者，新建 Tab 时我想 cwd 落在 **绑定 Workspace 根**，之后可 `cd` 到 Host 可访问任意路径，以便与文件树根一致且不被人工 chroot。

US-12：作为 Web 开发者，我想在 xterm 里正常键盘输入、退格、粘贴与终端 resize，以便交互式 Shell 可用。

US-13：作为 Web 开发者，我想终端 Tab 标题显示前台进程短名（如 `node`），检测不到时显示 Shell 名（如 `zsh`），以便多 Tab 可区分。

US-14：作为 Web 开发者，当尚未绑定 Workspace 时，我想 **终端** 段可见但展示说明空态、不可 spawn，以便与资源管理器前提一致。

US-15：作为 Web 开发者，当 Host 无法 spawn PTY 时，我想看到 **终端不可用** 说明与「重试」，且 Tab 不隐藏，以便区分环境問題。

US-16：作为 Web 开发者，当我在终端里改动了磁盘文件后，我想在 **离开终端段**或**进入资源管理器 / Git 段**时，Git 徽章与 Git 列表按磁盘刷新，以便与 Git 面板刷新策略一致。

US-17：作为 Web 开发者，当终端改动了已打开文件的磁盘内容时，我想资源管理器走现有 **外部变更** 对话框，以便不静默覆盖编辑缓冲。

US-18：作为 Web 开发者，当我硬刷新浏览器时，我想 Host 上该 Workspace 的 PTY 仍在，且页面重载后自动重连并回放有界 scrollback，以便不必重启 dev server。

US-19：作为 Web 开发者，我想人类终端跟随 Harness light/dark，以便 xterm 主题与对话区一致。

US-20：作为 Web 开发者，我想明确 V3 **不做** 终端 Split、JavaScript Debug Terminal 与 Problems / Output 面板，以便范围清晰。

US-21：作为 Web 开发者，我想人类终端操作 **不** 写入 Session 日志、也不出现在 Agent `terminal_*` 工具列表里，以便与模型面分离。

## UI 与设计要求

**UI 模式**：`spec-driven`。**UI 设计描述**为编码的唯一权威来源。禁止在本 PRD 要求设计稿、规划变体设计稿，或重写 / 扩展 `DESIGN.md` 的 Token 规格。

唯一端：`platform-id` = `web`（DeepSeek Harness Web）。

### 用户故事 ↔ 页面映射

| 用户故事编号 | 端 | page-id | 该页承担的故事范围 | UI 设计描述要点 |
| --- | --- | --- | --- | --- |
| US-1~US-4 | Web | app-shell | 打开终端、四段切换、切走不 Kill、工具箱拖宽 | 三栏壳 + 工具箱「资源管理器 \| Git \| 终端 \| 工具详情」 |
| US-5~US-21 | Web | human-terminal | Workspace 绑定、多 Tab、Shell 下拉、Kill、xterm、空态/不可用、刷新、重连 | 段内 Tab 栏 + xterm 全高填充 |

- 无孤立故事：有 UI 的用户故事均已映射。
- 无孤立页面：`human-terminal` 支撑 US-5~US-21；`app-shell` 为壳层（US-1~US-4）。
- 每个 `platform-id` 有且仅有一个 `app-shell`，且排在功能页之前。

### 状态策略

加载中 / 空 / 错误 / 禁用是同一页的状态变体，不是独立 UI 页。变体写在各页 UI 设计描述末尾，或复用 `DESIGN.md` §5。禁止为变体单独出设计稿。禁止用全屏遮罩挡住整个 dsh Web。

| 状态 | 处理方式 |
| --- | --- |
| 加载中 | 复用 DESIGN §5 Loading。首次 spawn / 重连 SSE：xterm 区居中 24px spinner + 12px `label-secondary`「连接中…」。Tab 标题待 Host 推送前可显示 Shell 名。 |
| 空状态 | 复用 DESIGN §5 空状态。**未绑定 Workspace**：整页居中 overlay 卡片，48px outline，标题「无法使用终端」，说明「请先选择 Workspace 并开始会话。」，无 CTA。**终端不可用**：同样卡片，标题「终端不可用」，说明展示 Host 原因，主按钮「重试」。 |
| 错误 | spawn / write / 重连失败：Tab 下方或 xterm 区顶 12px `semantic-error` 文案 + 可选「重试」。不 Kill 其它仍存活 Tab。 |
| 禁用 | 未绑定 Workspace：`+` 与 Tab 栏禁用或不可见（仅空态）。Spawn 进行中：`+` 禁用。 |

### 页面清单

按 `platform-id` 分组；每组第一条为 `app-shell`。

#### `app-shell`（Web 整体框架）

- **端 / 运行环境**：Web
- **page-id**：`app-shell`
- **页面标题**：Web 整体框架
- **主任务**：定义 dsh Web 三栏壳层与工具箱四段 Tab，不承载具体 Shell 任务
- **覆盖的用户故事**：US-1~US-4
- **DESIGN 复用**：§5 导航（details 分段 Tab）、表面 `--dsw-alias-bg-base`
- **UI 设计描述**：继承现有 dsh Web 三栏，本功能不改左侧 Session/Workspace 列表、不改中栏对话。viewport 分区：左栏 sidebar 既有宽度与折叠；中栏 conversation 弹性填充；右栏工具箱可拖宽，背景 `--dsw-alias-bg-base`。工具箱顶栏为水平 segmented，**从左到右**：「资源管理器」|「Git」|「终端」|「工具详情」，同时只选中一段。视觉沿用现有工具箱 Tab（与对话区「对话 / 轨迹」同构：左对齐、13px、选中底边强调），Token 引用 DESIGN §5 导航。未选中文字 `label-secondary`。顶栏下方为内容区，flex 填满工具箱剩余高度，无额外页边距（由子页自管）。选中「终端」时内容区渲染 `human-terminal`；切走 **终端** 只隐藏 `human-terminal` 视图，不 Kill Host PTY。壳层变体：无 Session 时工具箱可按现有逻辑收起；设置/登录等既有全屏页脱离本壳。无独立空/错态（由内容区子页承担）。

#### `human-terminal`（人类终端）

- **端 / 运行环境**：Web
- **page-id**：`human-terminal`
- **页面标题**：人类终端
- **主任务**：在绑定 Workspace 上运行交互式 Shell（多 Tab、Shell 选择、Kill）
- **覆盖的用户故事**：US-5~US-21
- **DESIGN 复用**：§5 导航（段内 Tab 栏对齐文件编辑器文件 Tab 栏：高 32px、选中底边 2px `editor-tab-active-line`、ghost 关闭/Kill 28×28）；§5 图标按钮（`+`、Kill 垃圾桶 24×24 ghost）；§5 空状态、Loading；§2 画布 `--dsw-alias-markdown-code-block`；§3 `--ds-font-family-code` 13px/20px（xterm 字体与行高）
- **UI 设计描述**：继承 `web` app-shell，工具箱 segmented Tab 选中「终端」；本页只描述工具箱内容区。内容区纵向 flex：① **终端 Tab 栏**（高 32px，水平滚动）：每 Tab 显示 Host 推送的标题（进程短名或 Shell 名），最大宽度截断省略；选中 Tab 底边 2px `editor-tab-active-line`；Tab 内右侧 28×28 ghost「关闭/Kill」图标（垃圾桶，aria「终止终端」）。栏右：**`+`** 24×24 ghost，点击展开下拉（bash、zsh 等 Host `profiles`；底部无 Split 项）。② **xterm 画布**（flex 1，min-height 0，padding 0）：背景 `--dsw-alias-markdown-code-block`，字体 `--ds-font-family-code` 13px/20px，主题随 Harness light/dark 切换。xterm 占满剩余宽高；resize 时向 Host 发送 cols/rows。首次进入且无 Tab：自动 spawn 默认 Shell（见 US-8）并显示加载变体直至 SSE 就绪。空态变体见状态策略。**未绑定 Workspace** 时不渲染 Tab 栏与 xterm，仅空态卡片。**终端不可用** 时保留 Tab 栏结构或仅空态（若从未 spawn 成功），主区空态 + 重试。Kill 当前选中 Tab 后：若仍有 Tab 则选中相邻 Tab；若 Kill 尽则下次进入再自动 spawn（同 US-8）。V3 **无** 分屏手柄、无 Debug Terminal 菜单项。硬刷新后：Client `list` 恢复 Tab 栏，逐 Tab 重连 SSE，xterm 回放 Host scrollback 快照后接 live 输出。

### DESIGN 合规自检

- [x] 未在 PRD 重写色板 / 字体 / Token（只引用 `DESIGN.md`）
- [x] 每页布局由 §5 通用原语组合而成
- [x] 导航形态与 §5 导航定义一致（工具箱 segmented Tab + 段内 Tab 栏）
- [x] 空状态、Loading 复用 §5
- [x] 未违反 §6 宜忌（无第二套主题、无全屏遮罩、xterm 用代码字体）
- [x] 每页均有 UI 设计描述，覆盖框架 / 层级 / 组件 / 交互 / 变体
- [x] `web` 已有 `app-shell`，且壳层描述先于功能页
- [x] spec-driven：全文无设计稿
- [x] 非受限运行时：DESIGN §3 字体实现约束不适用（纯 Web）

**PRD 末尾摘要**

- 本计划 **UI 模式**：`spec-driven`
- **页面总数**：Web 2 页（含 1 个 `app-shell`）
- **待扩展 DESIGN §5** 项：无（消费既有品牌板，与 Git 面板同策略）
- `docs/design/DESIGN.md`：已就绪，V3 不修改

## 实现决策

摘要 ADR-0005 / ADR-0006；定位词供下游 `/to-issues`、`/tdd` 逐字引用。

### Host 人类终端 RPC 契约

在现有 Host API 上扩展 **有类型的** `host.terminal.*` RPC，Client 只消费 RPC、不直接接触 `node-pty`。PTY 注册表按 **workspaceId** 索引；**不**经过 `ctx.terminals` Agent 服务。建议操作与语义：`profiles`（可用 Shell 列表 + login shell 默认）、`spawn`（workspaceId、profile、cwd 默认 Workspace 根）、`write`（stdin 字节/文本）、`resize`（cols/rows）、`kill`、`list`（存活 session id、title、profile）、`stream`（SSE：增量输出、scrollback 快照、title 元数据、truncated 标记）。Host 与 Client 双侧有界 scrollback。Spawn 与 I/O 以 **OS 用户**权限运行，不进 Agent 沙箱。须能区分 **终端不可用**（spawn 失败）与 **未绑定 Workspace**（Client 侧不发起 spawn）。

### ui-terminal

新建 Client 插件包：段内 Tab 栏、`+` 下拉、xterm.js 画布、空态/不可用/重连。经槽位 `conversation.details.terminal` 注入。store 按 **workspaceId** 持久 Tab 与选中项，不写入 Session 日志。切走 **终端** 段隐藏 xterm、保持 SSE 订阅或按需暂停（实现选择须保证切回不丢 live 输出）；不得 Kill Host PTY。硬刷新后 `list` + 重连 + scrollback 回放。

### 工具箱四段 Tab

`ui-conversation` 将工具箱 segmented Tab 扩为「资源管理器 | Git | 终端 | 工具详情」，声明 `conversation.details.terminal` 槽位。ADR-0002「人类工具进工具箱、不新开第四栏」仍然成立。同时只显示一段。复用右栏拖宽。向 **终端** 段传入 `visible`（与 Git / 资源管理器同模式）。

### 改盘刷新协调

终端改盘后不实时刷新资源管理器 / Git。`ui-conversation` 在离开 **终端** 段或进入资源管理器 / Git 段时触发既有 `notifyDiskPathsChanged` / 重读 Git 徽章路径（与 Git PRD 停在 Git Tab 不实时监视对称）。已打开文件的外部变更仍由 `ui-file-editor` 处理。

## 测试决策

只测外部行为，不测 xterm 内部 DOM、node-pty 调用次数、主题 HEX。

### Host 人类终端 RPC 集成 seam

在 Host API 测试先例上断言：`spawn` 后 `list` 含 session；SSE 收到输出增量；`write` 后 PTY 有响应；`kill` 后 session 消失；`profiles` 含 bash/zsh（或平台等价）；scrollback 超界返回 `truncated`；title 元数据随前台进程变化（可用 fixture 进程）；Workspace A/B 的 session 隔离；硬刷新场景下 Host session 在 Client 断开期间仍存活。不测 Agent `ctx.terminals`。

### ui-terminal 组件 seam

用 Fake Host API 驱动 `ui-terminal`，断言：首次进入自动 spawn；`+` 下拉选 Shell 新建 Tab；Kill 移除 Tab；未绑定 Workspace 空态；终端不可用 + 重试；切走 `visible=false` 不调用 kill；Tab 标题渲染 Host 推送的 title。不断言 xterm 内部 className。

### Web browser snapshot seam

在现有 Web 浏览器快照车道增加组装场景：工具箱 segmented Tab 可见「资源管理器 | Git | 终端 | 工具详情」；选中 **终端** 后的默认态（由夹具决定：已 spawn 一行 prompt 或未绑定空态）。断言规范化 DOM/文案快照。人类可见文案或 Tab 标签变更须更新该快照。

## 范围外

V3 不做下列事项（Not now）：

- 终端 Split（水平/垂直）、JavaScript Debug Terminal
- Problems / Output / Debug Console / Ports 底部面板
- 复用 Agent `ctx.terminals` 或把人类输入写入 Session 日志
- Agent Session 沙箱包裹人类 PTY
- 按 dsh Session 隔离终端池（V3 固定按 Workspace）
- Session 切换守卫因运行中 PTY 阻断
- 在资源管理器选中目录上「在此打开终端」（继承 cwd 的 `+` 变体）
- 终端内改盘的实时 `watchPath` 刷新（V3 仅切换段触发）
- 第四栏、把 Shell 暴露为任意 argv RPC
- WebSocket 第二传输栈（V3 用 SSE + RPC，见 ADR-0005）

## 补充说明

依赖：V1 工具箱与资源管理器、V2 Git 面板、Host `watchPath` 与 Workspace 绑定已存在；Session 切换守卫仍只处理 dirty 编辑缓冲。

风险：xterm + SSE 高频输出可能影响工具箱性能；须有 Host/Client scrollback 上限。人类终端全 Host 权限，用户须自知 Shell 能力边界；与 Agent 沙箱分离是有意产品决策。

开放问题：无。文案、空态互斥与刷新规则以本 PRD 与 `CONTEXT.md` 为准。
