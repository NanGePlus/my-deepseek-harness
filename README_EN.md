# DSH AI Coding Workbench

**A personal AI Coding workbench on DeepSeek Harness**

Agent · Workspace · Tools · Permissions · Toolbox · Resource manager · Extensible plugins

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![version](https://img.shields.io/badge/version-0.1.0--rc.5-orange) ![upstream](https://img.shields.io/badge/upstream-DeepSeek%20Harness-0066FF) ![branch](https://img.shields.io/badge/branch-custom%2Fmain-green)

Custom fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) · integration branch [custom/main](https://github.com/NanGePlus/my-deepseek-harness/tree/custom/main)

[中文](README.md) · 🌏 **English**

## 📑 Table of contents

- [✨ Capabilities](#-capabilities)
- [🚀 Install & run](#-install--run)
- [📖 Basic usage](#-basic-usage)
- [🧩 Custom modules: Toolbox & Resource manager](#-custom-modules-toolbox--resource-manager)
- [🏗️ Architecture & extension](#-architecture--extension)
- [🛠️ Development & build](#-development--build)
- [⚠️ Known limitations](#-known-limitations) · [🖥️ Platform support](#-platform-support)
- [🔗 Docs & upstream](#-docs--upstream)



## ✨ Capabilities



### Platform (inherited from DeepSeek Harness)


| Capability | Description |
| ---------- | ----------- |
| **Web Agent chat** | Multiple sessions, streaming replies, visible context and token usage |
| **Workspace** | Bind a local project directory; the agent reads, writes, and executes within it |
| **Tool calling** | Files, shell, search, web, subagents, todo, plan, etc. |
| **Permissions & approval** | Configurable confirmation for sensitive operations |
| **Model configuration** | DeepSeek API; Settings supports OpenAI-compatible endpoints |
| **Plugin architecture** | Cordis plugin tree; extend Host / Client capabilities as needed |




### Customizations shipped in this fork


| Module | Status | Notes |
| ------ | ------ | ----- |
| **Toolbox** | ✅ Shipped | Session header **icon + “Toolbox”** capsule to open/close; resizable |
| **Resource manager** | ✅ Shipped | Resource manager inside the toolbox |
| **Conversation preview** | ✅ Shipped | Mermaid charts with enlarged preview and zoom/pan; Markdown and images support zoom/pan viewing |
| **More modules** | 🔜 Planned | Terminal, Git panel, built-in browser, etc. |




## 🚀 Install & run

**Prerequisites**: Node.js `^22.19` or `>=24`; pnpm `11.7.0` (Corepack).

```sh
git clone https://github.com/NanGePlus/my-deepseek-harness.git
cd my-deepseek-harness
git checkout custom/main

corepack enable
pnpm install
pnpm run build
pnpm dsh web
```

Open `http://127.0.0.1:3080` in your browser.

**Update**:

```sh
git pull && pnpm install && pnpm run build && pnpm dsh web
# Hard-refresh the browser after Client plugin changes Cmd/Ctrl+Shift+R
```


| Symptom | Fix |
| ------- | --- |
| Official `npx @deepseek-ai/dsh web` lacks custom features | Build and run from this fork |
| `npm run web` fails | Run `pnpm run build` first; install dependencies with pnpm |
| “Toolbox” or “Resource manager” not visible | Confirm `custom/main` and a successful build; hard-refresh |
| Client UI changes in `ui-conversation` etc. not showing | `pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle`, then restart / hard-refresh |
| Resource manager: file too large / directory “…” | 5 MB per file; 1000 entries per directory level |




## 📖 Basic usage

1. **Configure model**: Settings → Models, enter API key.
2. **Choose workspace**: Add and select your project root directory.
3. **Start AI Coding**: Describe tasks in a session (with AI Coding Skills).
4. **Open toolbox**: Click the **Toolbox** capsule at the far right of the session header.
5. **View agent tool output**: Switch to **Tool details** in the toolbox, or click a tool row in the message stream.
6. **View and edit files / code yourself**: **Resource manager** tab in the toolbox — browse the file tree, open files, explicit save with ⌘S / Ctrl+S.



## 🧩 Custom modules: Toolbox & Resource manager



### Toolbox

In this fork, the upstream **details column** is product-named **Toolbox** (open / close toolbox).

- Entry: session header **Toolbox** capsule, same height as the session log
- Layout: beside the chat pane, resizable
- Tabs: **Resource manager** | **Tool details**



### Resource manager

Human-facing module inside the toolbox: when the agent edits the repo, browse directories, edit, and save explicitly without switching to an external IDE.

- File tree bound to the current session workspace (lazy loading, filtering, read-only Git badges)
- Monaco multi-tab, read-only image preview, create / rename / delete
- External change prompts, session switch guards, LSP diagnostics and hover

Implemented by plugin `@deepseek-ai/dsh-client-ui-file-editor` (Host RPC via `apiproxy`).

## 🏗️ Architecture & extension

```text
dsh web (web-app bundle)
  ├─ Agent runtime (sessions · tools · LLM · subagents …)
  └─ Web Client
       ├─ Chat pane (ui-conversation)
       ├─ Toolbox shell + tool details (ui-conversation / ui-tool)
       └─ Resource manager (ui-file-editor → Host RPC / apiproxy)
```



## 🛠️ Development & build

```sh
pnpm install
pnpm run build
pnpm dsh web            # or npm run web (build first)
pnpm run test:gui       # day-to-day changes
pnpm run test:web       # Web replay (build first)
pnpm run pack:dsh       # offline npm package → dist/npm/
```

When only Client plugin UI changes, **bundle** the affected package before `dsh web`, for example:

```sh
pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle
pnpm --filter @deepseek-ai/dsh-client-ui-file-editor run bundle
```



## ⚠️ Known limitations

- Personal fork; merging upstream requires manual alignment
- Resource manager has no auto-save; hard limits on large files and very large directories
- Terminal, Git commit, and other IDE features are not built in yet (planned)



## 🖥️ Platform support

Windows / Linux / macOS (macOS validated day to day; others covered by unit tests). Node `^22.19` or `>=24`.

---

MIT License · Based on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) · maintained by [my-deepseek-harness](https://github.com/NanGePlus/my-deepseek-harness)
