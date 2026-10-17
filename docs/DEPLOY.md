# 部署

## 1. 三种装法

### 1.1 远程一行（推荐）

```powershell
# Windows PowerShell
irm https://raw.githubusercontent.com/Yunique-hub/-/main/install.ps1 | iex
```

```bash
# Linux / macOS / WSL / Git Bash
curl -fsSL https://raw.githubusercontent.com/Yunique-hub/-/main/install.sh | bash
```

管道模式下脚本检测不到本地仓库，会自己拉 tarball 到临时目录再执行，结束自动清理。

### 1.2 本地 checkout

```bash
git clone https://github.com/Yunique-hub/-.git seagull && cd seagull
bash install.sh                      # 或 powershell -File install.ps1
```

### 1.3 离线 / 内网

仓库自带 `vendor/dsh-purge/`，不需要联网：

```bash
bash install.sh --no-pnpm             # 跳过 pnpm install
# 若之后补 pnpm：
cd "$DSH_HOME/profiles/desktop" && node /path/to/pnpm.cjs install
```

## 2. 安装器做了什么

| 步 | 动作 | 失败时的降级 |
|---|---|---|
| 1 | 定位 `DSH_HOME`（含 `profiles/` 的 `.dsh`） | `--dsh-home` 指定 |
| 2 | 选 profile（desktop 优先，否则 web） | `--profile` 指定 |
| 3 | 定位安装根 + 内嵌 node/pnpm | 降级 files-only（跳过 pnpm/Apply） |
| 4 | `vendor/dsh-purge` → `$DSH_HOME/plugins/dsh-purge` | 已有的先备份成 `.bak` |
| 5 | 改 profile `package.json`（加依赖 + bundle） | 自动备份 `.bak-seagull` |
| 6 | 在该 profile 目录 `pnpm install` | `--no-pnpm` 跳过 |
| 7 | 落 `prompt-inject.md` / `rules/` / `skills/` | 已有的加时间戳备份 |
| 8 | （`--apply` 时）解 asar + 打补丁 | 见 §3 |

**幂等**：重复执行不会重复追加 bundle，不会破坏已有配置。

## 3. Apply —— 最容易卡的一步

官方桌面 EXE 是**密封 asar**，`@deepseek-ai/*` 都在 `resources/app.asar`（约 121 MB / 12968 文件）
里。必须「解包 → 打补丁 → 挪走 asar」才生效。

### 3.1 自动（`--apply`）

```bash
bash install.sh --apply
```

密封宿主下它会跑 `lib/reapply-cli.js`（**不是** `bin/dsh-purge.js --apply`，后者在桌面下取不到 aiBase），
成功返回：

```json
{"ok":true,"error":"","version":"1.1.71","reverted":0,"applied":69,"failed":0,"renamed":false,"needsFullQuit":true,"cmdFlashOk":true}
```

然后手动收尾（宿主导出器在跑，asar 被占着，挪不动）：

```bash
# 1. 完全退出 DeepSeek Harness（托盘退出，或 taskkill /F /T /IM "DeepSeek Harness.exe"）
# 2. 挪走 asar
mv "$APP_ROOT/resources/app.asar" "$APP_ROOT/resources/app.asar.sealed.bak"
# 3. 重新打开
```

### 3.2 手动（图形界面）

1. 完全退出 DeepSeek Harness
2. 重开 → 会话标题旁点 **dsh-purge** → **Clean** 页 → **Apply**
3. 成功 Apply 会重启一次；之后新建会话即生效

### 3.3 网页宿主（`dsh web`，非密封）

```bash
bash install.sh --profile web --apply
```

没有 asar，`bin/dsh-purge.js --apply` 直接可用，重启 `dsh web` 生效。

## 4. 校验

```bash
bash verify.sh            # 21+ 项
bash verify-e2e.sh        # 真跑模型（需 API key）
bash tests/smoke.sh       # 不碰真机
```

`verify.sh` 检查：DSH_HOME / profile / 插件版本 / profile 挂载 / node_modules /
asar 状态 / 被改宿主文件数 / 官方身份句是否剥掉 / 补丁计数 / 注入文件 / 规则集 /
技能数 / 三个全破开关。

## 5. 回滚

```bash
bash install.sh --uninstall
```

会：
- 跑 `dsh-purge --revert` 还原宿主补丁
- 从 profile `package.json` 摘掉依赖与 bundle
- 删 `plugins/dsh-purge`、`prompt-inject.md`、`rules/seagull-fullbreak.*`
- **保留 `$DSH_HOME/skills`**（不误删你自己的技能）

若 asar 被挪走过，记得放回：

```bash
mv "$APP_ROOT/resources/app.asar.sealed.bak" "$APP_ROOT/resources/app.asar"
```

**更彻底的回滚**（不依赖插件备份）：

```bash
rm -rf "$APP_ROOT/resources/app" "$APP_ROOT/resources/app.dshpurge-prev"
mv "$APP_ROOT/resources/app.asar.sealed.bak" "$APP_ROOT/resources/app.asar"
```

因为原始 asar 从没被改过，这条永远有效。

## 6. 故障排查

| 症状 | 原因 | 处理 |
|---|---|---|
| `找不到 DSH 主目录` | 没启动过 DSH / 自定义路径 | `--dsh-home` 指定 |
| `没有任何 profile` | 首次安装还没生成 | 先启动一次 DSH 再装 |
| `pnpm install 失败` | registry 不通 / `file:` 路径错 | 配镜像，或 `--no-pnpm` 后手动 |
| Apply 后没变化 | `app.asar` 还在，Electron 仍读 asar | 退出宿主 → 挪 asar → 重开 |
| `ERR_MODULE_NOT_FOUND app.asar\...` | asar 被挪走后 CLI shim 还指着 asar | 把 `resources/runtime/cli/bin/dsh.cmd` 里的 `app.asar\dsh\` 改成 `app\dsh\` |
| 补丁数明显偏低 | dsh 版本升级，上游锚点对不上 | 看 `--status` 的 pending/skipped；换匹配的上游版本 |
| 中文任务报 `'C:\...DeepSeek' 不是内部或外部命令` | cmd.exe 重解析全角字符 | 别用 `dsh.cmd` 传中文，走 Electron node 模式（见 VERIFICATION §方法） |

## 7. 平台差异

| 平台 | 密封 asar | 内嵌 node/pnpm | 备注 |
|---|---|---|---|
| Windows 桌面版 | ✅ | ✅ | 需要 `taskkill` 或托盘退出才能挪 asar |
| macOS 桌面版 | ✅ | ✅ | 路径在 `DeepSeek Harness.app/Contents/Resources` |
| `dsh web`（任意平台） | ❌ | 视安装方式 | 直接 `--apply`，不需要挪 asar |
