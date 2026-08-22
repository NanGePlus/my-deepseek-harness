# dsh-web-file-editor

<p align="center">
  <strong>DeepSeek Harness 定制发行版：对话旁内置 Workspace 文件编辑器</strong><br/>
  <sub>文件树 · Monaco 多 Tab · 显式保存 · Git 徽章 · LSP · 外部变更检测 · Session 守卫</sub>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/NanGePlus/my-deepseek-harness"><img src="https://img.shields.io/badge/version-0.1.0--rc.5-orange" alt="version"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/upstream-DeepSeek%20Harness-0066FF" alt="upstream"></a>
  <a href="https://github.com/NanGePlus/my-deepseek-harness/tree/custom/main"><img src="https://img.shields.io/badge/branch-custom%2Fmain-green" alt="branch"></a>
</p>

<p align="center">
  基于 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>（<code>dsh</code>）fork 集成 · 集成线 <code>custom/main</code> · Cordis 插件架构<br/>
  details 栏 <strong>Tool 详情 | 文件编辑器</strong> 双 Tab —— Agent 与人类在同一 Web 界面协作写代码，无需切换外部 IDE
</p>

<p align="center">
  🌏 <strong>中文</strong> · <a href="README_EN.md">English</a>
</p>

<!-- 交付时可替换为演示 GIF / 截图 -->
<!-- ![文件编辑器演示](./docs/assets/file-editor-demo.png) -->

## 📑 目录

