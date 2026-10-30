# 海鸥 1.0.14：运行副本、人格热更新与验证加固

完成日期：2026-10-30。基线：1.0.13 / `70ae8d7`。

## 修复

### 运行副本

- `install.ps1` / `install.sh`：`--sync-plugin` 移出 pnpm 分支。只要 `profiles/<profile>/node_modules/dsh-purge` 存在，`--NoPnpm` / `--no-pnpm` 更新也会同步 profile 运行副本。
- 本机 profile 已从 1.0.12 同步到 1.0.13/1.0.14 对应文件：`net-scope.js` 回到 `0CCA8745`，`index.js` 不再挂 `installRegionGate`，人格槽回到 `24581A9E`。

### 人格热更新

- `core.js` 新增 `clearCommittedOverride(home)`。
- `index.js` 在 `prompt-inject.md` mtime 变化时清掉进程内旧 pin，再走 `resolveInjectText`。
- `rules.js` 在 pin 与磁盘哈希不一致时优先磁盘；同一份稿仍走 pin，避免重复 IO。
- 结果：外部替换人格文件后，刷新路径会清掉旧 pin 并读到新正文；宿主 system 段缓存仍以重启后的桌面验收为准。插件模块更新需要重启。

### 状态与验证

- `overrideStatus` 改为读取磁盘：`custom` / `default` / `missing`，不再恒 `default`。
- `verify.ps1` / `verify.sh` 增加 profile 运行副本检查：版本、范围闸、人格槽、`net-scope` 四处。
- `tests/verify-current-runtime.test.mjs` 增加“profile 副本带闸必须失败”的反例。
- 新增 `tests/prompt-external-change.test.mjs`、`tests/docs-consistency.test.mjs`。

### 文档与仓库结构

- 新增 `docs/CURRENT.md`、`docs/README.md`、`docs/RELEASE.md`。
- 发布记录移入 `docs/releases/`，评审记录移入 `docs/reviews/`。
- README / README.en / NOTICE / ARCHITECTURE 的版本、补丁数、范围闸归因统一到 1.0.14 / 88 / 1.0.13。
- NOTICE 的 104 blob 比对保留实测结果：76 一致 / 17 差异 / 11 图片；UPGRADE-1.0.12 的 77/16 是旧统计，已改为以 NOTICE 为准。
- 新增 `.github` issue / PR 模板与 `CODEOWNERS`。

## 升级

```powershell
cd E:\codex_my_project\海鸥
py -3 src\tools\patch_profile.py --sync-plugin "$env:USERPROFILE\.dsh" desktop
```

然后完全退出并重启 DeepSeek Harness。更新模式保留现有 `prompt-inject.md` 与项目数据；`--no-pnpm` 路径现在也会同步运行副本。

## 验证

- `node --test tests/*.test.mjs`：**165 pass / 0 fail**。
- `bash tests/smoke.sh`：全绿。
- `verify.ps1` / `verify.sh`：**25/25、28/28**，包含 profile 副本检查。
- profile 四处哈希见 `docs/CURRENT.md`。

## 边界

- 本次自动验证覆盖源码、安装器、profile 哈希与验证脚本；真实桌面点击、重启后的 UI 行为和用户项目数据由操作员按 `docs/RELEASE.md` 验收。
- 不改变操作员对目标的授权判断；范围闸移除只表示插件不再按目标地址/任务类别拦截。
- 上游只声明支持 rc.2；rc.3 适配属于海鸥定制。