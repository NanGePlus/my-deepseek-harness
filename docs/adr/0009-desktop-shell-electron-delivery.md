# 桌面壳以 Electron 交付，Main 进程 Host 与统一 IPC Carrier

V5 将现有 Web GUI **包装为桌面壳**，与 **浏览器交付**（`dsh web`）并存、Host 能力对等（领域层见 `CONTEXT.md` **功能对等**）。我们选用 **Electron**：**Main 进程** boot 新 **`desktop` profile**（`@deepseek-ai/dsh-desktop-app` bundle），**不启** `dsh-host-webserver`、不占 loopback HTTP 端口；Renderer 加载与 `apps/web` **同一 SPA 构建产物**，经 **`IpcApiClient`**（`AbstractApiClient` 子类）把 unary、`respond` 与 mux/host/watchPath 下行流映射到 Main 内 `InProcessApiClient` / fetch handler，**复用现有 RPC schema 与帧格式**。Renderer 启用 `contextIsolation`、`nodeIntegration: false`，preload 经 **`contextBridge`** 暴露窄 IPC 桥；**生产**用 **`dsh://`** 自定义协议加载 dist，**开发**连 Vite dev server；安装包用 **electron-builder**（macOS `.dmg`、Windows `.exe`），应用组装落在 **`apps/desktop`**；日常开发入口为 **`pnpm run dev:desktop`** 与 **`dsh desktop`** 薄启动器。

**Considered Options**

- **Tauri / 其他轻量壳**：dsh Host 为 Node Cordis 插件树；多一层非 Node 壳↔Host 桥，V5「包装落地」ROI 低。
- **Sidecar 子进程 Host**：Main 仅管窗口、独立 Node 进程跑 Host；一体启动须额外进程监管与退出同步；**外挂 Host** 调试已覆盖分离场景。
- **复用 `web` profile 并 runtime 禁用 webserver**：`dsh-web-app` patch 同时背负浏览器与桌面互斥行，组合职责混乱。
- **Electron 内硬编码 Cordis 插件列表**：破坏 profile/bundle 组合、`dump-config` 与 CI 组合测试一致性。
- **混合 loopback HTTP + WebSocket**：Renderer 仍用 `WebApiClient` 连 `127.0.0.1`；占端口、与 **单实例** / 无 webserver 冲突，且分裂 connection generation 语义。
- **纯 `file://` 生产加载**：Vite ESM 产物在 Electron 中路径与 module 解析 fragile；`dsh://` 映射 dist 更可控。
- **Renderer 开启 `nodeIntegration`**：client 插件 bundle 与第三方依赖攻击面等同任意网页，与本机 Host 权限模型不匹配。

**Consequences**

- 新增 `packages/bundle/desktop-app/`（patch 层，不含 webserver 行）、`apps/desktop/`（Main / Preload / electron-builder 配置）；`apps/cli` 增加 **`dsh desktop`**，与 `pnpm run dev:desktop` 共用 bootstrap。
- `dsh-client-connection` 新增 **`IpcApiClient`** 及 preload 侧 typed 契约；物理 codec 与 WebSocket/SSE carrier 同构（逐条 `ServerRequest` JSON），session/runtime 对象层不变。
- **`WebApiClient` 仍仅服务浏览器交付**；桌面 Renderer **不得**假设 same-origin `/api` fetch。
- Main 持有 Cordis Host 全 Node 能力；Renderer sandbox。特权浏览（**面板内 WebView**）由 Main **`BrowserView`** 承担，见 ADR-0010。
- **`dsh-host-webserver` 仅服务浏览器访问**；Electron 不 reuse 该 carrier（与 GUI 分层 Agent Note 一致）。
- **外挂 Host**（连接本机已运行 `dsh web`）为可选第二入口，走 loopback `WebApiClient`，不是一体启动默认路径。
- electron-builder 须打包 Host 运行时、built dist 与桌面专用资源；签名 / 公证策略由 V5 PRD 定义，不在本 ADR 锁定。
- 单实例、关闭即退出、退出守卫、标准壳应用菜单等**产品行为**由 PRD 与 `CONTEXT.md` 定义，本 ADR 只锁交付形态与 carrier。
