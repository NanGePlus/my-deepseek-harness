# PRD：桌面壳 V5

面向 DeepSeek Harness 人类开发者的 **桌面壳**：将现有 Web GUI（`apps/web` SPA + 工具箱五段）包装为可安装的 macOS / Windows 桌面 App，与 **浏览器交付**（`dsh web`）并存、**功能对等**；用户任选入口。V5 **不重写** 资源管理器、Git 面板、人类终端或 Agent 对话的业务语义，只新增交付层（Electron 壳、IPC carrier、标准壳 chrome）与桌面路径下的 **面板内 WebView** 浏览器人类操作面。

领域词汇见 [`CONTEXT.md`](../../CONTEXT.md)（**桌面壳**、**浏览器交付**、**功能对等**、**标准壳**、**单实例**、**关闭即退出**、**退出守卫**、**面板内 WebView** 等）。架构决策见 [`docs/adr/0009-desktop-shell-electron-delivery.md`](../adr/0009-desktop-shell-electron-delivery.md)、[`docs/adr/0010-desktop-browser-electron-cdp.md`](../adr/0010-desktop-browser-electron-cdp.md)；内嵌浏览器 RPC 与 Agent 工具仍见 ADR-0007 / ADR-0008。浏览器交付规格见 [`docs/prd/browser-v4.md`](./browser-v4.md)；V1–V3 工具箱能力见各版 PRD。品牌视觉 Token 与原语见 [`docs/design/DESIGN.md`](../design/DESIGN.md)；本 PRD 只引用，不重写色板或字号表，V5 **不扩** DESIGN §5（壳层原生菜单 / 窗口 chrome 走平台 HIG / Fluent，不写进 DESIGN.md）。

## 问题陈述

人类开发者已在 `dsh web` 中获得完整的 Agent 对话 + 工具箱五段（资源管理器、Git 面板、终端、浏览器、工具详情），但须先开终端跑 `pnpm dsh web`、再在系统浏览器访问 loopback URL，体验不像「一个 App」。有头 Chromium 浏览器窗口与 Web 窗口分离，预览 dev server 时须在多个 OS 窗口间切换。用户希望 **双击图标** 即可在本机获得与 Web 相同的能力；桌面 App 内浏览器预览应嵌入工具箱矩形，而非再弹独立 Chromium 窗口。Agent 与人类仍须共用同一浏览器 Tab 与 Cookie。浏览器交付须继续可用，供远程 / 习惯 Web 的用户选用。

## 解决方案

新增 **桌面壳** 交付：Electron App（`apps/desktop`）在 Main 进程 **一体启动** dsh Host（`desktop` profile + `@deepseek-ai/dsh-desktop-app` bundle，无 webserver），Renderer 加载与 `apps/web` **同一 SPA**，RPC 经 **统一 IPC carrier** 连 Main。V5 首版交付 **macOS + Windows**（`.dmg` / `.exe`），**标准壳**：原生主窗口、Dock / Taskbar 图标、应用菜单（About / Quit / Settings 入口）、窗口尺寸与位置持久化。**单实例**；**关闭即退出** 并停止 Host；存在 dirty 编辑器 Tab 时 **退出守卫** 与 Session 切换守卫对齐。工具箱 **浏览器** 段在桌面路径使用 **面板内 WebView**（Main `BrowserView` + bounds 同步 + Playwright `connectOverCDP`），移除 Web 路径的「显示窗口」主流程；Tab 栏 / 导航顶栏 / Agent `browser_*` 契约不变。安装包 **捆绑 Playwright Chromium**，用户无需 `playwright install`。开发者可选 **外挂 Host** 连接本机已运行的 `dsh web`；日常开发用 `pnpm run dev:desktop` 与 `dsh desktop`。

## 用户故事

序号在全文唯一递增。端列 `desktop` 表示桌面壳交付（macOS 与 Windows 共用故事，平台差异在 UI 描述中注明）。

US-1：作为开发者，我想从 macOS `.dmg` 或 Windows 安装包装并启动桌面 App，以便无需手动 `dsh web` 即可使用 Harness。

US-2：作为开发者，我想双击图标后 App **一体启动** Host 与 GUI，以便本机开箱即用。

