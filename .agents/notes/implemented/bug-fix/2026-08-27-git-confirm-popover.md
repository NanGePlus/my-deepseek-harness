# Agent Note: Git confirm popover at the trigger

Status: implemented

English | [中文](2026-08-27-git-confirm-popover.zh.md)

## Problem

**提交**, **提交并推送**, and **推送** opened a confirm card centered in the Git split. `.dialogRoot` was `position:absolute; inset:0; place-items:center` on `.split`, so the card sat over the white diff preview. `.dialogCard` had no border or shadow, so the white fill did not read as a dialog.

## Decision

Action confirms (`commit` / `commitPush` / `push`) are `position:fixed` popovers. `confirmPopoverPosition` places the card's top-left at the trigger's bottom-right plus a 4px gap, then clamps a measured size into the viewport. The card uses `--dsw-alias-border-l2` and `--dsw-shadow-lv3`. Discard and guard dialogs stay centered in the split and share the new card chrome.

## Alternatives considered

**Reuse `Menu` portal placement (`align: end`, below the trigger).** Rejected: the request is the bottom-right corner, not a right-aligned dropdown under the button.

**Full-viewport dimming `Modal`.** Rejected: a mask fights the "next to the button" popover and still recenters the card.

**CSS-only `top:100%; left:100%` on `.commitActions`.** Rejected: Push lives on a different row, and ops-column overflow would clip an in-flow absolute card.

## Consequences

A confirm can overlay the diff preview when the trigger sits at the right edge of the ops column. Viewport clamp can pull a card back when the trigger is near the window edge. Discard/guard remain centered.

## Testing

`packages/client/ui-git/tests/git-confirm-popover.client.spec.ts` checks origin math, viewport clamp, and card chrome.

`packages/client/ui-git/tests/git-panel.client.spec.tsx` mocks the submit and push `getBoundingClientRect` and asserts the dialog's `left`/`top`.
