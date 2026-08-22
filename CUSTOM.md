# 相对官方的定制说明

## 基线
- 上游仓库：https://github.com/deepseek-ai/deepseek-harness
- 跟做基线分支：master（developer preview，会有破坏性变更）
- **集成分支**：`custom/main`（本 fork 的功能集成线；相对 upstream `master` 约 +48 commits，截至 2026-08-22）
- 运行方式：从源码 `pnpm install` / `pnpm run build:lib:host` + client bundle + `pnpm run build:web` / `pnpm dsh web`
- Node：^22.19 或 >=24；pnpm@11.7.0（Corepack）
- 扩展策略：V1 文件编辑器因需改 Host RPC 与 details 栏壳层，**直接改 `packages/`**；长期仍优先树外插件 / 组合包，不改 `vendor/`
- 领域与决策：`CONTEXT.md`、`docs/adr/0001-file-editor-host-rpc.md`、`docs/adr/0002-file-editor-details-tab.md`、`docs/prd/file-editor-v1.md`

## 产品
- 产品名：（待填写）
- 默认 profile：`web`
- 模型提供方：DeepSeek / 其它 / 自定义 OpenAI 兼容端点
- **V1 定制重点**：Web details 栏内嵌 Workspace 文件编辑器（文件树 + Monaco 多 Tab），与 Agent 对话并列、不占用中栏

## 已实现定制功能（相对上游 master）

### Details 栏与壳层（PR #28–29）
- details 栏 segmented Tab：**Tool 详情 | 文件编辑器**
- 文件编辑器 Tab 注入 `@deepseek-ai/dsh-client-ui-file-editor`（`cordis.patch.yml` 注册）
- details 栏可拖宽；Tool 行点击可跳转 Tool 详情并保持面板存活（PR #38 前后续修复）

### Host RPC 扩展（`packages/host/apiproxy`，ADR-0001）
| RPC | 作用 |
|-----|------|
| `host.listWorkspaceEntries` | Workspace 内单层目录 listing（上限 1000 条/层，`truncated` 标记） |
| `host.gitStatus` | `git status --porcelain` 只读徽章（非仓库返回空） |
| `host.readFile` / `host.writeFile` | 文本 UTF-8 读写；图片 `bytes` + base64 预览 |
| `host.deletePath` / `host.renamePath` / `host.createWorkspaceDirectory` | 文件树工具栏增删改 |
| `host.watchPath` | SSE 监听已打开路径的外部磁盘变更 |
| LSP（`lspSyncDocument` / `lspHoverDocument` / `lspCloseDocument`） | 编辑器内诊断与 hover（经 `lsp-editor` + `lsp-stdio`） |

### 文件编辑器 Client（`packages/client/ui-file-editor`）
- 绑定当前 Session 的 Workspace；文件树**懒加载** + **虚拟滚动** + 文件名过滤
- Material Icon Theme 文件类型图标；Git 行尾徽章（M/U/D 等）
- 打开三档：**可编辑文本**（Monaco / textarea fallback）、**图片只读预览**、**已知二进制不可打开**
- 多 Tab、dirty 标记、**显式保存**（⌘S / Ctrl+S）；Markdown **预览 / 源码**切换（**默认源码**）
- 文件树工具栏：新建文件/文件夹、重命名、删除（确认对话框）；**右键菜单**（文件/文件夹分类型操作）
- **Tab 栏批量关闭**（关闭当前 / 其它 / 全部 / 左侧 / 右侧，VS Code 风格）
- **文件夹重命名**时同步更新已打开子文件 Tab 路径；**删除文件夹**时关闭子树 Tab 并清理树缓存
- 同名冲突：文件↔文件、文件夹↔文件夹分别提示；Host 层拦截路径类型冲突
- 外部变更对话框：**重新加载** / **保留本地编辑**（`watchPath`）
- Session 切换 / 关闭 dirty Tab **守卫**（保存 / 丢弃 / 取消）
- Session 内文件路径链接可在 details 编辑器中打开
- Monaco / 主题跟随 Harness light/dark
- 多 Tab 横向滚动、树切换时保持可用；滚动条按需显示
- 未打开文件**空状态**：设计系统图标 + 与文件树一致的轻量排版

### Markdown / 预览增强（PR #37–38，`ui-primitives` 等）
- Mermaid 代码块渲染 + **可缩放 lightbox**
- Markdown / 图片 **ZoomPanLightbox**（与会话消息区共用组件）
- 抑制空白 inline-code 芯片与 Monaco unicode 高亮噪声

