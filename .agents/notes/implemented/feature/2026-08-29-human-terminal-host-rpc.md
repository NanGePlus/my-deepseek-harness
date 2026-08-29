# Human terminal Host RPC (Issue #75)

Web human terminals need a Workspace-scoped PTY pool on the Host, separate from Agent `ctx.terminals`. The Host exposes typed `host.terminal*` unary RPC plus SSE `host.terminalStream`; `packages/host/apiproxy/src/human-terminal.ts` owns the registry (node-pty + subprocess-local cleanup), bounded scrollback, foreground title polling, and injectable internals for integration tests.

**Verification:** `packages/host/apiproxy/tests/api-proxy-terminal.spec.ts` covers Issue #75 acceptance criteria (profiles, spawn/list, stream/write/resize, kill, scrollback truncation, disconnect persistence, title metadata, workspace isolation, spawn failure).
