# PRD：内嵌浏览器 V4

面向 DeepSeek Harness Web 人类开发者的内嵌浏览器：在工具箱中与资源管理器、Git面板、终端平级，对当前绑定 Workspace 提供 Web 预览与交互（多 Tab、导航顶栏、screencast 画布），交互对标 Cursor 内嵌浏览器顶栏与 Tab 栏；Agent 浏览器工具与人类 **共用同一 Host Playwright 实例**。

领域词汇见 [`CONTEXT.md`](../../CONTEXT.md)。架构决策见 [`docs/adr/0007-embedded-browser-host-playwright.md`](../adr/0007-embedded-browser-host-playwright.md)、[`docs/adr/0008-embedded-browser-client-and-tools.md`](../adr/0008-embedded-browser-client-and-tools.md)；壳层先例见 [`docs/adr/0002-file-editor-details-tab.md`](../adr/0002-file-editor-details-tab.md)。品牌视觉 Token 与原语见 [`docs/design/DESIGN.md`](../design/DESIGN.md)；本 PRD 只引用，不重写色板或字号表，V4 **不扩** DESIGN §5（与人类终端同策略）。资源管理器、Git 面板与人类终端分别以 [`docs/prd/file-editor-v1.md`](./file-editor-v1.md)、[`docs/prd/git-panel-v2.md`](./git-panel-v2.md)、[`docs/prd/terminal-v3.md`](./terminal-v3.md) 为准，本 PRD 不重写编辑界面、Git 面板或人类终端。

## 问题陈述

人类开发者在 dsh Web 里与 Agent 并排改代码时，已在工具箱内编辑文件、提交 Git、跑 Shell，但预览 `http://127.0.0.1:5173` 等 dev server 仍须切到 Cursor / 系统浏览器。Agent 若需「看页面、点按钮、填表单」，现有 `web_fetch` 只做 HTTP 抓取，无法执行 DOM 交互，也无法与人类看到同一登录态。用户需要在同一工具箱 column 内打开浏览器 Tab、保留页面状态，并在切换资源管理器 / Git / 终端 / 对话时不必重载 dev server；Agent 与人类应操作 **同一 Tab 同一 Cookie**，而非两套隔离浏览器。

## 解决方案

在现有工具箱 segmented Tab 增加与资源管理器、Git面板、终端、工具详情平级的 **浏览器** 段。选中后展示内嵌浏览器：段内浏览器 Tab 栏 + 导航顶栏 + 「显示窗口」说明。Playwright `BrowserContext` 与 Tab 状态按 **绑定 Workspace** 归属（同一 Workspace 下多个 dsh Session 共用）；profile 目录持久 Cookie。人类操作面是 Host 拉起的**有头 Chromium 窗口**（与 Agent 同一 Context），输入手感与系统浏览器一致。V4 支持多 Tab、`+` 新建、`×` 关闭、Tab 右键批量关闭；导航 `http://` / `https://` 任意可达 URL；顶栏 ← → ↻、地址栏、溢出菜单（Hard Reload、Copy URL、Zoom）、在外部浏览器打开。Agent 通过 `browser_*` 工具操作同一 Registry；人类手动操作默认不进 Session 日志，Agent 操作 model-visible。切走 **浏览器** 段只隐藏工具箱视图，不销毁 Host Context 与有头窗口；硬刷新后 Host Context 与 profile 仍在，Client 从 store 恢复 Tab 并再次唤起窗口。Session 切换守卫**仅**管 dirty 编辑器标签页，不因浏览器 Tab 阻断。V4 **不含** 截图菜单、清 Cookie/缓存/历史、Split、书签管理器、顶栏跳转终端快捷图标。

## 用户故事

仅 Web 端。序号在全文唯一递增。

US-1：作为 Web 开发者，我想在工具箱打开「浏览器」分段 Tab，以便在对话旁预览 Web 应用。

US-2：作为 Web 开发者，我想在「资源管理器 | Git面板 | 终端 | 浏览器 | 工具详情」五段之间切换且同时只显示一段，以便浏览器与既有段平级共存。

US-3：作为 Web 开发者，当我切走 **浏览器** 段时，我想只隐藏视图、不销毁 Host 页面，以便 dev server 预览不被打断。

US-4：作为 Web 开发者，我想拖宽工具箱，以便给浏览器 Tab 栏与导航更多水平空间。

US-5：作为 Web 开发者，我想让浏览器 Tab 与 Playwright Context 跟随当前 **绑定 Workspace**，以便同一 Workspace 下换 Session 仍看到同一套浏览器 Tab。

