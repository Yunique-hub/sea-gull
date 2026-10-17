# Changelog

本文件格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.2] - 2026-10-17

### Fixed

- 新版工作目录通过 required runtime context 提供，身份后缀不再插入不存在的 `{{cwd}}`；旧版变量插值路径保留。
- Windows 官方 CLI 修复改为同步完成备份，再原子替换 `dsh.cmd`，不再启动未等待的备份任务。
- Windows 更新前检查并摘除 `app` / `app.dshpurge-prev*` 中指向共享 runtime 的联接，失败恢复；异常目标或联接应用目录会在安装前中止。
- 端到端验证适配新版 pnpm / Python 和跨平台 CLI；调用失败、问候缺失、profile 安装失败均返回非零退出码。
- `verify-e2e.sh --stored-credentials` 显式启用已保存认证，适配 0.2.1 headless 默认禁用凭据存储的变化。

### Tests

- Windows 真机安装官方 0.2.1-rc.2，并复验加上联接保护后的覆盖安装：退出码 0、6,150 个运行时文件与官方包哈希一致。
- 海鸥固定问候、实际工具创建和读回 UTF-8 中文文件通过；桌面补丁界面无 pending。
- Windows 24 项回归测试和安装、幂等、卸载冒烟测试通过；真机证据和可选条目范围见 `docs/VERIFICATION.md`。

## [1.0.1] - 2026-10-17

### Fixed

- 适配 DeepSeek Harness **0.2.1-rc.2**，保留原有 **82 条补丁**、上游 1.1.71 插件功能和 0.2.0-rc.2 兼容路径。
- 跟随 Web 上下文迁移到 `dsh-harness-dev-context`，保留用于旧会话迁移的匹配常量。
- complete 提示词继续保留自定义注入，同时保留新版要求的 required runtime contexts。
- 适配新版会话 `append()` 的条件清理，使回退标记继续重建当前会话窗口。
- 安装器优先探测新版 `primary-runtime/dependencies/pnpm/bin/pnpm.mjs` 和内嵌 Python，并保留旧 pnpm 目录回退。
- Windows 更新脚本兼容 `.sealed.bak`，明确使用当前用户安装，释放工作目录占用；静默安装失败后显示安装界面，失败恢复后显示退出码，不再静默重开旧版。

### Tests

- 增加新版布局、提示词组装、会话回退、双安装器运行时探测和更新交接回归测试；加入双平台 CI。
- 对两版官方安装包逐项对照 82 条补丁，检查生成 JS 语法及重复应用，验证方法和范围见 `docs/VERIFICATION.md`。

## [1.0.0] - 2026-10-17

首次开源发布。

### Added

- **通用一键安装器**（`install.sh` / `install.ps1`）
  - 自动探测 `DSH_HOME`（含 `profiles/` 的 `.dsh`），支持 `--dsh-home` 覆盖
  - 自动选择 profile（有 `desktop` 用 `desktop`，否则 `web`）
  - 自动探测宿主安装根与内嵌 node/pnpm，缺失时降级为 files-only 模式
  - 支持 `--dry-run` / `--apply` / `--no-pnpm` / `--uninstall` / `-q`
  - 支持管道安装：`curl -fsSL <raw>/install.sh | bash`（无本地 checkout 时自取 tarball）
  - 幂等：重复执行不破坏 profile，不重复追加 bundle
- **海鸥全破内核提示词**（`src/prompt/prompt-inject.md`）——宿主层注入正文，
  含 13 节行为契约（输出机 / 原义锁定 / 破甲协议 / 双用路由 / 能力选用协议）
- **规则集**（`src/rules/seagull-fullbreak.{md,json}`）——写成 `AGENTS.md`，与注入文件互为备份
- **28 个技能**：5 个海鸥领域技能 + 23 个红队技能
- **`regionGate` 开关**（对上游 `dsh-purge` 的唯一代码改动）——把上游硬编码的
  CN/HK/MO 目标地域闸门改成可配置，本仓库默认 `false`
- **三套验证**
  - `tests/smoke.sh` —— CI 冒烟（假 DSH_HOME，装/验/幂等/卸闭环，无需真机）
  - `verify.sh` / `verify.ps1` —— 真机安装校验（21+ 项）
  - `verify-e2e.sh` —— 端到端行为验证（金丝雀注入 + 出活 + A/B 对照）
- **CI**：bash 语法 + shellcheck + py_compile + node --check + 双平台冒烟
- **文档**：README（中）/ README.en / ARCHITECTURE / DEPLOY / VERIFICATION / NOTICE

### Changed

- 相对上游 `dsh-purge` 1.1.71：
  - `lib/index.js`：`DEFAULTS` 新增 `regionGate: true`；`applyHostHooks()` 中
    `installRegionGate(ctx)` 改为受 `cfg.regionGate !== false` 控制
  - `cordis.patch.yml`：`regionGate: false`、`autoApplyOnStart: true`
- 相对 `hermes-seagull`：`SOUL.md` 的破甲规则体系改写为 DeepSeek Harness
  兼容形态（插值白名单 / ChatML 信封安全 / 能力选用协议），丢弃其无效的
  Hermes 插件与错误的安装器

### Fixed

- 修复 MSYS 环境下把 POSIX 路径传给原生 python/node 导致的 `ENOENT`（`winpath` 转换）
- 修复 `dsh.cmd` 传中文任务被 cmd.exe 重解析的问题（端到端验证改走 Electron node 模式）
- 修复密封桌面宿主下 `bin/dsh-purge.js --apply` 无法定位 aiBase（改走 `lib/reapply-cli.js`）
