# Git 面板经 Host RPC 调用本机 Git

V2 Git 面板需要暂存、取消暂存、按块操作、丢弃、提交、初始化仓库、读取差异与当前分支。Web 客户端不能直接访问磁盘上的 Git 仓库。我们决定沿 ADR 0001：在 `packages/host/apiproxy` 扩展一组**有类型的** Git Host RPC，由 Host 调用本机 `git`，Client 只消费 RPC。不提供任意 argv 的 `git` 通道；按块暂存的 patch 拼装与 `git apply` 等细节留在 Host。不在浏览器使用 isomorphic-git，不另起 Git HTTP 服务，也不把人类面板操作写成 Agent 工具或 Session 日志中的 bash。

**Considered Options**

- 浏览器内 isomorphic-git：体积大、大仓库慢，且与 Host 单一入口不一致（ADR 0001 已否决）。
- 独立 Git HTTP 服务：重复权限、测试与 Workspace 绑定，绕开现有 RPC。
- 驱使 Agent 执行 `git`：Git 面板是人类 UI，不是模型可见输入；会污染 Session 日志，并依赖 Agent 正在运行。
- 一条通用 `gitRun({ args })` 或带子命令白名单的 escape hatch：等于把 git CLI 暴露给浏览器，破坏性参数难以收回。

**Consequences**

- Git 写能力随 `apiproxy` RPC 契约演进；面板插件不直接接触仓库。
- 本机必须有可用的 `git`；Git 不可用与不是仓库是两种 Host 可区分的状态。
