<div align="center">

# 🦅 海鸥 · DeepSeek Harness 全破 harness

**把 DeepSeek Harness 的宿主策略层摘干净，换成海鸥人格 + 28 个领域技能。**

一行装 · 幂等 · 可卸载 · 有证据

[![CI](https://github.com/Yunique-hub/-/actions/workflows/ci.yml/badge.svg)](https://github.com/Yunique-hub/-/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-65a30d.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](CHANGELOG.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)](#系统要求)

[中文](README.md) · [English](README.en.md) · [架构](docs/ARCHITECTURE.md) · [部署](docs/DEPLOY.md) · [验证报告](docs/VERIFICATION.md)

</div>

---

## 这是什么

**DeepSeek Harness（DSH）** 不只是转发提示词——它在运行时改写提示词、审批门、沙箱策略、
会话迁移。所以你对着它说"别拒绝"，改的是**嘴**；真正拦你的是**手**。

本项目做的是**手的部分**：在你自己机器上、对你自己装的 DSH，把宿主层的策略闸门
逐条摘掉，然后把人格层换掉。

它把两件事合成一个包：

| 来源 | 提供什么 |
|---|---|
| [dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 1.1.71 | 宿主层引擎：**82 条补丁** + 红队演练台 + 23 个红队技能 |
| [hermes-seagull](https://github.com/Yunique-hub/hermes-seagull) | 海鸥人格（00a–00r 规则体系）+ 5 个领域技能 |

合并不是拼盘——`SOUL.md` 不能直接当 DSH 提示词（插值白名单、ChatML 信封、技能目录协议
三处都会让它失效），本项目做了重写；上游那个 `seagull-armor-break` Hermes 插件是半成品
（hook 名与 `ctx.register_hook` 都不是 Hermes 的 API），已剔除。

---

## 一键安装

**Windows**

```powershell
irm https://raw.githubusercontent.com/Yunique-hub/-/main/install.ps1 | iex
```

**Linux / macOS / WSL / Git Bash**

```bash
curl -fsSL https://raw.githubusercontent.com/Yunique-hub/-/main/install.sh | bash
```

**从本地 checkout**

```bash
git clone https://github.com/Yunique-hub/-.git seagull && cd seagull
bash install.sh            # 或 powershell -File install.ps1
```

装完会有一步 **Apply**（密封桌面宿主必须），按输出提示做即可：

```
密封桌面宿主（官方 EXE），三步：
  1) 完全退出 DeepSeek Harness
  2) 重开 → 会话标题旁点 dsh-purge → Clean 页 → Apply
  （或 bash install.sh --apply，再按提示挪 asar）
```

### 安装器选项

| 选项 | 说明 |
|---|---|
| `--profile desktop\|web` | 目标宿主 profile（默认自动：有 desktop 用 desktop） |
| `--dsh-home <路径>` | DSH 主目录（默认 `$DSH_HOME` 或 `~/.dsh`） |
| `--app-root <路径>` | DSH 安装目录（默认自动探测） |
| `--apply` | 装完立刻尝试 Apply（desktop 会解 asar，需宿主已退出） |
| `--no-pnpm` | 跳过 pnpm install（离线 / 已装过） |
| `--dry-run` | 只打印计划，不落盘 |
| `--uninstall` | 卸载（还原 profile、删插件与注入文件，保留你的技能） |

> 设计上**不硬编码盘符和用户名**：自动探测 `DSH_HOME`、profile、安装根、内嵌 node/pnpm；
> 探测不到安装根就降级为 files-only 模式。重复执行幂等。

---

## 它到底破了什么

四层，逐层对照。**层 1–3 是项目做的；层 4 是项目不承诺的。**

### 层 1 · 宿主策略层 ✅

| 闸门 | 处理 |
|---|---|
| 审批门 `user-approval` / `permission-presets` | 中和 |
| 沙箱 `sandbox` / `sandbox-policy` / `fs-sandbox` / `fs-observation-policy` | 中和 |
| hooks（Claude Code / Codex）的 `deny` / `ask` | 改放行 |
| `agent/pre-step` 预检拦截（地域闸门） | 整段不挂（`regionGate: false`） |
| 官方身份段 | 剥掉（全树 0 处） |
| 工具面裁剪（minimal / standard / ptc） | 放宽 |
| 提示词组装顺序（inject 被吞） | 保留注入 |

### 层 2 · 提示词层 ✅

注入的是海鸥全破内核（13 节行为契约），**不是**插件内置默认人格。
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
│   ├── prompt/prompt-inject.md   全破内核提示词（会话注入正文）
│   ├── rules/                    规则集（写 AGENTS.md）
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
- 宿主层引擎派生自 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)（MIT © 2026 小杨），
  本项目对其的全部改动在 [NOTICE](NOTICE) 中逐条列出，仅 3 处
- 人格与技能来自 [Yunique-hub/hermes-seagull](https://github.com/Yunique-hub/hermes-seagull)（MIT）
- 与 DeepSeek 无雇佣 / 商业 / 授权 / 背书关系

> 上游 README 声明「非营利 / 禁商用 / 需署名」。MIT 许可本身允许商用，本项目尊重上游意愿
> 按非营利分发并保留全部署名。若要商业使用 `vendor/dsh-purge/` 部分，请先取得上游作者同意。

---

<div align="center">

**宿主层放行 ≠ 模型层照做。本项目把前者做干净，不替后者吹牛。**

</div>
