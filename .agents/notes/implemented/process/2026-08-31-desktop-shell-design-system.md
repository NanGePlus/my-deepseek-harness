# Agent Note: Desktop shell V5 SPA content consumes the file-editor DESIGN.md

Status: implemented

English | [中文](2026-08-31-desktop-shell-design-system.zh.md)

## Problem

Desktop shell V5 is spec-driven: page layout and product copy live in the PRD, while UI implementers still need a citeable brand board for SPA content. Without a close-out, later UI PRs can add native menu or window-chrome primitives to §5, use full-screen native overlays for exit guard, invent a BrowserView occupant primitive, or edit `DESIGN.md` while shipping the desktop shell.

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) is the brand board for SPA content inside the desktop shell—the same board as browser delivery. Native desktop chrome (application menu, title bar, traffic lights, window borders) follows platform HIG / Fluent and is **not** in `DESIGN.md`. The [file-editor design-system Agent Note](2026-08-20-file-editor-design-system.md) still owns overlay-token names, light-mode `--dsw-alias-brand-primary`, and the rule that UI implementation PRs do not edit global tokens.

**app-shell** SPA content reuses the Web three-column layout and §5 details segmented Tab. Host boot loader, connection connecting state, and loud boot errors stay inside the SPA viewport—no full-screen native mask (§6).

**Exit guard** reuses the same per-file save / discard / cancel dialog as Session switch guard (`--dsw-alias-bg-layer-3` dialog / confirm surface, `editor-dirty-dot` on tabs). Native Quit / close-window triggers that chain; it does not add a full-screen native overlay.

**embedded-browser** desktop occupant inherits the [embedded-browser design-system Agent Note](2026-08-30-embedded-browser-design-system.md): Tab bar, navigation, address bar, overflow, empty state, and Loading unchanged; the 「show window」 card is removed. The **panel WebView** occupant composes `--dsw-alias-markdown-code-block` as the preview-pane surface (same as screencast canvas); BrowserView bounds fill the occupant rectangle and it is not a new primitive. Error and empty overlays draw above or behind the BrowserView per PRD state strategy, still inside the toolbox column.

The desktop V5 PRD 「待扩展 DESIGN §5」 list stays empty. Page layout, native menu labels, and desktop-specific copy stay in the PRD.

## Alternatives considered

- **Add native menu, title bar, or traffic-light primitives to DESIGN §5.** Rejected: the PRD assigns shell chrome to platform native specs; adding primitives would force a non-empty 「待扩展 DESIGN §5」 list.
- **Full-screen native overlay for exit guard or Host boot failure.** Rejected: conflicts with §6 (no full-screen mask of entire dsh Web); the PRD requires SPA boot error and dirty-editor dialog patterns.
- **A second DESIGN.md or palette for desktop delivery.** Rejected: the desktop SPA loads the same `apps/web` bundle with functional parity; a second board would break parity.
- **Named §5 primitive for BrowserView occupant.** Rejected: the PRD composes the existing preview-pane surface; the embedded-browser close-out already governs Tab, nav, empty, and Loading.
- **Let desktop UI PRs patch DESIGN.md for native chrome tints.** Rejected: that is the same brand-board leak prior close-outs already forbid.

## Consequences

UI implementers for desktop `app-shell` and `embedded-browser` cite `DESIGN.md` §5/§6, the PRD page list, and platform HIG / Fluent for native chrome. They do not copy HEX into feature CSS, do not add shell-chrome or BrowserView primitives, and do not edit the brand board to land a page. A later generic primitive that the PRD does not already reuse is a Design Issue plus a PRD 「待扩展 DESIGN §5」 entry.
