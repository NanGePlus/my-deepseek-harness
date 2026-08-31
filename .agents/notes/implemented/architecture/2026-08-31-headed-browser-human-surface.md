# Agent Note: Headed Chromium is the human browser surface

Status: implemented

English | [中文](2026-08-31-headed-browser-human-surface.zh.md)

## Problem

The V4 toolbox browser painted Host Playwright JPEG frames into a Client `<img>` and synthesized pointer and keyboard events back onto the same `Page`. That kept Agent and human on one Context, but the human path was a remote-desktop stills stream: screenshots omit the caret, IME composition cannot sit on the insertion point, and component libraries that `preventDefault` on `mousedown` never receive a real focus. The product requirement is that after an Agent opens a page, a human can operate that same page with system-browser input.

`pnpm dsh web` cannot embed a second Chromium WebView inside the SPA. A full desktop shell is the next product version, not this change.

## Decision

`BrowserRegistry` launches the Workspace persistent context headed (`headless: false`, `viewport: null`). Create, select, navigate, reload, Agent click/type/select, and `host.browserShowWindow` call `page.bringToFront()`. Humans operate the visible Chromium window with native caret and IME. The toolbox **浏览器** segment keeps Tab chrome and address-bar remotes, shows a 「显示窗口」 card, and polls `browserList` while visible so titles and history stay current. JPEG screencast plus `sendPointer` / `sendKeyboard` remain on the wire as unused leftovers; the Client occupant no longer subscribes or forwards input. Integration tests pass `internals.headless: true` so CI does not open windows.

## Alternatives considered

- **Keep polishing JPEG remoting.** Rejected: caret, IME, and real focus cannot be reconstructed from screenshots at external-browser fidelity.
- **Ship a full Electron IDE first.** Rejected: the headed Playwright window satisfies the shared-instance and input requirements now; in-panel WebView waits for the later desktop wrap (`connectOverCDP`).
- **Client iframe as the human view.** Rejected earlier in ADR-0007: framing headers block arbitrary sites, and the iframe cannot share the Agent Context.

## Consequences

- Operators of local `dsh web` see a Chromium window on the Host machine. A remote browser talking to a server-side Host cannot see that window.
- Desktop wrap can keep this control plane and later replace the OS window with an in-panel WebView without rewriting Tab or Agent tools.
- Host integration tests must opt into headless; product default stays headed.
- Closing the headed window closes the persistent Context. The Registry evicts that pool; the next `createTab` relaunches, `closeTab` is idempotent, and `showWindow` raises `browser-tab-not-found` so the Client can restore store URLs.
