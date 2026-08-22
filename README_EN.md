# dsh-web-file-editor

<p align="center">
  <strong>A DeepSeek Harness distribution with a built-in Workspace file editor beside the chat</strong><br/>
  <sub>File tree · Monaco multi-tab · Explicit save · Git badges · LSP · External change detection · Session guards</sub>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/NanGePlus/my-deepseek-harness"><img src="https://img.shields.io/badge/version-0.1.0--rc.5-orange" alt="version"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/upstream-DeepSeek%20Harness-0066FF" alt="upstream"></a>
  <a href="https://github.com/NanGePlus/my-deepseek-harness/tree/custom/main"><img src="https://img.shields.io/badge/branch-custom%2Fmain-green" alt="branch"></a>
</p>

<p align="center">
  Fork of <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> (<code>dsh</code>) · integration branch <code>custom/main</code> · Cordis plugin architecture<br/>
  Details column tabs: <strong>Tool details | File editor</strong> — humans and the agent work on the same codebase in one Web UI
</p>

<p align="center">
  <a href="README.md">中文</a> · 🌏 <strong>English</strong>
</p>

## 📑 Table of contents

- [✨ Features](#-features)
- [🚀 Install & run](#-install--run)
- [🖼️ Feature tour](#-feature-tour)
- [⌨️ Shortcuts](#-shortcuts)
- [🏗️ Architecture](#-architecture)
- [🛠️ Development](#-development)
- [⚠️ Known limitations](#-known-limitations) · [🖥️ Platforms](#-platforms)
- [🔗 Upstream & docs](#-upstream--docs)

## ✨ Features

- **🤖 AI agent workspace** (from upstream): Web chat, workspace read/write, shell, subagents; DeepSeek and OpenAI-compatible endpoints
- **🗂️ File tree**: bound to the active session workspace; lazy loading, virtual scroll, filename filter; Material file icons; read-only Git badges
- **📝 Monaco multi-tab editing**: syntax highlighting, dirty state, **explicit save** (no auto-save); Markdown preview / source (source default)
- **🖼️ Open policy**: editable text / read-only image preview / blocked known binaries
- **📁 File ops**: create, rename, delete (with confirmation), context menu; VS Code–style batch tab close
- **🔔 External changes**: reload disk or keep local buffer when the file changes on disk (`watchPath`)
- **🛡️ Session guards**: save / discard / cancel when switching sessions or closing dirty tabs
- **🔍 LSP**: diagnostics and hover in the editor
- **🎨 Theming**: Monaco follows Harness light/dark; Mermaid and image lightbox in the conversation pane
- **📐 Details column**: segmented tabs with Tool details; resizable; file links in chat open in the editor

> 🔌 **Implementation**: Cordis client plugin `@deepseek-ai/dsh-client-ui-file-editor` injects `conversation.details.editor`; I/O goes through Host RPC (`apiproxy`). V1 extends `packages/` directly — see [CUSTOM.md](./CUSTOM.md).

## 🚀 Install & run

**Prerequisites**: Node.js `^22.19` or `>=24`; pnpm `11.7.0` (Corepack); DeepSeek API key (or OpenAI-compatible endpoint in Settings).

> ⚠️ The public npm package `@deepseek-ai/dsh` does **not** include this file editor. Build from this fork, or use a custom tarball/registry release from the maintainer.

### Option 1: From source (recommended)

```sh
git clone https://github.com/NanGePlus/my-deepseek-harness.git
cd my-deepseek-harness
git checkout custom/main

corepack enable
pnpm install
pnpm run build
pnpm dsh web          # or npm run web / npm start
```

Open the printed URL (default `http://127.0.0.1:3080`). Configure a model under **Settings → Models**, choose a workspace, switch the details column to **File editor**.

<details>
<summary><strong>API key via .env (optional)</strong></summary>

```sh
DEEPSEEK_API_KEY=sk-...
# DEEPSEEK_BASE_URL=https://api.example.com/v1
```

</details>

<details>
<summary><strong>Option 2: npx (after maintainer publishes to npm)</strong></summary>

```sh
npx @deepseek-ai/dsh@<custom-version> web
```

Offline delivery: `pnpm run build && pnpm run pack:dsh` → ship everything under `dist/npm/`.

</details>

<details>
<summary><strong>FAQ</strong></summary>

| Symptom | Fix |
|---------|-----|
| No “File editor” tab | On `custom/main`, ran `pnpm run build`, hard-refresh browser |
| `npm run web` fails | Run `pnpm run build` first; install deps with pnpm, not npm |
| “File too large” | 5 MB read cap per file |
| `…` in tree | Directory listing capped at 1000 entries per level |
| Official `npx @deepseek-ai/dsh web` has no editor | Use this fork’s build |

</details>

## 🖼️ Feature tour

### 🗂️ File tree

Root follows the bound workspace of the selected session; lazy per-directory loading; filename filter; Git badges on each row.

### 📝 Monaco editor

Multi-tab editing with explicit save; image preview; binary blocked with a clear message; batch tab close; path updates on folder rename/delete.

### 🔔 Guards

External disk changes prompt reload vs keep buffer; session switch and dirty tab close use save / discard / cancel dialogs.

## ⌨️ Shortcuts

| Action | Keys |
|--------|------|
| Save | Ctrl/Cmd + S |
| Close tab | Tab close button (dirty guard first) |

## 🏗️ Architecture

```text
Browser
  └─ ui-conversation (details tabs)
       └─ ui-file-editor (FileTreePane + EditorPane)
            └─ WorkspaceRuntime → Host RPC (apiproxy)
                 └─ ctx.fs / git / watchPath / LSP
```

Decisions: [ADR-0001](./docs/adr/0001-file-editor-host-rpc.md) · [ADR-0002](./docs/adr/0002-file-editor-details-tab.md) · [PRD V1](./docs/prd/file-editor-v1.md)

## 🛠️ Development

```sh
pnpm install
pnpm run build
pnpm dsh web
pnpm run test:gui
pnpm run pack:dsh
```

See [CUSTOM.md](./CUSTOM.md) and [docs/repo-wiki/README.md](./docs/repo-wiki/README.md).

## ⚠️ Known limitations

- 5 MB read cap; no auto-save; not yet a standalone `dsh plugin add` npm package
- Listing caps: 1000 entries/level, 10000 dirent scan
- `custom/main` must be reconciled manually when merging upstream

## 🖥️ Platforms

macOS / Linux primary; Windows not fully validated. Node `^22.19` or `>=24`.

## 🔗 Upstream & docs

| Link | |
|------|---|
| [Upstream Harness](https://github.com/deepseek-ai/deepseek-harness) | Official repo |
| [This fork](https://github.com/NanGePlus/my-deepseek-harness) | `custom/main` |
| [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) | Ecosystem reference (sidebar plugin via npm) |
| [Web UI guide](./docs/user/guide/index.md) | Usage |

---

<p align="center">
  MIT License · Based on <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>
</p>
