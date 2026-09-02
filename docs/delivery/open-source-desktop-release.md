# MIT 开源与桌面 Release 跟做指南

面向维护者：将本仓库以 **MIT** 协议开源，并在 **GitHub Releases** 持续提供 **macOS（`.dmg`）** 与 **Windows（`.exe` NSIS 安装包）**。

本文档只覆盖**桌面安装包**交付；Web 端（`pnpm dsh web`）与 npm 包发布见文末「相关但不在本文范围」。

---

## 1. 交付物定义

一次正式 Release 应包含：

| 产物 | 平台 | 构建命令产出 | 发布位置 |
| --- | --- | --- | --- |
| `NanGeAGI-<version>.dmg`（文件名以 electron-builder 实际为准） | macOS（Apple Silicon / Intel 取决于 CI runner） | `pnpm run pack:desktop` | GitHub Release Assets |
| `NanGeAGI Setup <version>.exe` | Windows x64 | 同上（须在 Windows 上或 Windows CI） | GitHub Release Assets |
| 源码 tag | — | `git tag v<version>` | 与 Release 同名 |
| `THIRD_PARTY_NOTICES.md` | — | 仓库根目录（随源码） | Release 说明中链接 |

安装包内已捆绑：

- `apps/web` 前端 dist（SPA）
- Playwright Chromium（浏览器段与 Agent `browser_*`）
- Host runtime（`dsh-desktop-host-pkg` deploy 闭包）

**用户无需**安装 Node.js、pnpm 或执行 `playwright install`。Git 面板需要本机已安装 `git` 并在 PATH 中。

---

## 2. 前置条件

### 2.1 维护者环境

| 用途 | macOS | Windows |
| --- | --- | --- |
| 本地打 macOS 包 | Node ^22.19 或 >=24、pnpm 11.7.0、git | — |
| 本地打 Windows 包 | — | 同上 |
| 推荐 | 日常开发 + macOS 本地 smoke | 至少一台或 CI 跑 Windows 矩阵 |

启用 Corepack 并锁定 pnpm：

