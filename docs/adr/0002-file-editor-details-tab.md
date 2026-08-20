# 文件编辑器嵌入 details 栏 Tab

V1 文件编辑器（文件树 + Monaco 多 Tab 编辑区）需要可收起的右侧面板，且不能与 Agent 对话争用中栏。我们决定将完整 Editor Surface 放入现有 `details` 栏，与 Tool 详情通过 Tab 切换（「Tool 详情 | 文件编辑器」），复用右栏拖宽与 concession 逻辑，而非新增第四栏、浮层 overlay，或在 sidebar 与中栏之间拆分布局。

**Considered Options**

- 中栏 Chat/Editor Tab 切换：对话与编辑互斥，不符合「编辑在右侧、随时收起」的产品方向。
- 浮层抽屉（`shell.overlay`）：与 details 拖宽手柄和 Session 详情交互易冲突。
- sidebar 新增 explorer 槽位 + 中栏编辑：左侧已承载 Session/Workspace，文件树与编辑区分置两栏，V1 集成成本高。

**Consequences**

- `ui-file-editor` 通过 `ctx.slots.inject('details', …)` 或 details 子槽位注册 Tab 内容；须与 `ui-conversation` 的 Tool 详情 occupant 协调 Tab 壳层归属。
- 收起编辑器即切回 Tool 详情 Tab；Session 切换守卫（dirty Tab）在 Client store 层实现。
