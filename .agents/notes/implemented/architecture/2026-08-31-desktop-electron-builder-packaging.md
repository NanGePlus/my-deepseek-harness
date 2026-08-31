# Agent Note: Desktop electron-builder packaging and Chromium bundle (Issue #120)

Status: implemented

English | [中文](2026-08-31-desktop-electron-builder-packaging.zh.md)

## Problem

Desktop V5 must ship installable macOS and Windows artifacts with the same SPA and Host capabilities as browser delivery, without requiring end users to run `playwright install chromium`. The PRD requires unsigned CI artifacts, headless validation of bundled `apps/web` dist and Chromium, and documented Windows installer choice (NSIS vs portable exe).

## Decision

Packaging stages inputs under `dist/desktop/staging/` via `scripts/prepare-desktop-packaging.ts`: full repository build, copied desktop/cli `lib/`, pnpm deploy of `apps/desktop-host-pkg` (`dsh-desktop-host-pkg`) with `--config.ignore-scripts=true`, `web-dist` from `apps/web/dist`, and `playwright install chromium` into `playwright-browsers`. A duplicate `host-runtime` extraResources tree holds the deployed Host closure for smoke and future spawn wiring.

`apps/desktop/electron-builder.yml` sets `directories.app` to the staged app tree and `extraResources` for `web-dist`, `playwright-browsers`, and `host-runtime`. **Windows target is NSIS** (`win.target: nsis`), not portable exe. `scripts/run-electron-builder.mjs` invokes electron-builder from `apps/desktop` without pnpm filter install hooks. `electronVersion: 35.7.5` is pinned.

Main resolves packaged paths through `resolvePackagingLayout()` and calls `applyPackagedRuntimeEnv()` before Host boot so `PLAYWRIGHT_BROWSERS_PATH` points at `process.resourcesPath/playwright-browsers` and SPA assets load from `process.resourcesPath/web-dist`. Headless smoke lives in `validatePackagedArtifactResources()` (`apps/desktop/src/artifact-smoke.ts`) and `scripts/smoke-desktop-packaging.ts`. CI workflow `.github/workflows/desktop-packaging.yml` builds unpacked output, runs smoke, then produces unsigned dmg (macOS) or NSIS exe (Windows). Code signing remains out of V5 scope.

## Alternatives considered

- **`--prepackaged` pointing at the staging tree.** Rejected: electron-builder expects an already assembled `.app` / `win-unpacked` bundle, not a loose app directory; `directories.app` is the supported staging input.
- **Portable exe on Windows.** Rejected: PRD leaves NSIS vs portable to the implementing issue; NSIS supports install directory choice and matches common desktop expectations.
- **End-user `playwright install` at first launch.** Rejected: violates US-15 and PRD bundled-Chromium requirement.
- **tsx wrapper for electron-builder.** Rejected: root `tsx` is not guaranteed on minimal installs; a plain `.mjs` wrapper using `createRequire` is sufficient.
- **Code signing as a V5 merge blocker.** Rejected: PRD explicitly allows unsigned CI artifacts; signing is follow-up work.

## Consequences

Installers are significantly larger (~150–300MB Chromium on top of Electron and Host closure). Local pack requires network access to download the Electron binary on first builder run. CI owns full dmg/exe + smoke validation; developers run `pnpm run pack:desktop:dir` and `pnpm run smoke:desktop-packaging` for faster iteration. `apps/cli/src/profile-boot.ts` resolves preset anchors for both `src/` and `lib/types/` layouts so packaged CLI paths work after deploy.

## Verification

- `apps/desktop/tests/packaging.spec.ts` — extraResources smoke, `PLAYWRIGHT_BROWSERS_PATH` wiring, layout resolution
- `.github/workflows/desktop-packaging.yml` — unsigned dmg/exe + artifact smoke on macOS and Windows
