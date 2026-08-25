# Design system document: DeepSeek Harness file editor

English | [中文](DESIGN.zh.md)

> UI mode: `spec-driven` (spec-driven UI)
>
> Global tokens, palettes, and type scale change only through a Design Issue; UI implementation PRs must not edit them. Page layout and product copy live in the PRD. Runtime `--dsw-*` values are owned by [`ui-theme`](../../packages/client/ui-theme/README.md) sheets; this file is the brand-board mapping. The Git panel in the same toolbox column consumes this board and does not define a second palette, type scale, or §5 primitive. See [web-styling.md](../web-styling.md), the [file-editor design-system Agent Note](../../.agents/notes/implemented/process/2026-08-20-file-editor-design-system.md), and the [Git panel design-system Agent Note](../../.agents/notes/implemented/process/2026-08-25-git-panel-design-system.md).

## 1. Overview and creative north star

### Creative north star: 「Side-by-side workshop」

The file editor is not a standalone product. It is a collapsible coding panel nested in the DeepSeek Harness Web details column: conversation stays primary, editing stays secondary. Visuals inherit `ui-theme` `--dsw-alias-*` tokens at 100%. The Monaco theme is derived from the same tokens and switches with light/dark in lockstep with the conversation pane.

The way out of template UI is surface steps and ghost interaction states, not card shadows or heavy borders. The file tree is as dense as an IDE; the editor surface matches conversation code-block surfaces so the user feels they are editing the same kind of code they already see in the session. Dual-layer tabs (details segmented control + file tab bar) carry state with a bottom edge and a warn dot inside a narrow column, without extra chrome.

---

## 2. Color and surface architecture

The file editor does not define a separate palette. Four roles map onto the dsh static scale: primary is DeepSeek blue (brand and emphasis), secondary is generic blue (links and info), tertiary is green (success feedback), and neutral is the bluish gray scale (surfaces and copy). Light/dark follow the Harness global theme.

### Palette (must be visualizable on a brand board)

| Role | Primary HEX | Steps (light → dark, with HEX) |
|------|-------------|-------------------------------|
| Primary (DeepSeek) | `#4176E6` | `#EDF3FE` · `#E4EDFD` · `#D3E2FF` · `#B7C8FE` · `#679EFE` · `#5686FE` · `#4176E6` · `#4868B2` · `#2F4C8F` · `#283142` |
| Secondary (Blue) | `#3B82F6` | `#EFF6FF` · `#E5F0FF` · `#DBEAFE` · `#93C5FD` · `#60A5FA` · `#4D93F8` · `#3B82F6` · `#2563EB` · `#1E40AF` · `#0E3074` |
| Tertiary (Green) | `#22C55E` | `#E6FAED` · `#4ED17E` · `#22C55E` · `#233C2C` |
| Neutral (Bluish) | `#0F1115` | `#FFFFFF` · `#F9FAFB` · `#F5F6F7` · `#F1F3F5` · `#EBEEF2` · `#E1E5EE` · `#CFD3D6` · `#ADB2B8` · `#979DA6` · `#61666B` · `#151517` · `#0F1115` |

Tertiary green inherits only the four published `--dsw-static-green-*` steps in `ui-theme` (100 / 400 / 500 / 900). This document does not invent extra steps to reach an 8–10 ramp.

### Semantic color (must be visualizable on a brand board)

Semantic colors reuse dsh aliases. Light-mode HEX values follow; dark mode overrides the same alias names on `body[data-ds-dark-theme]`.

| Role | Token | HEX | Source |
|------|-------|-----|--------|
| Error | `semantic-error` → `--dsw-alias-state-error-primary` | `#EC1313` | Independent red |
| Success | `semantic-success` → `--dsw-alias-state-success-primary` | `#22C55E` | Independent green |
| Warning | `semantic-warning` → `--dsw-alias-state-warn-primary` | `#F59E0B` | Independent amber |
| Info | `semantic-info` → `--dsw-alias-state-business-primary` | `#4176E6` | Derived from DeepSeek primary |

### No-stroke partitioning rule

**Explicit instruction:** Do not use a 1px solid line as the primary divider between an overlay list column and a code/preview pane, or between list rows. Use the surface contrast of `--dsw-alias-bg-overlay` versus `--dsw-alias-markdown-code-block`, or a single vertical ghost line of `--dsw-alias-border-l2` (≤1px equivalent opacity) between those columns. Selected tabs may use a 2px bottom edge of `--dsw-alias-brand-primary`.

In light mode `--dsw-alias-brand-primary` is `--dsw-static-neutral-bluish-1000` (`#0F1115`), not DeepSeek blue. Tab-edge emphasis follows that alias. DeepSeek blue remains the brand-board primary HEX and `--dsw-alias-brand-primary-new-colorprimary-new-color`.

### Surface layers and nesting

