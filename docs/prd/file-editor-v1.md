# PRD：资源管理器 V1

面向 DeepSeek Harness Web 人类开发者的资源管理器：在当前 Session 的绑定 Workspace 内浏览文件树、打开与编辑文本、只读预览常见图片，并经显式保存落盘。

领域词汇见 [`CONTEXT.md`](../../CONTEXT.md)。架构决策见 [`docs/adr/0001-file-editor-host-rpc.md`](../adr/0001-file-editor-host-rpc.md)、[`docs/adr/0002-file-editor-details-tab.md`](../adr/0002-file-editor-details-tab.md)。品牌视觉 Token 与原语见 [`docs/design/DESIGN.md`](../design/DESIGN.md)；本 PRD 只引用，不重写色板或字号表。

## 问题陈述

人类开发者在 dsh Web 里与 Agent 对话写代码时，无法在同一界面里直接浏览绑定 Workspace 目录、打开文件、改文本并显式保存。要核对或改一处源码，只能离开 Web 去用外部编辑器，或等待 Agent 工具读写，无法自己掌控落盘时机。全量目录（含隐藏项、`node_modules`、`.git`）不可见时，也难以发现 Agent 刚改过的路径。已打开文件若被 Agent 或其他进程改写磁盘，用户没有机会选择重新加载或保留本地编辑缓冲，容易静默丢改动或覆盖 Agent 产出。切换 Session 时若不允许处理 dirty 的编辑器标签页，未保存工作会丢失。

## 解决方案

在现有 details 栏增加「资源管理器」分段 Tab，与「Tool 详情」切换；选中后展示完整编辑界面（文件树 + 多 Tab 编辑区），不需要时切回 Tool 详情即关闭编辑器视图。文件树跟随当前 Session 的绑定 Workspace，全量可见、按目录展开懒加载，支持文件名过滤、文件类型图标与只读 Git 状态标记。可编辑文本进入编辑缓冲，语法高亮，经显式保存写入磁盘；常见图片只读预览；其余二进制提示不可打开。支持新建文件、新建文件夹、重命名、删除（删除须确认）。已打开文件的外部变更弹出对话框，由用户选择重新加载或保留本地编辑缓冲。切换 Session 或关闭 dirty Tab 时经 Session 切换守卫逐文件保存、丢弃或取消，禁止静默丢失。

## 用户故事

仅 Web 端。序号在全文唯一递增。

US-1：作为 Web 开发者，我想在 details 栏打开「资源管理器」分段 Tab，以便在对话旁浏览并编辑绑定 Workspace 内的文件。

US-2：作为 Web 开发者，我想切回「Tool 详情」以关闭编辑器视图，以便不需要编辑时把注意力还给对话与 Tool 详情。

US-3：作为 Web 开发者，我想拖宽 details 栏，以便给文件树和编辑区更多水平空间。

US-4：作为 Web 开发者，我想让文件树根跟随当前选中 Session 的绑定 Workspace，以便树中路径与该 Session 的 Agent 工作目录一致。

US-5：作为 Web 开发者，我想浏览绑定 Workspace 下的完整递归文件树（含 `.` 开头隐藏项、`node_modules`、`.git`），以便看到目录内全部路径。

US-6：作为 Web 开发者，我想在每个树条目旁看到文件类型图标，以便快速识别文件种类。

US-7：作为 Web 开发者，我想在树条目行尾看到只读 Git 状态标记，以便知道哪些路径是 modified、untracked 或 deleted。

US-8：作为 Web 开发者，当绑定 Workspace 不是 Git 仓库或本机没有 git 时，我想文件树仍可用且不报错，只是没有 Git 状态标记，以便非仓库目录也能编辑。

US-9：作为 Web 开发者，我想展开文件夹时才加载该层子项，以便打开编辑器时不必等待整棵树递归完成。

US-10：作为 Web 开发者，当某一层有极多条目（如 `node_modules`）时，我想仍能滚动浏览文件树，以便大目录不会把界面卡死。

US-11：作为 Web 开发者，我想在文件树顶部按文件名实时过滤可见节点，以便在全量树里快速定位文件。

