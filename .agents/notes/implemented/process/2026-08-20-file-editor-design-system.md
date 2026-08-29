# Agent Note: File-editor DESIGN.md is the brand-board SSOT

Status: implemented

English | [中文](2026-08-20-file-editor-design-system.zh.md)

## Problem

The file-editor V1 UI is spec-driven: page layout and product copy live in the PRD, while a brand board must still give UI implementers tokens, generic primitives, and do/don't rules they can cite without rewriting `ui-theme` or inventing a second palette. Grill already wrote `docs/design/DESIGN.md`. Without a close-out, later UI PRs can drift HEX into components, edit the brand board while shipping a page, or treat missing press/stroke details as a reason to expand the PRD token table.

## Decision

[`docs/design/DESIGN.md`](../../../../docs/design/DESIGN.md) is the file-editor brand board. It maps Harness `--dsw-alias-*` / `--ds-font-family-*` tokens onto generic primitives (including details segmented Tab and the file tab bar) and names editor overlay tokens in §4 (`editor-hover-tint`, `editor-selected-tint`, `editor-danger-hover-tint`, `editor-tab-active-line`, `editor-dirty-dot`). Runtime HEX and alias resolution stay in [`ui-theme`](../../../../packages/client/ui-theme/README.md) sheets; the living coding rules stay in [web-styling.md](../../../../docs/web-styling.md) and the [styling-system Agent Note](2026-07-19-web-styling-system.md). The Git panel and human terminal consume this same board without a second palette or §5 primitive; see the [Git panel design-system Agent Note](2026-08-25-git-panel-design-system.md) and the [human-terminal design-system Agent Note](2026-08-29-human-terminal-design-system.md).

Global tokens, palettes, and type scale in `DESIGN.md` change only through a Design Issue. UI implementation PRs consume those names (as aliases or local custom properties) and do not edit the brand board. The tertiary green ramp stays at the four published `--dsw-static-green-*` steps. Light-mode `--dsw-alias-brand-primary` is near-black (`#0F1115`); tab-edge emphasis follows that alias, not the DeepSeek-blue brand HEX.

Page layout, empty-state copy, and Git letter mapping stay in the PRD. `DESIGN.md` §5 stays generic primitives; the parent PRD 「待扩展 DESIGN §5」 list stays empty.

## Alternatives considered

- **Rewrite the grill brand board (new palette, 8–10 green steps, DeepSeek-blue tab edge).** Rejected: Issue #13 is acceptance-close, not a restyle, and `ui-theme` only publishes four green static steps. `--dsw-alias-brand-primary` in light is bluish-1000, so painting the tab edge DeepSeek blue would contradict the alias the rest of Web already consumes.
- **Let UI PRs patch `DESIGN.md` when a page needs a new tint.** Rejected: that mixes product layout work with brand-board ownership and is the exact leak the Design Issue / UI Issue split exists to prevent.
- **Move overlay tokens into `ui-theme` in this close-out.** Rejected: no file-editor CSS consumer exists yet; promoting names into the global sheet before a consumer would expand `ui-theme` without evidence. UI PRs may introduce local custom properties that match the §4 names, or a later Design Issue may add aliases once reuse is proven.
- **Leave `DESIGN.md` Chinese-only in the unsuffixed path.** Rejected: `docs/**` is in the translation-pairing corpus, so an unpaired file is not citeable under `doc-sync`.

## Consequences

UI implementers cite `DESIGN.md` §5/§6 and the PRD page list; they do not copy HEX into feature CSS or edit the brand board to land a page. Overlay tokens in §4 are names the first UI PR must realize, not a second theme. Adding a generic primitive that the PRD does not already reuse is a Design Issue plus a PRD 「待扩展 DESIGN §5」 entry, not a silent `DESIGN.md` append.
