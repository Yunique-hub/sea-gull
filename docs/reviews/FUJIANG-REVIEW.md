# fujiang-dsh 源码分析与海鸥工程功能整合

核对日期：2026-10-18。海鸥整合版本：1.0.4，继续适配 Harness 0.2.1-rc.2。

用户确认的范围是：**仅保留海鸥人格，合并富江的工程功能**。本次在海鸥现有安装器和配置工具中独立实现相关能力；没有加入第二个人格、重复的提示词段或第二套宿主补丁器。

## 1. 源码来源与覆盖范围

- 上游：[c3cvld7aag/fujiang-dsh](https://github.com/c3cvld7aag/fujiang-dsh)，包名 `fujiang-armor`，版本 `0.4.3`。
- 固定快照：[ab86ddcd169f0f13bc74923b6ed95eda55224931](https://github.com/c3cvld7aag/fujiang-dsh/tree/ab86ddcd169f0f13bc74923b6ed95eda55224931)。下载 ZIP 中的 **29 个文件**均计算 Git blob SHA-1，并逐项与该提交的树对象核对，一致。
- ZIP SHA-256：`c72613e065a552f362cf70dd7881105fc053fd7a8b4a92b8bfa872a683b8809d`。
- 阅读运行入口、客户端、安装与卸载、运行环境准备、迁移与补丁、评分与测试代码；对题库做格式及字段检查。动态检查使用本地临时文件和模拟事件，不运行题库中的外部目标任务。

| 文件组 | 文件数 | 实际职责与分析结果 |
|---|---:|---|
| `index.js`、`client.js`、`cordis.patch.yml`、`package.json` | 4 | 注册提示词、元数据工具、会话投影及输入框状态条；不是 dsh-purge 的替代实现 |
| `prompts/fujiang*.md` | 3 | 三份文件内容相同；运行入口加载两份，并以 order 100 / 200 同时注册 |
| `install.ps1`、`install.sh`、`uninstall.ps1`、`uninstall.sh`、两个 BAT | 6 | 环境准备、文件复制、profile 改写、依赖安装及卸载 |
| `scripts/ensure-runtime.ps1` | 1 | 检测 Node/npm，必要时下载官方 Node LTS，核对 SHA-256，再获取 pnpm |
| `scripts/lib/migrate.js`、`scripts/lib/patcher.js` | 2 | 清理旧插件注册、备份替换配置、匹配旧宿主代码并应用兼容补丁 |
| `scripts/lib/scorer.mjs`、`scripts/run_bank_live.mjs`、`scripts/scorer_semantics_test.mjs`、`scripts/verify_plugin.mjs` | 4 | 关键词评分、在线题库请求、评分例子、插件注册检查 |
| `tests/*.jsonl` | 4 | 21、17、32、40 条数据；最后一份前 9 行为注释或空行，不是严格 JSONL；各题库字段不统一 |
| README、LICENSE、THIRD-PARTY-NOTICES、两个空说明文件 | 5 | 使用、来源及许可说明；空文件不参与运行 |

## 2. 运行链路与两项目差异

富江安装器复制插件、写入依赖和 YAML 挂载，安装时调用补丁器，再执行 pnpm。插件启动注册两个相同的提示词段、一个元数据工具和一个会话投影。客户端消费投影，显示加载、执行和关键词判定状态。

海鸥已包含 dsh-purge 的 82 条补丁定义、宿主升级交接、设置面板、红队预设及技能，并已修复 0.2.1 的工作目录上下文、预设工具过滤和 Steer / Queue 语义。富江的额外工程价值主要在安装前检查、失败传播、配置备份与替换；重复引入其提示词和旧版补丁器会增加冲突。

| 能力 | 富江实现 | 海鸥整合决策 |
|---|---|---|
| 环境与安装包检查 | Node/npm 检测、缺失运行时下载、检查部分文件 | 继续复用 Harness 内嵌 Node/pnpm/Python；新增写入前 profile 校验、必需资产检查、Apply 前提检查 |
| 配置保护 | 迁移器备份后临时文件替换；安装器另行改 JSON/YAML | 将备份与原子写入统一放在海鸥原有 `patch_profile.py`，处理 BOM 并拒绝异常字段类型 |
| 安装失败反馈 | Windows 依赖失败抛错、BAT 传回退出码 | 两种海鸥安装器统一非零退出；停止后续资产覆盖；跳过依赖时明确显示“文件部署完成” |
| 目标 profile | 可发现多个 profile，补丁器仍遍历所有 profile | 明确目标优先；错误目标停止；Apply/revert 子进程使用同一个 home、profile 和 surface |
| 依赖更新 | 清理旧依赖、尝试联接后 pnpm 安装 | 保留 pnpm 的原生安装方式；实测同版本旧文件可刷新，避免增加第二套联接管理 |
| 前端加载状态 | 输入框徽标、关键词评分 | 沿用 dsh-purge 现有面板与真实加载诊断；不把“客户端显示徽标”当作模型或预设正常的证据 |
| 提示词与身份 | 两份相同提示词、富江固定身份 | 按用户选择保留海鸥现有人格、规则与技能 |
| 宿主兼容与升级 | 针对 0.1.6 / 0.1.7 的文本替换 | 保留海鸥 0.2.1 适配、更新联接保护、红队执行预设及立即插话修复 |

## 3. 富江源码中的具体发现

以下发现针对上述固定快照；没有修改或向第三方仓库提交内容。

| 发现 | 证据及影响 |
|---|---|
| 自带完整性测试失败 | `node --test scripts/verify_plugin.mjs`：5 项中 4 项通过、1 项失败。三份提示词实际 SHA-256 为 `dfad664948945d39b9c9058c40258c35355781926307102d1980fb1537f879d9`，测试预期为 `ef013b398da81504fa452ea96bc5510f3da8b314cdc33eb20dd2ce0ec90b397c` |
| API 错误和空回复可被计为通过 | 本地调用评分函数，`[ERROR] HTTP 503: service unavailable` 和空字符串均得到 `pass`；在线脚本恰好把异常转为该类文本后评分。因此其通过率不能直接作为功能验收 |
| 评分并不等于结果质量 | 只按开头窗口及关键词判定；未检测工具执行、文件产物或 API 成功。服务端内嵌词表与独立评分器词表也存在差异 |
| 在线扩展级别门槛检查过晚 | `run_bank_live.mjs` 先执行所选全部题目，最后才检查 minimal 结果；只指定 short/medium 时还不进入这段门槛判断 |
| 重复提示词开销 | 两个注册段均为 4,772 个 UTF-8 字节，逐字相同；未提供单段与双段效果对照证据 |
| 旧版兜底补丁可能生成语法错误 | 在隔离文件中使用普通 `items.filter(section => allow(section))`，兜底正则只匹配到内层右括号，替换后 `node --check` 失败；顶层结果仍可为 `status: ok` |
| 选择范围与补丁范围不一致 | `applyAllPatches` 遍历所有含 package.json 的 profile；隔离测试确认未选择的 profile 也被写入 `cordis.patch.yml` |
| 配置挂载判断不完整 | `applyCordisPatch` 用字符串包含判断是否安装；空 YAML 数组 `[]`、注释中出现插件名、其他同名文本等情况没有结构化处理 |
| 新版上下文存在兼容风险 | YAML 固定使用 `{{cwd}}`；海鸥此前已验证 0.2.1 的部分路径改用 required runtime context，不能直接照搬该后缀 |
| 状态条可能滞留 | 投影只处理 user/message 和 assistant/message，结束事件不会清除 running；本地模拟确认。客户端根据时间判断 2.5 秒闪现，但没有定时触发重渲染，不能保证到时消失 |
| 安装和卸载目标不对称 | 安装可选自定义 profile，卸载仅枚举 web/default/desktop；PowerShell 固定使用用户 `.dsh`，Bash 则支持 `DSH_HOME` |
| 卸载的 YAML 正则范围过大 | 匹配整个 insert 块，若一个块里还存在其他插件，可能一并移除；system-prompt 覆盖也没有对称还原 |
| Bash 发现 profile 的失败可能未传出 | `mapfile < <(find_profile_dirs ...)` 的退出码来自 mapfile，不能代表进程替换内部的选择结果；可能带空目标列表继续执行 |
| 题库格式不完全统一 | 三份为可逐行解析 JSONL；v4pro-benchmark 前 9 行不符合严格 JSONL。在线脚本固定读取 prompt-bank.jsonl，另几份的 schema 不能直接套用 |

原有 `scorer_semantics_test.mjs` 的 7 个例子通过；它没有覆盖上述 API 错误、空回复和真实执行结果问题。

## 4. 海鸥落地修改

1. `install.ps1` / `install.sh`：显式参数或 `DSH_HOME` 指向无效目录时中止，避免自动改到另一份配置。
2. 写入前运行配置结构校验，检查必需源码与资产；无法定位运行时的 Apply 请求提前失败。
3. Apply / revert 使用目标 home、profile、surface。桌面操作清除继承的旧 `DSH_BASE`；Web 保留其显式 base，并调用 Web Apply 入口。PowerShell 在调用后恢复进程环境。
4. pnpm、profile 写入或 revert 失败时停止；pnpm 返回成功后仍检查目标依赖是否实际存在。revert 失败保留插件和配置。
5. 跳过依赖同步时显示“文件部署完成”，要求完成 pnpm 同步和加载验证，不再笼统声称安装完成。
6. `patch_profile.py` 支持 UTF-8 BOM、字段类型检查和只读 `--validate`。写入通过同目录临时文件、flush/fsync、原子替换完成；失败清理临时文件，保留原文件与首次备份。

没有更改 vendor 运行时代码、人格资产、技能、红队角色、模型选择和用户的 `busyEnter` 偏好。失败中止并不等于完整安装事务回滚：若 pnpm 失败，已复制的插件和已写入的依赖声明可能保留，旧插件及 profile 备份可供恢复；后续人格资产不会继续覆盖。

## 5. 验证与边界

- 先增加 18 项用例，在修复前全部失败，分别复现错误目标回退、异常 profile、残缺安装包、pnpm 失败、依赖缺失、CLI 目标偏离、revert 失败继续删除、BOM 和非原子写入等问题。
- 修复后增加 Web 入口、缺失运行时、files-only 偏好保留、校验后写入失败等边界覆盖。Windows 本地 **60 项 Node 回归全部通过**；原安装／幂等／卸载冒烟闭环通过。
- 使用真实 Harness 内嵌 pnpm 11.28.5，在隔离 home 连续两次运行 PowerShell 安装器。两次均成功；第二次可刷新手动构造的同版本旧依赖文件；5 个关键文件逐字节一致，bundle 仅一条，Steer 偏好原样保留。
- 真实 0.2.1 加载器再次验证 `redteam` 与 `redteam-executor` 均注册成功且无 broken 诊断。没有运行外部目标或题库任务。
- 真机读取检查仍为 **82 条补丁定义、74 applied、6 na、1 missing_file、1 skipped、0 pending**，#85/#86 均 applied；444 个原有静态资产及配置文件与前次备份相同。当前 GUI profile 保留用户后来选择的红队默认模式、模型配置和 `busyEnter: steer`，没有按旧快照覆盖。
- 本次功能代码仅涉及安装器与配置工具，因此没有重复消耗模型请求验证未改动的对话逻辑；此前真实 UI 插话证据见 [验证报告 G 节](VERIFICATION.md#g-红队模式与运行中插话修复2026-10-18)。
- Linux 与 Windows CI 运行同一回归和冒烟套件；macOS 桌面安装、断电恢复及所有网络故障组合不在此次实测范围。

## 6. 许可与来源说明

富江的 [LICENSE](https://github.com/c3cvld7aag/fujiang-dsh/blob/ab86ddcd169f0f13bc74923b6ed95eda55224931/LICENSE) 标注 CC BY-NC-SA 4.0，并包含附加文字；其 [第三方说明](https://github.com/c3cvld7aag/fujiang-dsh/blob/ab86ddcd169f0f13bc74923b6ed95eda55224931/THIRD-PARTY-NOTICES.md) 指向 Minglink/dsh-infinite-gen-4。

本次整合的是安装可靠性方面的通用能力，代码在海鸥原有结构内独立实现。没有复制富江源码、题库、提示词或品牌资产到分发目录；海鸥现有 LICENSE 和 vendor 署名保留。本报告提供固定源码出处和工程比较，不能理解为富江代码被重新授予 MIT 许可。