```sh
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

### 2.2 GitHub 仓库

- 仓库设为 **Public**
- Settings → General → Releases → 允许维护者创建 Release
- （可选）Settings → Actions → General → Workflow permissions：`Read and write`（若后续 workflow 自动上传 Release asset）

### 2.3 发布分支策略（建议）

| 分支 | 用途 |
| --- | --- |
| `main`（或 `custom/main` 合并后） | 稳定集成分支，Release 只从这里打 tag |
| `test/*` | 预发布验证，不打对外 tag |

Release 前确认桌面 V5 相关 Issue（#111–#122）已在目标分支合并并通过本地 smoke。

---

## 3. 开源前一次性 checklist

按顺序执行，**首次公开仓库前**完成。

### 3.1 许可证

根目录已有 [`LICENSE`](../../LICENSE)（MIT）。开源前确认：

1. **Copyright 行**是否为你的实体（当前为 `Copyright (c) 2026 DeepSeek`，fork 公开时应改为你的名称或组织）。
2. 仓库根 `README` 顶部加许可证徽章与一句「Licensed under MIT」。
3. 各 `package.json` 的 `"license": "MIT"` 与根一致（桌面壳见 `apps/desktop/package.json`）。

### 3.2 第三方声明

```sh
pnpm run verify-third-party-notices
```

失败则：

```sh
pnpm run gen-third-party-notices
git add THIRD_PARTY_NOTICES.md
```

Release 说明中应链接 [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) 与 [`LICENSE`](../../LICENSE)。

### 3.3 品牌与安装包元数据

发布前统一产品名，避免 GitHub 名与安装包名不一致：

| 文件 | 字段 | 当前示例 |
| --- | --- | --- |
| [`apps/desktop/electron-builder.yml`](../../apps/desktop/electron-builder.yml) | `productName` | `NanGeAGI` |
| [`apps/desktop/src/app-branding.ts`](../../apps/desktop/src/app-branding.ts) | `DESKTOP_APP_DISPLAY_NAME` | `NanGeAGI` |
| [`apps/desktop/package.json`](../../apps/desktop/package.json) | `productName` | `NanGeAGI` |

图标：electron-builder 从 `apps/desktop/resources/` 读取（`icon.icns` / `icon.ico`）。若目录为空，打包会用 Electron 默认图标——**首次对外 Release 前应补全**。

### 3.4 敏感信息

确认未提交：

- `.env`、API Key、`$DSH_HOME/.credentials.yaml` 样例中的真实密钥
- 内网 URL、私有证书

`.gitignore` 已忽略常见路径；可用 `git log -p -- .env` 等抽查历史。

### 3.5 对外 README 最小内容

公开仓库 README 建议包含：

- 项目简介（Agent + 工具箱：文件编辑器 / Git / 终端 / 浏览器）
- **下载**：Releases 页链接
- **系统要求**：macOS 版本、Windows 10+、需安装 git
- **首次使用**：设置里配置模型 API Key（见 [`docs/user/guide/providers.zh.md`](../user/guide/providers.zh.md)）
- **从源码构建**（可选，给贡献者）：`pnpm install && pnpm run build`
- License: MIT

---

## 4. 版本号

桌面安装包版本取自 **`apps/desktop/package.json` 的 `version`**（staging 时写入打包用根 `package.json`）。

与 workspace 根 [`package.json`](../../package.json) 保持一致。当前族内版本线示例：`0.1.0-rc.5`。

### 4.1 bump 版本（推荐用仓库脚本）

```sh
# 补丁 / 次版本 / 主版本
pnpm run release:dsh -- patch   # 或 minor / major

# 或显式版本（含 prerelease）
pnpm run release:dsh -- 1.0.0
pnpm run release:dsh -- 1.0.0-rc.1
```

脚本会更新各 manifest 与 lockfile 并生成 commit；**tag 由人打**，CI 不写回仓库。

### 4.2 打 tag

对外桌面 Release 建议使用 **SemVer** tag（与 npm 族的 `dsh-v*` 可并存，桌面用更直观的 `v` 前缀）：

```sh
git tag v1.0.0
git push origin v1.0.0
```

---

## 5. 本地打包（发布前必做 smoke）

### 5.1 完整命令

在仓库根目录：

```sh
pnpm install --frozen-lockfile
pnpm run pack:desktop:dir    # ① staging + unpacked（快速验证）
pnpm run smoke:desktop-packaging
pnpm run pack:desktop        # ② 正式安装包
```

产物目录：

```
dist/desktop/installers/
  *.dmg          # macOS
  *.exe          # Windows NSIS
  mac/           # unpacked .app（--dir 时）
  win-unpacked/  # Windows unpacked（--dir 时）
```

### 5.2 `prepare:desktop-packaging` 做了什么

[`scripts/prepare-desktop-packaging.ts`](../../scripts/prepare-desktop-packaging.ts) 依次：

1. `pnpm run build`（含 `apps/web` dist）
2. 编译 `apps/cli`、`apps/desktop`
3. `pnpm deploy` Host runtime 到 staging
4. `playwright install chromium` 到 staging（体积大，首次较慢）
5. 写入 `dist/desktop/staging/`

### 5.3 人工验收（Release 阻塞项）

在对应平台安装 unpacked 或正式包后：

- [ ] 应用启动，无 Host boot 致命错误
- [ ] 设置 → 配置模型 API Key → 能发起对话
- [ ] 创建 Workspace，绑定目录
- [ ] 工具箱五段均可打开：资源管理器、Git 面板、终端、浏览器、工具详情
- [ ] 文件编辑器：打开 / 编辑 / 保存
- [ ] Git：status / diff / commit（需本机 git）
- [ ] 终端：spawn shell、输入命令
- [ ] 浏览器：导航网页（桌面为面板内 WebView）
- [ ] 退出：无 dirty 时关窗即退出；有 dirty 编辑器时弹出退出守卫

### 5.4 平台注意

- **macOS 包只能在 macOS 上构建**（或 macOS CI）。
- **Windows 包只能在 Windows 上构建**（或 Windows CI）。
- 不要在单平台交叉编译另一平台安装包。

---

## 6. CI 打包（双平台）

仓库已有 [`.github/workflows/desktop-packaging.yml`](../../.github/workflows/desktop-packaging.yml)。

### 6.1 手动触发

1. GitHub → **Actions** → **Desktop packaging**
2. **Run workflow**，选择要打包的 **branch / tag**（选已打 tag 的 commit 更稳妥）
3. 等待 `pack (macos)` 与 `pack (windows)` 完成
4. 在 Run 页面 **Artifacts** 下载：
   - `deepseek-harness-desktop-macos` → `*.dmg`
   - `deepseek-harness-desktop-windows` → `*.exe`

Artifact 保留 **7 天**；长期分发必须上传到 **GitHub Release**。

### 6.2 CI 与本地命令等价关系

| CI step | 本地等价 |
| --- | --- |
| `pnpm run prepare:desktop-packaging` | 同左 |
| `electron-builder --dir` + smoke | `pnpm run pack:desktop:dir && pnpm run smoke:desktop-packaging` |
| `electron-builder`（installer） | `pnpm run pack:desktop` |

当前 CI 产出 **unsigned** 包（`electron-builder.yml` 中 `identity: null`、`sign: false`）。对外 Release 第一版可先发 unsigned，Release 说明中写清 Gatekeeper / SmartScreen 处理方式（见 §8）。

---

## 7. 发布 GitHub Release（逐步）

### 7.1 流程总览

```
合并稳定分支 → bump 版本 → 打 tag vX.Y.Z → push tag
    → 触发 Desktop packaging workflow（选 tag）
    → 下载 macOS dmg + Windows exe
    → 创建 GitHub Release，上传 assets
    → 填写 Release notes
```

### 7.2 创建 Release

1. GitHub → **Releases** → **Draft a new release**
2. **Choose a tag**：`v1.0.0`（与 §4.2 一致）
3. **Release title**：`v1.0.0` 或产品名 + 版本
4. **Attach binaries**：
   - 从 CI Artifacts 取出 `*.dmg`、`*.exe` 拖入
   - 建议命名：`NanGeAGI-1.0.0-macos.dmg`、`NanGeAGI-1.0.0-windows-x64.exe`（便于用户识别）
5. （可选）生成 `SHA256SUMS.txt`：

```sh
cd dist/desktop/installers
shasum -a 256 *.dmg *.exe > SHA256SUMS.txt
# Windows: certutil -hashfile file.exe SHA256
```

6. **Publish release**

### 7.3 Release notes 模板

复制到 GitHub Release 描述，替换 `<>` 占位：

```markdown
## NanGeAGI <version>

基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 AI 编程助手桌面版（MIT）。

### 下载

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| macOS | `NanGeAGI-<version>-macos.dmg` | 打开 dmg，将 App 拖入「应用程序」 |
| Windows | `NanGeAGI-<version>-windows-x64.exe` | 运行安装向导 |

### 系统要求

- **macOS**：<填写最低版本，建议 macOS 12+>
- **Windows**：Windows 10 64 位及以上
- **Git**：Git 面板需要本机已安装 [Git](https://git-scm.com/) 并在 PATH 中
- **网络**：对话需要配置模型 API Key（设置 → 模型）

### 首次使用

1. 安装并启动应用
2. 打开 **设置 → 模型**，添加 DeepSeek 或其它 OpenAI 兼容提供方并保存 API Key
3. 创建或选择 **Workspace**，绑定本地项目目录
4. 在对话区开始任务；右侧 **工具箱** 可编辑文件、Git、终端、浏览器

### 安全提示（未签名包）

本 Release 安装包**尚未做代码签名/公证**。若系统拦截：

- **macOS**：系统设置 → 隐私与安全性 → 仍要打开；或右键 App → 打开
- **Windows**：点击「更多信息」→「仍要运行」

### 许可证

- 本项目：[MIT](../../LICENSE)
- 第三方组件：[THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)

### 从源码构建

见仓库 [README](../../README.md#从源码运行)。
```

---

## 8. 代码签名（第二阶段，可选但强烈建议）

第一版 unsigned 可交付给技术用户；面向大众建议排期：

| 平台 | 需要 | 配置位置 |
| --- | --- | --- |
| macOS | Apple Developer、Developer ID Application、notarytool 公证 | `apps/desktop/electron-builder.yml` → `mac.identity`、`hardenedRuntime: true`、entitlements |
| Windows | 代码签名证书（EV 更佳） | `win.signAndEditExecutable: true` + 证书环境变量 |

签名 secrets 只放在 GitHub **Environments** 或本地钥匙串，**不要** commit 到仓库。

---

## 9. 自动化：tag 触发打包并上传 Release（可选增强）

当前 `desktop-packaging.yml` 仅在 PR / 手动 dispatch 时运行，**不会**自动创建 GitHub Release。若要「推 tag 即发布」，可新增 workflow（维护者自行添加 `.github/workflows/desktop-release.yml`）：

```yaml
name: Desktop release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

env:
  DSH_TELEMETRY_DISABLED: '1'

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-latest
            artifact_glob: '*.dmg'
            asset_name: macos
          - os: windows-latest
            artifact_glob: '*.exe'
            asset_name: windows
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run prepare:desktop-packaging
      - run: node ../../scripts/run-electron-builder.mjs --config electron-builder.yml --dir
        working-directory: apps/desktop
      - run: pnpm run smoke:desktop-packaging
      - run: node ../../scripts/run-electron-builder.mjs --config electron-builder.yml
        working-directory: apps/desktop
      - name: Upload to GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: dist/desktop/installers/${{ matrix.artifact_glob }}
          generate_release_notes: true
```

注意：macOS 与 Windows 各跑一个 job 会**分别**调用 `action-gh-release`；更稳妥做法是 matrix 只产出 artifact，再用第三个 job `needs: [mac, win]` 统一上传。首次启用前在 fork 上试跑 tag `v0.0.0-test`。

---

## 10. 日常发版节奏（建议）

| 阶段 | 动作 |
| --- | --- |
| 开发 | feature 分支 → PR → 合并 `main` |
| 预发布 | `pnpm run pack:desktop:dir` + 本地 smoke |
| 定版 | `pnpm run release:dsh -- <version>` → `git tag vX.Y.Z` → push |
| 构建 | Actions **Desktop packaging** on tag |
| 发布 | Draft Release → 附 dmg/exe → Publish |
| 公告 | README 下载链接指向 latest Release |

---

## 11. 故障排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| `prepare:desktop-packaging` 在 playwright 步骤失败 | 网络或磁盘空间 | 重试；确保 ~2GB 可用空间 |
| `smoke-desktop-packaging: no unpacked desktop resources` | 未先 `--dir` 或路径不对 | 先 `pack:desktop:dir` |
| macOS 打开提示「已损坏」 | unsigned + quarantine | `xattr -cr /Applications/NanGeAGI.app` 或用户右键打开 |
| Windows SmartScreen | 未签名 | Release 说明写清；后续做代码签名 |
| Git 面板不可用 | 未装 git | 用户安装 Git for Windows / Xcode CLT |
| Host boot 失败 | staging 不完整 | 删 `dist/desktop/staging` 后重跑 prepare |
| 浏览器段不可用 | Chromium 未打进包 | 检查 `resources/playwright-browsers` 是否存在 |

---

## 12. 相关但不在本文范围

| 主题 | 参考 |
| --- | --- |
| npm 包发布（`dsh` CLI） | [`.github/workflows/release.yml`](../../.github/workflows/release.yml)、`pnpm run release:pack` |
| Web 浏览器交付（非安装包） | `pnpm dsh web`；无现成 Docker 部署模板 |
| 上游合并策略 | [`CUSTOM.md`](../../CUSTOM.md) |
| 桌面 PRD / ADR | [`docs/prd/desktop-v5.md`](../prd/desktop-v5.md)、[`docs/adr/0009-desktop-shell-electron-delivery.md`](../adr/0009-desktop-shell-electron-delivery.md) |
| 打包实现细节 | [`apps/desktop/README.md`](../../apps/desktop/README.md) |

---

## 13. 快速命令备忘

```sh
# 开发桌面
pnpm run dev:desktop

# 发布前本地全量
pnpm install --frozen-lockfile
pnpm run pack:desktop:dir && pnpm run smoke:desktop-packaging
pnpm run pack:desktop

# 版本
pnpm run release:dsh -- 1.0.0
git tag v1.0.0 && git push origin v1.0.0

# 第三方声明
pnpm run verify-third-party-notices
```

---

*文档版本：与仓库桌面打包链（Issue #120 / `desktop-packaging.yml`）对齐。维护者更新打包脚本或 electron-builder 配置时请同步修订本文 §5–§6。*