US-3：作为开发者，我想桌面壳与 `dsh web` **功能对等**（五段工具箱、Host RPC、Session / Workspace 规则相同），以便任选入口不丢能力。

US-4：作为开发者，当 App 已在运行时再次点击 Dock / Taskbar 图标，我想 **聚焦已有主窗口** 而非再开一套 Host，以便符合 **单实例**。

US-5：作为开发者，我想关闭主窗口或菜单 **Quit** 时 App 退出并 **停止 Host**，以便不在后台残留 PTY / 浏览器进程。

US-6：作为开发者，当存在 **dirty 编辑器标签页** 时关窗或 Quit，我想须先保存 / 丢弃 / 取消退出，以便不静默丢失编辑缓冲（**退出守卫**）。

US-7：作为开发者，我想 **退出守卫** 不因运行中终端 PTY 或打开中浏览器 Tab 阻断，以便与 Session 切换守卫对称。

US-8：作为开发者，我想通过应用菜单打开 About、Settings（进入既有设置 UI）与 Quit，以便符合桌面 App 惯例（**标准壳**）。

US-9：作为开发者，我想 App 记住上次窗口尺寸与位置并在下次启动恢复，以便减少布局调整（**标准壳**）。

US-10：作为开发者，我想在 Dock（macOS）或 Taskbar（Windows）看到 App 图标，以便快速唤起。

US-11：作为开发者，我想在桌面 App 内使用与 Web 相同的三栏布局与会话 / 工具箱交互，以便学习成本为零。

US-12：作为开发者，我想在桌面 **浏览器** 段内直接看到网页内容（**面板内 WebView**），而非弹出独立 Chromium OS 窗口，以便预览与 Agent 操作同屏。

US-13：作为开发者，我想桌面浏览器仍支持多 Tab、导航顶栏、溢出菜单与 Workspace 级 Tab 持久化，以便与 [`browser-v4.md`](./browser-v4.md) 行为一致（除人类操作面载体外）。

US-14：作为开发者，我想 Agent `browser_*` 工具在桌面 App 内与人类操作 **同一浏览器实例**，以便 Cookie / DOM 共用。

US-15：作为开发者，安装桌面 App 后 **无需** 单独执行 `playwright install chromium` 即可使用浏览器段，以便离线开箱可用。

US-16：作为开发者，我想继续使用 `dsh web` 浏览器交付且行为不受 V5 破坏，以便远程或偏好 Web 时仍可用。

US-17：作为开发者，我想在开发时通过 `pnpm run dev:desktop` 或 `dsh desktop` 启动壳 + Vite HMR，以便迭代桌面与 SPA。

US-18：作为开发者，我想可选 **外挂 Host** 连接本机已运行的 `dsh web` 调试，以便分离 GUI 与 Host 联调（非默认用户路径）。

US-19：作为开发者，我想 Session 切换时 **Session 切换守卫** 仍仅因 dirty 编辑器阻断，以便与 V1 一致。

US-20：作为开发者，我想明确 V5 **不做** Linux 桌面、自动更新、系统协议唤起（`dsh://` 打开项目）、系统通知、多窗口与远程 Host 一体启动，以便范围清晰。

## UI 与设计要求

**UI 模式**：`spec-driven`。**UI 设计描述**为编码的唯一权威来源。禁止在本 PRD 要求设计稿、规划变体设计稿，或重写 / 扩展 `DESIGN.md` 的 Token 规格。SPA 内容区（对话、工具箱五段）沿用现有 Web 实现与 [`DESIGN.md`](../design/DESIGN.md)；本 PRD 只描述 **桌面壳层** 与 **桌面浏览器 occupant** 相对 Web 的差异。

唯一端：`platform-id` = `desktop`（V5 含 macOS 与 Windows；壳层菜单与窗口控件遵循各平台原生规范，SPA 内部不分叉）。

### 用户故事 ↔ 页面映射

| 用户故事编号 | 端 | page-id | 该页承担的故事范围 | UI 设计描述要点 |
| --- | --- | --- | --- | --- |
| US-1~US-11, US-16~US-20 | desktop | app-shell | 安装启动、单实例、退出、菜单、窗口持久化、SPA 壳、功能对等 | 原生窗口 + 内嵌 SPA 三栏 |
| US-12~US-15 | desktop | embedded-browser | 面板内 WebView、Tab/导航、Agent 共用、捆绑 Chromium | BrowserView occupant，无「显示窗口」 |

