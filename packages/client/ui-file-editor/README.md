# @deepseek-ai/dsh-client-ui-file-editor

File editor surface for the Web details column **文件编辑器** tab: the `editor-surface` occupant injected into `conversation.details.editor`.

## Model experience

No model-visible effect. Editor UI state (open tabs, dirty buffers) stays in client stores and does not enter the session log.

## Known limitations and deferred work

- V1 Issue scope stops at the empty-state shell; file tree, Monaco, and Host RPC wiring land in follow-on issues.