US-6：作为 Web 开发者，当我切换到绑定 Workspace **不同**的 Session 时，我想看到该 Workspace 的浏览器 Tab 集合，且原 Workspace 的页面仍在 Host 后台运行。

US-7：作为 Web 开发者，当我切换 Session 时，我想 **Session 切换守卫** 不因打开中的浏览器 Tab 拦住我。

US-8：作为 Web 开发者，当某 Workspace **首次进入浏览器段**且尚无 Tab 时，我想自动打开一个 `about:blank` Tab 且地址栏获焦，以便立即输入 URL。

US-9：作为 Web 开发者，我想通过 `+` 新建浏览器 Tab，以便并排预览多个 URL。

US-10：作为 Web 开发者，我想关闭某个浏览器 Tab（右键批量关闭或 `×`），以便释放 Tab 栏空间；至少保留 1 个 Tab。

US-11：作为 Web 开发者，我想在导航栏使用 ← → ↻ 与地址栏输入 URL，以便手动浏览。

US-12：作为 Web 开发者，我想导航到任意 `http://` / `https://` URL（含 localhost 与公网），以便预览 dev server 与文档站。

US-13：作为 Web 开发者，当我首次导航到非 localhost 域名时，我想看到 inline「正在访问外部站点」提示，不被 modal 阻断。

US-14：作为 Web 开发者，我想在溢出菜单使用 Hard Reload、Copy Current URL 与 Zoom，以便对标 Cursor 核心菜单能力。

US-15：作为 Web 开发者，我想用「在外部浏览器打开」把当前 Tab URL 交给系统浏览器。

US-16：作为 Web 开发者，当尚未绑定 Workspace 时，我想 **浏览器** 段可见但展示「无法使用浏览器」空态，以便与终端前提一致。

US-17：作为 Web 开发者，当 Host 无法启动 Playwright / Chromium 时，我想看到 **浏览器不可用** 卡片与「重试」。

US-18：作为 Web 开发者，当页面加载失败时，我想在导航栏下看到 inline 错误与重试，以便区分 DNS / 连接拒绝等问题。

US-19：作为 Web 开发者，当我硬刷新 dsh Web 时，我想 Host 上该 Workspace 的 Context 仍在，且 Tab 栏从 store 恢复并重连 screencast。

US-20：作为 Web 开发者，我想工具箱 Zoom 菜单不改变 Agent snapshot 的 viewport 语义；页面缩放使用有头 Chromium 自身能力。

US-21：作为 Web 开发者，我想有头窗口可按系统窗口方式调整大小，而不把工具箱内容区尺寸写成页面 viewport。

US-22：作为 Web 开发者，我想 Agent 调用 `browser_*` 工具后，对应有头窗口与 Tab 提到前台，以便人类看见并继续操作同一页。

US-23：作为 Web 开发者，我想我手动在浏览器里的导航 **不** 写入 Session 日志，以便对话区不被刷屏。

US-24：作为 Web 开发者，我想 Agent 的 `browser_snapshot` 在对话区可展开查看，以便调试 Agent 读到的页面结构。

US-25：作为 Web 开发者，我想明确 V4 **不做** 截图菜单、清 Cookie/缓存/历史、Split、书签管理器与顶栏终端快捷图标，以便范围清晰。

## UI 与设计要求

**UI 模式**：`spec-driven`。**UI 设计描述**为编码的唯一权威来源。禁止在本 PRD 要求设计稿、规划变体设计稿，或重写 / 扩展 `DESIGN.md` 的 Token 规格。

唯一端：`platform-id` = `web`（DeepSeek Harness Web）。

### 用户故事 ↔ 页面映射

| 用户故事编号 | 端 | page-id | 该页承担的故事范围 | UI 设计描述要点 |
| --- | --- | --- | --- | --- |
| US-1~US-4 | Web | app-shell | 打开浏览器、五段切换、切走不销毁、工具箱拖宽 | 三栏壳 + 工具箱五段 Tab |
| US-5~US-25 | Web | embedded-browser | Workspace 绑定、多 Tab、导航、有头窗口、空态/不可用、Zoom、Agent 共用 | Tab 栏 + 导航栏 + 显示窗口 |

- 无孤立故事：有 UI 的用户故事均已映射。
- 无孤立页面：`embedded-browser` 支撑 US-5~US-25；`app-shell` 为壳层（US-1~US-4）。
- 每个 `platform-id` 有且仅有一个 `app-shell`，且排在功能页之前。

### 状态策略

加载中 / 空 / 错误 / 禁用是同一页的状态变体，不是独立 UI 页。变体写在各页 UI 设计描述末尾，或复用 `DESIGN.md` §5。禁止为变体单独出设计稿。禁止用全屏遮罩挡住整个 dsh Web。

