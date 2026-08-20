# 文件编辑器经 Host RPC 访问文件系统与 Git

DeepSeek Harness Web 客户端无法直接调用 `ctx.fs`。V1 文件编辑器需要读/写/删除/重命名文件、监听已打开文件的外部变更，以及读取 Git 工作区状态。我们决定在 `packages/host/apiproxy` 扩展一组 Host RPC（如 `readFile`、`writeFile`、`deletePath`、`renamePath`、`watchPath`、`gitStatus`），Host 侧委托现有 `ctx.fs` 与 `git status --porcelain`，而非新建独立 HTTP 服务或在浏览器内使用 isomorphic-git。文本编辑内核选用 Monaco Editor；文件树采用目录懒加载与虚拟滚动；文件类型图标使用 Material Icon Theme SVG 子集。

**Considered Options**

- 浏览器内 isomorphic-git：包体积大、大仓库慢，且与 Host 单一入口模式不一致。
- 独立 File Editor 服务：绕开现有 RPC 与 fs 策略链，权限与测试面重复建设。
- 全量预加载文件树：与用户选定的全量可见范围在大型 monorepo 下不可行。

**Consequences**

- 文件编辑器的 I/O 与 Git 能力随 `apiproxy` RPC 契约演进；Client 包 `@deepseek-ai/dsh-client-ui-file-editor` 仅消费 RPC，不直接接触磁盘。
- 外部变更检测对每个已打开 Tab 注册独立 `watchPath`；Tab 关闭须释放 watch。
