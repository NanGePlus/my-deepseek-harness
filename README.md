# DSH AI Coding Workbench

**基于 DeepSeek Harness 的个人 AI Coding 工作台**
Agent 对话 · Workspace · 工具与子任务 · 权限与计划 · 资源管理器 · 可扩展插件

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)![version](https://img.shields.io/badge/version-0.1.0--rc.5-orange)![upstream](https://img.shields.io/badge/upstream-DeepSeek%20Harness-0066FF)![branch](https://img.shields.io/badge/branch-custom%2Fmain-green)

在官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）之上定制的 fork · 集成线 `custom/main`

🌏 **中文** · [English](README_EN.md)

## 📑 目录

- [这是什么](#-这是什么)
- [✨ 能力概览](#-能力概览)
- [🚀 安装与运行](#-安装与运行)
- [📖 基本使用](#-基本使用)
- [🧩 定制模块：资源管理器](#-定制模块资源管理器)
- [🏗️ 架构与扩展](#-架构与扩展)
- [🛠️ 开发与构建](#-开发与构建)
- [⚠️ 已知限制](#-已知限制) · [🖥️ 平台支持](#-平台支持)
- [🔗 文档与上游](#-文档与上游)



## 这是什么

本项目是一个**个人 AI Coding 工作台**：在本机启动 Web UI，绑定项目目录（Workspace），与 DeepSeek（或 OpenAI 兼容）Agent 对话，让它读文件、改代码、跑命令；你则在同一界面里查看工具输出、审阅改动、必要时自己编辑文件。

## ✨ 能力概览



### 平台能力（继承 DeepSeek Harness）


| 能力               | 说明                                                |
| ---------------- | ------------------------------------------------- |
| **Web Agent 对话** | 多 Session、流式回复、上下文与 Token 用量可见                    |
| **Workspace**    | 绑定本地项目目录，Agent 在该目录内读写与执行                         |
| **工具调用**         | 文件、Shell、搜索、Web、子 Agent、Todo、Plan 等（随 profile 装配） |
| **权限与审批**        | 敏感操作可配置确认策略                                       |
| **模型配置**         | DeepSeek API；设置页可配 OpenAI 兼容端点                    |
| **插件架构**         | Cordis 插件树；可按需扩展 Host / Client 能力                 |




### 本 fork 已落地的定制（相对 upstream）


| 模块              | 状态     | 一句话                                                                                                      |
| --------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| **资源管理器**       | ✅ 已实现  | details 栏内文件树 + Monaco 多 Tab，与 Agent 并列、人类可亲手改代码                                                         |
| **会话区预览增强**     | ✅ 已实现  | Mermaid 渲染与 lightbox、Markdown/图片 ZoomPan                                                                 |
| **details 栏体验** | ✅ 已实现  | Tool 详情 / 资源管理器 Tab、可拖宽、Tool 行跳转                                                                         |
| **更多工作台模块**     | 🔜 规划中 | 终端、Git 面板等可参考生态插件（如 [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)）或在本 fork 内继续集成 |




## 🚀 安装与运行

**前置**：Node.js `^22.19` 或 `>=24`；pnpm `11.7.0`（Corepack）；DeepSeek API Key（或设置页配置兼容端点）。

> npm 上的官方 `@deepseek-ai/dsh` **不含**本 fork 的定制模块。请从本仓库构建，或使用 Maintainer 发布的定制包。



### 从源码运行（推荐）

```sh
git clone https://github.com/NanGePlus/my-deepseek-harness.git
cd my-deepseek-harness
git checkout custom/main

corepack enable
pnpm install
pnpm run build
pnpm dsh web          # 或 npm run web / npm start
```

浏览器打开终端地址，默认 `http://127.0.0.1:3080`。

**配置 API Key（可选，启动前）**

在仓库根目录创建 `.env`（勿提交版本库）：

```sh
DEEPSEEK_API_KEY=sk-...
# DEEPSEEK_BASE_URL=https://api.example.com/v1   # 可选
```

**让 AI 助手帮你安装**

```text
帮我在本机安装 DSH AI Coding Workbench（NanGePlus/my-deepseek-harness），步骤：
1. git clone 该仓库并 checkout custom/main
2. corepack enable && pnpm install && pnpm run build
3. 在仓库根目录执行 pnpm dsh web（或 npm run web）
4. 打开 http://127.0.0.1:3080 ，在设置→模型填 API Key，选择 Workspace，即可开始 AI Coding
遇到报错查 README 常见问题表。
```

**更新**

```sh
git pull && pnpm install && pnpm run build
pnpm dsh web
# 浏览器硬刷新 Cmd/Ctrl+Shift+R
```

**常见问题**


| 现象                                   | 原因与解决                                            |
| ------------------------------------ | ------------------------------------------------ |
| `pnpm: command not found`            | `corepack enable`，或 `npm install -g pnpm@11.7.0` |
| 官方 `npx @deepseek-ai/dsh web` 缺少定制功能 | 须用本 fork 构建运行                                    |
| `npm run web` 报错                     | 先 `pnpm run build`；依赖用 pnpm 安装                   |
| 看不到「资源管理器」Tab                        | 确认 `custom/main` 且已 build；硬刷新浏览器                 |
| 资源管理器：文件过大 / 目录 `…`                  | 单文件 5 MB 上限；单层 listing 1000 条上限                  |




## 📖 基本使用

1. **配置模型**：设置 → 模型，填入 API Key。
2. **选择 Workspace**：添加并选中你的项目根目录。
3. **开始 AI Coding**：在 Session 里描述任务（例如「梳理这个仓库的模块结构并补一个测试」）。
4. **查看 Agent 行为**：中间是对话流；右侧 details 栏默认 **工具详情**，点击工具行可看输入输出。
5. **自己改代码（可选）**：details 栏切到 **资源管理器**，浏览文件树、打开 Tab、⌘S / Ctrl+S 显式保存。

更完整的 Web UI 说明见 [docs/user/guide/index.zh.md](./docs/user/guide/index.zh.md)。

## 🧩 定制模块：资源管理器

资源管理器是 **本工作台里的一块人类面向模块**，不是项目的全部。它解决的是：Agent 在改仓库时，你不必切到外部 IDE 才能浏览目录、打开文件、亲手保存。

**入口**：details 栏 Tab **资源管理器 | 工具详情**（与对话并列，不占中栏）。

**核心能力**：

- 文件树绑定当前 Session 的 Workspace（懒加载、过滤、Git 只读徽章）
- Monaco 多 Tab 编辑、显式保存、图片只读预览
- 新建 / 重命名 / 删除、外部变更提示、Session / Tab 切换守卫
- LSP 诊断与 hover；主题跟随 Harness light/dark

**快捷键**：保存 `Ctrl/Cmd + S`（资源管理器内）。

实现上为 Cordis Client 插件 `@deepseek-ai/dsh-client-ui-file-editor`，经 Host RPC 访问磁盘。细节见 [PRD](./docs/prd/file-editor-v1.md)、[CONTEXT.md](./CONTEXT.md)、[CUSTOM.md](./CUSTOM.md#已实现定制功能相对上游-master)。

## 🏗️ 架构与扩展

```text
dsh web（本 fork 的 web-app bundle）
  ├─ Agent 运行时：Session · 工具 · LLM · 子 Agent …（上游 Harness 核心）
  └─ Web Client
       ├─ 对话与 Tool 详情（ui-conversation 等）
       └─ 资源管理器（ui-file-editor → Host RPC / apiproxy）
```

- **定制清单**：[CUSTOM.md](./CUSTOM.md)
- **代码导读**：[docs/repo-wiki/README.md](./docs/repo-wiki/README.md)
- **Harness 架构**：[docs/architecture.md](./docs/architecture.md)
- **Agent 开发规范**：[AGENTS.md](./AGENTS.md)



## 🛠️ 开发与构建

```sh
pnpm install
pnpm run build          # Host + Client + Web
pnpm dsh web            # 或 npm run web（需先 build）
pnpm run test:gui       # 日常改动推荐
pnpm run test:web       # Web 回放（需先 build）
pnpm run pack:dsh       # npm 离线安装包 → dist/npm/
```

提交前建议：`pnpm run build && pnpm run test:gui`。

## ⚠️ 已知限制

- 个人 fork / 集成线，与 upstream 需手动 reconcile
- 资源管理器无自动保存；大文件与超大目录有硬上限（见 [CUSTOM.md](./CUSTOM.md)）
- 部分 CI 工作流可能已禁用；交付前请自行验证
- 更多 IDE 级能力（终端、Git 提交等）尚未内置，可接生态插件或后续在本 fork 扩展



## 🖥️ 平台支持

macOS / Linux 为主；Windows 未经完整验证。Node `^22.19` 或 `>=24`。

## 🔗 文档与上游


| 链接                                                                                | 说明                   |
| --------------------------------------------------------------------------------- | -------------------- |
| [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)   | 上游 Harness           |
| [NanGePlus/my-deepseek-harness](https://github.com/NanGePlus/my-deepseek-harness) | 本仓库（`custom/main`）   |
| [CUSTOM.md](./CUSTOM.md)                                                          | 相对 upstream 的定制 diff |
| [docs/user/guide/index.zh.md](./docs/user/guide/index.zh.md)                      | Web UI 使用指南          |
| [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)   | 生态参考：独立 npm 侧边栏工作台   |


---

MIT License · 基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) · 个人 AI Coding 工作台由 [my-deepseek-harness](https://github.com/NanGePlus/my-deepseek-harness) 维护
