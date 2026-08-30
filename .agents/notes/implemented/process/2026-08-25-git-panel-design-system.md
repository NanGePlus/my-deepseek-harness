# Agent Note: Git panel V2 consumes the file-editor DESIGN.md

Status: implemented

English | [中文](2026-08-25-git-panel-design-system.zh.md)

## Problem

Git panel V2 is spec-driven: page layout and product copy live in the PRD, while UI implementers still need a citeable brand board. Without a close-out, later UI PRs can invent a second palette, add diff-hunk primitives to §5, treat destructive confirm or disabled icon buttons as missing named variants, or edit `DESIGN.md` while shipping `git-panel`.

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) is the brand board for the Git panel, human terminal, and file editor. The [file-editor design-system Agent Note](2026-08-20-file-editor-design-system.md) still owns overlay-token names, light-mode `--dsw-alias-brand-primary`, and the rule that UI implementation PRs do not edit global tokens.

§5 already supplies list row, multiline input, buttons, icon button, empty state, Loading (in-row / centered / list-top bar), status badge, card container, and details segmented Tab. Line-level diffs compose `semantic-success` / `semantic-error` with `--ds-font-family-code` at 13px/20px; they are not a new primitive. Destructive dialog confirm uses Primary geometry plus `editor-danger-hover-tint` hover and `semantic-error` helper copy. Disabled icon buttons use `label-caption` and cursor not-allowed. Overlay list columns use `--dsw-alias-bg-overlay`; code/preview panes use `--dsw-alias-markdown-code-block`.

The Git panel PRD 「待扩展 DESIGN §5」 list stays empty. Page layout, empty-state copy, and Git operation labels stay in the PRD.

## Alternatives considered

- **A second DESIGN.md or palette for the Git panel.** Rejected: the panel lives in the same toolbox column, follows the same Harness light/dark tokens, and the V2 PRD forbids rewriting the brand board.
- **Named §5 primitives for hunk headers, added/removed rows, or a sixth Danger button.** Rejected: the PRD already composes existing semantic colors, the code face, Primary geometry, and `editor-danger-hover-tint`; adding primitives would force a non-empty 「待扩展 DESIGN §5」 list.
- **Leave danger-button and disabled icon-button unspecified and block Issue #52.** Rejected: both are compositions of tokens §5 already names; recording them in the brand board keeps the PRD token table empty without a restyle.
- **Let git-panel UI PRs patch DESIGN.md when a preview type needs a new tint.** Rejected: that is the same brand-board leak the file-editor close-out already forbids.

## Consequences

UI implementers for app-shell, git-panel, human-terminal, and embedded-browser cite `DESIGN.md` §5/§6 and the PRD page list. They do not copy HEX into feature CSS, do not add a hunk-row primitive, and do not edit the brand board to land a page. A later generic primitive that the PRD does not already reuse is a Design Issue plus a PRD 「待扩展 DESIGN §5」 entry.