| Layer | Token | Light HEX | Use |
|-------|-------|-----------|-----|
| Base | `--dsw-alias-bg-base` | `#FFFFFF` | details column background |
| File-tree pane | `--dsw-alias-bg-overlay` | `#E9ECF2` | overlay list column (file tree or other operation lists) |
| Editor pane | `--dsw-alias-markdown-code-block` | `#F9FAFB` | code/preview pane (Monaco or line-level diffs) |
| Hint / empty-state card | `--dsw-alias-bg-overlay` | `#E9ECF2` | grouping container, 8px radius |
| Dialog / confirm | `--dsw-alias-bg-layer-3` | `#FFFFFF` | reuse the Harness overlay when present |

Dark mode: `bg-base` `#151517`, `bg-overlay` `#61666B`, `markdown-code-block` `#1B1B1C`.

### Glass and gradient rules

Not applicable; skip. The file editor does not use frosted glass or a signature gradient. Depth comes from surface steps and ghost interaction states.

---

## 3. Type: Harness-inherited type

UI copy uses `--dsw-font-family` (including PingFang SC and the system stack). The Monaco code pane and line-level diffs use `--ds-font-family-code` (SF Mono / JetBrains Mono stack). Pairing reason: it matches conversation code blocks, so editable and previewed code share one face.

### Type scale (must be visualizable on a brand board)

| Role | Family | Use | Sample size |
|------|--------|-----|-------------|
| Heading | `--dsw-font-family` | details segmented Tab labels, dialog titles | 14px/20px semibold |
| Body | `--dsw-font-family` | file-tree names, empty-state body | 13px/18px regular |
| Label | `--dsw-font-family` | micro badges, search placeholder, caption | 10–12px/12–16px regular |
| Code | `--ds-font-family-code` | Monaco pane and line-level diffs | 13px/20px regular |

### Information hierarchy

Titles (tabs, dialogs) use `label-primary`. Tree nodes, list paths, and tab titles use 13px `label-primary`. Supporting copy and badges use `label-secondary` / `label-caption`. Monaco and line-level diffs use 13px/20px to keep IDE density; list row height 22px against 13px body is a tight contrast, not a larger type size.

### Font implementation constraints (required for constrained runtimes)

Not applicable; skip. Pure Web embedded in Harness. Monaco is injected with `fontFamily: var(--ds-font-family-code)`. No custom font loading and no mockup/implementation font split.

| Touchpoint | Mockup font | Implementation font / fallback | Loading |
|------------|-------------|-------------------------------|---------|
| Web file editor | Same as implementation | `--ds-font-family-code` / `--dsw-font-family` | System stack, no extra load |

---

## 4. Hierarchy and depth

Hierarchy is built with tonal stacking, not wireframes or shadows. Avoid floating shadowed cards inside the narrow details column.

* **Stacking:** the overlay list column sits lighter than the code/preview pane. Selection and hover lift a row with an interaction tint, not a z-index shadow.
* **Ambient shadow:** file editor V1 does not use box-shadow. Lift comes only from surface contrast and the tab bottom edge.
* **Ghost stroke fallback:** inputs default to `--dsw-alias-border-l2` (light `rgba(0,0,0,0.1)`); focus switches to `--dsw-alias-brand-primary`. The overlay-list / code-preview split may use a single `border-l2` vertical line.

### Overlay table (must be visualizable on a brand board)

| Token | Base | Opacity | Precomputed HEX (light) | Use |
|-------|------|---------|-------------------------|-----|
| `editor-hover-tint` | `rgb(38, 49, 72)` | 6% | `#F2F3F4` | list-row hover |
| `editor-selected-tint` | `--dsw-static-neutral-bluish-75` | 100% | `#F1F3F5` | list-row selected |
| `editor-danger-hover-tint` | `--dsw-static-red-600` | 5% | `#FEF5F5` | danger-action hover (delete) |
| `editor-tab-active-line` | `--dsw-alias-brand-primary` | 100% | `#0F1115` | 2px tab bottom edge (light) |
| `editor-dirty-dot` | `--dsw-alias-state-warn-primary` | 100% | `#F59E0B` | unsaved-tab dot |

In dark mode `editor-hover-tint` is `rgba(255,255,255,0.08)` over `#151517` ≈ `#2A2A2C`; `editor-selected-tint` is `#353638`.

---

## 5. Components

Every component is a generic UI primitive for toolbox UIs to consume. Colors reference alias tokens. Repeated overlays reference §4 token names. Line-level added/removed text uses `semantic-success` / `semantic-error` with the §3 code face; that pairing is not a new primitive.

### Buttons and interaction (must be visualizable on a brand board)