US-12：作为 Web 开发者，我想一键清除文件名过滤，以便立刻回到未过滤的树。

US-13：作为 Web 开发者，我想打开可编辑文本并看到按语言/扩展名的语法高亮，以便阅读和修改源码与配置。

US-14：作为 Web 开发者，我想同时打开多个编辑器标签页并在其间切换，以便对照多个文件。

US-15：作为 Web 开发者，我想在编辑缓冲里修改文本并看到 dirty 标记，以便知道哪些 Tab 尚未显式保存。

US-16：作为 Web 开发者，我想通过快捷键或保存按钮把编辑缓冲显式保存到磁盘，以便自己决定何时落盘。

US-17：作为 Web 开发者，我想打开常见图片（`.png`、`.jpg`、`.gif`、`.webp`、`.svg`）并在编辑区只读预览，以便查看资源而不误改内容。

US-18：作为 Web 开发者，当我点击不可打开的二进制文件时，我想得到明确提示且不加载内容，以免把二进制当文本改坏。

US-19：作为 Web 开发者，我想只读预览 Tab 没有 dirty 标记且保存操作为禁用，以免误以为图片可以保存。

US-20：作为 Web 开发者，我想在绑定 Workspace 内新建文件，以便不必离开 dsh 创建路径。

US-21：作为 Web 开发者，我想在绑定 Workspace 内新建文件夹，以便整理目录结构。

US-22：作为 Web 开发者，我想重命名文件或文件夹，以便纠正路径名。

US-23：作为 Web 开发者，当重命名目标已存在时，我想看到校验错误且磁盘不变，以免覆盖已有路径。

US-24：作为 Web 开发者，我想删除文件或文件夹，并在确认对话框中明确同意后才执行，以免误删。

US-25：作为 Web 开发者，当已打开文件在磁盘上被 Agent 工具或其他进程修改时，我想被提示并选择重新加载或保留本地编辑缓冲，以免静默丢改动或覆盖外部写入。

US-26：作为 Web 开发者，当我切换 Session 且仍有 dirty 的编辑器标签页时，我想先逐文件保存、丢弃或取消切换，以免静默丢失未保存编辑缓冲。

US-27：作为 Web 开发者，当我关闭一个 dirty 的编辑器标签页时，我想先选择保存、丢弃或取消关闭，以免误关丢失改动。

US-28：作为 Web 开发者，我想资源管理器的 UI 与 Monaco 主题跟随 Harness 的 light/dark，以便编辑区与对话区代码块观感一致。

US-29：作为 Web 开发者，当打开或保存文件较慢时，我想在编辑区内看到加载反馈，且不会挡住整个 dsh Web，以便知道操作仍在进行。

US-30：作为 Web 开发者，当保存或打开失败时，我想在编辑区内看到错误说明并可重试，以便从权限或 I/O 失败中恢复。

## UI 与设计要求

**UI 模式**：`spec-driven`。**UI 设计描述**为编码的唯一权威来源。禁止在本 PRD 要求设计稿、规划变体设计稿，或重写 `DESIGN.md` 的 Token 规格。

唯一端：`platform-id` = `web`（DeepSeek Harness Web）。

### 用户故事 ↔ 页面映射

| 用户故事编号 | 端 | page-id | 该页承担的故事范围 | UI 设计描述要点 |
| --- | --- | --- | --- | --- |
| US-1~US-3 | Web | app-shell | 打开/收起资源管理器、与 Tool 详情切换、details 拖宽 | 三栏壳 + details 分段 Tab |
| US-4~US-30 | Web | editor-surface | 绑定、文件树、过滤、打开三档、多 Tab、显式保存、文件操作、外部变更、Session 切换守卫、主题与加载错误 | 文件树 + 多 Tab 编辑区 |

- 无孤立故事：有 UI 的用户故事均已映射。
- 无孤立页面：`editor-surface` 支撑 US-4~US-30；`app-shell` 为壳层（US-1~US-3）。
- 每个 `platform-id` 有且仅有一个 `app-shell`，且排在功能页之前。

### 状态策略

