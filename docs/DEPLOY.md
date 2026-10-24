# 部署

## 1. 三种装法

### 1.1 远程一行（推荐）

```powershell
# Windows PowerShell
irm https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/install.ps1 | iex
```

```bash
# Linux / macOS / WSL / Git Bash
curl -fsSL https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/install.sh | bash
```

管道模式下脚本检测不到本地仓库，会自己拉 tarball 到临时目录再执行，结束自动清理。

### 1.2 本地 checkout

```bash
git clone https://github.com/Yunique-hub/sea-gull.git seagull && cd seagull
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
| 1 | 定位 `DSH_HOME`（含 `profiles/` 的 `.dsh`） | 显式参数或环境变量无效时停止，不切换到其他目录 |
| 2 | 选 profile（desktop 优先，否则 web） | `--profile` 指定 |
| 3 | 定位安装根 + 内嵌 node/pnpm/Python，校验 profile 与必需资产 | 普通部署可降级 files-only；明确请求 Apply 且缺少安装根或 Node 时停止 |
| 4 | `vendor/dsh-purge` → `$DSH_HOME/plugins/dsh-purge` | 已有的先备份成 `.bak` |
| 5 | 改 profile `package.json`（加依赖 + bundle） | 自动备份 `.bak-seagull`；原子替换失败保留原文件，停止后续步骤 |
| 6 | 在该 profile 目录 `pnpm install`，检查依赖实际存在 | 失败非零退出；主动 `--no-pnpm` 跳过时仅报告文件部署完成 |
| 7 | 落 `prompt-inject.md` / `skills/`（人格单源；同时清理 1.0.7 遗留的 `rules/seagull-fullbreak.*` 与激活状态） | 已有的加时间戳备份 |
| 8 | （`--apply` 时）解 asar + 打补丁 | 见 §3 |

**幂等**：重复执行不会重复追加 bundle，不会破坏已有配置。

v1.0.4 对 Apply / revert 子进程传递选定的 `DSH_HOME`、`DSH_PROFILE` 和 `DSH_SURFACE`。桌面模式还绑定安装目录并清除旧的 `DSH_BASE`；Web 模式保留显式指定的 `DSH_BASE`，使用 Web Apply 入口。PowerShell 调用后恢复原进程环境。

失败停止不等于整次安装全部回滚：依赖安装失败时，已复制的插件及依赖声明可能保留，旧插件和 profile 备份仍在，后续人格资产不会继续覆盖。修复网络或配置后重跑即可。卸载时 revert 或 profile 移除失败会停止并保留插件文件。

`--no-pnpm` / `-NoPnpm` 不验证新文件已进入 node_modules；完成依赖同步、重启及加载检查后才能确认更新生效。详细工程整合记录见 [fujiang-dsh 分析报告](FUJIANG-REVIEW.md)。

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

0.2.1 的 headless 默认不读取 GUI 保存的密钥或账号登录。默认验证使用启动环境 / `.env` 中的 API key；若要沿用 GUI 凭据，显式运行 `bash verify-e2e.sh --stored-credentials`，可加 `--skip-ab` 省去对照调用。该选项只为本次验证生成覆盖文件，不改日常 profile 或凭据存储。验证失败会返回非零退出码，原始输出保存在 `_verify/`，请勿提交账号凭据或完整会话日志。

### 4.1 运行中插话

v1.0.3 恢复 Steer 的下一步投递，Queue 仍在下一轮处理。若希望运行中直接按 Enter 插话，可在 desktop profile 的 `cordis.patch.yml` 中配置 `ui-conversation` 项的 `config.busyEnter: steer`；已有同 id 项时合并该字段，不要重复添加。安装器保留这一用户偏好。消息会立即获接收，在当前工具返回后的下一处理步骤读取，不会强制中断正在执行的命令。

红队模式新增“红队执行者”预设，子任务会自动选择；主会话继续选“红队模式”。原有自定义预设源文件不改写，注册时把失效的工具过滤迁到执行预设。无法自动迁移的自定义过滤会报告明确诊断，避免静默丢失约束。

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
- 删 `plugins/dsh-purge`、`prompt-inject.md`、`rules/seagull-fullbreak.*`（含 `rules/archived/` 里的历史副本及其激活状态）
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
| 远程安装 `下载失败` | GitHub 不可达 | `export https_proxy=http://127.0.0.1:7890` 后再跑；或本地 clone |
| 远程安装 `tar ... Cannot connect to C:` | 已修（改为 `cd` + 相对路径解包） | 升级到 ≥1.0.0 |
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


## 一键更新（1.0.5 起）

Windows：`irm https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/update.ps1 | iex`。

Bash：`curl -fsSL https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/update.sh | bash`。

先结束任务并完全退出 Harness；更新成功后重新打开，按输出检查 Apply。每次下载最新 main，保留已保存提示词和用户数据，更新内置规则与技能。自定义 DSH 主目录、profile 或安装目录可下载 update.ps1 后使用 `-DshHome` / `-Profile` / `-AppRoot`，或在 Bash 管道后使用 `bash -s -- --dsh-home 路径 --profile desktop`。`install.ps1 -Update` / `install.sh --update` 则只使用当前本地源码。


## 1.0.6 / purge 1.1.77

推荐先完成官方 Harness 0.2.1-rc.3 更新，再运行海鸥一键更新。海鸥保留保存的人格、项目数据和偏好，当前包不启用重复 postinstall，bundle 由安装器显式管理。新版保留上游本地靶场限制；旧 23 个技能仅源码存档，不重新复制到运行目录，现有本地数据保留。

## 1.0.7 / 插件市场修复

一键更新会将已安装市场升级到已验证的 0.4.16，修复设置 BOM、profile 选择、旧嵌套依赖与 bundle 校验。没有市场的 profile 不会额外安装。保留有效显式 profile 选择，不创建假的 web 目录。市场 core 兼容修复针对 0.4.13，未知版本会停止并报告，避免盲目修改。

pnpm 完成后，海鸥还会核对实际 node_modules/dsh-purge 文件；陈旧同版本副本先归档再替换，失败恢复原目录。purge 面板的原版更新器会提示改用海鸥一键更新，以保留定制适配。更新前先结束任务并退出 Harness。
