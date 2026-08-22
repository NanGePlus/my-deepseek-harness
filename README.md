# DSH AI Coding Workbench

**基于 DeepSeek Harness 的个人 AI Coding 工作台**

Agent · 工作区 · 工具 · 权限 · 工具箱 · 资源管理器 · 可扩展插件

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![version](https://img.shields.io/badge/version-0.1.0--rc.5-orange) ![upstream](https://img.shields.io/badge/upstream-DeepSeek%20Harness-0066FF) ![branch](https://img.shields.io/badge/branch-custom%2Fmain-green)

在官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）之上定制的 fork · 集成线 [custom/main](https://github.com/NanGePlus/my-deepseek-harness/tree/custom/main)

🌏 **中文** · [English](README_EN.md)

## 📑 目录

- [✨ 能力概览](#-能力概览)
- [🚀 安装与运行](#-安装与运行)
- [📖 基本使用](#-基本使用)
- [🧩 定制模块：工具箱与资源管理器](#-定制模块工具箱与资源管理器)
- [🏗️ 架构与扩展](#-架构与扩展)
- [🛠️ 开发与构建](#-开发与构建)
- [⚠️ 已知限制](#-已知限制) · [🖥️ 平台支持](#-平台支持)
- [🔗 文档与上游](#-文档与上游)



## ✨ 能力概览



### 平台能力（继承 DeepSeek Harness）


| 能力                 | 说明                                  |
| ------------------ | ----------------------------------- |
| **Web Agent 对话**   | 多会话、流式回复、上下文与 Token 用量可见            |
| **工作区（Workspace）** | 绑定本地项目目录，Agent 在该目录内读写与执行           |
| **工具调用**           | 文件、Shell、搜索、Web、子 Agent、Todo、Plan 等 |
| **权限与审批**          | 敏感操作可配置确认策略                         |
| **模型配置**           | DeepSeek API；设置页可配 OpenAI 兼容端点      |
| **插件架构**           | Cordis 插件树；可按需扩展 Host / Client 能力   |




### 本 fork 已落地的定制


| 模块        | 状态     | 说明                                              |
| --------- | ------ | ----------------------------------------------- |
| **工具箱**   | ✅ 已实现  | 会话头 **图标 +「工具箱」** 胶囊按钮打开/收起；可拖宽                 |
| **资源管理器** | ✅ 已实现  | 工具箱内资源管理器                                       |
| **会话区预览** | ✅ 已实现  | Mermaid 图表渲染与放大预览并支持缩放平移浏览；Markdown 与图片支持缩放平移浏览 |
| **更多模块**  | 🔜 规划中 | 终端、Git 面板、内置浏览器等                                |




## 🚀 安装与运行

**前置**：Node.js `^22.19` 或 `>=24`；pnpm `11.7.0`（Corepack）。

```sh
git clone https://github.com/NanGePlus/my-deepseek-harness.git
cd my-deepseek-harness
git checkout custom/main

corepack enable
pnpm install
pnpm run build
pnpm dsh web
```

浏览器打开 `http://127.0.0.1:3080`。

更新：

```sh
git pull && pnpm install && pnpm run build && pnpm dsh web
# 改动了 Client 插件后硬刷新浏览器 Cmd/Ctrl+Shift+R
```


| 现象                                     | 处理                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| 官方 `npx @deepseek-ai/dsh web` 无定制功能    | 须用本 fork 构建                                                                  |
| `npm run web` 报错                       | 先 `pnpm run build`；依赖用 pnpm 安装                                               |
| 看不到「工具箱」或「资源管理器」                       | 确认 `custom/main` 且已 build；硬刷新                                                |
| 改了 `ui-conversation` 等 Client 包 UI 不更新 | `pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle` 后重启 / 硬刷新 |
| 资源管理器：文件过大 / 目录「…」                     | 目前设置为单文件 5 MB；单层目录列表上限 1000 条                                                |




## 📖 基本使用

1. **配置模型**：设置 → 模型，填入 API Key。
2. **选择工作区（Workspace）**：添加并选中项目根目录。
3. **开始 AI Coding**：在会话中描述任务（配合AI Coding Skills）。
4. **打开工具箱**：点击会话头最右侧 **工具箱** 胶囊按钮。
5. **查看 Agent 工具输出**：工具箱内切到 **工具详情**，或点击消息流中的工具行。
6. **自己查看和编辑文件/改代码**：工具箱内 **资源管理器** Tab，浏览文件树、打开文件、⌘S / Ctrl+S 显式保存。



## 🧩 定制模块：工具箱与资源管理器



### 工具箱

Harness 原右侧 **详情栏**（details 栏）在本 fork 的产品文案中统一为 **工具箱**（打开 / 收起工具箱）。

- 入口：会话头 **工具箱** 胶囊按钮，与会话日志同高
- 布局：与对话区并列，可拖宽
- Tab：**资源管理器** | **工具详情**



### 资源管理器

工具箱内的人类面向模块：Agent 改仓库时，你无需切到外部 IDE 即可浏览目录、编辑并显式保存。

- 文件树绑定当前会话的工作区（懒加载、过滤、Git 只读徽章）
- Monaco 多 Tab、图片只读预览、新建 / 重命名 / 删除
- 外部变更提示、会话切换守卫、LSP 诊断与悬停提示

插件实现：`@deepseek-ai/dsh-client-ui-file-editor`（Host RPC 经 `apiproxy`）。

## 🏗️ 架构与扩展

```text
dsh web（web-app bundle）
  ├─ Agent 运行时（会话 · 工具 · LLM · 子 Agent …）
  └─ Web Client
       ├─ 对话区（ui-conversation）
       ├─ 工具箱壳层 + 工具详情（ui-conversation / ui-tool）
       └─ 资源管理器（ui-file-editor → Host RPC / apiproxy）
```



## 🛠️ 开发与构建

```sh
pnpm install
pnpm run build
pnpm dsh web            # 或 npm run web（需先 build）
pnpm run test:gui       # 日常改动
pnpm run test:web       # Web 回放（需先 build）
pnpm run pack:dsh       # 离线 npm 包 → dist/npm/
```

仅改 Client 插件 UI 时，对应包需 **bundle** 后再 `dsh web`，例如：

```sh
pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle
pnpm --filter @deepseek-ai/dsh-client-ui-file-editor run bundle
```



## ⚠️ 已知限制

- 个人 fork，合并上游需手动对齐
- 资源管理器无自动保存；大文件与超大目录有硬上限
- 终端、Git 提交等 IDE 能力尚未内置（规划中）



## 🖥️ 平台支持

Windows / Linux / macOS 三平台适配（macOS 日常验证；其余经单元测试覆盖）。Node `^22.19` 或 `>=24`。

---

MIT License · 基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) · [my-deepseek-harness](https://github.com/NanGePlus/my-deepseek-harness) 维护