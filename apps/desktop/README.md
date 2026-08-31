# `@deepseek-ai/dsh-desktop-shell`

Electron desktop shell for DeepSeek Harness V5 ([ADR-0009](../../../docs/adr/0009-desktop-shell-electron-delivery.md)).

Main boots the `desktop` profile Host on App `ready`, serves the SPA via `dsh://` in production, and loads the Vite dev server during `pnpm run dev:desktop`. Attach mode (`DSH_DESKTOP_ATTACH`) skips integrated Host boot and points the Renderer at a running `dsh web` URL.

Standard shell (#117): single-instance lock with second-launch focus, close-to-quit with dirty-editor exit guard (reuses file-editor dialog), window bounds persisted under `desktop.windowBounds.v1`, and About / Settings / Quit application menu.

## Commands

```sh
pnpm run dev:desktop          # Vite HMR + Electron
pnpm dsh desktop              # launch built or source Main entry
DSH_DESKTOP_ATTACH=http://127.0.0.1:PORT pnpm dsh desktop
```

IPC RPC carrier (`IpcApiClient`) lands in Issue #116; this package exposes the preload skeleton and Host lifecycle only.

## Model Experience

No model-visible session events. Desktop delivery changes the human GUI carrier only.

## Known Limitations and Deferred Work

- Full SPA RPC over IPC requires Issue #116 (`IpcApiClient`).
- `electron-builder` packaging is Issue #120.