- 无孤立故事：有 UI 的用户故事均已映射。
- 无孤立页面：`embedded-browser` 支撑 US-12~US-15；`app-shell` 支撑其余桌面壳故事。
- 每个 `platform-id` 有且仅有一个 `app-shell`，且排在功能页之前。

### 状态策略

加载中 / 空 / 错误 / 禁用是同一页的状态变体，不是独立 UI 页。变体写在各页 UI 设计描述末尾，或复用 `DESIGN.md` §5。禁止为变体单独出设计稿。禁止用全屏原生遮罩挡住整个 SPA（退出守卫使用既有编辑器 dirty 对话框模式）。

| 状态 | 处理方式 |
| --- | --- |
| 加载中 | **app-shell**：Host boot 期间 SPA 显示既有 loader（`AppWebEntry` 启动 settle）；IPC 未连接时 connection 层 connecting。**embedded-browser**：导航进行中 occupant 内 24px spinner；↻ 同步转圈。BrowserView attach 前 occupant 可显示「正在准备浏览器…」inline 文案。 |
| 空状态 | **embedded-browser** 未绑定 Workspace：同 [`browser-v4.md`](./browser-v4.md) 整页空态「无法使用浏览器」。**浏览器不可用**：卡片 + Host 原因 +「重试」；Tab 栏仍可见（若有 store）。**app-shell** 无单独空态页；Host 启动失败时 SPA 内 loud error（沿用 boot 失败报告）。 |
| 错误 | **embedded-browser** 导航失败：同 V4（导航栏下 `semantic-error` + 重试；occupant 内「无法加载此页」）。**app-shell**：IPC / Host 致命错误在 SPA boot 层展示，不 silently 退出。 |
| 禁用 | **退出守卫** 进行中：Quit / 关窗被 dirty 对话框阻断。**embedded-browser**：未绑定 / 不可用 / 无历史 ← → disabled / 最后一 Tab 规则同 V4。 |
| 上传 / 提交中 | 不适用全局上传；Git 提交、Agent 运行等沿用 Web 各段既有态。 |

### 页面清单

按 `platform-id` 分组；每组第一条为 `app-shell`。

#### `app-shell`（桌面整体框架）

- **端 / 运行环境**：desktop（macOS + Windows）
- **page-id**：`app-shell`
- **页面标题**：桌面整体框架
- **主任务**：定义原生桌面窗口壳层 + 内嵌 dsh Web SPA 视口
- **覆盖的用户故事**：US-1~US-11、US-16~US-20
- **DESIGN 复用**：SPA 内部沿用 Web 三栏与工具箱 §5 导航；壳层原生菜单 / 标题栏 **不**引用 DESIGN §5（平台原生）
- **UI 设计描述**：
  1. **原生窗口**：单主窗口；macOS 使用标准标题栏 + 交通灯（**关闭即退出**，不隐藏到 Dock 驻留 Host）；Windows 使用可调整大小边框 + 标题栏 ✕（同义退出）。窗口最小尺寸须容纳 Web 三栏布局（具体像素在实现 Issue 中取自现有 Web 断点，PRD 不写死数值）。
  2. **Dock / Taskbar**：安装后显示 App 图标；**单实例**下二次启动聚焦本窗口（macOS `activate` / Windows 聚焦已有实例）。
  3. **应用菜单（标准壳）**：macOS 菜单栏 / Windows 应用菜单：**About**（显示版本与简短说明）、**Settings**（聚焦 SPA 内既有设置入口，不新建独立设置窗口规格）、**Quit**（同 **关闭即退出**）。不含自动更新、最近文件、协议唤起菜单项（V5 范围外）。
  4. **内容视口**：窗口客户区内 100% 嵌入现有 dsh Web SPA（Sidebar + 对话 + 工具箱），视觉与 `dsh web` 一致；不另做桌面专属配色。工具箱五段 Tab 文案与顺序不变。
  5. **窗口几何持久化**：退出前保存 bounds（x、y、width、height）；下次 **一体启动** 恢复。多显示器场景：若上次坐标不可见则回退安全默认居中（实现须处理，PRD 只要求不 off-screen 静默失败）。
  6. **退出守卫变体段**：关窗 / Quit 时若存在 dirty 编辑器 Tab，弹出与 Session 切换守卫 **同风格** 的逐文件保存 / 丢弃 / 取消对话框；取消则保持 App 运行。不因 PTY / 浏览器 Tab 弹窗。
  7. **Host 启动失败变体段**：Main 无法 boot Host 时，Renderer 仍挂载但 SPA boot 报告错误；提供「重试启动 Host」与 Quit；不 crash 无提示。
  8. **外挂 Host 变体段**（开发者）：启动参数或环境变量启用 attach 模式时，Main **不** boot Host，Renderer 用 `WebApiClient` 连本机 `dsh web` URL；窗口壳层同上，菜单 Quit 仅退出 GUI（不 kill 外挂 Host）。非默认打包行为，文档说明即可。

