# @deepseek-ai/dsh-client-ui-browser

Embedded browser surface for the DeepSeek Harness Web toolbox **浏览器** segment. Registers into `conversation.details.browser`, keeps Tab rows and Client zoom per **workspaceId** (not Session log), and drives screencast display plus pointer/keyboard forwarding through `ctx.workspaces.browser*`.

## Model Experience

Human browser navigation in the toolbox does **not** write Session events. Agent `browser_*` tools remain model-visible through `@deepseek-ai/dsh-tool-browser` (separate package). Client zoom scales the JPEG screencast only; Host viewport semantics stay unchanged for Agent snapshots.

## Known Limitations and Deferred Work

- Overflow menu (Hard Reload, Copy URL, Zoom controls), external-open, and non-localhost inline info belong to later browser UI slices.
- **浏览器不可用** Host card + retry is deferred until the unavailable-state slice lands.
