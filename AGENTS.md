# DesktopRug：给代码智能体的项目入口

先读 `README.md` 和 `docs/AI_DEPLOY.md`，再读 `docs/DEVELOPMENT.md`。这是 Windows 原生桌面程序，不是要部署到服务器的网站。

## 最短执行路径

1. 检查 Windows x64、Node.js x64 >= 22.12（已用 24 测试）、Git、PowerShell、系统 .NET Framework 4.x 编译器。
2. 仓库根目录运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1`。
3. 运行 `npm --prefix web test`。这组测试不移动真实桌面图标、不切换壁纸。
4. 用 `DesktopRug.exe --gpu-preview` 查看窗口预览；真实桌面使用 `DesktopRug.exe`。

## 开发约束

- 保留全部当前源码与样式。当前运行入口是 Electron + Three.js + C# 桥接；`src` 中的旧 WPF 实现仍保留，不能把旧版测试结果当成新版验收。
- 交互性能优先。物理计算在 Worker；高频鼠标输入合并；原生图标更新有在途限制。改变这些路径须跑相应测试。
- 桌面窗口必须保持独立顶层并由桌面拥有，不能把透明 Chromium 窗口重新作为图标窗口的子窗口，否则可能让图标闪烁或消失。
- 保留首帧完成后再显示的启动顺序。不要使用 `moveBottom()` 代替现有桌面挂载过程。
- 扫帚推动 Windows 原生图标，不先隐藏图标或替换为图片。不移动、删除用户文件。
- 原壁纸必须保留独立备份，风格切换不能覆盖这份备份。截图与基准测试优先用预览模式和合成图标。
- 不提交个人数据：`web/profile`、原壁纸备份、布局文件、日志、录像、运行状态、`revisions`。提交前运行 `node scripts/privacy-check.mjs`，并人工检查新图片和日志。
- `npm test` 是离线逻辑测试。`test-*-native.cjs`、bridge、桌面回放、壁纸测试会调用真实 Windows 桌面；不要在通用 CI 中运行。
- 历史 `--drag-baseline` 回放依赖维护者本地旧版备份，不属于首次部署流程。公开复测使用当前版测试与 `qa/reference` 历史结果。

有当前用户明确要求时以用户的任务范围为准；上述规则不是对正常安装、构建或开发操作增加重复确认。