加载中 / 空 / 错误 / 禁用 / 对话框是同一页的状态变体，不是独立 UI 页。变体写在各页 UI 设计描述末尾，或复用 `DESIGN.md` §5。禁止为变体单独出设计稿。禁止用全屏遮罩挡住整个 dsh Web。

| 状态 | 处理方式 |
| --- | --- |
| 加载中 | 复用 DESIGN §5 Loading。目录展开：该行右侧 16px spinner（`label-caption`）。打开文件 / 显式保存：编辑区居中 24px spinner + 12px `label-secondary` 文案「加载中…」或「保存中…」。Git 状态刷新：树顶 2px 高 indeterminate 条（`semantic-info`），不遮罩整树。 |
| 空状态 | 复用 DESIGN §5 空状态（48px outline 图标 + 标题 14px `label-primary` + 说明 12px `label-secondary` + 可选主按钮 CTA，包在 overlay 卡片内）。具体文案见 `editor-surface` 变体段：未打开文件、过滤无结果、空 Workspace。非 Git 仓库不是空状态：树照常展示，仅无 Git 状态标记。 |
| 错误 | 复用 DESIGN §5 输入错误态。重命名冲突：输入框边框 `semantic-error`，说明「已存在同名路径」。打开 / 保存 / 删除 / 列表失败：编辑区或对话框内 `semantic-error` 文案 + 可点「重试」（打开/保存）。路径越出绑定 Workspace 的拒绝表现为错误文案，不静默忽略。 |
| 禁用 | 非 dirty 的可编辑文本 Tab、只读预览 Tab、不可打开提示态：保存按钮禁用。删除确认主按钮在提交中禁用。无选中树条目时，重命名与删除图标按钮禁用。 |
| 对话框 | 删除确认、外部变更、Session 切换守卫、关闭 dirty Tab：均为 `editor-surface` 浮层变体，表面 `bg-layer-3`，复用 DESIGN §5 按钮（主 / 次 / 危险）。不是独立 page-id。 |

### 页面清单

按 `platform-id` 分组；每组第一条为 `app-shell`。

#### `app-shell`（Web 整体框架）

- **端 / 运行环境**：Web
- **page-id**：`app-shell`
- **页面标题**：Web 整体框架
- **主任务**：定义 dsh Web 三栏壳层与 details 分段 Tab，不承载具体文件任务
- **覆盖的用户故事**：US-1~US-3
- **DESIGN 复用**：§5 导航（details 分段 Tab）、表面 `--dsw-alias-bg-base`
- **UI 设计描述**：继承现有 dsh Web 三栏，本功能不改左侧 Session/Workspace 列表、不改中栏对话。viewport 分区：左栏 sidebar 既有宽度与折叠；中栏 conversation 弹性填充；右栏 details 可拖宽，背景 `--dsw-alias-bg-base`。details 顶栏为水平 segmented：「Tool 详情」|「资源管理器」，选中项背景 `editor-selected-tint` + 底边 2px `editor-tab-active-line`，未选中文字 `label-secondary`，标签 14px semibold。顶栏下方为内容区，flex 填满 details 剩余高度，无额外页边距（由子页自管）。资源管理器选中时内容区渲染 `editor-surface`；切回 Tool 详情即关闭编辑器视图（Tab 与缓冲仍可留在 Client store，直到 Session 切换守卫处理）。壳层变体：无 Session 时 details 可按现有逻辑收起，本功能不强制展开；设置/登录等既有全屏页脱离本壳，本 PRD 不改。无独立空/错态（由内容区子页承担）。

#### `editor-surface`（编辑界面）

