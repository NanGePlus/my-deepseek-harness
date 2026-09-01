# `@deepseek-ai/dsh-desktop-app`

English | [中文](README.zh.md)

The dsh **desktop Host surface** bundle. [`cordis.patch.yml`](cordis.patch.yml) layers over [`dsh-base`](../base/README.md): it mounts the same Host capabilities as the Web surface (apiproxy, Playwright browser registry, workspace, storage, LSP, and the toolbox client roster) **without** `dsh-host-webserver`, HTTP static serving, or the loopback-only rows (`modules`, `client-hmr`). `connection` is present so its client half enters the SPA boot graph; the node half stays idle without `webServer`. Electron Main boots this profile and reaches the Host over IPC ([ADR-0009](../../../docs/adr/0009-desktop-shell-electron-delivery.md)).

Verify the composed tree with `dsh --profile desktop --dump-config`.

## Model Experience

This bundle adds no model-visible prompt sections or tools of its own; it composes Host rows and client roster entries whose model-visible behavior is owned by those plugins and the shipped agent presets.

## Known Limitations and Deferred Work

- Loopback HTTP transport and `/plugins` static serving are intentionally absent; [`IpcApiClient`](../../../docs/adr/0009-desktop-shell-electron-delivery.md) lands in the IPC carrier Issue (#116).
- The Electron shell, `dsh desktop`, and `pnpm run dev:desktop` entry points are separate desktop delivery Issues.
