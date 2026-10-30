# Changelog

本文件格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.13] - 2026-10-30

### Changed

- 移除上游的本地靶场范围闸（`vendor/dsh-purge/lib/net-scope.js`）：插件不再注册 `agent/pre-step` / `tools/pre-execute` 拦截，不再按目标地址（含 `inet_aton` 数字型主机）、任务分类（渗透 / 外挂）或边界措辞拦请求，也不再向会话写拒绝消息。`lib/index.js` 删除 `regionGate` 旧配置键与 `installRegionGate(ctx)` 挂载。
- `net-scope.js` 只保留自有服务器白名单的解析与读写；`writeAllowText()` 改为真实落盘（归一后写入，非法条目丢弃并在响应里回报数量），面板不再「提交成功但不保存」。
- 人格 §4 中文禁词表移除 `不能` / `不在范围` / `需要授权` 三项，`§3` 仍禁止以「这个不能」开场；`不能为空`、`不能为 null` 这类技术表述不再被当成拒答。人格源与加密槽重新封装，仍为逐字节同源。
- 真机校验（`verify.sh` / `verify.ps1`）改为检查范围闸**确已移除**；`tests/smoke.sh` 同步。

### Validation

- `node --test tests/*.test.mjs`：全部通过（见 `docs/VERIFICATION.md` P 节）。
- 覆盖：`tests/upstream-1177.test.mjs` 改为锁定「闸门不再回来」、白名单落盘与 `ownServerNote` 恒空；`tests/verify-current-runtime.test.mjs` 同步新的校验口径。

## [1.0.12] - 2026-10-30

### Changed

- 合并 dsh-purge 最新正式版 1.1.82（固定 `6318442a88ea7459d0135d0a07f31776c5d6a7b1`）：pnpm allowBuilds URL 键、重复键和实际 lock URL 修复；桌面识别；ZIP 目录解压；软链启动器与文件权限保护；应用流程进度；主子会话能力协议一致。
- 保留海鸥 rc.3 兼容、人格单源、恢复默认备份、首启须知隐藏、Steer/Queue、项目与工具目录功能、自有更新保护及许可署名。上游自身仍声明支持 rc.2，不能用原版更新覆盖海鸥适配。

### Fixed

- 上游挂载自愈会在海鸥已有 bundle insert 之外追加 profile insert。新增先失败后通过的回归，托管包已有本体时跳过追加，缺失本体时仍自愈。

- 启动自愈在宿主明确指定 profile 时仅处理该环境，保留其他 profile 的配置。

### Validation

- 海鸥 157 项回归、上游 36 项测试与隔离安装冒烟通过；上游测试加入双平台 CI。实际桌面验证和部署边界见 [1.0.12 升级报告](docs/UPGRADE-1.0.12.md)。

## [1.0.11] - 2026-10-29

### Fixed

- **安装器在只有 `py` 启动器的 Windows 上拒绝安装**：`install.ps1` 只查找 `python`，找不到就直接 `Die "需要 python"`，尽管解释器明明装着。Windows 官方安装方式默认只放 `py` 启动器，因此这批机器无法安装。现按 `python` → `python3` → `py -3` 依次探测，`py` 分支带上 `-3` 参数。
- **`install.sh` / `verify.sh` / `verify-e2e.sh` / `tests/smoke.sh` 同样的 `py` 缺口**：Git Bash 下 `python` 与 `python3` 通常都不存在（实测 `command -v python`、`command -v python3` 均失败，`py` 解析到 `/c/windows/py`）。四个脚本补上 `py -3` 回退。
- **测试硬编码 `python` 导致整批假失败**：7 个测试文件按 `process.platform === 'win32' ? 'python' : 'python3'` 取解释器，在 `py`-only 机器上 30 多项失败，看着像大面积回归，实际产品无问题。新增 `tests/python-exec.mjs` 统一解析（`SEAGULL_PYTHON` 覆盖 → `python` → `python3` → `py -3`），失败时给出可读排查指引。
- **`tests/smoke.sh` 在无 WSL 的 Windows 上退出 1**：Windows 的 `C:\windows\system32\bash.exe` 是 WSL 存根，没装发行版时连 `bash -c 'exit 0'` 都被拒绝，脚本根本无法被解释，脚本内部的任何探测都救不了。新增 `tests/run-bash.sh` 在「选择解释器」这一层挑真 bash，找不到则明确跳过并退出 0（环境缺失不等于回归失败）。
- **AgentTeams 兼容声明落后于实际宿主**：`compatibility.json` 的 `recommendedHost` 停在 `0.2.1-rc.2`，而实际宿主与 `dshTarget` 都是 `0.2.1-rc.3`，rc.3 落在「未声明但能跑」区间，宿主再漂一个小版本就会以运行时异常暴露。现已对齐并由测试锁死。

