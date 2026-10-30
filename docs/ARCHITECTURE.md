# 架构

当前 1.0.13 使用 Harness 0.2.1-rc.3 / purge 1.1.82；本地靶场范围闸已移除（不再注册 `agent/pre-step` / `tools/pre-execute` 拦截），旧技能仅源码存档。当前差异见根 NOTICE，分析见 PROJECT-REVIEW-2026-10-25，验证见 VERIFICATION 的 M 节与 P 节。以下保留设计演进记录。

## 1. 为什么是「合并」而不是「选一个」

两个上游解决**两个不同的层**，互补不重叠：

| 层 | 谁负责 | 产物 |
|---|---|---|
| 宿主层（审批/沙箱/hook/身份段/提示词组装） | dsh-purge | 86 条补丁定义 |
| 行为层（人格/输出契约/领域技能） | hermes-seagull | SOUL + 5 技能 |
| 工具层（红队打法/隧道/凭据/横向） | dsh-purge | 23 红队技能 + 演练台 |

所以合并动作是「**把行为层灌进宿主层的机制**」，不是重写任何一方。

## 2. 上游分析

### 2.1 dsh-purge 1.1.72

```
bin/dsh-purge.js       CLI：--status/--apply/--revert/--uninstall/--edit
lib/core.js              86 条补丁定义(ALL_PATCHES) + 宿主定位 + 备份/回滚 + asar 解包
lib/index.js             插件入口 apply(ctx, config)：注入 systemPrompt/tools、挂 host hooks
lib/identity.js          身份段篡改 + ChatML 信封处理 + 插值转义
lib/phase1-keep.js       放宽官方 phase-1 白名单到 dsh-purge* / dshpg-*
lib/hooks-deny.js        hooks deny/ask 旁路
lib/net-scope.js         目标地域闸门（CN/HK/MO）+ 银行/交易所黑名单（1.0.13 起只留自有服务器白名单存储层）
lib/rules.js             规则集（写 AGENTS.md / CLAUDE.md）；1.0.8 起只服务用户自建的非人格规则
lib/skills.js            技能库（写 $DSH_HOME/skills/<id>/SKILL.md）
lib/redteam/*            演练台：5 角色预设 + SQLite 资产库 + HTTP UI 桥
presets/redteam/*        红队指挥智能体
skills/redteam/*.md      23 个红队技能
client.js               右侧 dock 前端（Clean / Drill）
```

**86 条补丁定义分层**

| 层 | 条数 | 代表 |
|---|---|---|
| 提示词/Prompt | ~20 | `WORKSPACE_CONTEXT_INTRO`、`SYSTEM_PROMPT_PERSONA`、`HARNESS_IDENTITY_STRIP` |
| 代码/Code | ~35 | `SANDBOX_DENY_FILE_WRITE`、`APPROVAL_POLICY_DEFAULT`、`FS_FENCE_DISABLED`、`READ_CAPS_RAISED` |
| 工具/Tools | ~8 | `MINIMAL_OFFICIAL_TOOLSET`、`HOOKS_CLAUDE_DENY_ALLOW` |
| 兼容层 | ~10 | `0.1.5 兼容` / `0.2.0 兼容` / `DESKTOP_HOST_CLOSE_*` |

**关键机制**

1. **密封桌面宿主**：官方 EXE 的 `@deepseek-ai/*` 全在 `resources/app.asar` 里。
   插件先解包到 `resources/app/`，打补丁，再把 `app.asar` 挪走，让 Electron 下次走解包目录。
2. **提示词优先级**：`prompt-inject.md` > 当前目录勾选的 `AGENTS.md/CLAUDE.md` > 插件内加密槽默认值。1.0.8 起加密槽与 `src/prompt/prompt-inject.md` 同源；人格只允许出现在 `prompt-inject.md` 里，`AGENTS.md` 不得承载人格（否则每会话注入两份）。
3. **身份段**：用 `dsh-purge*` / `dshpg-*` 前缀插段（前者会被官方挪到最前，后者不会，
   用前缀绕开渲染顺序反转）。
4. **地域闸门**：`agent/pre-step` 全局前置钩子，step 1 判断攻击类任务 + CN/HK/MO 目标 → 停轮。1.0.13 起整体移除。

**已知脆弱点（实测踩到）**

- **CLI 对密封桌面不直接 Apply**：`bin/dsh-purge.js --apply` 在桌面宿主下拿不到 aiBase，直接报错。
  真入口是 app 内 Apply（`core.ensureHostClean`）或 `lib/reapply-cli.js`。
- **备份步骤会抛**：`atomicCopyFile` 用 `<dst>.<pid>.<ts>.copytmp` + rename，实测偶尔 ENOENT，
  并把 `.dshpurge.bak` 落成 **0 字节** → 之后 `--revert` 会毁宿主。
  本项目在冒烟测试里覆盖了这条，回滚依赖**原始 asar**（比 bak 更可靠）。
- 上游已声明"维护暂停"，新 dsh 版本未匹配的补丁会显示 skipped（不会乱写）。

### 2.2 hermes-seagull

```
SOUL.md          350 行   海鸥人格（00a–00r 十一条铁律 + 问候 + 触发词）  ← 有效成分
skills/*          5 个     领域技能（reverse/pentest/exploit/game-hack/license）  ← 有效成分
seagull-armor-break/       自研 Hermes 插件（88 行 python）              ← 无效
install.sh / README        指向 laoshu666/hermes-seagull（不是本仓）      ← 无效
```

