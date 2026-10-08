# 开发指南

## 运行架构

```text
DesktopRug.exe（C# 启动器）
  └─ web/main.cjs（Electron 主进程，透明窗口与桌面层）
       ├─ DesktopRug.exe --bridge（C# / Windows Shell）
       │    └─ 壁纸、真实图标读写、备份、撤销、分类
       └─ web/renderer.mjs（Three.js 与指针交互）
            ├─ worker.mjs → cloth.mjs → self-contact.mjs（布料模拟）
            ├─ surface.mjs / fur.mjs / materials.mjs（曲面与毛发）
            └─ push-icons.mjs / broom-physics.mjs（扫帚推挤）
```

C# 桥接通过标准输入输出交换逐行 JSON。Electron preload 只暴露受限接口，主进程对白名单命令分发；不要为了方便接入任意 shell 执行接口。`contextIsolation` 与 renderer sandbox 均开启。

当前物理网格为 30×20 个格子（651 个顶点），渲染细分为 60×40。碰撞覆盖顶点/三角形和边/边；接触候选复用，网格连接关系缓存。`ClothInput` 合并在途输入，平移累计增量、拖动保留最新目标、松手按顺序处理。

## 目录说明

| 路径 | 内容 |
| --- | --- |
| `src/` | 完整 C# 桌面桥接、启动器、Shell/壁纸逻辑；同时保留旧 WPF 实现 |
| `web/` | 当前 Electron/Three.js 程序、物理引擎、交互、全部现有 JS 测试 |
| `assets/` | 所有当前纹理、图标、样式注册表、生成来源；保留旧波斯毯贴图 |
| `setup.ps1` / `build.ps1` | 安装锁定依赖、检查环境、构建 Windows EXE |
| `scripts/` | 语法/资源校验、无桌面副作用测试入口、Git 隐私扫描 |
| `docs/images/` | 使用合成图标的预览截图，未使用个人桌面截图 |
| `qa/reference/` | 经过筛选的历史自动化验证与性能报告 |
| `qa/*.mjs` / `qa/package-v4.py` | 性能诊断、个人形状本地检查、便携包构建脚本 |

## 安装、构建与测试

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
npm --prefix web run check
npm --prefix web test
```

修改 JS/贴图后重启程序生效；修改 C# 后先关闭本项目实例再运行 `build.ps1`。`npm ci --prefix web` 依据锁文件安装，避免随手更新 Electron/Three.js；运行时版本记录在 `web/package.json`。

默认测试包含输入合并、扫帚物理、扫帚在途批次、类型整理、交互顺序、布料物理、三种材质、堆叠碰撞。测试结果写入本地 `qa/`，默认忽略。CI 执行这些测试及 C# 构建，不接触真实桌面。

真实桌面专项测试保留在 `web/test-bridge.cjs`、`test-push-bridge.cjs`、`test-native-v43.cjs`、`test-live-native.cjs`、`test-broom-desktop.cjs`、`test-styles-native.cjs` 等文件。它们有的创建临时图标，有的切换系统壁纸；请读脚本了解作用后在 Windows 交互会话运行，并检查清理/恢复结果。旧版原生测试部分使用 125% 缩放假设，其他缩放比例需要调整测试参数。

```powershell
# 只在预览窗口回放高频拖动，结束后自动关闭
.\web\node_modules\electron\dist\electron.exe web --drag-benchmark
# 纯布料碰撞分段性能诊断
node qa/profile-contact.mjs
# 从合成默认姿态运行高强度模拟
node qa/drag-stress.mjs
```

`qa/check-saved-shape.mjs` 需要本地已经生成 `state.ini` 和 `plush-shape.json`，不用于全新安装。历史 baseline 模式依赖未公开的旧版程序备份，不应当作完整自动化测试入口。

## 增加壁纸风格

把顶视角地板图片放进 `assets/`，在 `assets/wallpapers.json` 新增记录：

```json
{"id":"my-floor","name":"我的地板","file":"my-floor.png"}
```

`id` 保持唯一、文件名不带目录。现有 UI 与原生风格列表读取同一注册表。保留 `original` 项及其备份/恢复行为。更换原壁纸不能将当前应用地板错误记录为原壁纸。

## 增加毯子或纸张风格

把平整、正视、无环境阴影的纹理放进 `assets/`，在 `assets/rugs.json` 新增：

```json
{"id":"my-rug","name":"我的短绒毯","file":"my-rug.png","material":"short"}
```

现有材质为 `plush`（长绒、毛束）、`short`（短绒、印花）、`paper`（薄纸、无毛发）。仅增加印花不需要改物理引擎；新材质类型需同步 `SurfaceStyles.cs`、`materials.mjs`、`cloth.mjs` 与校验/测试。避免把摄影中的透视、人物或褶皱烘焙进 UV 图案。更新 README 图鉴和素材来源记录后运行校验与材质测试。

`assets/persian-rug.png` 是保留的早期 WPF 波斯毯素材，当前 4.6 的风格面板未启用；它不是额外的第五款当前毯子。

## 性能与已知限制

固定初始姿态的 4.6 比较中，长绒模拟中位耗时约 15.93 → 13.11 ms，短绒约 23.99 → 17.68 ms。见 `qa/reference/verification-v46.txt`。这些不是所有电脑的帧率保证。

常规三种材质各四次堆叠检查通过。极端高频揉叠仍有穿插和长帧；不要把“测试通过”写成任意姿态都不会穿模。渲染提交时间也不等于 Windows 合成器呈现帧率或鼠标到显示延迟。

保持源码性能优化与视觉质量调整分开核对；不要通过隐藏毛发、减少碰撞迭代或大幅降网格而宣称同等效果更快。

## 打包

需要 Python 3。先执行 setup，再运行：

```powershell
python qa/package-v4.py
```

输出位于 `dist/DesktopRug-Windows-v4.6.zip`，包含 EXE、所需 Electron 运行时、Three.js、资产、源码与说明。打包脚本使用明确清单并检查压缩包完整性，不收集运行缓存、原壁纸和个人桌面状态。源码仓库无需提交整个 `node_modules`。