- **端 / 运行环境**：Web
- **page-id**：`editor-surface`
- **页面标题**：编辑界面
- **主任务**：在绑定 Workspace 内浏览文件树、打开文件、编辑并显式保存、完成基础文件操作
- **覆盖的用户故事**：US-4~US-30
- **DESIGN 复用**：§5 列表行、搜索框、状态徽章、图标按钮、空状态、Loading、按钮、输入、卡片容器、文件 Tab 栏；§4 `editor-hover-tint` / `editor-selected-tint` / `editor-dirty-dot` / `editor-tab-active-line`；§2 文件树 `bg-overlay`、编辑区 `markdown-code-block`
- **UI 设计描述**：继承 `web` app-shell，details 分段 Tab 选中「资源管理器」；本页只描述 details 内容区。内容区左右分栏：左侧文件树（约 36% 宽、最小约 180px，背景 `--dsw-alias-bg-overlay`），右侧编辑区（弹性填充，背景 `--dsw-alias-markdown-code-block`），中间一条竖向 ghost 线 `--dsw-alias-border-l2`。树顶为贴顶过滤框（高 28px，左搜索图标，placeholder「按文件名过滤」，有内容时右侧清除）。过滤框下为树工具栏：24×24 ghost 图标按钮「新建文件」「新建文件夹」，选中条目时另显「重命名」「删除」。其下为虚拟滚动文件树：行高 22px、无行间分隔、每级缩进 12px；行首 16px 文件类型图标 + 文件名 `label-primary` 13px；行尾 Git 字母微徽章（M 用 `state-warn-label`，U 用 `label-caption`，D 用 `semantic-error`）；hover `editor-hover-tint`，selected `editor-selected-tint`。单击文件：可编辑文本打开为编辑器标签页；常见图片打开为只读预览 Tab；其余二进制不加载，编辑区居中卡片提示「不支持打开此文件类型」。双击文件夹或行首折叠图标展开/折叠；展开时该行右侧 16px spinner。右侧顶部为水平滚动文件 Tab 栏（高 32px）：选中底边 2px `editor-tab-active-line`；dirty 标题前 6px `editor-dirty-dot`；关闭为 28×28 ghost。Tab 栏下为 Monaco（可编辑文本，语法高亮，`--ds-font-family-code` 13px/20px）或图片只读预览（居中 contain）或不可打开提示。显式保存：⌘S / Ctrl+S 或工具栏主按钮「保存」；非 dirty / 只读预览时保存禁用。空状态变体：无打开 Tab 时，编辑区居中 overlay 卡片，48px 文件 outline，标题「未打开文件」，说明「从左侧文件树选择文件，或新建文件」，CTA「新建文件」。过滤无结果变体：树区居中「无匹配文件」，清除过滤为文字按钮。空 Workspace 变体：树区「此目录为空」，CTA「新建文件」。加载变体：打开文件 / 保存时编辑区居中 24px spinner + 「加载中…」/「保存中…」。错误变体：保存/打开失败在编辑区卡片内 `semantic-error` 文案 + 「重试」；重命名冲突输入框错误描边 + 「已存在同名路径」。删除确认对话框变体：标题「删除」，说明含路径，主按钮「删除」（危险）/ 次按钮「取消」。外部变更对话框变体：标题「文件已在磁盘上更改」，说明文件名，主按钮「重新加载」/ 次按钮「保留本地编辑」。Session 切换守卫 / 关闭 dirty Tab 变体：逐文件「保存」「丢弃」「取消」。Git 非仓库：无徽章、无错误提示。

### DESIGN 合规自检

- [x] 未在 PRD 重写色板 / 字体 / Token（只引用 `DESIGN.md`）
- [x] 每页布局由 §5 通用原语组合而成
- [x] 导航形态与 §5 导航定义一致（details 分段 Tab + 文件 Tab 栏）
- [x] 空状态、Loading、表单错误态复用 §5
- [x] 未违反 §6 宜忌（无第二套主题、无全屏遮罩、无 1px 实线主分区、Monaco 不用 UI sans）
- [x] 每页均有 UI 设计描述，覆盖框架 / 层级 / 组件 / 交互 / 变体
- [x] `web` 已有 `app-shell`，且壳层描述先于功能页；功能页已声明继承关系
- [x] spec-driven：全文无设计稿；UI 设计描述可直接指导实现
- [x] 非受限运行时：DESIGN §3 字体实现约束不适用（纯 Web）

**PRD 末尾摘要**