#### `embedded-browser`（桌面内嵌浏览器）

- **端 / 运行环境**：desktop
- **page-id**：`embedded-browser`
- **页面标题**：内嵌浏览器（桌面）
- **主任务**：在工具箱 **浏览器** 段 occupant 内嵌 Web 页面，Agent 与人类共用实例
- **覆盖的用户故事**：US-12~US-15
- **DESIGN 复用**：Tab 栏 / 导航顶栏 / 地址栏 / 溢出菜单 / 空态 / Loading 同 [`browser-v4.md`](./browser-v4.md) 与 embedded-browser design-system Agent Note；occupant **不含**「显示窗口」卡片
- **UI 设计描述**：继承 desktop **app-shell** 内工具箱；选中 **浏览器** 段。纵向 flex 与 V4 相同：① Tab 栏 ② 导航栏 ③ 可选提示条（外部站点 info / 导航 error）。④ **occupant（面板内 WebView）**：flex 1 最小高度 200px；Main `BrowserView` 通过 IPC bounds 精确覆盖此矩形；人类在 BrowserView 内直接点击 / 输入 / IME；**不**渲染「在本机浏览器窗口中查看」卡片与 **显示窗口** 按钮。切走 **浏览器** 段：Renderer 通知 Main detach BrowserView（或 zero bounds），页面不销毁；切回 reattach 并同步 bounds。硬刷新 App：从 workspace store 恢复 Tab 栏，BrowserView 按 URL 重载。Zoom 菜单仍持久化 Client store，不改变 BrowserView 内页面缩放语义（与 V4 一致）。**未绑定 / 不可用 / 导航失败** 变体同 V4 PRD 状态策略，错误与空态画在 occupant 上层（BrowserView detach 或置于其后）。Agent 操作后 BrowserView 内对应 Tab 保持选中，无需 `bringToFront` OS 窗口。

### DESIGN 合规自检

- [x] 未在 PRD 重写色板 / 字体 / Token（只引用 `DESIGN.md`）
- [x] SPA 内布局由既有 §5 原语组合；壳层原生 chrome 不写 DESIGN
- [x] 浏览器段空状态、Loading、错误复用 §5 / V4 约定
- [x] spec-driven：全文无设计稿
- [x] V5 不扩展 DESIGN §5

**PRD 末尾摘要**

- 本计划 **UI 模式**：`spec-driven`
- **页面总数**：desktop 2 页（含 1 个 `app-shell`）
- **整体框架页**：`desktop` / `app-shell` UI 设计描述已定稿
- **待扩展 DESIGN §5** 项：无（壳层走平台原生）
- `docs/design/DESIGN.md`：已就绪，V5 不修改

## 实现决策

摘要 ADR-0009 / ADR-0010。领域行为见 `CONTEXT.md`。

### desktop profile 与 dsh-desktop-app bundle

新增 **`desktop` profile** 与 `@deepseek-ai/dsh-desktop-app` bundle：继承 `dsh-base`，挂载 apiproxy、Playwright、终端、Git、client 插件 roster 等与 web 对等的 Host 能力，**不含** `dsh-host-webserver` 与 HTTP 静态 serving 行。`apps/desktop` Main 进程 boot 此 profile。`dsh --profile desktop --dump-config` 须可验证组合。

### Electron Main 进程 Host boot

Main 在 App `ready` 后启动 Cordis Host（一体启动默认路径）；App `before-quit` 在 **退出守卫** 通过后 teardown Host。Renderer 崩溃不自动重启 Host（V5 简单策略：随 App 生命周期）。Host 与 Renderer **同机**；不连接远程 Host。

