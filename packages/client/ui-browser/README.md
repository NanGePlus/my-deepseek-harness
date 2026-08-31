# @deepseek-ai/dsh-client-ui-browser

Embedded browser chrome for the DeepSeek Harness Web toolbox **浏览器** segment. Registers into `conversation.details.browser`, keeps Tab rows and Client zoom per **workspaceId** (not Session log), and remotes the Host headed Chromium window through `ctx.workspaces.browser*`.

## Model Experience

Human navigation in the toolbox does **not** write Session events. Agent `browser_*` tools remain model-visible through `@deepseek-ai/dsh-tool-browser` (separate package). Humans type and click in the headed Chromium window that shares the Workspace Playwright Context; the toolbox Tab bar and address bar stay in sync and can raise that window (`browserShowWindow`).

Segment hide does not close Host tabs or the headed window. Hard refresh rehydrates Tab rows and zoom from `dsh.browser.panel.v1`, syncs through Host `list`, and raises the window again.

## Known Limitations and Deferred Work

- The headed window appears on the machine that runs Host, not inside the toolbox rectangle.
- Embedding that window in a future desktop shell is deferred.