- 本计划 **UI 模式**：`spec-driven`
- **页面总数**：Web 2 页（含 1 个 `app-shell`）
- **整体框架页**：`web` 的 `app-shell` UI 设计描述已定稿
- **UI 设计描述**：2 页均已写完整描述；无过简页
- **待扩展 DESIGN §5** 项：无（文件树行、双层 Tab、过滤框、Git 微徽章、分层 Loading、空状态均已在 DESIGN §5）
- `docs/design/DESIGN.md`：已就绪

## 实现决策

摘要 ADR-0001 / ADR-0002；定位词供下游 `/to-issues`、`/tdd` 逐字引用。

### Host RPC 契约

在现有 Host API 上扩展资源管理器所需 RPC，Client 只消费 RPC、不直接接触磁盘。路径参数为 Host 绝对路径；实现必须拒绝绑定 Workspace 根之外的路径（越界失败，不静默截断）。建议方法与语义：`readFile`（读文本或图片字节）、`writeFile`（显式保存；仅可编辑文本）、`deletePath`（删除文件或文件夹）、`renamePath`（重命名/移动同一父级下的新名）、`watchPath`（对单个已打开路径推送外部变更）、`gitStatus`（在绑定 Workspace 根执行 `git status --porcelain`；非仓库或 git 不可用时返回空列表，不报错）。新建文件走 `writeFile` 创建；新建文件夹复用或并列现有创建目录语义（已存在则失败，与现有 `directory-exists` 同类失败对齐）。

### host.listWorkspaceEntries

现有 `host.listDirectory` 只返回子目录，不够画文件树。新增（或严格扩展且不破坏目录选择器）一层列表：给定绑定 Workspace 内某目录，返回该层直接子项（文件与文件夹），含名称、绝对路径、是否目录、是否隐藏。打开编辑器只拉根层；用户展开文件夹再拉该层。截断时须有可观测标志，Client 不得假装已穷尽。

### ui-file-editor

新建 Client 插件包承载编辑界面：文件树、文件名过滤、文件类型图标、Git 状态标记、多编辑器标签页、Monaco、只读预览、文件操作工具栏与对话框。经 slot 注入 details 栏。编辑缓冲与 dirty、打开 Tab 集合活在 Client store，不写入 Session 日志（人类 UI 状态，非模型可见输入）。

### details Tab 集成

完整编辑界面放入现有 `details` 栏，与 Tool 详情通过分段 Tab「Tool 详情 | 资源管理器」切换，复用右栏拖宽与 concession。收起编辑器 = 切回 Tool 详情 Tab。不新增第四栏，不用 overlay 浮层抽屉，不把文件树拆到 sidebar。须与现有 Tool 详情 occupant 协调 Tab 壳层归属（壳层在 `app-shell`，内容在 `editor-surface`）。

### Monaco Editor

可编辑文本的编辑内核为 Monaco Editor。语法高亮按语言/扩展名自动应用，覆盖常见源码与配置格式。Monaco 主题从 `--dsw-alias-*` / `--ds-font-family-code` 派生，随 Harness light/dark 与对话区同步。字体 13px、行高 20px。只读预览与不可打开提示不使用 Monaco。

### 目录懒加载与虚拟滚动

文件树按文件夹展开逐层拉取子项，打开时不递归预加载整棵树。树列表虚拟滚动，只渲染可视行，以支撑单层上万条目。已展开分支缓存在 Client；文件操作成功后使受影响父目录失效并重拉该层。

### Material Icon Theme 子集

文件类型图标使用 Material Icon Theme SVG 子集，按扩展名/文件夹映射；未覆盖的扩展名 fallback 到通用文件图标。不是图片内容缩略图。

### 按文件 watchPath

每个已打开的编辑器标签页注册独立 `watchPath`；收到磁盘变更且与编辑缓冲不一致时弹出外部变更对话框。关闭 Tab 必须释放对应 watch。不对整个绑定 Workspace 根做递归 watch，不定时轮询 mtime。

### Session 切换守卫

切换当前 Session 前，若存在 dirty 的编辑器标签页，弹出逐文件「保存 / 丢弃 / 取消」；取消则不切换 Session。保存失败停留在守卫，不继续切换。切换成功后文件树根改为新 Session 的绑定 Workspace，关闭旧 Tab 并释放 watch。V1 不按 Session 持久化 Tab 与编辑缓冲。关闭单个 dirty Tab 使用同一组三按钮，不影响 Session。