### IpcApiClient 统一 IPC carrier

`dsh-client-connection` 新增 **`IpcApiClient`**：`callUnary` / `respond` 走 `ipcMain.handle`；mux / host / watchPath 下行经 Main→Renderer 事件流，帧为现有 `ServerRequest` JSON。Preload `contextBridge` 暴露窄 API；`contextIsolation: true`，`nodeIntegration: false`。SPA 内 `connection` 插件在检测到 desktop 交付时选用 `IpcApiClient` 而非 `WebApiClient`。

### dsh 协议与 SPA 加载

**生产**：Main 注册 **`dsh://`** 协议映射到 `apps/web` dist；Renderer `loadURL('dsh://…')`。**开发**：Renderer 加载 Vite dev server URL（`pnpm run dev:desktop` 编排）；IPC carrier 不变。`AppWebEntry` 的 `seams` 在 desktop 下注入 IPC bundle 加载（若需要）。

### electron-builder 打包与 Chromium 捆绑

`apps/desktop` 配置 electron-builder：macOS **dmg**，Windows **nsis 或 portable exe**（实现 Issue 选定其一并文档化）。`extraResources` 包含 Playwright Chromium 与 Host 运行时依赖。V5 **不强制** 代码签名 / 公证为验收阻塞项，但 CI 须产出可本地安装的 unsigned artifact。安装包体积预期显著大于纯 Web（PRD 记录约 +150–300MB 浏览器运行时，精确值实现后填入 Release Note）。

### 单实例与 second-instance 聚焦

`app.requestSingleInstanceLock()`（或平台等价）：二次启动时 `focus` 主窗口，不新建 Host。与 **外挂 Host** attach 模式互斥或 attach 模式跳过 lock（开发者文档说明）。

### 退出守卫与 Host 停止

关窗 / Quit 前调用与 Session 切换守卫 **相同 dirty 编辑器检测**；通过后 Main 停止 Host（PTY kill 策略与 web 进程退出一致）、销毁 BrowserView、释放单实例 lock。macOS / Windows **关闭即退出** 语义一致。

### 窗口几何持久化

Main 或 preload 约定键（如 `desktop.windowBounds.v1`）持久化至 userData；启动时 apply；须 clamp 到可见工作区。

### 标准壳应用菜单

About 显示 `app.getVersion()`；Settings 向 Renderer 发送 focus-settings 事件（打开 SPA 内既有设置 UI）；Quit 触发退出守卫链。

### BrowserRegistry 交付形态分叉

Host `BrowserRegistry` 识别 **交付形态**（环境或 config）：**web** 保持 ADR-0007 `launchPersistentContext` + 有头窗；**desktop** 使用 **Electron 主导** + `chromium.connectOverCDP` 附着 Main 创建的 BrowserView webContents。`host.browser.*` RPC 签名与 Tab 元数据不变；desktop 路径 **不**实现 `showWindow` 唤起 OS 窗口（可 no-op 或返回已嵌入状态）。

### BrowserView bounds IPC

Renderer `ui-browser` occupant 使用 `ResizeObserver` + 段 `visible` 上报 `{x,y,width,height}`（屏幕坐标）；Main `setBounds` / hide 时 detach。每 Workspace 选中 Tab 对应 BrowserView 展示目标 webContents。

### ui-browser 桌面 occupant

`@deepseek-ai/dsh-client-ui-browser` 检测 desktop 交付：移除「显示窗口」卡片与 `browserShowWindow` 主路径；occupant 渲染占位 div（`#browser-occupant`）并驱动 bounds IPC。Tab 栏 / 导航 / store / Zoom **不变**。

### 外挂 Host attach 模式

可选启动 flag（如 `DSH_DESKTOP_ATTACH=http://127.0.0.1:PORT`）：Main 不 boot Host；Renderer 使用 `WebApiClient` 连该 URL。仅开发文档与 `--help` 暴露；默认安装包行为为 **一体启动**。

### dsh desktop 启动器

`apps/cli` 增加 **`dsh desktop`**，spawn `apps/desktop` 开发或 built 入口；根 **`pnpm run dev:desktop`** 并行 Vite + Electron。

