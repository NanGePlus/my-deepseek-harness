# 人类终端经 Host RPC 提供 Workspace 级 PTY

V3 人类终端需要在 Web 工具箱内提供全交互 Shell（xterm 键盘输入、resize、scrollback），且按绑定 Workspace 归属、与 Agent 在 `ctx.terminals` 上的 PTY 工具完全分离。Web 客户端不能直接 spawn 本机 PTY。我们决定在 `packages/host/apiproxy` 扩展一组**有类型的** `host.terminal.*` RPC：Host 维护按 **workspaceId** 索引的 PTY 注册表，经 `subprocess.spawnTerminal`（或等价 `node-pty` substrate）启动 Shell；**输出**经 SSE 流推送（对齐 `host.watchPath` 先例），**输入**与 **resize** 经 RPC 写入；页面硬刷新后 PTY **不** Kill，Client 重载后 `list` 并重连 SSE、回放有界 scrollback。人类终端以**当前 OS 用户**运行，**不**套用 Agent Session 的沙箱策略；不提供任意 argv 通道，也不复用 `ctx.terminals` 的 Agent 所有权模型。

**Considered Options**

- 复用 `ctx.terminals` 并为 Web 伪造 Agent owner：与领域层「完全分离」冲突，会把沙箱、Session 日志与工具卡片耦合进人类 UI。
- 每 Tab 独立 WebSocket 全双工：引入第二传输栈与鉴权面，V3 无必要；现有 Host 已有 SSE 先例。
- 刷新浏览器时 Kill 全部 PTY：误杀长跑 dev server，与「切走只隐藏不终止」及 Workspace 级持久池矛盾。

**Consequences**

- 终端 I/O 契约随 `apiproxy` RPC 与 schema 演进；`ui-terminal` 不直接接触 `node-pty`。
- Host 每个 PTY 须维护有界 scrollback；SSE 帧须能携带增量输出、元数据（如 Tab 标题）与截断标记。
- Tab 动态标题由 Host 探测前台进程短名（复用 `subprocess-local` 同类机制），不可检测时回退 Shell profile 名。
- 本机须能 spawn 交互式 Shell；**终端不可用**（无 Shell、PTY 失败等）与**未绑定 Workspace** 是两种可区分状态。
