# @deepseek-ai/dsh-client-ui-browser

Embedded browser surface for the DeepSeek Harness Web toolbox **浏览器** segment. Registers into `conversation.details.browser`, keeps Tab rows and Client zoom per **workspaceId** (not Session log), and drives screencast display plus pointer/keyboard forwarding through `ctx.workspaces.browser*`.

## Model Experience

Human browser navigation in the toolbox does **not** write Session events. Agent `browser_*` tools remain model-visible through `@deepseek-ai/dsh-tool-browser` (separate package). Client zoom scales the JPEG screencast only; Host viewport semantics stay unchanged for Agent snapshots.

Segment hide aborts screencast SSE without closing Host tabs; re-entering the **浏览器** segment resumes the stream. Hard refresh rehydrates Tab rows and zoom from `dsh.browser.panel.v1`, syncs through Host `list`, and reconnects screencast. Hard Reload keeps the previous frame visible (no dim overlay); soft reload and SSE connect still use the dim loading overlay.

## Known Limitations and Deferred Work

- None.