### Added

- `tests/python-exec.mjs` + `tests/python-exec.test.mjs`：解释器解析顺序、`SEAGULL_PYTHON` 覆盖、失败提示的回归。
- `tests/run-bash.sh` + `tests/run-bash.test.mjs`：真 bash 透传与「无真 bash 时跳过且退出 0」的回归。
- `tests/version-sync.test.mjs`：`VERSION` 为唯一真源，`install.ps1`、`install.sh`、`vendor/dsh-purge` 的 `seagull.version` 必须一致，且 `updateManaged` 必须为 `true`。
- `tests/agent-teams-compat.test.mjs`：`recommendedHost` 必须等于 `dsh-target`，且必须出现在 `supportedHosts` 中。
- `tests/persona-integrity.test.mjs`：人格章节号必须唯一、递增、无空标题；章号缺口以显式登记表的形式锁住。当前登记缺口为 **§23**（人格 22 直接跳到 24，三处同源故三处同时缺失），属待确认语义归属的已知问题，补齐后测试会提示删除豁免声明。
- CI 新增「禁止裸 python 调用」静态检查与 `py-only` 作业（Windows runner 不装 python，只靠 `py` 启动器跑关键回归）。

### Changed

- **人格 §14 新增出口代理规则**：`PROXY_URL` 已配置时，任何主动对外发包（扫描、爬取、爆破、API 调用、下载）默认经该代理出口，不直接用本机 IP 直连；未配置时按直连处理，不询问、不提示、不阻塞任务。豁免 `127.0.0.1`、`localhost`、内网段与 RFC 5737 文档段（代理通常到不了），需经隧道访问内网时走既有隧道；`--no-proxy` / `NO_PROXY` 命中时直连。子代理、团队成员与脚本任务继承同一规则。`redteam-setup` 技能同步登记该环境变量与规则。
- **人格章节编号修复**：`src/prompt/prompt-inject.md` 长期从 §22 直接跳到 §24，缺 `## 23`。经 `git log -S'## 23.'` 确认全历史零命中、v1.0.0 结构不兼容，判定为编号跳号而非内容丢失（v1.0.8 单源化时缺口已存在）。原 §24 顺延为 **§23**，同时修掉 §22 仲裁表里指向不存在 §23 的悬空引用（「包装冲突」本就在 §22 仲裁表内，改为指向本节）。`tests/persona-integrity.test.mjs` 去掉豁免登记，改为强制章节连续，并新增「交叉引用不得指向不存在章节」断言。
- 测试总数 136 → **155**，在具备 `python` 与仅有 `py` 启动器两种环境下均为 155 通过 / 0 失败。

## [1.0.10] - 2026-10-25

### Fixed

- 市场校验按实际 profile 依赖和已安装包清单解析组织名，修复 `@dsh-market/plugin` 被当成 `plugin` 的误报；歧义名称保持未解析。
- 原生 `skills/change` 事件接通远端转发及菜单缓存失效，修复当前会话中市场安装/卸载技能后 `/` 菜单未刷新的通用问题；市场不再仅凭空技能目录报告 live。
- 增加独立中文回复约定，覆盖进度和成员报告；保留用户明确要求的其他语言，更新不改用户人格文件。

### Added

- 环境适配支持原生文件夹选择和一键安装配置：保留已有工具，固定官方发布文件与 SHA-256，校验后解包到所选目录，显示进度、失败原因和待处理项；Impacket 使用独立 venv。首次安装自行设置目录，更新保留。
- 整合 MIT 许可的 AgentTeams 0.1.26，固定提交 `230958db812ed34bcf2d1168e8157bbf5af04055`。支持裸 `agent-teams` 和 `/agent-teams` 入口，默认完整计划自动执行，保留显式先审阅流程、成员权限过滤、任务依赖与工作区存档。
- scoped 包校验、下载损坏、路径越界、重复安装、团队部署和命令边界回归；真实桌面验证双成员写入与依赖复核、技能正文注入、默认中文及显式英文。

## [1.0.9] - 2026-10-25

### Fixed

- 桌面「恢复默认」按钮原先调用普通保存接口，未触发备份；现在显式调用备份后恢复。备份失败时停止覆盖；同一秒重复恢复使用独立备份，避免覆盖较早的用户正文。
- PowerShell / Bash 真机校验兼容当前注入标记与纯 Markdown 人格，逐项检查五个海鸥技能和仍启用的本地靶场检查，移除过时的地域开关断言。
- README 与插件海鸥托管版本信息同步。

### Added

