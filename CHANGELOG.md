# Changelog

本文件格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.5] - 2026-10-19

### Changed

- dsh-purge 升至固定 master 提交 ec69166706bed95efb6c35e225b01588f3cd9b72（包版本 1.1.72），118 个 Git blob 核验一致；补丁定义 82 → 86，保留海鸥人格和 28 个技能。

- 新增 Windows / Bash 一键更新入口，每次获取最新源码，复用安装器的 Update 模式；保留现有提示词、偏好和项目，失败返回错误。

### Fixed

- 演练台在已有项目时仍可新建，校验名称与重复项目并显示错误；创建、刷新、切换共享互斥锁，项目页面按项目隔离状态。
- #40 迁移真实 0.2.1 旧产物，保留 waterfall 后的人格和必需上下文；#89 保留原生 system 消息及顺序，修复旧字段提取产物。
- 定制人格在重复 Apply / 启动同步后保留；正常释放插件不清除默认预设，卸载只清理精确归属的预设值。
- 5 个海鸥技能补齐官方发现所需的 YAML 元数据，技能正文保留。

### Validation

- 完整回归、两次真实 pnpm 隔离安装、宿主预设加载器和本机界面验证见 docs/VERIFICATION.md 的 I 节。

## [1.0.4] - 2026-10-18

### Fixed

- 整合 fujiang-dsh 源码评审中适用的安装可靠性能力，保留海鸥人格；新增完整的源码对比、采用范围与许可来源报告。
- 显式 DSH_HOME 无效时停止，避免写入其他目录；配置结构、安装资产与 Apply 前提在落盘前检查。
- Apply/revert 传递正确的 home、profile、surface；Web profile 使用 Web 入口，桌面清除继承的旧 DSH_BASE；PowerShell 调用后恢复环境变量。
- pnpm、配置写入及 revert 失败停止；依赖缺失不报告成功；跳过 pnpm 明确提示仅完成文件部署。
- profile 支持 UTF-8 BOM，拒绝异常字段类型，通过同目录临时文件原子替换；失败保留原文件和备份。

### Tests

- 新增 26 项 Windows 回归，覆盖失败传播、目标隔离、预检、配置保护、Web 分支、files-only 和偏好保留；全部 60 项回归及原冒烟测试通过。
- 真实内嵌 pnpm 在隔离 home 连续安装两次，旧依赖文件刷新、单一挂载及 Steer 偏好保留均通过。
- 真实 0.2.1 加载器再次验证红队主预设及执行预设；真机检查补丁 pending 为 0，原有资产保留。

## [1.0.3] - 2026-10-18

### Fixed

- #85 / #86 不再将用户 Steer 强制转为 followup；修复已有旧标记的部署，保留 Queue 的 FIFO 下一轮语义和公共 steer 的下一步语义。
- 红队预设不再把已移除的 `toolFilter` 直接交给新版宿主；在注册时迁到独立执行预设，保留用户 YAML、人设、角色、主会话工具和子会话过滤、深度限制。
- 红队子预设继续参与角色提示词识别；注册失败时释放已注册预设，子预设加载失败也会写入状态诊断。

### Tests

- 增加 10 项回归，覆盖原生／已打补丁的投递路径、幂等、预设迁移、用户自定义内容保留和失败清理；Windows 34 项回归及原冒烟测试通过。
- 新版真实加载器中红队模式和执行预设均加载成功；本机可创建红队会话。
- 实际桌面运行任务期间按 Enter 插话，63 毫秒内入队到 next-step；当前第 1 轮创建验证文件，普通排队消息在第 2 轮处理，最终空闲且无错误事件。

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