- [✨ 功能一览](#-功能一览)
- [🚀 安装与运行](#-安装与运行)
- [🖼️ 特性巡礼](#-特性巡礼)
- [⌨️ 快捷键](#-快捷键)
- [🏗️ 架构说明](#-架构说明)
- [🛠️ 开发与构建](#-开发与构建)
- [⚠️ 已知限制](#-已知限制) · [🖥️ 平台支持](#-平台支持)
- [🔗 上游与文档](#-上游与文档)

## ✨ 功能一览

- **🤖 AI Agent 工作台**（继承上游）：Web 对话、读写 Workspace、执行命令、委派子任务；支持 DeepSeek 及 OpenAI 兼容端点
- **🗂️ 文件树**：绑定当前 Session 的 Workspace；懒加载 + 虚拟滚动 + 文件名过滤；Material 文件类型图标；只读 Git 状态徽章（M/U/D）
- **📝 Monaco 多 Tab 编辑**：语法高亮、dirty 标记、**显式保存**（无自动保存）；Markdown 预览 / 源码切换（默认源码）
- **🖼️ 打开三档**：可编辑文本 / 图片只读预览 / 已知二进制不可打开
- **📁 文件操作**：新建文件 / 文件夹、重命名、删除（确认对话框）、右键菜单；Tab 批量关闭（VS Code 风格）
- **🔔 外部变更**：Agent 或其他进程改磁盘时，对话框选择重新加载或保留本地编辑缓冲（`watchPath`）
- **🛡️ Session 守卫**：切换 Session 或关闭 dirty Tab 时，逐文件保存 / 丢弃 / 取消
- **🔍 LSP**：编辑器内诊断与 hover（经 Host LSP 接线）
- **🎨 主题一致**：Monaco 与 Harness light/dark 同步；会话区 Mermaid + 图片 lightbox
- **📐 details 栏**：与 Tool 详情 segmented Tab 切换；栏宽可拖拽；会话内文件路径链接可直达编辑器

> 🔌 **实现方式**：文件编辑器以 Cordis Client 插件 `@deepseek-ai/dsh-client-ui-file-editor` 注入 `conversation.details.editor` 槽位；I/O 经 Host RPC（`apiproxy`）访问本地磁盘，浏览器不直接碰盘。V1 为打通 RPC 与 details 壳层，直接扩展了 `packages/`（见 [CUSTOM.md](./CUSTOM.md)）。

## 🚀 安装与运行

**前置**：Node.js `^22.19` 或 `>=24`；pnpm `11.7.0`（Corepack）；DeepSeek API Key（或设置页配置 OpenAI 兼容端点）。

> ⚠️ npm 上的官方 `@deepseek-ai/dsh` **不含**本仓库的文件编辑器。须使用本 fork 构建运行，或 Maintainer 发布的定制 tarball / registry 版本。

### 方式一：从源码运行（推荐）

```sh
git clone https://github.com/NanGePlus/my-deepseek-harness.git
cd my-deepseek-harness
git checkout custom/main

corepack enable
pnpm install
pnpm run build
pnpm dsh web          # 或 npm run web / npm start
```

浏览器打开终端输出的地址，默认 `http://127.0.0.1:3080`。首次使用在 **设置 → 模型** 填入 API Key，再 **选择 Workspace** 并开始对话；右侧 details 栏切换到 **文件编辑器** Tab。

<details>
<summary><strong>配置 API Key（可选，启动前）</strong></summary>

在仓库根目录创建 `.env`（勿提交版本库）：

```sh
DEEPSEEK_API_KEY=sk-...
# DEEPSEEK_BASE_URL=https://api.example.com/v1   # 可选
```

</details>

<details>
<summary><strong>方式二：让 DSH 帮你从源码装好</strong></summary>

把下面提示词发给任意 DSH 会话（或你的 AI 助手）：

```text
帮我在本机安装 dsh-web-file-editor（DeepSeek Harness 文件编辑器定制版），步骤：
1. git clone https://github.com/NanGePlus/my-deepseek-harness.git 并 checkout custom/main
2. corepack enable && pnpm install && pnpm run build
3. 在仓库根目录执行 pnpm dsh web（或 npm run web）
4. 提醒我打开 http://127.0.0.1:3080 ，在设置→模型填 API Key，选择 Workspace，details 栏切到「文件编辑器」
遇到报错先查 https://github.com/NanGePlus/my-deepseek-harness README 的常见问题表。
```

</details>

<details>
<summary><strong>方式三：npx 运行（需 Maintainer 先发布到 npm）</strong></summary>

Maintainer 将本 fork 完整 `release:pack` 并发布到 npm 后：

```sh
npx @deepseek-ai/dsh@<定制版本> web
```

离线交付：Maintainer 执行 `pnpm run build && pnpm run pack:dsh`，将 `dist/npm/` 下全部 `.tgz` 交给用户做 `file:` 安装。详见 [release:verify-packed-install](./scripts/release/verify-packed-install.ts)。

</details>

<details>
<summary><strong>更新</strong></summary>

```sh
git pull
pnpm install
pnpm run build
# 硬刷新浏览器 Cmd/Ctrl+Shift+R
pnpm dsh web
```

</details>

<details>
<summary><strong>常见问题</strong></summary>

| 现象 | 原因与解决 |
|------|------------|
| `pnpm: command not found` | 运行 `corepack enable`，或 `npm install -g pnpm@11.7.0` |
| 启动后看不到「文件编辑器」Tab | 确认在 `custom/main` 分支且已 `pnpm run build`；硬刷新浏览器 |
| `npm run web` 报错找不到模块 | 须先 `pnpm run build`；依赖安装用 pnpm，不要用 npm install |
| 打开文件提示「文件过大」 | 单文件 `readFile` 上限 5 MB；超大文件请用外部编辑器 |
| 目录展开很慢或显示 `…` | 单层 listing 上限 1000 条；极大目录会截断，属预期行为 |
| Git 徽章不显示 | 非 Git 仓库或未安装 git 时静默降级，文件树仍可用 |
| 用了官方 `npx @deepseek-ai/dsh web` 没有编辑器 | 官方 npm 包不含本定制；须用本仓库构建 |
| Agent 改文件后编辑器没提示 | 仅对已打开 Tab 注册 `watchPath`；未打开的文件不会监听 |
| 未保存 edits 丢失 | V1 无自动保存；切换 Session / 关 Tab 时会触发守卫，也可手动 ⌘S 保存 |

</details>

## 🖼️ 特性巡礼

> 以下为功能说明；交付时可补充界面截图或演示 GIF。

### 🗂️ 文件树与 Workspace 绑定

文件树根目录跟随**当前选中 Session 的绑定 Workspace**；全量可见（含 `.` 开头、`node_modules`、`.git`）；展开时才加载该层；支持顶部文件名过滤与 Git 行尾徽章。

### 📝 Monaco 多 Tab 编辑区

同时打开多个文件 Tab；可编辑文本走 Monaco（大文件自动降级优化）；图片只读预览；二进制文件给出明确提示。Tab 栏支持批量关闭；文件夹重命名 / 删除时同步更新已打开子路径 Tab。

### 🔔 外部变更与 Session 守卫

磁盘文件被 Agent 工具或其他进程修改时，弹出「重新加载 / 保留本地编辑」；切换 Session 或关闭 dirty Tab 时，逐文件保存 / 丢弃 / 取消，禁止静默丢改动。

### 📐 details 栏集成

与 **Tool 详情** 共用 segmented Tab，不占用中栏对话区；栏宽可拖；Tool 行点击可跳回 Tool 详情；会话消息中的文件路径链接可在编辑器中打开。

## ⌨️ 快捷键

| 操作 | 按键 |
|------|------|
| 保存当前编辑 | Ctrl/Cmd + S |
| 关闭 Tab | 点击 Tab 关闭按钮（dirty 时先弹守卫） |

## 🏗️ 架构说明

```text
Web 浏览器
  └─ ui-conversation（details Tab 壳层：Tool 详情 | 文件编辑器）
       └─ ui-file-editor（Client 插件：FileTreePane + EditorPane）
            └─ WorkspaceRuntime → Host RPC（apiproxy）
                 └─ ctx.fs / git status / watchPath / LSP（Host 进程）
```

| 模块 | 路径 | 作用 |
|------|------|------|
| Client 插件 | `packages/client/ui-file-editor` | 文件树 + Monaco surface |
| Host RPC | `packages/host/apiproxy` | `readFile` / `writeFile` / `listWorkspaceEntries` 等 |
| details 壳层 | `packages/client/ui-conversation` | 声明 `conversation.details.editor` 槽 |
| Bundle 注册 | `packages/bundle/web-app/cordis.patch.yml` | `ui-file-editor` 行 |
| LSP | `packages/lsp/lsp-editor` | 编辑器诊断 / hover |

架构决策：[ADR-0001 Host RPC](./docs/adr/0001-file-editor-host-rpc.md) · [ADR-0002 details Tab](./docs/adr/0002-file-editor-details-tab.md) · [PRD V1](./docs/prd/file-editor-v1.md)

## 🛠️ 开发与构建

```sh
corepack enable
pnpm install

pnpm run build          # Host + Client + Web 完整构建
pnpm dsh web            # 启动 Web UI
npm run web             # 同上（需先 build）

pnpm run test:gui       # Client / Host 单元测试（日常推荐）
pnpm run test:web       # Web 回放测试（需先 build）
pnpm run typecheck
pnpm run lint
pnpm run pack:dsh       # 打 npm 离线安装包 → dist/npm/
```

提交前建议至少跑通 `pnpm run build && pnpm run test:gui`。定制 diff 清单见 [CUSTOM.md](./CUSTOM.md)；代码导读见 [docs/repo-wiki/README.md](./docs/repo-wiki/README.md)。

面向 Agent 开发：遵循 [AGENTS.md](./AGENTS.md)。

## ⚠️ 已知限制

- 单文件读取上限 **5 MB**；minified 超大单行会关闭 word wrap 并跳过 LSP 全量同步
- 目录 listing 单层 **1000** 条、dirent 扫描 **10 000** 上限；截断节点显示 `…`
- **无自动保存**；唯一落盘路径是显式保存
- V1 直接改 `packages/`，尚未拆成可 `dsh plugin add` 的独立 npm 插件包
- 本 fork CI 部分工作流可能已禁用；交付前请自行验证构建与测试
- 相对 upstream `master` 的集成线 `custom/main` 需手动 reconcile 上游更新

## 🖥️ 平台支持

macOS / Linux 为主要开发与验证环境；Windows 未经本定制版完整验证。Node `^22.19` 或 `>=24`。

## 🔗 上游与文档

| 链接 | 说明 |
|------|------|
| [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | 上游 Harness |
| [NanGePlus/my-deepseek-harness](https://github.com/NanGePlus/my-deepseek-harness) | 本 fork（`custom/main`） |
| [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | 生态参考：侧边栏文件工作台插件（独立 npm 插件形态） |
| [CUSTOM.md](./CUSTOM.md) | 相对 upstream 的定制清单 |
| [CONTEXT.md](./CONTEXT.md) | 文件编辑器领域术语 |
| [docs/user/guide/index.zh.md](./docs/user/guide/index.zh.md) | Web UI 使用指南 |
| [docs/architecture.md](./docs/architecture.md) | Harness 整体架构 |

---

<p align="center">
  MIT License · 基于 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> · 文件编辑器 V1 定制由 <a href="https://github.com/NanGePlus/my-deepseek-harness">my-deepseek-harness</a> 维护
</p>
