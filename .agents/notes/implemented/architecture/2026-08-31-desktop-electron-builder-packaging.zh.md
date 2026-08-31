# Agent Note: 桌面 electron-builder 打包与 Chromium 捆绑（Issue #120）

Status: implemented

[English](2026-08-31-desktop-electron-builder-packaging.md) | 中文

## Problem

桌面 V5 须交付可安装的 macOS 与 Windows 产物，SPA 与 Host 能力与浏览器交付对等，且终端用户不得再执行 `playwright install chromium`。PRD 要求 CI 产出 unsigned 安装包、headless 校验捆绑的 `apps/web` dist 与 Chromium，并文档化 Windows 安装器选型（NSIS 与 portable exe）。

## Decision

`scripts/prepare-desktop-packaging.ts` 在 `dist/desktop/staging/` 下 staging：全量 build、复制 desktop/cli `lib/`、对 `apps/desktop-host-pkg`（`dsh-desktop-host-pkg`）执行 pnpm deploy（`--config.ignore-scripts=true`）、从 `apps/web/dist` 复制 `web-dist`，以及 `playwright install chromium` 到 `playwright-browsers`。另有一份 `host-runtime` extraResources 树保存 Host 闭包，供 smoke 与未来 spawn 接线。

`apps/desktop/electron-builder.yml` 将 `directories.app` 指向 staged app 树，`extraResources` 写入 `web-dist`、`playwright-browsers`、`host-runtime`。**Windows 目标为 NSIS**（`win.target: nsis`），非 portable exe。`scripts/run-electron-builder.mjs` 从 `apps/desktop` 调用 electron-builder，绕过 pnpm filter 安装钩子。`electronVersion: 35.7.5` 已固定。

Main 经 `resolvePackagingLayout()` 解析 packaged 路径，并在 Host boot 前调用 `applyPackagedRuntimeEnv()`，使 `PLAYWRIGHT_BROWSERS_PATH` 指向 `process.resourcesPath/playwright-browsers`，SPA 从 `process.resourcesPath/web-dist` 加载。Headless smoke 位于 `validatePackagedArtifactResources()`（`apps/desktop/src/artifact-smoke.ts`）与 `scripts/smoke-desktop-packaging.ts`。CI 工作流 `.github/workflows/desktop-packaging.yml` 先构建 unpacked 产物并跑 smoke，再产出 unsigned dmg（macOS）或 NSIS exe（Windows）。代码签名不在 V5 合并阻塞范围内。

## Alternatives considered

- **对 staging 树使用 `--prepackaged`。** 拒绝：electron-builder 期望已组装的 `.app` / `win-unpacked`，而非松散 app 目录；`directories.app` 才是支持的 staging 输入。
- **Windows 使用 portable exe。** 拒绝：PRD 将 NSIS 与 portable 留给实现 Issue；NSIS 支持选择安装目录，更符合常见桌面预期。
- **首次启动时由用户执行 `playwright install`。** 拒绝：违反 US-15 与 PRD 捆绑 Chromium 要求。
- **用 tsx 包装 electron-builder。** 拒绝：最小环境不保证根目录有 `tsx`；使用 `createRequire` 的纯 `.mjs` 包装即可。
- **将代码签名作为 V5 合并阻塞项。** 拒绝：PRD 明确允许 unsigned CI 产物；签名为后续工作。

## Consequences

安装包体积显著增大（Chromium 约 +150–300MB，叠加 Electron 与 Host 闭包）。本地打包首次运行 electron-builder 须能下载 Electron 二进制。CI 负责完整 dmg/exe 与 smoke；开发者可用 `pnpm run pack:desktop:dir` 与 `pnpm run smoke:desktop-packaging` 快速迭代。`apps/cli/src/profile-boot.ts` 同时解析 `src/` 与 `lib/types/` 布局的 preset 锚点，使 packaged CLI 路径在 deploy 后可用。

## Verification

- `apps/desktop/tests/packaging.spec.ts` — extraResources smoke、`PLAYWRIGHT_BROWSERS_PATH` 接线、layout 解析
- `.github/workflows/desktop-packaging.yml` — macOS / Windows unsigned dmg/exe 与 artifact smoke