## 测试决策

只测外部可观察行为，不测 Electron 内部实现细节。

### IpcApiClient 协议同构 seam

Fake Main handler + Renderer 侧 `IpcApiClient`：unary 往返与 `InProcessApiClient` 同结果；mux/host 下行帧顺序与 schema 校验通过；断线触发 connection generation 失败与 backoff（可简化 mock）。PRD 依据：`PRD 实现决策 › IpcApiClient 统一 IPC carrier`。

### desktop profile boot seam

`desktop` profile 在 Node 侧 boot 成功；`host.describe` 可达；**无** webserver 端口监听。PRD 依据：`PRD 实现决策 › desktop profile 与 dsh-desktop-app bundle`。

### 单实例与聚焦 seam

启动两次 Electron（或 harness mock）：第二次仅触发 focus 事件，Host 进程数不变。PRD 依据：`PRD 实现决策 › 单实例与 second-instance 聚焦`。

### 退出守卫 seam

Fake dirty 编辑器 store：Quit 被对话框阻断；丢弃后 Host teardown 被调用。PRD 依据：`PRD 实现决策 › 退出守卫与 Host 停止`；`用户故事 US-6`。

### BrowserRegistry desktop CDP seam

Mock Electron debug URL + CDP：desktop 形态下 `createTab` / `navigate` / `snapshot` 成功；**不**调用 OS `bringToFront`。web 形态回归不受影响。PRD 依据：`PRD 实现决策 › BrowserRegistry 交付形态分叉`。

### BrowserView bounds seam

上报 bounds 变化时 Main mock 收到 `setBounds`；段 `visible=false` 时 detach。PRD 依据：`PRD 实现决策 › BrowserView bounds IPC`。

### ui-browser 桌面 occupant seam

Fake desktop 标志：无「显示窗口」文案；occupant 占位存在；导航 / Tab 行为与 V4 fake API 一致。PRD 依据：`PRD 实现决策 › ui-browser 桌面 occupant`。

### 功能对等 smoke seam

桌面壳启动后：工具箱五段 Tab 可见；能创建 Session、列出 Workspace（或等价 smoke）；与 web snapshot 共享的 shell 文案不回归。PRD 依据：`用户故事 US-3`；`PRD 测试决策 › 功能对等 smoke seam`。

### 打包 artifact smoke

CI 产出 dmg/exe 后 headless 校验包内 dist 与 Chromium 资源存在（不跑 GUI 安装）。PRD 依据：`PRD 实现决策 › electron-builder 打包与 Chromium 捆绑`。

## 范围外

V5 不做（Not now）：

- **Linux** 桌面安装包
- **自动更新**、更新通道、delta 包
- **系统协议唤起**（`dsh://` 打开 Workspace / Session）
- **系统通知** / 托盘驻留（关窗即退出，不最小化到托盘）
- **多窗口** / 「新建窗口」菜单
- 桌面 **一体启动** 连接 **远程 Host**（远程仍走浏览器交付）
- 桌面 **壳层超集**（先于 Web 的新工具箱能力）
- 重写 V1–V4 各段业务 PRD
- 浏览器段 **截图菜单**、清 Cookie / 缓存 / 历史（仍属 V4 范围外）
- **代码签名 / 公证** 作为 V5 合并阻塞项（可 follow-up）
- **外挂 Host** 的产品化 UI（仅 env / flag 调试）

## 补充说明

**依赖**：V1–V4 工具箱与 Host RPC 已存在于 `custom/main`；Electron 与 electron-builder 为 V5 新增 devDependency / 打包链。

**风险**：安装包体积与 Playwright + Electron 双运行时；BrowserView + CDP 附着复杂度高于 Web 有头窗。Electron 安全须严格 sandbox Renderer。macOS 上 **关闭即退出** 与部分用户「关窗留 Dock」习惯不同，V5 有意统一语义。

**浏览器交付**：`dsh web` 路径须全量回归；ADR-0007 有头窗行为 **不变**。

**开放问题**：Windows 安装器选 NSIS 还是 portable；Settings 菜单聚焦 SPA 内哪一项（实现 Issue 对齐既有设置入口）。实现切片见 GitHub Issue [#111](https://github.com/NanGePlus/my-deepseek-harness/issues/111)（子 Issue #113–#122）。