| 状态 | 处理方式 |
| --- | --- |
| 加载中 | 导航进行中内容区中央 24px spinner；↻ 同步转圈。唤起有头窗口期间可短暂 connecting。 |
| 空状态 | **未绑定 Workspace**：整页居中卡片，标题「无法使用浏览器」，说明「请先选择 Workspace 并开始会话。」，无 Tab 栏。**浏览器不可用**：卡片标题「浏览器不可用」，说明 Host 原因，主按钮「重试」；Tab 栏仍可见（若有 store 记录）。 |
| 错误 | 导航失败：导航栏下 12px `semantic-error` +「重试」；画布居中空态图标 +「无法加载此页」。不关闭 Tab。 |
| 禁用 | 未绑定：无 Tab 栏/导航。← → 在无历史时 disabled。最后一 Tab 隐藏 `×`、禁用「关闭 / 关闭全部」。 |

### 页面清单

按 `platform-id` 分组；每组第一条为 `app-shell`。

#### `app-shell`（Web 整体框架）

- **端 / 运行环境**：Web
- **page-id**：`app-shell`
- **页面标题**：Web 整体框架
- **主任务**：定义 dsh Web 三栏壳层与工具箱五段 Tab
- **覆盖的用户故事**：US-1~US-4
- **DESIGN 复用**：§5 导航（details 分段 Tab）、表面 `--dsw-alias-bg-base`
- **UI 设计描述**：继承现有 dsh Web 三栏。工具箱顶栏 segmented **从左到右**：「资源管理器」|「Git面板」|「终端」|「浏览器」|「工具详情」，同时只选中一段。视觉沿用现有工具箱 Tab（13px、选中底边强调）。选中「浏览器」时渲染 `embedded-browser`；切走只隐藏视图，不销毁 Host Context。壳层变体同 V3 终端 PRD。

#### `embedded-browser`（内嵌浏览器）

- **端 / 运行环境**：Web
- **page-id**：`embedded-browser`
- **页面标题**：内嵌浏览器
- **主任务**：在绑定 Workspace 上预览与交互 Web 页面（多 Tab、导航、有头窗口）
- **覆盖的用户故事**：US-5~US-25
- **DESIGN 复用**：§5 导航（段内 Tab 栏对齐终端/文件 Tab：32px、底边 2px 选中线、20×20 ×）；§5 图标按钮（← → ↻、外部打开、… 菜单 24×24 ghost）；§5 输入（地址栏）；§5 空状态、Loading；§2 `semantic-error` / `semantic-info`
- **UI 设计描述**：纵向 flex 三区。① **Tab 栏**（32px，水平滚动）：标题为 `document.title` 或 URL 主机名；`+` 24×24 ghost；`×` 20×20；右键菜单：关闭 / 关闭其他 / 关闭左侧 / 关闭右侧 / 关闭全部。② **导航栏**（~40px）：← → ↻ | 地址栏 flex 1（Enter 导航，聚焦 `semantic-info` 描边）| 外部打开 | … 下拉（Hard Reload、Copy Current URL、Zoom 行：− / 百分比 / + / 重置）。③ **提示条**（可选）：非 localhost 首次访问 inline info；导航错误 `semantic-error` + 重试。④ **本机窗口说明**（flex 1）：居中卡片「在本机浏览器窗口中查看」+ 说明人与 Agent 共用该窗口 + **显示窗口**。首次进入无 Tab：自动 `about:blank` + 地址栏 focus，并唤起有头窗口。Hard Reload / 导航 / Agent 操作把对应页提到前台。Zoom 比例按 workspaceId 持久化，不进 Session 日志。

### Agent 工具对话区展示

| 工具 | render intent | 展示 |
| --- | --- | --- |
| `browser_navigate` / `browser_tabs` | `generic` | 一行摘要（URL / Tab 动作） |
| `browser_click` / `browser_type` / `browser_scroll` / `browser_select_option` | `generic` | 一行摘要 |
| `browser_snapshot` | `terminal` | 可折叠 accessibility 树；超大 spill |

点击 Tool 行可跳转 **工具详情** 查看 spill 全文。

### DESIGN 合规自检

- [x] 未在 PRD 重写色板 / 字体 / Token（只引用 `DESIGN.md`）
- [x] 每页布局由 §5 通用原语组合而成
- [x] 导航形态与 §5 导航定义一致
- [x] 空状态、Loading 复用 §5
- [x] 未违反 §6 宜忌（无全屏遮罩挡整个 dsh Web）
- [x] spec-driven：全文无设计稿
- [x] V4 不扩展 DESIGN §5

