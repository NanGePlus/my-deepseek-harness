# Agent Note: Git graph compact ref pills

Status: implemented

English | [中文](2026-08-27-git-graph-compact-ref-pills.zh.md)

## Problem

Graph ref pills used `inline-flex` with `text-overflow: ellipsis` on the flex container, so long branch names did not ellipsize. Padding and 18px line-height made each pill fill the 24px row. Hovering a pill had no way to read the full ref or the commit message.

## Decision

Pills are 14px tall and cap at 80px (88px with the remote cloud). An inner label span owns `min-width: 0` and the ellipsis. When a commit has refs, those pills sit on a second 16px line, right-aligned under the subject, so they do not cover the author; rows without refs stay 24px. Tagged rows use `flex: none` so the Graph list does not shrink them back to 24px. Graph nodes stay on the subject-line center; SVG Y uses cumulative row tops. Hovering a pill shows a `position:fixed` GitLens-style card (not an in-row popover, because `.graphRow` uses `overflow: hidden`) with the full ref, author, relative and absolute time, subject, body, and short hash. `host.gitLog` adds `%aI` and `%b` so the card does not need a second RPC. The card stays open while the pointer moves onto it (120ms hide delay) and closes when Graph collapses.

## Alternatives considered

**Native `title` tooltip.** Rejected: it cannot show author, times, or the commit body.

**Reuse `Tooltip` from ui-primitives.** Rejected: that bubble is a string label with `pointer-events: none`; the card must be rich text the pointer can enter.

**Portal to `document.body`.** Rejected: the existing tooltip pattern already escapes ancestor overflow with `position:fixed` and does not add a `react-dom` dependency on ui-git.

**Keep pills on the subject line.** Rejected: in the 260px ops column they overlap the author.

## Consequences

The hover card does not offer "Open on GitHub"; `host.gitLog` still does not resolve a remote HTML URL. A page of 50 commits now includes author dates and bodies on the wire.

## Testing

`packages/host/apiproxy/tests/parse-git-log.spec.ts` asserts `%aI` / `%b` fields and newlines inside the body.

`packages/client/ui-git/tests/git-graph-card.client.spec.ts` asserts relative-age buckets and viewport placement.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` hovers a long `origin/` pill, asserts the card, then covers hide delay, card-enter, collapse, an empty body/date on a local ref, and pills living on a second line after the author.

`packages/client/ui-git/tests/git-graph-layout.client.spec.ts` asserts node Y stays on the subject line when a later row grows for pills.
