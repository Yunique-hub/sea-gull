# 发布流程

本仓库的发布以“源码 → 运行副本 → 桌面验收 → 推送”为顺序。只跑测试或只看版本号不算发布完成。

## 1. 版本同步

改版本时同时改：

- `VERSION`
- `install.ps1` 的 `$VERSION`
- `install.sh` 的 `VERSION`
- `vendor/dsh-purge/package.json` 的 `seagull.version`
- `CHANGELOG.md`
- `docs/CURRENT.md`

`tests/version-sync.test.mjs` 会锁住这几处。

## 2. 自动化验证

```powershell
node --test "tests/*.test.mjs"
bash tests/smoke.sh
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File verify.ps1
bash verify.sh
```

`verify` 必须同时覆盖：

- `plugins/dsh-purge` 与 `profiles/<profile>/node_modules/dsh-purge` 的版本一致；
- profile 的 `index.js` 不含 `installRegionGate`；
- profile 的 `default-prompt-inject.md` / `net-scope.js` 与源逐字节一致。

## 3. 运行副本同步

```powershell
py -3 src\tools\patch_profile.py --sync-plugin "$env:USERPROFILE\.dsh" desktop
```

同步后比对 `docs/CURRENT.md` 的四处哈希。`--no-pnpm` 更新也必须走这一步；1.0.14 起安装器会自动执行。

## 4. 桌面验收

重启 DeepSeek Harness 后逐项确认：

- 清洗面板显示当前版本与 purge 版本；
- 新会话人格是当前版本，`在吗` 回复固定问候；
- 本地靶场任务不再被插件拦截；
- 面板「恢复默认」生成备份，当前人格哈希不变；
- Steer / Queue、项目创建切换、市场 live、无首启须知；
- 重启后项目和偏好保留。

桌面点击和重启由操作员确认；自动截图与哈希只能作为证据，不替代桌面结论。

## 5. 文档与署名

- 根 `README.md` / `README.en.md` 的 badge、版本、补丁数；
- `NOTICE` 的上游版本、blob 比对、改动表；
- `docs/CURRENT.md`；
- `CHANGELOG.md`；
- 本版本 `docs/releases/UPGRADE-x.y.z.md`。

`tests/docs-consistency.test.mjs` 会检查版本、补丁数和“1.0.12 起”这类错误归因。

## 6. 推送

```powershell
git status --short
git diff --stat
git diff --check
```

确认没有私密对话、账号、凭据、项目数据库、原始备份。然后：

```powershell
git add <具体文件>
git commit -m "release: 1.0.14 ..."
git push origin main
```

不要 `git add -f` 整个维护目录，不要把 `_src/`、`_verify/`、`05_私密资料` 带进仓库。

## 7. 回滚

| 层 | 回滚 |
|---|---|
| profile 副本 | 恢复 `node_modules/dsh-purge.bak-*` 或 `.dsh-purge-previous-*`，重启 |
| 人格文件 | 恢复 `prompt-inject.md.bak-*`，重启 |
| 源码 | revert 发布提交，重新部署上一版 |
| 宿主解包 | 用 dsh-purge 自带备份 / 原始 `app.asar` 恢复 |

不强制推送、不删除用户项目与凭据。