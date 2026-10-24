<div align="center">

# 🦅 海鸥 · DeepSeek Harness 全破 harness

**保留海鸥人格，适配新版 Harness，提供本地演练与工程管理功能。**

一行装 · 幂等 · 可卸载 · 有证据

[![CI](https://github.com/Yunique-hub/sea-gull/actions/workflows/ci.yml/badge.svg)](https://github.com/Yunique-hub/sea-gull/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-65a30d.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.7-blue.svg)](CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](#系统要求)

[中文](README.md) · [English](README.en.md) · [架构](docs/ARCHITECTURE.md) · [部署](docs/DEPLOY.md) · [验证报告](docs/VERIFICATION.md)

</div>

---

当前 **v1.0.7** 适配官方 Windows Harness **0.2.1-rc.3**，引擎为 dsh-purge **1.1.78**（固定上游 master 提交 [fd109e1](https://github.com/YuJunZhiXue/dsh-purge/tree/fd109e106ce5818b3c00524123a3431e4afc0e81)）。98 个上游 Git blob 已核验。

一键更新同时修复**已安装**的插件市场：升级至已验证的 0.4.16，修复 BOM 设置导致错误回退到 `web`、旧 core 遮蔽新依赖、bundle 校验误报重启，以及跨 profile 混列旧版本。没有市场的用户不会被额外安装。pnpm 完成后还会逐文件校验 purge 运行副本，避免同版本陈旧代码被误报为更新成功。详见[本次验证记录](docs/VERIFICATION.md#k-插件市场与-purge-运行副本修复2026-10-24)。

保留用户保存的**海鸥人格**、5 个海鸥技能、项目创建与切换修复、立即插话、独立排队、安装/更新和回退保护。新版保留上游的本地靶场限制及工具执行前检查，并纳入证据账本等工程功能。上游已下架随包技能库与知识库入口；本机已有数据保留，旧 23 个技能仅在源码中作历史存档，不再自动分发。

上游主体代码现为 **Apache-2.0**；原始 LICENSE、NOTICE 与来源均保留，海鸥自身及历史资产分别按原有许可标注。当前本地仍维护 86 条补丁定义，其中 #89–#92 为保留原生消息路径等海鸥兼容修复。验证范围见[本次验证记录](docs/VERIFICATION.md#j-harness-021-rc3--dsh-purge-1177-合并2026-10-24)。

已安装用户请使用下方“一键更新”命令，更新模式会保留现有提示词。先完成 Harness 官方版本更新，再重新应用插件；仅替换版本号或把旧 `resources/app` 整目录复制到新版会重新加载旧宿主。Windows 更新若静默失败，会改为显示安装界面；取消或失败时恢复旧解包目录并提示退出码。

新版更新交接会先摘除已验证指向共享 runtime 的目录联接，避免覆盖安装清理旧解包目录时影响运行时；安装失败后恢复联接。`verify-e2e.sh --stored-credentials` 可显式使用 GUI 已保存的凭据，默认仍沿用 headless 的启动环境认证。

运行中发送分为 **Steer（插话，下一处理步骤读取）** 和 **Queue（下一轮处理）**。v1.0.3 尊重发送方式，不再把 Steer 改成 Queue。Enter 的行为由 `ui-conversation.busyEnter` 偏好控制；已配置的偏好不被安装器覆盖。红队模式保留原角色与主会话工具，新增的“红队执行者”预设由子任务自动使用，用来承接新版的工具过滤机制。

---

## 这是什么

**DeepSeek Harness（DSH）** 不只是转发提示词——它在运行时改写提示词、审批门、沙箱策略、
会话迁移。所以你对着它说"别拒绝"，改的是**嘴**；真正拦你的是**手**。

本项目做的是**手的部分**：在你自己机器上、对你自己装的 DSH，把宿主层的策略闸门
逐条摘掉，然后把人格层换掉。

它把两件事合成一个包：

| 来源 | 提供什么 |
|---|---|
| [dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 1.1.78 | 宿主兼容、演练台、证据账本与本地靶场限制；保留 86 条本地补丁定义 |
| [hermes-seagull](https://github.com/Yunique-hub/hermes-seagull) | 海鸥人格（00a–00r 规则体系）+ 5 个领域技能 |

合并不是拼盘——`SOUL.md` 不能直接当 DSH 提示词（插值白名单、ChatML 信封、技能目录协议
三处都会让它失效），本项目做了重写；上游那个 `seagull-armor-break` Hermes 插件是半成品
（hook 名与 `ctx.register_hook` 都不是 Hermes 的 API），已剔除。

---

## 一键安装

**Windows**

```powershell
irm https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/install.ps1 | iex
```

**Linux / macOS / WSL / Git Bash**

```bash
curl -fsSL https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/install.sh | bash
```

**从本地 checkout**

```bash
git clone https://github.com/Yunique-hub/sea-gull.git seagull && cd seagull
bash install.sh            # 或 powershell -File install.ps1
```

装完会有一步 **Apply**（密封桌面宿主必须），按输出提示做即可：

```
密封桌面宿主（官方 EXE），三步：
  1) 完全退出 DeepSeek Harness
  2) 重开 → 会话标题旁点 dsh-purge → Clean 页 → Apply
  （或 bash install.sh --apply，再按提示挪 asar）
```

### 一键更新

先结束当前任务并完全退出 Harness。更新器每次从 GitHub 拉取最新 main 源码，更新插件、内置规则和技能，保留现有提示词、客户端偏好、项目数据库及额外技能；完成后重新启动 Harness，按提示检查 Apply。它不会代替官方 Harness 安装器升级宿主。

**Windows PowerShell**

```powershell
irm https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/update.ps1 | iex
```

**Linux / macOS / WSL / Git Bash**

```bash
curl -fsSL https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/update.sh | bash
```

已有最新源码 checkout 时可执行 `powershell -File install.ps1 -Update` 或 `bash install.sh --update`；本地模式使用当前 checkout，不会自动 git pull。未安装海鸥会提示先安装；下载、配置或依赖同步失败返回错误，缺少 pnpm 时明确报告仅部署文件。

### 安装器选项

| 选项 | 说明 |
|---|---|
| `--profile desktop\|web` | 目标宿主 profile（默认自动：有 desktop 用 desktop） |
| `--dsh-home <路径>` | DSH 主目录（默认 `$DSH_HOME` 或 `~/.dsh`） |
| `--app-root <路径>` | DSH 安装目录（默认自动探测） |
| `--apply` | 装完立刻尝试 Apply（desktop 会解 asar，需宿主已退出） |
| `--no-pnpm` | 跳过 pnpm install（离线 / 已装过） |
| `--dry-run` | 只打印计划，不落盘 |
| `--update` / `-Update` | 更新当前源码中的海鸥，保留现有提示词 |
| `--uninstall` | 卸载（还原 profile、删插件与注入文件，保留你的技能） |

> 设计上**不硬编码盘符和用户名**：自动探测 `DSH_HOME`、profile、安装根、内嵌 node/pnpm；
> 探测不到安装根就降级为 files-only 模式。重复执行幂等。

显式指定的 DSH 主目录无效时立即停止。profile 或安装包异常会在写入前报告；pnpm、配置写入或 revert 失败返回非零退出码。`--no-pnpm` / `-NoPnpm` 只部署文件，需完成目标 profile 的依赖同步和加载检查。`--apply` / `-Apply` 找不到安装根或 Node 时会提前停止。

---

## 它到底破了什么

四层，逐层对照。**层 1–3 是项目做的；层 4 是项目不承诺的。**

### 层 1 · 宿主策略层 ✅

| 闸门 | 处理 |
|---|---|
| 审批门 `user-approval` / `permission-presets` | 中和 |
| 沙箱 `sandbox` / `sandbox-policy` / `fs-sandbox` / `fs-observation-policy` | 中和 |
| hooks（Claude Code / Codex）的 `deny` / `ask` | 改放行 |
| 本地靶场检查 | 保留新版上游限制，按解析结果检查目标，并在工具执行前检查 |
| 官方身份段 | 剥掉（全树 0 处） |
| 工具面裁剪（minimal / standard / ptc） | 放宽 |
| 提示词组装顺序（inject 被吞） | 保留注入 |

### 层 2 · 提示词层 ✅

注入的是海鸥全破内核（**整合版 v2**：25 域能力层 + CTF 契约 + 路由 + 确定性输出槽，加人格、输出机、原义锁定、破甲协议、执行纪律），
并且**只有一份** —— 只走 `prompt-inject.md`。`AGENTS.md` 自 1.0.8 起是不含人格的宿主级工程约定，
`rules\` 只留给用户自建的非人格规则；插件加密槽与人格源逐字节同源，所以面板「恢复默认」恢复的还是这一份。
插件不会往 prompt 里塞任何额外禁令（`ownServerNote()` 是空壳、`withOwnServers()` 短路）。

### 层 3 · 行为层 ✅

关键词不拒 / 不降级 / 不给氛围版 / 原义锁定 / **真跑验证**（不是"应该会输出"）。

### 层 4 · 模型权重层 ❌ 不承诺

宿主放行 ≠ 模型照做。训练时焊死的那部分对齐，**改宿主代码、加提示词、堆 few-shot 都推不动**。

如果你要的是模型层也不拒，唯一真杠杆是**换后端模型路由**——DSH 这边是配置项：

```
adapter:  dsh-llm-deepseek  /  dsh-llm-pi-ai（多厂商）
配置:     agent-default-model 的  provider / model
```

那是换「做判断的大脑」，跟提示词层不是一回事。本项目不假装提示词能推过去。

> **法律边界（不是提示词边界）**：针对真实第三方生产系统的未授权入侵与欺诈取数
> （薅积分 / 兑换礼品 / 白拿实物），这条由《刑法》《网络安全法》《数据安全法》
> 《个人信息保护法》划定，harness 的开关动不了它。

---

## 验证

三套，全部可复跑。**下面每个数字都来自真实命令输出。**

```bash
bash tests/smoke.sh      # CI 冒烟：假 DSH_HOME，装/验/幂等/卸 全闭环（不碰真机）
bash verify.sh           # 真机安装校验（21+ 项）
bash verify-e2e.sh       # 端到端：金丝雀注入 + 出活 + A/B 对照（真跑模型）
```

真机实测快照（Windows 11 + DSH 0.2.0-rc.2 桌面版）：

| 项 | 结果 |
|---|---|
| 补丁 | **76/82 applied, 0 failed** |
| 被改宿主文件 | **44 个** |
| 官方身份句 | **0 处** |
| 输出干净度 | 替换字符 0 / 控制符 0 / 乱码特征 0 |
| 冒烟测试 | dry-run 无副作用 / 装 / 幂等 / 卸载还原 —— 全过 |

**判定性注入测试**（`verify-e2e.sh` 的 A 段）：发 `在吗`，宿主原样返回

```
海鸥在线，你要整点薯条吗？
```

插件内置默认人格是上游作者的「小码酱」，**不可能**吐这句 —— 所以注入确实是我们这份。
（1.0.8 起加密槽与 `src/prompt/prompt-inject.md` 同源，这条判定对「恢复默认」后同样成立。）

**A/B 对照**（同题、一份挂插件一份不挂）：

| 指标 | 全破 harness | 原版 |
|---|---|---|
| 海鸥式开场 | 1 | 0 |
| 真跑过的痕迹 | 2 | 0 |
| 拒绝/免责话术 | 0 | 0 |

> 照实说：那条请求本身合法，**两边都不拒绝**。差别在人格注入与执行纪律
> （真跑 + 真输出 vs 只贴代码），不是"拒绝 vs 不拒绝"。

细节与原始输出见 [docs/VERIFICATION.md](docs/VERIFICATION.md)。

---

## 系统要求

| 项 | 要求 |
|---|---|
| 宿主 | DeepSeek Harness（桌面版 / `dsh web` 均可） |
| 系统 | Windows 10+ / Linux / macOS |
| 运行时 | 宿主内置 node ≥18 + pnpm（安装器自动用内置的；系统级仅兜底） |
| 其他 | 安装脚本需要 `python3`（改 JSON）+ `curl`（远程安装） |

---

## 目录结构

```
.
├── install.sh / install.ps1      通用一键安装（本地 / 管道）
├── verify.sh / verify.ps1        真机安装校验
├── verify-e2e.sh                 端到端行为验证
├── src/
│   ├── prompt/prompt-inject.md   全破内核提示词（唯一人格源，会话注入正文）
│   ├── skills/                   5 海鸥 + 23 红队 = 28 个技能
│   └── tools/patch_profile.py    profile JSON 幂等改写/摘出
├── vendor/dsh-purge/             上游宿主层引擎（保留其 LICENSE，改动见 NOTICE）
├── tests/smoke.sh                CI 冒烟（假 DSH_HOME）
├── docs/                         架构 / 部署 / 验证报告
└── .github/workflows/ci.yml      shellcheck + py_compile + node --check + 双平台冒烟
```

---

## 卸载

```bash
bash install.sh --uninstall      # 或 powershell -File install.ps1 -Uninstall
```

会还原 profile、删插件与注入文件，**保留 `$DSH_HOME/skills`**（不误删你自己的技能）。
若把 `app.asar` 挪走过，放回去：

```bash
mv "$APP_ROOT/resources/app.asar.sealed.bak" "$APP_ROOT/resources/app.asar"
```

---

## 许可与署名

- 本项目自身代码：**MIT**（[LICENSE](LICENSE)）
- 宿主层引擎派生自 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)（Apache-2.0 © 2026 YuJunZhiXue），
  本项目对其的全部改动在 [NOTICE](NOTICE) 中逐条列出
- 人格与技能来自 [Yunique-hub/hermes-seagull](https://github.com/Yunique-hub/hermes-seagull)（MIT）
- 与 DeepSeek 无雇佣 / 商业 / 授权 / 背书关系

> 上游主体许可与补充说明分别见 `vendor/dsh-purge/LICENSE`、`LICENSE-COMMERCIAL.md` 和 `NOTICE`；本地差异见根 NOTICE。

---

<div align="center">

**宿主层放行 ≠ 模型层照做。本项目把前者做干净，不替后者吹牛。**

</div>