### 打开策略判定

可编辑文本：UTF-8 或可检测编码的文本，打开后进入编辑缓冲。只读预览：扩展名为 `.png`、`.jpg`、`.jpeg`、`.gif`、`.webp`、`.svg` 的常见图片，编辑区展示、不可改、不可保存。其余为不可打开：树中可见且有文件类型图标，点击后提示「不支持打开此文件类型」，不加载内容。判定在打开时进行；树本身不做类型过滤。

## 测试决策

只测外部行为，不测 Monaco 内部、虚拟滚动像素差、图标 SVG 逐文件比对。定位词与接缝一一对应。

### Host RPC 集成 seam

在现有 Host API 测试先例上断言新 RPC 的响应字段与失败码：读/写/删/改名后磁盘与返回路径一致；`listWorkspaceEntries` 含文件与文件夹且越界路径失败；`writeFile` / `deletePath` / `renamePath` 拒绝绑定 Workspace 外路径；`gitStatus` 在非仓库返回空列表；`watchPath` 在文件被外部改写后产生一次可观测变更事件，取消订阅后不再投递。不测 git porcelain 解析器的内部字符串分片，只测映射到 Client 所需的状态字母（M/U/D 等）是否出现在响应里。

### ui-file-editor 组件 seam

用 Fake Host API 驱动 `ui-file-editor`，断言用户可见行为：展开目录才发起该层列表；文件名过滤收窄节点；单击打开三档（可编辑文本 Tab / 只读预览 / 不可打开提示）；多 Tab 切换；编辑后出现 dirty 圆点，显式保存后圆点消失且 Fake `writeFile` 被调用；新建/重命名/删除走工具栏且删除有确认；外部变更对话框在 Fake watch 事件后出现，选「重新加载」丢缓冲、「保留本地编辑」不丢；Session 切换在 dirty 时被拦住，取消则仍停在原 Session。不断言 className、hook 调用次数或 Monaco 模型内部 API。

### Web browser snapshot seam

在现有 Web 浏览器快照车道增加组装场景，覆盖产品用户可见输出：details 分段 Tab 可见「Tool 详情 | 资源管理器」；选中资源管理器后编辑界面默认态（文件树 + 未打开文件空状态）；必要时一条空过滤/空目录文案。断言规范化 DOM/文案快照，不把 Monaco 光标像素或主题 HEX 写入期望。人类可见文案变更须更新该快照。

## 范围外

V1 不做下列事项（Not now）：

- Agent 工具面（不新增/不替代 `read` / `write` / `str_replace_editor`）
- Terminal 面板、独立 Git 侧栏、stage / commit / push
- 拖拽移动、回收站、右键菜单
- 按文件内容搜索、Quick Open、⌘P / ⌘⇧F
- 自动保存、按 Session 持久化 Tab 与编辑缓冲
- 图片编辑、hex 查看、任意二进制当文本打开
- 尊重 `.gitignore` 的默认隐藏、可配置过滤策略
- 浏览器内 isomorphic-git、独立 Resource Manager HTTP 服务
- 第四栏布局、overlay 浮层抽屉、中栏对话/编辑互斥 Tab
- Tab 数量上限、全量预加载整棵文件树

## 补充说明

依赖：dsh Web 三栏与 `details` 槽位已存在；Host 已有 `listDirectory` / `createDirectory`（目录选择器，仅目录）。资源管理器列表必须含文件，不能假设现有 `listDirectory` 足够。

风险：全量可见范围在巨型 monorepo 下仍可能使单层列表或 `gitStatus` 变慢；懒加载 + 虚拟滚动是缓解而非消除。`watchPath` 在部分网络文件系统上可能漏事件，V1 以 Host `fs.watch` 能提供的信号为准，不另做内容哈希对账。Monaco 打包体积会进入 Web bundle，可接受。

开放问题：无。打开策略的扩展名列表、Git 字母与对话框文案以本 PRD 与 `CONTEXT.md` 为准；实现阶段若需增补罕见图片扩展名，先改本 PRD 再改代码。
