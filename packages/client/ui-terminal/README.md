# @deepseek-ai/dsh-client-ui-terminal

Human terminal surface for the toolbox **Terminal** segment: workspace-scoped tabs, auto-spawn on first entry, multi-tab `+` shell dropdown, per-tab Kill, xterm canvas, unbound and Host-unavailable empty states, inline spawn/write/stream errors with retry, and SSE connect loading. Injects into `conversation.details.terminal` declared by `ui-conversation`.

## Model experience

No model-visible effect. Human terminal I/O stays outside the session log and Agent `terminal_*` tools.

## Known Limitations and Deferred Work

- Hard-refresh reconnect and scrollback replay ship in issue #80.