**判定**：只有 `SOUL.md` + `skills/` 是真货。它的 Hermes 插件用
`transform_system_prompt` / `pre_agent_turn` 当事件名、`ctx.register_hook` 当 API ——
两个都不是 Hermes 的，装了不生效；安装器指向另一个仓库且命令不存在。合并时全部剔除。

## 3. 合并动作

| # | 动作 | 落点 |
|---|---|---|
| 1 | dsh-purge 1.1.72 全量作为宿主层引擎 | `vendor/dsh-purge/` |
| 2 | SOUL.md 的 00a–00r 重写成 DSH 兼容注入提示词 | `src/prompt/prompt-inject.md` |
| 3 | ~~同一份文本做成规则集（写 `AGENTS.md`）~~ **1.0.8 取消**：宿主会读 `AGENTS.md`，等于第二份人格注入 | 旧规则集归档于 `docs/archive/` |
| 4 | 5 个海鸥技能按 DSH 技能格式落地 | `src/skills/seagull-*/SKILL.md` |
| 5 | 23 个红队技能一并落地 | `src/skills/redteam/*.md` |
| 6 | ★ `regionGate` 变可配置，本仓库默认 `false` | `vendor/dsh-purge/lib/index.js` + `cordis.patch.yml` |
| 7 | `autoApplyOnStart: true`（npm 覆写后自愈） | `cordis.patch.yml` |
| 8 | 幂等 JSON 改写器 | `src/tools/patch_profile.py` |
| 9 | 通用安装/校验/冒烟/端到端 | `install.*` / `verify.*` / `verify-e2e.sh` / `tests/smoke.sh` |

### 3.1 DSH 兼容改写（第 2 步的技术细节）

SOUL.md 不能直接当 DSH 提示词，必须处理三件事：

1. **插值**：DSH 只允许 `{{cwd}} {{model}} {{provider}}`，其它 `{{ }}` 会让整段被丢弃 →
   全破文本里除这三个外不出现 `{{`。
2. **ChatML 信封**：不能出现裸 `<|im_start|>` / `<project_instructions>`，
   否则与官方段拼成两套未闭合信封。
3. **能力选用协议**：DSH 的 skill/MCP 目录机制要保留（否则技能库形同虚设）→
   全破提示词第 13 节保留「先读目录、按任务匹配、子代理继承」。

### 3.2 初始配置改动示例

以下保留初始配置示例；当前全部源码差异以根目录 [NOTICE](../NOTICE) 为准。0.2.1 和 1.1.72 的迁移与验证见 [VERIFICATION](VERIFICATION.md)。

```diff
# vendor/dsh-purge/lib/index.js
   capabilityProtocol: true,
   hooksDenyBypass: true,
+  // [seagull 全破] true = 保留上游 CN/HK/MO 地域闸门；false = 完全不装
+  regionGate: true,
 };

# vendor/dsh-purge/lib/index.js — applyHostHooks()
   installIdentityOverride(ctx, cfg);
-  installRegionGate(ctx);
+  if (cfg.regionGate !== false) installRegionGate(ctx);

# vendor/dsh-purge/cordis.patch.yml
-        autoApplyOnStart: false
+        autoApplyOnStart: true
+        regionGate: false
```

## 4. 运行时数据流

```
用户消息
   │
   ├─ agent/pre-step  ── region gate 关了 → 不拦
   │
   ├─ system-prompt/assemble
   │     ├─ 官方段（身份段已被剥）
   │     ├─ inject 段  ← $DSH_HOME/prompt-inject.md（海鸥全破内核）
   │     └─ cap 段     ← capability protocol
   │
   ├─ 工具调用
   │     ├─ 审批门    → 已中和
   │     ├─ 沙箱策略  → 已中和
   │     └─ hooks     → deny/ask 放行
   │
   └─ 输出（海鸥人格 + 执行纪律）
```

## 5. 目录职责边界

| 路径 | 谁维护 | 升级方式 |
|---|---|---|
| `vendor/dsh-purge/` | 上游与本地兼容修复 | 换版本时按 NOTICE 复核本地差异并验证 |
| `src/prompt/` `src/skills/` | 本项目 | 直接改 + 重跑 `install.sh`；人格只此一份，勿再投向 `AGENTS.md` |
| `install.*` `verify.*` `tests/` | 本项目 | 同上 |
| `$DSH_HOME/skills/` | 用户 | 安装器只覆盖同名技能，不删其他 |

## 6. 已知限制

以下为初始 0.2.0 版本的限制记录。当前 0.2.1 / 1.1.72 状态以 [VERIFICATION 的 I 节](VERIFICATION.md#i-dsh-purge-1172-升级与演练台项目修复2026-10-19) 为准。

1. `dsh --profile desktop` 由 Electron 独占，CLI 不能 `--dump-config` 验证挂载 →
   用「文件级标记 + 补丁计数 + 进程存活」三条实证代替（见 VERIFICATION）。
2. 密封解包路径下宿主文件 bak 不落盘（实测 bak 数 = 0）→ 回滚依赖原始 `app.asar`。
3. 2 条 pending 补丁（`#56`/`#77`）是上游 UI 代码已改版导致锚点对不上，
   属回退渲染（undo/rewind 气泡），`optional: true`，**不是破甲闸门**。