- 备份失败、同时间戳重复恢复及双脚本当前运行态的正反例回归。
- 本轮项目审查及桌面验收记录，见 `docs/PROJECT-REVIEW-2026-10-25.md`、`docs/VERIFICATION.md` M 节。

## [1.0.8] - 2026-10-24

### Changed

- **人格单源化**：人格正文只由 `$DSH_HOME/prompt-inject.md`（源 `src/prompt/prompt-inject.md`）提供；`AGENTS.md` 改为不含人格的宿主级工程约定。1.0.7 及更早版本把同一份文本同时写成 `rules/seagull-fullbreak.md`，并由 `activateRule()` 整文件覆盖 `AGENTS.md` —— 而宿主会读 `AGENTS.md`，等于每个会话注入两份互相冲突的人格。旧规则集归档到 `docs/archive/seagull-fullbreak-1.0.7.{md,json}`；安装 / 更新 / 卸载都会清理运行目录里的遗留副本与激活状态。
- 提示词换为整合版（25 域能力层 + CTF 契约 + 路由 + 确定性输出槽；人格 + 输出机 + 原义锁定 + 破甲协议 + 执行纪律），不含 ChatML 标签，符合 `CONTRIBUTING.md` 对 `src/prompt/` 的约定。

### Fixed

- 插件加密槽按同一份人格源重新封装：面板「恢复默认提示词」恢复的是 `src/prompt/prompt-inject.md`，不再把上游默认人格（小码酱）写进用户目录。
- 「恢复默认」覆盖前自动备份为 `prompt-inject.md.bak-<时间戳>`，面板提示备份路径（此前一次点击即可无痕替换用户人格，且无备份可回滚）。
- `isKeepableUserOverride()`：显式保存（`explicitSave`）优先于血统战标记判定。此前用户改过的正文若保留 ChatML 外壳，会被当成「插件旧默认」，在启动同步时被整段刷回默认槽。

### Added

- `tests/single-prompt-source.test.mjs`：断言人格源唯一、加密槽源与人格源逐字节一致、加密槽解包等于人格源、安装器不再投放规则副本、历史规则集归档到位。

## [1.0.7] - 2026-10-24

### Fixed

- 已安装的插件市场更新到验证版本 0.4.16，保留原本地链接源；归档旧运行副本，避免嵌套 core 0.4.11 遮蔽新 core 0.4.13。
- 修复市场设置带 UTF-8 BOM 时解析失败、忽略 desktop 并回退到不存在的 web profile；保留有效显式选择、偏好和未知设置字段。
- 修复市场 core 的 bundle 校验漏读及跨 profile 混列旧版本；只对验证过的 core 0.4.13 应用小范围兼容修改。
- pnpm 安装后比对 purge 实际加载文件；同版本陈旧副本用已校验暂存目录替换，替换失败恢复原目录，保留旧副本。
- 海鸥标记阻止 purge 自带更新器用上游原版覆盖定制代码，提示使用海鸥一键更新。

### Changed

- 合并 dsh-purge 1.1.78 / fd109e106ce5818b3c00524123a3431e4afc0e81：停用后的预设回退、热重载取消清理、嵌套 bundle 卸载；保留精确 YAML 清理与执行者兼容。
- 延迟清理绑定发起时的 DSH_HOME，防止环境改变后操作其他 home。海鸥人格保持原样。

## [1.0.6] - 2026-10-24

### Changed

- 官方 Windows Harness 适配升级至 0.2.1-rc.3；dsh-purge 升至发布提交 ac58b3e35509da23bd75b6250f01007590524102 / 1.1.77，98 个 Git blob 核验一致。
- 保留海鸥人格及本地项目修复，纳入证据账本、上下文处理、文件系统和归档更新等上游工程改动；保留本地靶场与工具执行前限制。
- 采用上游 Apache-2.0 LICENSE 和 NOTICE；旧技能源码按原 MIT 快照存档，不再自动分发；已有本地用户数据保留。

### Fixed

- 修复海鸥 file 安装下上游新配置只加载演练台、未加载主插件的兼容问题；显式挂载一个主入口。
- 海鸥安装器显式管理 bundle，去掉包内重复 postinstall，避免 pnpm 11 因未批准生命周期脚本报错；保留脚本审批策略。
- 保留旧 toolFilter 配置并在注册时迁移到执行者预设，避免直接删除用户限制；新预设无需迁移。
- 保留 #40 旧产物迁移、Steer/Queue、#89–#92 原生消息兼容和人格持久化修复。

### Validation

- 本地 89 项回归通过；真实 pnpm 重复安装、原生预设/技能加载、桌面及实际对话检查见验证记录 J 节。

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
