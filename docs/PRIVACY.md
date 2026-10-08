# 本地数据与发布检查

应用本体不需要账户、API Key 或后端服务。依赖安装通过 npm/GitHub 下载；日常壁纸、布料和图标处理都在本机完成。

## 哪些数据只留在本机

| 路径 / 文件 | 内容 |
| --- | --- |
| `wallpaper-backup/` | 原壁纸独立图片副本及来源路径 |
| `original-wallpaper.txt` | 旧版原壁纸路径记录 |
| `original-icon-layout.bin` / `original-icon-flags.txt` | 最初图标布局和网格设置 |
| `before-last-sweep.bin` | 最近一轮清扫或整理的撤销布局 |
| `state.ini` / `plush-shape.json` / `cloth-shape.bin` | 位置、尺寸、旋转和个人布料形状 |
| `floor-enabled.txt` / `rug-style.txt` | 当前选择 |
| `web/profile/` | Electron / Chromium 本地运行缓存 |
| `runtime.log` / `status.txt` | 本机诊断，可能含路径和错误详情 |
| `revisions/` / `qa/` 运行输出 | 本地恢复快照、诊断记录、可能涉及桌面的测试结果 |

这些路径默认被 `.gitignore` 排除。应用在项目目录中写入配置，因此请选择可写目录；换位置或更新代码时，应自行保留需要恢复的备份。不要在仍需要恢复图标/壁纸时删除备份。

## 本次公开源码的处理

保留全部当前 C# 与网页程序源码、样式资源、锁文件和测试源码。排除个人运行状态、原壁纸图片、图标布局、账号缓存、使用录像截图、性能分析原始文件以及含本机信息的旧诊断输出。资源来源记录中的本机绝对路径改为仓库相对路径，两个原生测试改为自动寻找当前用户桌面。

`docs/images` 为程序预览窗口截图，只含合成图标，已经人工检查。`qa/reference` 只保留经过筛选的自动化指标；原始用户轨迹和个人姿态文件未附带。Git 提交采用 GitHub noreply 邮箱，不公布私人邮箱。

## 再次发布前

```powershell
git add README.md src web assets docs scripts setup.ps1 build.ps1
node scripts/privacy-check.mjs
git diff --cached --stat
git diff --cached
```

扫描针对 Git 索引中的内容，检查禁止上传的路径、常见凭证格式、个人绝对路径和 PNG 文本元数据。它是辅助检查，不能替代人工查看新截图、日志、未知格式附件和业务数据。不要使用 `git add -f` 绕过忽略规则上传状态文件。

如果要报告问题，优先上传合成预览或裁去私人内容后的截图；日志先检查用户名、文件名、完整路径和凭证。不要直接打包整个运行目录。
