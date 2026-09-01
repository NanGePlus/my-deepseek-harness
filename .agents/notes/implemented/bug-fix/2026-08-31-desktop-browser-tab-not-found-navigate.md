# Agent Note: Desktop browser tab-not-found on navigate

Status: implemented

English | [中文](2026-08-31-desktop-browser-tab-not-found-navigate.zh.md)

## Problem

Submitting the toolbox browser address bar showed a red **browser tab not found: &lt;uuid&gt;** bar with **重试**. Reload already recovered a missing Host tab; navigate did not. After an Electron/Host restart the Client store still holds the previous UUID while bootstrap remaps asynchronously. Enter during that window, or a later Host drop of the same tab, sent the stale id. Retry captured the navigate closure that still named that id, so **重试** repeated the failure.

## Decision

Address-bar submit, session/popup open, and history back/forward use the same recover-and-retry path as reload: on `browser-tab-not-found`, `list` or recreate from the store, then repeat the RPC with the live tab id. Submits that arrive before Host tabs are ready are queued and flushed after remap. Navigate retry reads the current `handleNavigate` rather than the failing closure.

## Alternatives considered

**Disable the address bar until `hostTabsReady`.** Rejected as the only fix: a later Host tab drop would still paint the same red bar, and reload already had the recover path.

**Preserve Client tab UUIDs in Host `createTab`.** Rejected: remap after `list` is the existing restart contract; teaching Host to adopt persisted ids duplicates that.

**Leave retry on the failing closure.** Rejected: after bootstrap remaps the selected tab, **重试** would still call `navigate` with the stale UUID.

## Consequences

A typed URL is not sent until bootstrap remaps, then it targets the live tab. A Host tab that disappears after ready remaps the store and retries once. Session links that arrive during preparing wait for the same ready edge.

## Testing

`packages/client/ui-browser/tests/browser-panel-desktop.client.spec.tsx`: address-bar recover after `browser-tab-not-found`; submit during hung `list` is flushed onto the remapped tab; session URL during preparing waits; history back recovers.
