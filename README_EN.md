# NanGeAGI

**An open-source AI Coding workbench built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)**

Chat with the agent in the browser or desktop app, and edit files, run Git, use a terminal, and preview web pages in the same UI—without switching between an IDE, terminal, and browser.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![version](https://img.shields.io/badge/version-0.1.0--rc.5-orange)

[中文](README.md) · Customizations: [CUSTOM.md](CUSTOM.md)

---

## AI Coding Skills

The toolbox’s five segments (resource manager → Git → terminal → browser → desktop shell) are the result of a full **DeepSeek Harness fork** iteration. The whole process followed a **controlled AI Coding** rhythm: align requirements, plan and slice work, implement step by step, fix bugs, and maintain architecture.

From domain vocabulary and PRDs through Issue slices to Host RPC and Client plugins, everything was done in collaboration with the agent under **AI Coding Skills**—not ad-hoc “vibe coding.” Each module was planned and landed on its own so features could grow while the overall structure stayed clear.

**Get AI Coding Skills**

| Channel | Link |
| --- | --- |
| Bilibili | [Get AI Coding Skills (Bilibili)](https://mall.bilibili.com/neul-next/detailuniversal/detail.html?page=detailuniversal_detail&itemsId=41424824&loadingShow=1&noTitleBar=1#noReffer=true&msource=merchant_share) |
| Patreon | [Get AI Coding Skills (Patreon)](https://www.patreon.com/nangeagi/posts/ni-shi-bu-shi-ye-166882633?utm_medium=clipboard_copy&utm_source=copyLink&utm_campaign=postshare_creator&utm_content=join_link) |

For an introduction and how to use AI Coding Skills, see:

Bilibili video: [https://www.bilibili.com/video/BV1zQNM6MEqf/](https://www.bilibili.com/video/BV1zQNM6MEqf/)
YouTube playlist: [https://www.youtube.com/playlist?list=PLRsjhp02BBRE](https://www.youtube.com/playlist?list=PLRsjhp02BBRE)

---

## Capabilities

### Agent platform (inherited from DeepSeek Harness)

| Capability | Description |
| --- | --- |
| **Multi-session agent chat** | Streaming replies; visible context and token usage |
| **Workspace** | Bind a local project directory; the agent reads, writes, and executes within it |
| **Tool calling** | Files, shell, web search, subagents, todo, plan, browser automation, etc. |
| **Permissions & approval** | Configurable confirmation for sensitive operations |
| **Model configuration** | DeepSeek API; Settings supports OpenAI-compatible endpoints |
| **Cordis plugin architecture** | Extend Host / Client capabilities as needed |

### This fork: five toolbox segments

In this fork, Harness’s upstream **details column** is product-named **Toolbox**. Open or close it from the session header **icon + “Toolbox”** capsule; the panel is resizable.

| Segment | Module | Highlights |
| --- | --- | --- |
| **Resource manager** | File editor | Monaco multi-tab, Markdown preview/source, syntax highlighting, LSP diagnostics, explicit save, Git line badges, drag-and-drop moves |
| **Git panel** | Source control | Change lists and commit graph, diff preview, hunk stage/discard, commit and push, Git action guards |
| **Terminal** | Human terminal | Multi-tab interactive shell (xterm), **fully separate** from agent `terminal_*` tools |
| **Browser** | Embedded browser | Multi-tab navigation; Web uses a headed Chromium window; desktop app uses in-panel WebView; agent `browser_*` shares the same instance with humans |
| **Tool details** | Tool output | Inspect agent tool calls; click tool rows in the message stream to jump here |

### Conversation enhancements

- Mermaid rendering with zoom preview
- Markdown / image ZoomPan viewing
- Selection **Add to Chat**; file paths in sent messages open in the editor

### Two delivery modes (both from source)

| Mode | Command | Notes |
| --- | --- | --- |
| **Web** | `pnpm dsh web` | Open the loopback URL printed in the terminal |
| **Desktop app** | `pnpm run dev:desktop` or `pnpm dsh desktop` | Electron shell + same SPA; prefer `dev:desktop` for daily dev (Vite HMR) |

Desktop and Web are **feature-equivalent** (same SPA + same Host capabilities). Desktop connects to the local Host over Electron IPC and does not bind a loopback HTTP port.

---

## Install & run

**Prerequisites**

- Node.js `^22.19` or `>=24`
- pnpm `11.7.0` (Corepack)
- [Git](https://git-scm.com/) (required for the Git panel; must be on `PATH`)
- Model API key (configure in-app under **Settings → Models**)

**Clone and build**

```sh
git clone https://github.com/NanGePlus/my-deepseek-harness.git
cd my-deepseek-harness
git checkout custom/main

corepack enable
pnpm install
pnpm run build
```

**Start Web (browser delivery)**

```sh
pnpm dsh web
```

Open the URL printed in the terminal (usually `http://127.0.0.1:3080`). After Client plugin UI changes, hard-refresh (`Cmd/Ctrl+Shift+R`).

**Start desktop app (Electron)**

```sh
pnpm run dev:desktop    # recommended: Vite HMR + Electron
# or
pnpm dsh desktop        # launch from built artifacts
```

**Update your local clone**

```sh
git pull && pnpm install && pnpm run build
# If only Client plugin UI changed, bundle the package then restart / hard-refresh
```

| Symptom | Fix |
| --- | --- |
| Official `npx @deepseek-ai/dsh web` lacks custom features | Build and run from this repo with `pnpm dsh web` |
| “Toolbox” or five segments not visible | Confirm `custom/main` and `pnpm run build`; hard-refresh |
| Client UI changes not showing | `pnpm --filter <package> run bundle`, then restart web or hard-refresh |
| Resource manager: file too large / directory “…” | ~5 MB per file; 1000 entries per directory level |

---

## Basic usage

1. **Configure model** — Settings → Models, enter API key (see [provider guide](docs/user/guide/providers.md)).
2. **Choose workspace** — Add and select the project root; file tree, Git, terminal, and browser all bind to that workspace.
3. **Work with the agent** — Describe tasks in a session (use **AI Coding Skills**; see [AI Coding Skills](#ai-coding-skills) above). The agent can read/write the repo, run commands, and browse the web via tools.
4. **Work in parallel as a human** — Edit files in the toolbox (⌘S / Ctrl+S to save), manage Git, open a shell, preview pages.
5. **View tool output** — Toolbox **Tool details**, or click tool rows in the message stream.

**Guards**: Unsaved editor tabs prompt save/discard when switching sessions or quitting the desktop app. Running terminal or browser tabs **do not** block session switches.

---

## Architecture (brief)

```text
Delivery
  ├─ Desktop app (Electron · desktop profile · IPC)
  └─ Web (dsh web · web profile · HTTP + SSE/WebSocket)

Host (Node)
  ├─ Agent runtime (sessions · tools · LLM · subagents …)
  └─ apiproxy RPC (files · Git · terminal · Playwright browser · LSP …)

Web Client (browser / Electron renderer)
  ├─ Chat (ui-conversation)
  └─ Toolbox
       ├─ ui-file-editor   resource manager
       ├─ ui-git           Git panel
       ├─ ui-terminal      human terminal
       ├─ ui-browser       browser
       └─ ui-tool          tool details
```

See [docs/architecture.md](docs/architecture.md) and [AGENTS.md](AGENTS.md) for upstream extension points.

---

## Development & build

```sh
pnpm install
pnpm run build              # Host + web frontend
pnpm dsh web                # Web delivery
pnpm run dev:desktop        # Desktop dev (HMR)
pnpm run test:gui           # Client / Host GUI unit tests
```

When only Client plugin UI changes, bundle the affected package before restart or hard-refresh, for example:

```sh
pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle
pnpm --filter @deepseek-ai/dsh-client-ui-file-editor run bundle
```

Fork differences from upstream: [CUSTOM.md](CUSTOM.md). Domain vocabulary: [CONTEXT.md](CONTEXT.md). For further fork work or bug fixes, keep using [AI Coding Skills](#ai-coding-skills) in `pnpm dsh web` or `pnpm run dev:desktop` sessions.

---

## Known limitations

- **Fork** of DeepSeek Harness; merging upstream is manual (integration branch `custom/main`).
- File editor has **no auto-save**; ~5 MB per file; 1000 entries per directory level (truncation shown as `…`).
- Linux desktop shell is out of V5 scope; on Linux use Web delivery via `pnpm dsh web` from source.
- Desktop shell V5 has **no** auto-update, multi-window, or remote Host co-boot.
- Official `npx @deepseek-ai/dsh web` does **not** include this toolbox fork; build and run from this repo.

---

## Documentation

| Document | Contents |
| --- | --- |
| [CUSTOM.md](CUSTOM.md) | Fork customization ledger and changelog |
| [CONTEXT.md](CONTEXT.md) | Domain language (toolbox, bound workspace, etc.) |
| [docs/prd/](docs/prd/) | Product specs (V1–V5) |
| [docs/adr/](docs/adr/) | Architecture decision records |
| [DeepSeek Harness docs](https://github.com/deepseek-ai/deepseek-harness) | Upstream platform and plugin development |

---

## License

[MIT](LICENSE) · Based on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) · Third-party notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

Maintained by [NanGePlus/my-deepseek-harness](https://github.com/NanGePlus/my-deepseek-harness)
