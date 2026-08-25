# 相对官方的定制说明

## 基线
- 上游仓库：https://github.com/deepseek-ai/deepseek-harness
- 跟做基线分支：master（developer preview，会有破坏性变更）
- **集成分支**：`custom/main`（本 fork 的功能集成线；相对 upstream `master` 约 +48 commits，截至 2026-08-22）
- 运行方式：从源码 `pnpm install` / `pnpm run build:lib:host` + client bundle + `pnpm run build:web` / `pnpm dsh web`
- Node：^22.19 或 >=24；pnpm@11.7.0（Corepack）
- 扩展策略：V1 文件编辑器因需改 Host RPC 与 **工具箱**（details 栏）壳层，**直接改 `packages/`**；长期仍优先树外插件 / 组合包，不改 `vendor/`
- 领域与决策：`CONTEXT.md`、`docs/adr/0001–0002`（文件编辑器）、`docs/adr/0003–0004`（Git 面板）、`docs/prd/file-editor-v1.md`、`docs/prd/git-panel-v2.md`

## 产品
- 产品名：（待填写）
- 默认 profile：`web`
- 模型提供方：DeepSeek / 其它 / 自定义 OpenAI 兼容端点
- **V1 定制重点**：Web **工具箱**（原 details 栏）内嵌 Workspace 文件编辑器（文件树 + Monaco 多 Tab），与 Agent 对话并列、不占用中栏
- **V2 定制重点（进行中）**：工具箱增加 **Git 面板**（工作区变更 + 差异预览）；PRD 见 `docs/prd/git-panel-v2.md` 与 Issue [#51](https://github.com/NanGePlus/my-deepseek-harness/issues/51)。Host Git 只读 RPC 见 Issue [#53](https://github.com/NanGePlus/my-deepseek-harness/issues/53)；写 RPC（暂存 / 取消暂存 / 丢弃 / 提交）见 Issue [#54](https://github.com/NanGePlus/my-deepseek-harness/issues/54)；工具箱三段 Tab 见 Issue [#55](https://github.com/NanGePlus/my-deepseek-harness/issues/55)；Git 面板绑定/列表/空态/初始化见 Issue [#56](https://github.com/NanGePlus/my-deepseek-harness/issues/56)；整文件暂存/丢弃/提交见 Issue [#57](https://github.com/NanGePlus/my-deepseek-harness/issues/57)

## 已实现定制功能（相对上游 master）

### 工具箱与壳层（details 栏，PR #28–29 及后续）
- 产品文案：**详情栏 / 详情面板** 统一表述为 **工具箱**（`packages/client/ui-conversation` locales；Tab 内「工具详情」仍指 Tool 输出内容）
- 会话头入口：**图标 +「工具箱」** capsule 按钮（与 Session log 同高 32px）；tooltip / `aria-label` 仍为「打开 / 收起工具箱」
- 工具箱 segmented Tab：**资源管理器 | Git | 工具详情**；Tab 条样式与对话区 **对话 / 轨迹** 一致（左对齐、13px、`state-business-primary` 选中下划线）；Git 段槽位 `conversation.details.git` 供 `ui-git` 注入，切走只隐藏不卸载；资源管理器段传入 `visible`，切回后重读文件树 Git 状态标记
- 文件编辑器 Tab 注入 `@deepseek-ai/dsh-client-ui-file-editor`（`cordis.patch.yml` 注册）
- 工具箱可拖宽；Tool 行点击可跳转工具详情并保持面板存活（PR #38 前后续修复）

### Host RPC 扩展（`packages/host/apiproxy`，ADR-0001）
| RPC | 作用 |
|-----|------|
| `host.listWorkspaceEntries` | Workspace 内单层目录 listing（上限 1000 条/层，`truncated` 标记） |
| `host.gitStatus` | `git status --porcelain` 只读徽章（非仓库返回空） |
| `host.gitWorkingTree` | 向上发现仓库根与当前分支；返回未暂存 / 已暂存两段磁盘变更（忽略路径不出现；路径相对仓库根，可在绑定 Workspace 外） |
| `host.gitInit` | 仅当无祖先仓库时在绑定 Workspace 根 `git init` |
| `host.gitDiffPreview` | 只认磁盘的差异预览（`text` / `untracked-text` / `binary` / `deleted-text` / `deleted-binary`） |
| `host.gitStage` | 整文件或按块暂存一条未暂存变更；返回刷新后的工作树 |
| `host.gitUnstage` | 整文件或按块取消暂存；不改写磁盘 |
| `host.gitDiscard` | 整文件或按块丢弃未暂存变更（已跟踪还原 / 未跟踪删除）；不碰已暂存 |
| `host.gitCommit` | 用非空说明 + 非空暂存区新建 HEAD 提交；作者只取 Git 配置；不 amend、不 push |
| `host.readFile` / `host.writeFile` | 文本 UTF-8 读写；图片 `bytes` + base64 预览 |
| `host.deletePath` / `host.renamePath` / `host.createWorkspaceDirectory` | 文件树工具栏增删改 |
| `host.watchPath` | SSE 监听已打开路径的外部磁盘变更 |
| LSP（`lspSyncDocument` / `lspHoverDocument` / `lspCloseDocument`） | 编辑器内诊断与 hover（经 `lsp-editor` + `lsp-stdio`） |

### 文件编辑器 Client（`packages/client/ui-file-editor`）
- 绑定当前 Session 的 Workspace；文件树**懒加载** + **虚拟滚动** + 文件名过滤
- Material Icon Theme 文件类型图标；Git 行尾徽章（M/U/D 等）
- 打开三档：**可编辑文本**（Monaco / textarea fallback）、**图片只读预览**、**已知二进制不可打开**
- 多 Tab、dirty 标记、**显式保存**（⌘S / Ctrl+S）；Markdown **预览 / 源码**切换（**默认源码**）
- Markdown **预览态可编辑**（TipTap + `@tiptap/markdown` 双向序列化）：段落 + 行内 **B/I/U/S/Code/Link**；选区浮动工具栏；**链接**为同一 BubbleMenu 内切换的胶囊输入框（点「链接」即显）；预览内 **链接可点击**（新标签页打开）；**代码块 / Mermaid 只读**（`readOnlyFencedBlock` atom + `MarkdownText` 渲染）；**中文 IME** 组合输入期间不回写 buffer；**单击仅定位光标**（误选区自动折叠，双击/拖拽选区不受影响）
- Markdown **源码（Monaco）** 与预览同样保护 **IME 组合输入**：聚焦/拼音组合期间不 `setValue` 重载模型；**默认 soft wrap**；Markdown 使用 `wrappingStrategy: simple` + `accessibilitySupport: off` 以保持 CJK IME preedit 紧跟光标（不再组合期间切换 wrap）；**单击仅定位光标**（误选区自动折叠）；**任意可编辑文本文件（含 Markdown 源码与其他语言 Monaco 编辑器）** 选区 **Add to Chat** 插入 composer 可见 pill chip（13/20，与输入框同字重以免长英文宽于光标；光标落在胶囊外空格上，可继续输入；发送时展开行内容进 prompt；**已发送用户气泡**同样投影为 pill、可点击打开编辑器，session log 仍保留展开全文）
- 文件树工具栏：新建文件/文件夹、重命名、删除（确认对话框）；**右键菜单**（文件/文件夹分类型操作）
- **Tab 栏批量关闭**（关闭当前 / 其它 / 全部 / 左侧 / 右侧，VS Code 风格）
- **文件夹重命名**时同步更新已打开子文件 Tab 路径；**删除文件夹**时关闭子树 Tab 并清理树缓存
- 同名冲突：文件↔文件、文件夹↔文件夹分别提示；Host 层拦截路径类型冲突
- 外部变更对话框：**重新加载** / **保留本地编辑**（`watchPath`）
- **文件树自动刷新**：编辑器保存、外部磁盘变更（`watchPath`）及 Workspace 根目录监听后，自动重载对应目录 listing，无需手动点刷新
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
| `@deepseek-ai/dsh-client-ui-file-editor` | `packages/bundle/web-app/cordis.patch.yml` 行 `ui-file-editor` | 工具箱内文件编辑器 surface | 2026-08 |
| `@deepseek-ai/dsh-client-ui-git` | `packages/bundle/web-app/cordis.patch.yml` 行 `ui-git` | 工具箱 Git 面板：仓库绑定、两段列表、空态、刷新与初始化；整文件暂存 / 取消暂存 / 丢弃（须确认）/ 提交；提交说明草稿按 Session | 2026-08 |
| `@deepseek-ai/dsh-lsp-editor` | Host 面新包 + apiproxy 接线 | 编辑器 LSP 文档 sync / hover / close | 2026-08 |

## 我改过的官方文件（尽量为空）
| 文件/目录 | 改了什么 | 日期 |
|-----------|----------|------|
| `packages/host/apiproxy/` | 文件编辑器 Host RPC、listing 性能、`readFile` 大小上限；**2026-08-25** Git 面板只读 RPC（`gitWorkingTree` / `gitInit` / `gitDiffPreview`）；**2026-08-25** Git 面板写 RPC（`gitStage` / `gitUnstage` / `gitDiscard` / `gitCommit`）；**2026-08-25** `GitWorkingTreeChange.kind`（modified / untracked / deleted） | 2026-08 |
| `packages/client/ui-file-editor/` | **新包**：文件树 + Monaco 编辑器 surface；**2026-08-23** Markdown 预览 WYSIWYG（TipTap）；**2026-08-23** 全语言 Monaco 选区 Add to Chat；**2026-08-23** 保存/外部变更后文件树自动刷新；**2026-08-25** 资源管理器 `visible` 切回后重读 Git 徽章 | 2026-08 |
| `packages/client/ui-conversation/` | 工具箱 segmented Tab、Tool 详情与编辑器 Tab 协调；**2026-08-22** 工具箱文案、capsule 入口、Tab 样式对齐对话区；**2026-08-23** 已发送用户消息 file-context pill 展示投影；**2026-08-25** 工具箱三段 Tab（资源管理器 \| Git \| 工具详情）与 `conversation.details.git` 槽位；**2026-08-25** Git 槽传入 `visible` 供面板按切 Tab 重读；**2026-08-25** Explorer 槽传入 `visible` 供切回后重读 Git 徽章 | 2026-08 |
| `packages/client/ui-git/` | **新包**：工具箱 Git 面板 occupant（绑定 Workspace、两段变更列表、四种空态、初始化）；**2026-08-25** 整文件暂存 / 取消暂存 / 丢弃确认 / 提交与按 Session 草稿 | 2026-08 |
| `packages/client/runtime/` | `WorkspaceRuntime` 转发新 Host RPC；**2026-08-25** 转发 Git 面板只读 RPC；**2026-08-25** 转发 Git 面板写 RPC | 2026-08 |
| `packages/client/ui-primitives/` | Mermaid 块、ZoomPanLightbox、Markdown 图片 | 2026-08 |
| `packages/client/ui-tool/` | Tool 行 selection → details 跳转 | 2026-08 |
| `packages/client/ui-layout/` | 工具箱栏宽度 / AppFrame 微调 | 2026-08 |
| `packages/lsp/lsp-editor/` | **新包**：编辑器 LSP 类型与接线 | 2026-08 |
| `packages/lsp/lsp-stdio/` | 编辑器实例诊断推送 | 2026-08 |
| `packages/bundle/web-app/cordis.patch.yml` | 注册 ui-file-editor、ui-git 与 LSP 相关插件 | 2026-08 |
| `tsconfig.base.json` | 为 `ui-file-editor` / `ui-git` 增加 source-plane `paths`（tsx 启动不依赖 built `lib/`） | 2026-08 |
| `apps/web/` | Vite 构建含 Monaco workers / material icons 同步 | 2026-08 |
| `CONTEXT.md`、`docs/adr/0001–0002`、`docs/prd/file-editor-v1.md` | 文件编辑器 V1 领域与 PRD | 2026-08 |
| `AGENTS.md`（Agent skills 块） | Issue 跟踪 / triage / domain / wiki 工作流说明 | 2026-08 |
| `scripts/translation-pairing.manifest.json`、`scripts/build-exe-for-python-sdk.ts`、`scripts/verify-translation-prompt.ts` | 根 README 排除 upstream 双语配对 / 部署文档列表 | 2026-08-22 |
| `scripts/agent-note-tree.ts` | Agent Note 生命周期根 allowlist 仅保留 `AGENTS.md` | 2026-08-22 |

## 我故意不跟的上游行为
| 点 | 原因 |
|----|------|
| 在 `packages/` 内联实现文件编辑器 V1 | Host RPC 与工具箱壳层必须改官方包；树外插件留待后续拆分 |
| `custom/main` 长期领先 upstream `master` | 自研功能集成线，合并 upstream 时需手动 reconcile |
| 文件树 listing 单层上限 1000 + dirent 扫描上限 10 000 | 防止 monorepo 大目录拖垮 Host / 浏览器 |
| `readFile` 5 MB 硬上限 | 防止 minified bundle 等超大文件经 RPC + Monaco 卡死主线程 |
| 根 `README.md` / `README_EN.md` 不走 upstream 双语配对（`README.zh.md`、`README.i18n.yaml` 已删） | fork 对外交付文档；中文主文档 + 独立英文版 |
| 全仓库无 `CLAUDE.md` symlink（`packages/`、`examples/`、`vendor/`、`.agents/notes/implemented/` 已删） | 本 fork 以 Cursor 为主；规则真源为各目录 `AGENTS.md` |
| CI：部分 push/PR 工作流已禁用（PR #25） | 定制开发阶段减少噪声；见 commit `a43e450eb9` |

## 合并官方记录
| 日期 | 官方提交/标签 | 有没有冲突 | 备注 |
|------|---------------|------------|------|
| 2026-08 | upstream `master` @ 文件编辑器开工前 | — | 自 `7672080d88` 起维护本文件 |
| — | deepseek-ai/deepseek-harness `master` | 未定期合并 | `custom/main` 为功能线；合并时需跑 build + `test:gui` |

## 待合并 / 进行中
| 分支 | 内容 | 状态 |
|------|------|------|
| `fix/file-editor-v1-qa-validation` | PR [#48](https://github.com/NanGePlus/my-deepseek-harness/pull/48)：**工具箱**文案与 capsule 入口、Tab 样式对齐对话区；**Markdown 预览 WYSIWYG**（TipTap）与 IME/wrap 修复；**Add to Chat file-context pill**（Markdown 源码 + 全语言 Monaco → composer pill；发送展开进 prompt；**已发送用户气泡** pill 投影并可点击打开编辑器） | 已合并入 `custom/main` |
| `fix/file-editor-v1-qa` | Tab 批量关闭、删除/重命名/同名冲突、文件夹重命名 Tab 同步、Markdown 默认源码、空状态 UI | 已并入 `custom/main` 或与本线并行，合并前需 reconcile |
| `fix/file-editor-v1-verify-fix` | 大文件 + 目录 listing 性能修复 | 已合并入 `custom/main` |
| `docs/git-panel-v2-prd` | Git 面板 V2：父 PRD [#51](https://github.com/NanGePlus/my-deepseek-harness/issues/51)；切片 #52–#59 | PR [#60](https://github.com/NanGePlus/my-deepseek-harness/pull/60) 已合并入 `custom/main` |
| `issue/52-d-global-git-panel-design-close` | [#52](https://github.com/NanGePlus/my-deepseek-harness/issues/52) `#D-global`：验收关闭 Git 面板 DESIGN.md | 进行中 |
| `issue/53-host-git-rpc-inspect` | [#53](https://github.com/NanGePlus/my-deepseek-harness/issues/53) Host Git RPC：仓库发现、变更列表、差异预览与初始化 | 已合并入 `custom/main`（PR [#62](https://github.com/NanGePlus/my-deepseek-harness/pull/62)） |
| `issue/54-host-git-rpc-write` | [#54](https://github.com/NanGePlus/my-deepseek-harness/issues/54) Host Git RPC：暂存、取消暂存、丢弃与提交 | 已合并入 `custom/main`（PR [#63](https://github.com/NanGePlus/my-deepseek-harness/pull/63)） |
| `issue/55-app-shell-details-three-tab` | [#55](https://github.com/NanGePlus/my-deepseek-harness/issues/55) app-shell：工具箱三段 Tab 与 Git 槽位 | 已合并入 `custom/main`（PR [#64](https://github.com/NanGePlus/my-deepseek-harness/pull/64)） |
| `issue/56-git-panel-bind-list` | [#56](https://github.com/NanGePlus/my-deepseek-harness/issues/56) `ui-git`：仓库绑定、两段列表、空态、刷新与初始化 | 已合并入 `custom/main`（PR [#65](https://github.com/NanGePlus/my-deepseek-harness/pull/65)） |
| `issue/57-git-panel-stage-commit` | [#57](https://github.com/NanGePlus/my-deepseek-harness/issues/57) `ui-git`：整文件暂存、丢弃、提交说明与提交 | 已合并入 `custom/main`（PR [#66](https://github.com/NanGePlus/my-deepseek-harness/pull/66)） |

## 近期操作记录
| 日期 | 操作 | 备注 |
|------|------|------|
| 2026-08-22 | 从最新 `origin/custom/main` 创建分支 `fix/file-editor-v1-qa-validation` | 用于 V1 验证测试与 BUG 修复；开工前 stash 了未提交 WIP |
| 2026-08-22 | 用户可见文案：详情栏 / 详情面板 → **工具箱** | `ui-conversation` locales；e2e `details-segmented-tab` 快照英文 `Toolbox` |
| 2026-08-22 | 会话头工具箱入口改为 **图标 +「工具箱」** capsule | `DetailsPanelToggle`；改 client 插件后需 `pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle` 并硬刷新 `pnpm dsh web` |
| 2026-08-22 | 工具箱 Tab 条样式对齐对话区 Tab | `DetailsPanel.module.css`：左对齐、蓝色选中态、2px 下划线 |
| 2026-08-22 | 新增 Cursor 规则 `.cursor/rules/custom-md-changelog.mdc` | 定制改动须同步更新 `CUSTOM.md` |
| 2026-08-22 | 移除 `.claude/skills` symlink | 仅 Claude Code 用；本 fork 以 Cursor 为主，skills 见 `.agents/skills` |
| 2026-08-22 | 删除根 `CLAUDE.md`、`README.i18n.yaml` | 根 README 改用 `README.md` + `README_EN.md`；配对 gate 排除见 `translation-pairing.manifest.json` |
| 2026-08-22 | 删除全仓库 `CLAUDE.md` symlink | `examples/`、`packages/`、`vendor/`、`.agents/notes/implemented/`；与 `.claude/skills` 移除一致 |
| 2026-08-23 | Markdown 预览态 WYSIWYG（TipTap H1） | `EditableMarkdownPreview` + 选区工具栏 B/I/U/S/Code/Link；代码块 / Mermaid 只读；依赖 `@tiptap/*` |
| 2026-08-23 | 修复 Markdown 预览 IME 无法输入 | 组合输入期间跳过 buffer 回写 / `setContent` 重载，避免打断中文输入法 |
| 2026-08-23 | 修复预览编辑器每次按键重建 TipTap 实例 | 稳定 `codeLabels` / extensions memo；聚焦时跳过 props 回写；工具栏 portal 到 `document.body` |
| 2026-08-23 | 修复 Markdown 源码（Monaco）IME 被 props 回写打断 | 聚焦/组合输入期间跳过 `setValue`；组合结束再提交 buffer |
| 2026-08-23 | Markdown 链接改为内联弹框 | 工具栏「链接」弹出胶囊输入框（图1）；Enter/✓ 确认、Esc 关闭 |
| 2026-08-23 | 修复链接弹框延迟 / 预览链接不可点 | 单 BubbleMenu 内切换表单与链接输入；`openOnClick: true` + `target=_blank` |
| 2026-08-23 | 修复预览工具栏选区状态 | 链接确认后折叠选区隐藏工具栏；`useEditorState` 按当前选区刷新 B/I/U 等激活态 |
| 2026-08-23 | 修复 Markdown 源码 IME 组合排版 | `monacoWordWrapForLanguage('markdown')` 强制 `wordWrap: off`；预览区 `overflow-wrap: break-word` |
| 2026-08-23 | Markdown 源码恢复软换行 | 移除 markdown 专用 `wordWrap: off`；与普通文本同样随宽度 wrap |
| 2026-08-23 | Markdown 源码 wrap + IME 兼得 | 默认 soft wrap；`compositionstart/end` 临时 `wordWrap: off` 保持 preedit 内联 |
| 2026-08-23 | Markdown 源码 CJK IME + soft wrap | 移除组合期间 wrap 切换；Markdown 用 `accessibilitySupport: off` + simple wrap |
| 2026-08-23 | 修复单击误选文本 | 预览（TipTap）与源码（Monaco）在简单单击后折叠非空选区；拖拽与多击选词/选行保留 |
| 2026-08-23 | Markdown 源码 Add to Chat pill 交互 | 圆角胶囊 pill（适度 padding）；backdrop 点击跳转；chip 点击后在 buffer 同步完成后再选中 Monaco 行范围 |
| 2026-08-23 | Add to Chat pill 光标与输入 | 单层 13/20 regular 胶囊（勿用 500，长英文会宽于光标）；光标在尾随空格后 |
| 2026-08-23 | Markdown 源码 Add to Chat → composer file-context pill | `e9a619f`；Monaco 选区浮动 **Add to Chat**；`file-context` input trigger；提交时读文件展开行内容进 prompt |
| 2026-08-23 | 已发送用户消息 file-context pill 展示投影 | `b15cd147`；`ui-conversation` `project-user-text`；气泡显示 pill 非全文 excerpt；可点击打开编辑器；session log 仍保留展开全文 |
| 2026-08-23 | 全语言 Monaco 选区 Add to Chat | `8c624b4a`；TS/Python 等可编辑文本与 Markdown 源码同链路；改 `ui-file-editor` 后需 `run bundle` |
| 2026-08-23 | 开 PR [#48](https://github.com/NanGePlus/my-deepseek-harness/pull/48) → `custom/main` | 分支 `fix/file-editor-v1-qa-validation`；7 commit（预览/IME + Add to Chat 全链路） |
| 2026-08-23 | PR #48 合并入 `custom/main` | 保留分支 `fix/file-editor-v1-qa-validation` |
| 2026-08-23 | 文件树自动刷新 | 保存 / `watchPath` 外部变更 / Workspace 根监听后重载 listing；改 `ui-file-editor` 后需 `run bundle` |
| 2026-08-25 | 起草 Git 面板 V2 PRD | `docs/prd/git-panel-v2.md`；领域见 `CONTEXT.md`，ADR-0003/0004 |
| 2026-08-25 | 发布 Git 面板 V2 Issue | 父 PRD [#51](https://github.com/NanGePlus/my-deepseek-harness/issues/51)；#52 `#D-global`；#53/#54 Host Git RPC；#55 app-shell 三段 Tab；#56–#59 `git-panel` 四刀 |
| 2026-08-25 | 提交 Git 面板 V2 规格 | 分支 `docs/git-panel-v2-prd`：PRD、ADR-0003/0004、`CONTEXT.md`、DESIGN 多行/禁用原语；PR [#60](https://github.com/NanGePlus/my-deepseek-harness/pull/60) 已合并 |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/52-d-global-git-panel-design-close` | Issue [#52](https://github.com/NanGePlus/my-deepseek-harness/issues/52) `#D-global` 验收关闭；Git 面板消费既有品牌板，不新增 §5 原语 |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/53-host-git-rpc-inspect` | Issue [#53](https://github.com/NanGePlus/my-deepseek-harness/issues/53) Host Git 只读 RPC；不改 V1 `gitStatus`，不暴露任意 argv |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/54-host-git-rpc-write` | Issue [#54](https://github.com/NanGePlus/my-deepseek-harness/issues/54) Host Git 写 RPC：暂存 / 取消暂存 / 丢弃 / 提交；按块 patch 由 Host 拼装；不暴露任意 argv |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/55-app-shell-details-three-tab` | Issue [#55](https://github.com/NanGePlus/my-deepseek-harness/issues/55) 工具箱三段 Tab（资源管理器 \| Git \| 工具详情）；声明 `conversation.details.git`；切走 Git 只隐藏不卸载 |
| 2026-08-25 | PR [#64](https://github.com/NanGePlus/my-deepseek-harness/pull/64) 合并入 `custom/main` | 关闭 Issue [#55](https://github.com/NanGePlus/my-deepseek-harness/issues/55)；保留分支 `issue/55-app-shell-details-three-tab` |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/56-git-panel-bind-list` | Issue [#56](https://github.com/NanGePlus/my-deepseek-harness/issues/56) `ui-git`：仓库绑定、两段列表、空态、刷新与初始化；切走只隐藏不卸载 |
| 2026-08-25 | 实现 Issue #56 Git 面板 1/4 切片 | 新包 `@deepseek-ai/dsh-client-ui-git`；工具箱 Git 槽传入 `visible`；e2e `git-empty` 快照 |
| 2026-08-25 | PR [#65](https://github.com/NanGePlus/my-deepseek-harness/pull/65) 合并入 `custom/main` | 关闭 Issue [#56](https://github.com/NanGePlus/my-deepseek-harness/issues/56)；保留分支 `issue/56-git-panel-bind-list` |
| 2026-08-25 | 从最新 `origin/custom/main` 创建分支 `issue/57-git-panel-stage-commit` | Issue [#57](https://github.com/NanGePlus/my-deepseek-harness/issues/57) 整文件暂存、丢弃、提交说明与提交；按块与守卫留待后续切片 |
| 2026-08-25 | 实现 Issue #57 Git 面板 2/4 切片 | 整文件暂存 / 取消暂存 / 丢弃确认 / 提交；草稿按 Session；Host `GitWorkingTreeChange.kind`；资源管理器切回后重读 Git 徽章 |
| 2026-08-25 | PR [#66](https://github.com/NanGePlus/my-deepseek-harness/pull/66) 合并入 `custom/main` | 关闭 Issue [#57](https://github.com/NanGePlus/my-deepseek-harness/issues/57)；保留分支 `issue/57-git-panel-stage-commit` |
