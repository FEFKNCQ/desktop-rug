# 把仓库交给 Codex、Claude Code、WorkBuddy 等智能体

把下面这段连同仓库链接发给具备 Windows 本地终端权限的 AI 即可。纯聊天工具或只有 Linux 云容器的工具不能挂载 Windows 桌面。

```text
请在我的 Windows 电脑本地部署 https://github.com/LongJingSU/desktop-rug 。
先阅读 README.md、AGENTS.md 和 docs/DEVELOPMENT.md。
检查 Windows x64、Node.js x64 22.12+、Git 和 .NET Framework 编译器。
克隆项目，运行 setup.ps1 安装锁定依赖并构建，再运行 npm --prefix web test。
先启动 DesktopRug.exe --gpu-preview 验证贴图、拖动、缩放和风格面板。
预览完成后关闭预览，再启动 DesktopRug.exe 挂载真实桌面。
我知道真实桌面首次启动会备份壁纸和图标布局、启用自由摆放并设置木地板。
保留恢复入口，不上传我的壁纸、文件名、布局、缓存、日志或任何凭证。
后续开发基于此源码进行，优先保证交互流畅；不要重写成网页演示。
最后报告部署位置、启动和退出方法、测试结果以及仍存在的限制。
```

## 执行步骤

```powershell
git clone https://github.com/LongJingSU/desktop-rug.git
cd desktop-rug
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
npm --prefix web test
.\DesktopRug.exe --gpu-preview
```

`setup.ps1` 只安装本项目依赖并构建；默认不改变桌面。`-Preview` 构建后打开预览，`-Start` 构建后进入真实桌面。两个开关不能同时使用。

预览和桌面版不要同时开：先关闭预览窗口，再运行 `.\DesktopRug.exe`。再次启动同一路径下的程序会切换显示状态。需要退出时用托盘菜单，或 `.\DesktopRug.exe --exit`。

## 环境限制

| 情况 | 应如何处理 |
| --- | --- |
| Linux / macOS / 云端 Linux 容器 | 可以读源码、运行纯 Node 测试；不能编译 Windows 桥接或展示真实桌面。移交 Windows 本地执行端。 |
| 未安装 Node 或版本过旧 | 安装 Node.js 24 x64，重新打开终端；不需要全局安装 Electron。 |
| 没有 Git | 可下载 GitHub 的 Source code ZIP 并完整解压；构建与运行仍可使用。隐私检查需要 Git 工作区。 |
| 依赖下载失败 | 保留 npm 错误，检查 npm registry 和 GitHub Electron 下载访问；不要删除锁文件或偷偷换依赖版本。 |
| Electron 未下载 | Electron 44 按需下载运行时；`setup.ps1` 会执行 `node web/node_modules/electron/install.js`。手动安装也须执行这一步。 |
| 找不到 Framework64 编译器 | 修复/启用 Windows .NET Framework 4.x 环境。项目不要求 Visual Studio 或 .NET 8 SDK。 |
| 旧程序占用 EXE，构建失败 | 关闭本项目的旧实例后再构建，不要结束资源管理器或其他用户程序。 |

没有外部服务、数据库、API Key 或云端配置。首次安装需要联网下载依赖；安装完成后应用本体可以离线运行。

## 交付检查

确认 `DesktopRug.exe`、`web/enabled.flag`、`web/node_modules/electron/dist/electron.exe` 和所有注册样式图片存在；确认八组纯逻辑测试通过。预览应有四种壁纸选项、四种材质选项和扫帚/整理入口。真实桌面检查图标没有持续闪烁，原壁纸可恢复，并向使用者说明退出不会自动还原壁纸与网格设置。