* **Primary:** background `--dsw-alias-button-primary-fill`; text `--dsw-alias-label-primary-foreground` (light: `#FFFFFF` on dark fill); radius 6px; hover `--dsw-alias-button-primary-hover`; pressed `--dsw-alias-interactive-bg-active`.
* **Secondary:** background `--dsw-alias-button-elevated-fill`; text `--dsw-alias-label-primary`; radius 6px; hover `--dsw-alias-button-floating-hover`; pressed `--dsw-alias-interactive-bg-active`.
* **Outline:** background transparent; border `--dsw-alias-border-l2`; text `--dsw-alias-label-primary`; radius 6px; hover background `--dsw-alias-button-ghost-active-fill`; pressed `--dsw-alias-interactive-bg-active`.
* **Text:** no fill; text `--dsw-alias-label-secondary`; radius 6px; hover text `--dsw-alias-label-primary`; pressed background `--dsw-alias-interactive-bg-active`.
* **Inverse:** background `--dsw-alias-button-contrast-fill` (`#61666B` light); text `--dsw-alias-label-primary-foreground`; radius 6px; hover slightly lighter `--dsw-alias-button-primary-hover`; pressed `--dsw-alias-interactive-bg-active`; for a light CTA on a dark editor pane (use sparingly).
* Destructive dialog confirm uses Primary geometry; hover may use `editor-danger-hover-tint`; helper copy uses `semantic-error`.

### Inputs and forms

* **Default:** background `--dsw-alias-bg-base`; border `--dsw-alias-border-l2`; text `--dsw-alias-label-primary`; radius 6px; height 28px (default single line).
* **Focus:** border `--dsw-alias-brand-primary`; no outer glow; 1px-equivalent ghost at most.
* **Error:** border `semantic-error` (`#EC1313`); helper copy `semantic-error`; used for validation failures such as a name collision.
* **Disabled:** text `--dsw-alias-label-caption`; border `--dsw-alias-border-l2`; background `--dsw-alias-bg-overlay`; no focus stroke; cursor not-allowed.
* **Multiline:** same fill, border, text, radius, focus, error, and disabled tokens as the single line; min-height 72px; padding 8px 10px; type 13px/18px (`--dsw-font-family`); overflow auto; no corner resize handle. Placeholder color is `label-caption`; this document does not specify product placeholder copy.

### Card container

* Radius 8px; padding 12px; background `--dsw-alias-bg-overlay`; no shadow; no product content layout.

### List row

* Row height 22px; row gap 0; no row divider; indent 12px per level.
* **hover:** background `editor-hover-tint`.
* **selected:** background `editor-selected-tint`.
* 16px icon at the start of the row; micro-badge at the end of the row.

### Navigation

* **details segmented Tab:** horizontal segmented control; selected background `editor-selected-tint` + 2px bottom edge `editor-tab-active-line`; unselected text `label-secondary`.
* **File tab bar:** horizontal scroll; tab height 32px; selected 2px bottom edge `editor-tab-active-line`; unsaved indicator is a 6px `editor-dirty-dot` before the title; close control is a 28×28 ghost icon button.

### Search field

* Flush to the top of the list; height 28px; 16px search icon on the left in `label-caption`; background `bg-base`; border `border-l2`; radius 6px; focus stroke `brand-primary`; when the field has content, a 24×24 ghost clear icon button on the right. Placeholder color is `label-caption`; this document does not specify product placeholder copy.
* No dropdown-result pattern (no global search; skip).

### Status badge

* Padding 0 4px; radius 3px; type 10px / 12px line-height; letter-spacing 0.02em.
* **Generic sample:** text `semantic-error` (`#EC1313`), no fill or background `editor-danger-hover-tint`. Do not map product status names here.

### Icon button

* Stroke width 0px (ghost; no outline). Toolbar size 24×24; close / collapse size 28×28.
* Default icon `label-secondary`; hover background `editor-hover-tint`; active background `editor-selected-tint`, icon `label-primary`.
* **Selected:** same as active, used for a pressed toggle (for example a folder expanded).
* **Disabled:** icon `label-caption`; no hover fill; cursor not-allowed.

### Empty state

* 48px outline icon in `label-caption`; title 14px `label-primary`; body 12px `label-secondary`; optional CTA uses the primary button; the whole block sits in a card container, vertically centered.

### Loading

* **In-row:** 16px spinner in `label-caption` on the right of that row.
* **Centered in content:** 24px spinner plus 12px `label-secondary` copy.
* **List-top bar:** 2px-tall indeterminate bar in `semantic-info`; do not mask the whole list.

---

## 6. Do and don't

### Do:

* **Do** consume every color and font through `--dsw-alias-*` / `--ds-font-family-*`. Do not write literal HEX in components.
* **Do** derive the Monaco theme from dsw tokens so it switches with light/dark and the conversation pane.
* **Do** use ghost hover/selected on overlay list rows at compact 22px, and keep letter badges or row actions on the right.
* **Do** mark an unsaved tab with `editor-dirty-dot`. Do not silently drop an edit buffer before save.
* **Do** use layered Loading for async work. Do not use a full-screen mask.

### Don't:

* **Don't** introduce a second theme palette or a Tailwind/component library inside toolbox UIs.
* **Don't** use a 1px solid border as the primary partition (except input focus and the tab bottom-edge emphasis).
* **Don't** full-screen-mask the entire dsh Web (async feedback stays inside the toolbox column).
* **Don't** use UI sans-serif in the Monaco pane or in line-level diffs.
* **Don't** use Session, Workspace, or Agent as visual labels in this design-system document.