### 性能与边界（分支 `fix/file-editor-v1-verify-fix`，已合并入 `custom/main`）
- **`host.readFile` 5 MB 上限**：超出返回 `file-too-large`，编辑器提示「文件过大」
- **大文件 / minified 单行**：Monaco `largeFileOptimizations`、超长行关闭 word wrap、跳过 LSP 全量同步，避免页面卡死
- **目录 listing 优化**：symlink 分类 32 并发；dirent 扫描上限 10 000；Client 每目录 **30 s 超时**、独立 AbortController
- 目录加载失败行尾 **!** 标记（可折叠后再展开重试）；超大目录 **…** 表示 listing 截断

## 我的插件与组合包
| 名称 | 形态 | 作用 | 日期 |
|------|------|------|------|
| `@deepseek-ai/dsh-client-ui-file-editor` | `packages/bundle/web-app/cordis.patch.yml` 行 `ui-file-editor` | details 栏文件编辑器 surface | 2026-08 |
| `@deepseek-ai/dsh-lsp-editor` | Host 面新包 + apiproxy 接线 | 编辑器 LSP 文档 sync / hover / close | 2026-08 |

## 我改过的官方文件（尽量为空）
| 文件/目录 | 改了什么 | 日期 |
|-----------|----------|------|
| `packages/host/apiproxy/` | 文件编辑器 Host RPC、listing 性能、`readFile` 大小上限 | 2026-08 |
| `packages/client/ui-file-editor/` | **新包**：文件树 + Monaco 编辑器 surface | 2026-08 |
| `packages/client/ui-conversation/` | details segmented Tab、Tool 详情与编辑器 Tab 协调 | 2026-08 |
| `packages/client/runtime/` | `WorkspaceRuntime` 转发新 Host RPC | 2026-08 |
| `packages/client/ui-primitives/` | Mermaid 块、ZoomPanLightbox、Markdown 图片 | 2026-08 |
| `packages/client/ui-tool/` | Tool 行 selection → details 跳转 | 2026-08 |
| `packages/client/ui-layout/` | details 栏宽度 / AppFrame 微调 | 2026-08 |
| `packages/lsp/lsp-editor/` | **新包**：编辑器 LSP 类型与接线 | 2026-08 |
| `packages/lsp/lsp-stdio/` | 编辑器实例诊断推送 | 2026-08 |
| `packages/bundle/web-app/cordis.patch.yml` | 注册 ui-file-editor 与 LSP 相关插件 | 2026-08 |
| `apps/web/` | Vite 构建含 Monaco workers / material icons 同步 | 2026-08 |
| `CONTEXT.md`、`docs/adr/0001–0002`、`docs/prd/file-editor-v1.md` | 文件编辑器 V1 领域与 PRD | 2026-08 |
| `AGENTS.md`（Agent skills 块） | Issue 跟踪 / triage / domain / wiki 工作流说明 | 2026-08 |

## 我故意不跟的上游行为
| 点 | 原因 |
|----|------|
| 在 `packages/` 内联实现文件编辑器 V1 | Host RPC 与 details 壳层必须改官方包；树外插件留待后续拆分 |
| `custom/main` 长期领先 upstream `master` | 自研功能集成线，合并 upstream 时需手动 reconcile |
| 文件树 listing 单层上限 1000 + dirent 扫描上限 10 000 | 防止 monorepo 大目录拖垮 Host / 浏览器 |
| `readFile` 5 MB 硬上限 | 防止 minified bundle 等超大文件经 RPC + Monaco 卡死主线程 |
| CI：部分 push/PR 工作流已禁用（PR #25） | 定制开发阶段减少噪声；见 commit `a43e450eb9` |

## 合并官方记录
| 日期 | 官方提交/标签 | 有没有冲突 | 备注 |
|------|---------------|------------|------|
| 2026-08 | upstream `master` @ 文件编辑器开工前 | — | 自 `7672080d88` 起维护本文件 |
| — | deepseek-ai/deepseek-harness `master` | 未定期合并 | `custom/main` 为功能线；合并时需跑 build + `test:gui` |

## 待合并 / 进行中
| 分支 | 内容 | 状态 |
|------|------|------|
| `fix/file-editor-v1-qa` | Tab 批量关闭、删除/重命名/同名冲突、文件夹重命名 Tab 同步、Markdown 默认源码、空状态 UI | 进行中 → `custom/main` |
| `fix/file-editor-v1-verify-fix` | 大文件 + 目录 listing 性能修复 | 已合并入 `custom/main` |
