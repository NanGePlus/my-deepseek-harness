# Agent Note: Human terminal V3 consumes the file-editor DESIGN.md

Status: implemented

English | [中文](2026-08-29-human-terminal-design-system.zh.md)

## Problem

Human terminal V3 is spec-driven: page layout and product copy live in the PRD, while UI implementers still need a citeable brand board. Without a close-out, later UI PRs can invent a second palette, add xterm or shell-dropdown primitives to §5, treat inline error banners or disabled `+` as missing named variants, or edit `DESIGN.md` while shipping `human-terminal`.

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) is the brand board for the human terminal as well as the file editor and Git panel. The [file-editor design-system Agent Note](2026-08-20-file-editor-design-system.md) still owns overlay-token names, light-mode `--dsw-alias-brand-primary`, and the rule that UI implementation PRs do not edit global tokens.

§5 already supplies details segmented Tab, the file tab bar (32px height, 2px `editor-tab-active-line`, 28×28 ghost close), icon button (24×24 toolbar, 28×28 close), empty state, Loading (centered 24px spinner plus 12px `label-secondary`), primary button (retry CTA), and card container. The terminal tab bar reuses the file tab bar; Kill uses the 28×28 ghost icon button; `+` uses the 24×24 ghost icon button. The xterm canvas composes `--dsw-alias-markdown-code-block` with `--ds-font-family-code` at 13px/20px; it is not a new primitive. xterm light/dark follows the same Harness theme as Monaco. Inline spawn/write/reconnect errors compose 12px `semantic-error` copy with optional primary retry; they are not a new primitive. Shell profile dropdown items reuse existing menu patterns; V3 does not add a §5 dropdown primitive.

The human terminal PRD 「待扩展 DESIGN §5」 list stays empty. Page layout, empty-state copy, and terminal labels stay in the PRD.

## Alternatives considered

- **A second DESIGN.md or palette for the human terminal.** Rejected: the terminal lives in the same toolbox column, follows the same Harness light/dark tokens, and the V3 PRD forbids rewriting the brand board.
- **Named §5 primitives for the xterm pane, shell dropdown, or terminal error strip.** Rejected: the PRD already composes existing surfaces, the code face, icon buttons, empty state, Loading, and `semantic-error`; adding primitives would force a non-empty 「待扩展 DESIGN §5」 list.
- **Leave xterm typography unspecified and block Issue #74.** Rejected: §3 and §6 already govern the code face for Monaco and line-level diffs; extending the same rule to xterm closes the gap without a restyle.
- **Let ui-terminal UI PRs patch DESIGN.md when xterm needs a new tint.** Rejected: that is the same brand-board leak the file-editor and Git-panel close-outs already forbid.

## Consequences

UI implementers for app-shell, human-terminal, and embedded-browser cite `DESIGN.md` §5/§6 and the PRD page list. They do not copy HEX into feature CSS, do not add an xterm-pane primitive, and do not edit the brand board to land a page. A later generic primitive that the PRD does not already reuse is a Design Issue plus a PRD 「待扩展 DESIGN §5」 entry.