**PRD 末尾摘要**

- 本计划 **UI 模式**：`spec-driven`
- **页面总数**：Web 2 页（含 1 个 `app-shell`）
- **待扩展 DESIGN §5** 项：无
- `docs/design/DESIGN.md`：已就绪，V4 不修改

## 实现决策

摘要 ADR-0007 / ADR-0008。

### Host 内嵌浏览器 RPC 契约

在 `packages/host/apiproxy` 扩展 **有类型的** `host.browser.*` RPC。Playwright `BrowserRegistry` 按 **workspaceId** 索引；profile 目录 `.sessions/browser-profiles/<workspaceId>/`。产品 Context 默认有头。建议操作：`list`（tabId、url、title、selected）、`createTab` / `closeTab` / `selectTab` / `showWindow`、`navigate` / `goBack` / `goForward` / `reload`（含 hard）、`snapshot`（accessibility tree）、`click` / `type` / `scroll` / `selectOption`。人类不经工具箱画布输入。须区分 **浏览器不可用** 与 **未绑定 Workspace**。关掉有头窗口后 Registry 丢掉死 Context；`createTab` 重建，`closeTab` 对已消失 Tab 成功，`showWindow` 走 `browser-tab-not-found` 以便按 store 恢复。

### tool-browser

新建 Agent 工具包，注册 `browser_navigate`、`browser_snapshot`、`browser_click`、`browser_type`、`browser_scroll`、`browser_select_option`、`browser_tabs`；共用 Host Registry。每次调用 model-visible 写入 Session 日志。

### ui-browser

新建 Client 插件 `@deepseek-ai/dsh-client-ui-browser`，槽位 `conversation.details.browser`；Tab store、导航顶栏、「显示窗口」、Client Zoom 持久化。切走段不关有头窗口；硬刷新 `list` + `showWindow`。

### 工具箱五段 Tab

`ui-conversation` 扩为「资源管理器 | Git面板 | 终端 | 浏览器 | 工具详情」，声明 `conversation.details.browser`。向 **浏览器** 段传入 `visible`（与 Git / 终端同模式）。

## 测试决策

只测外部行为，不测 Playwright 内部调用次数、JPEG 编码细节。

### Host 浏览器 RPC 集成 seam

断言：`createTab` 后 `list` 含 tab；`navigate` 后 title/url 更新；`snapshot` 返回树；`showWindow` 成功；`closeTab` 后 tab 消失；关掉 Context 后再 `createTab` 成功、`closeTab` 幂等、`showWindow` 报 tab-not-found；Workspace A/B Context 隔离；缺 Chromium 时 `browser-unavailable`；硬刷新场景 Host Context 在 Client 断开期间仍存活。

### ui-browser 组件 seam

Fake Host API 驱动，断言：首次进入 `about:blank` 并 `showWindow`；`+` 新建 Tab；关闭与最后一 Tab 规则；未绑定空态；不可用 + 重试；切走 `visible=false` 不关闭 Host Tab；导航失败 inline 错误。

### Web browser snapshot seam

工具箱 segmented Tab 可见五段标签；选中 **浏览器** 后的默认态快照。人类可见文案或 Tab 标签变更须更新快照。

### tool-browser seam

各工具调用写入 Session 日志；snapshot spill 阈值；与 Registry 共用 tabId。

## 范围外

V4 不做（Not now）：

- Take Screenshot / Capture Area Screenshot（人类菜单与 Agent 写入 Session）
- Clear Browsing History / Cookies / Cache
- Split 视图、独立窗口拖拽、书签管理器
- 顶栏跳转 **终端** 快捷图标
- `file://` 与自定义协议
- Client iframe 替代 screencast
- Agent 与人类操作的 global lock
- 按 dsh Session 隔离浏览器池（固定按 Workspace）
- 自动猜测 dev server 端口打开 URL
- 捆绑 Chromium 进 npm install
## 补充说明

依赖：V1–V3 工具箱能力、Workspace 绑定、Session 切换守卫已存在。Host 须 `npx playwright install chromium`（见 ADR-0007）。

风险：有头窗口出现在跑 Host 的机器上，远程打开 dsh Web 时操作者看不到该窗。共用实例下 Agent 与人类并发可能产生竞态；产品决策为不加锁。Playwright 以 OS 用户权限运行，用户须自知浏览行为边界。

开放问题：无。实现切片见 GitHub 父 PRD Issue #92（`NanGePlus/my-deepseek-harness`）。文案与状态机以本 PRD 与 `CONTEXT.md` 为准。
