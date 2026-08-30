# Agent Note: Embedded browser V4 consumes the file-editor DESIGN.md

Status: implemented

English | [中文](2026-08-30-embedded-browser-design-system.zh.md)

## Problem

Embedded browser V4 is spec-driven: page layout and product copy live in the PRD, while UI implementers still need a citeable brand board. Without a close-out, later UI PRs can invent a second palette, add screencast-canvas or overflow-menu primitives to §5, treat dim loading overlays or inline external-site banners as missing named variants, or edit `DESIGN.md` while shipping `embedded-browser`.

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) is the brand board for the embedded browser as well as the file editor, Git panel, and human terminal. The [file-editor design-system Agent Note](2026-08-20-file-editor-design-system.md) still owns overlay-token names, light-mode `--dsw-alias-brand-primary`, and the rule that UI implementation PRs do not edit global tokens.

§5 already supplies details segmented Tab, the file tab bar (32px height, 2px `editor-tab-active-line`), icon button (24×24 toolbar, 28×28 close), inputs (address bar), empty state, Loading (centered 24px spinner plus 12px `label-secondary`), primary button (retry CTA), and card container. The browser tab bar reuses the file tab bar; navigation controls (← → ↻), external-open, and overflow triggers use the 24×24 ghost icon button; tab `×` uses a 20×20 hit target within the tab bar. The screencast canvas composes `--dsw-alias-markdown-code-block` as the preview-pane surface; JPEG frames fill the content area and it is not a new primitive. Address-bar focus composes §5 input focus geometry with a `semantic-info` stroke per the PRD; that pairing is not a new primitive. Navigation failure, external-site info, and browser-unavailable copy compose 12px `semantic-error` or `semantic-info` with optional primary retry; they are not new primitives. Overflow menu items (Hard Reload, Copy Current URL, Zoom) reuse existing menu patterns; V4 does not add a §5 dropdown primitive. Loading dim stays inside the screencast content area and does not full-screen-mask the entire dsh Web (§6).

The embedded-browser PRD 「待扩展 DESIGN §5」 list stays empty. Page layout, empty-state copy, and browser labels stay in the PRD.

## Alternatives considered

- **A second DESIGN.md or palette for the embedded browser.** Rejected: the browser lives in the same toolbox column, follows the same Harness light/dark tokens, and the V4 PRD forbids rewriting the brand board.
- **Named §5 primitives for the screencast canvas, overflow dropdown, or inline info/error strips.** Rejected: the PRD already composes existing surfaces, icon buttons, inputs, empty state, Loading, and semantic colors; adding primitives would force a non-empty 「待扩展 DESIGN §5」 list.
- **Leave screencast-surface or address-bar focus unspecified and block Issue #93.** Rejected: §2 and §5 already govern preview-pane surfaces and input focus; recording the PRD's `semantic-info` focus pairing closes the gap without a restyle.
- **Let ui-browser UI PRs patch DESIGN.md when screencast needs a new tint.** Rejected: that is the same brand-board leak the file-editor, Git-panel, and human-terminal close-outs already forbid.

## Consequences

UI implementers for app-shell and embedded-browser cite `DESIGN.md` §5/§6 and the PRD page list. They do not copy HEX into feature CSS, do not add a screencast-pane primitive, and do not edit the brand board to land a page. A later generic primitive that the PRD does not already reuse is a Design Issue plus a PRD 「待扩展 DESIGN §5」 entry.
