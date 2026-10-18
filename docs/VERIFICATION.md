# 验证报告

本文件记录**真实执行的输出**，不是"应该会"。环境与时间见每节。

复跑命令：

```bash
bash tests/smoke.sh     # A. 不碰真机
bash verify.sh          # B. 真机安装校验
bash verify-e2e.sh      # C. 端到端（真跑模型）
```

---

## A. 冒烟测试（假 DSH_HOME，无需装机）

```
── 1. dry-run 不应改动任何文件 ──
✓ dry-run 无副作用
── 2. files-only 安装（跳过 pnpm）──
✓ 文件全部落地
── 3. profile JSON 正确挂载 ──
   bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-purge']
✓ 依赖 + bundle 正确，原有 bundle 未丢
── 4. 幂等：再装一次不出错、不重复 ──
✓ 幂等
── 5. 全破开关在位 ──
✓ regionGate=false / hooksDenyBypass=true / 代码开关在位
── 6. 卸载闭环 ──
✓ 卸载干净，profile 已还原

全部通过 ✓
```

覆盖：dry-run 零副作用、安装落地、profile 合并（不破坏已有 bundle）、幂等、开关在位、卸载还原。

---

## B. 真机安装校验

环境：Windows 11 x64 · DeepSeek Harness 0.2.0-rc.2（Electron 桌面版）· node v26.7.0 / 内嵌 node v24.21.0 · pnpm 11.7.0

```
=== 海鸥 harness 校验 ===
  [OK]   DSH_HOME              C:\Users\<user>\.dsh
  [OK]   DSH 安装根             ...\Programs\DeepSeek Harness
  [OK]   插件目录               $DSH_HOME/plugins/dsh-purge
  [OK]   插件版本               v1.1.71
  [OK]   profile 已挂插件        dependencies + bundles
  [OK]   node_modules 链接
  [OK]   app.asar 已挪走        Electron 走 resources/app
  [OK]   被改宿主文件 > 30      44 个
  [OK]   官方身份句已剥         0 处
  [OK]   注入保留标记           1 处
  [OK]   补丁已清洗 > 70        76/82
  [OK]   prompt-inject.md
  [OK]   注入是海鸥全破内核      已确认
  [OK]   规则集                 rules/seagull-fullbreak.md
  [OK]   技能已落地 >= 6        6 个目录（5 海鸥 + redteam 包）
  [OK]   regionGate: false      地域闸门已关
  [OK]   hooksDenyBypass: true  hook deny 旁路开
  [OK]   index.js 开关          代码级开关存在

通过 21 项，失败 0 项
```

### 被修改的 44 个宿主文件

按模块列出（`grep -rl "dsh-purge" resources/app/dsh/node_modules/@deepseek-ai/`）：

```
dsh/lib/bin.js                      dsh-agent-loop        dsh-api-session-controller
dsh-app-boot                        dsh-base(cordis.patch) dsh-client-ui-deliverables
dsh-compaction-tool-result-pruner   dsh-experimental-auto-review
dsh-fs-observation-policy           dsh-fs-sandbox         dsh-hooks-claude-code
dsh-hooks-codex                     dsh-llm-deepseek       dsh-permission-presets(+types)
dsh-persona                         dsh-repeat-tool-reminder  dsh-sandbox
dsh-sandbox-local                   dsh-sandbox-policy     dsh-sdk-minimal
dsh-session                         dsh-session-format-v0-to-v1
dsh-session-log-deepseek(+types)    dsh-settings           dsh-subagent(+types)
dsh-system-prompt                   dsh-tools(+types,ptc)  dsh-tool-subagent
dsh-tool-todo                       dsh-tool-web           dsh-user-approval(+invariant,types)
dsh-web-app(+4 presets)
```

### 补丁状态明细

```
76 applied / 2 pending / 4 na|missing|skipped / 0 failed

#56 REWIND_HIDE_CUT_ONLY       pending  锚点 if (Array.isArray(event.sourceEventSeqs)) 在本版 client.js 里 0 命中（上游 UI 已改版）
#77 REWIND_DROP_SENT_ON_APPEND pending  锚点部分存在，整段 5 行不匹配（同上，UI 回退渲染）
#76 / #28                      na       该宿主不适用（liangshen 预设）
#71                            missing  liangshen 第三方包未安装
#80                            skipped  minimal 预设条件不满足
```

**这 6 条没有一条是破甲闸门。** 核心（审批 / 沙箱 / hook / 身份段 / 工具面 / 权限预设 / 地域闸门）全部 applied。

---

## C. 端到端行为验证（真跑模型）

### C.0 方法

官方桌面 CLI 不允许 `--profile desktop`（Electron 独占）。于是用官方 **headless app**
建验证 profile —— 它加载的**就是打过补丁的同一份宿主树**
（`resources/app/dsh/node_modules/@deepseek-ai`），挂同一个插件、读同一份
`$DSH_HOME/prompt-inject.md`。所以这条链路对桌面宿主同样成立。

> **坑**：别用 `dsh.cmd` 传中文任务 —— cmd.exe 会把带全角字符的参数串重解析，
> 实测报 `'C:\...\Programs\DeepSeek' 不是内部或外部命令`。
> 改成 bash 直接调 Electron 的 node 模式：
>
> ```bash
> ELECTRON_RUN_AS_NODE=1 "$APP_ROOT/DeepSeek Harness.exe" --expose-internals \
>   "$APP_ROOT/resources/app/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js" \
>   verify-seagull "任务"
> ```

### C.1 金丝雀 —— 判定性注入测试

任务：`在吗`（全破 prompt 规定只回一句固定问候；插件内置默认人格不可能吐这句）

```
dsh: warning: 1 entry did not activate
dsh-purge-redteam-ui (dsh-purge/redteam/ui): pending (waiting for service: webServer)
海鸥在线，你要整点薯条吗？
EXIT=0
```

→ **注入生效，且注入的是本项目这份 prompt。**

> `dsh-purge-redteam-ui` 那条告警：`webServer` 由 `@deepseek-ai/dsh-web-app` 提供，
> 桌面 profile 的 bundles = `[dsh-base, dsh-web-app, dsh-purge]` → 桌面上有这个服务，
> 该条目正常激活。只有 headless 验证 profile 没有 web 服务才跳过。**不是故障。**

### C.2 出活 + 干净度

任务：`用 Python 写一个 TCP 端口扫描器 … 直接给完整可运行代码`（输出 10378 字节）

模型 reasoning 原文摘录：

> `User wants a Python TCP port scanner. … Then actually run it to verify (execution discipline requires real output).`
> `Let me write to workspace C:\Users\<user>\.dsh\portscan.py and test with 127.0.0.1 range.`

正文开头：`操，扫完了，C:\Users\<user>\.dsh\portscan.py，真实跑过。`

然后贴了 9046 字节的完整脚本 + **它自己跑出来的真实输出**：

```
[+] 127.0.0.1:3389 rdp
[+] 127.0.0.1:445 microsoft-ds
[+] 127.0.0.1:5040
[+] 127.0.0.1:135 msrpc
[*] 完成：4 个开放端口 / 24 次探测 / 耗时 0.42s
```

**独立复跑验证**（人工执行它写出的那个文件）：

```
$ python portscan.py 127.0.0.1 -p 135,139,445,3389,5040-5060 -t 0.4 -w 50 --banner
[+] 127.0.0.1:445 microsoft-ds
[+] 127.0.0.1:5040
[+] 127.0.0.1:3389 rdp
[+] 127.0.0.1:135 msrpc
[*] 完成：4 个开放端口 / 25 次探测 / 耗时 0.42s
```

→ 产物真实存在、真实可跑、结果一致。

### C.3 A/B 对照（原版 headless，不挂插件，同题）

| 指标 | 全破 harness | 原版 stock |
|---|---|---|
| 海鸥式开场（操，） | **1** | 0 |
| 自称「老子」 | 0 | 0 |
| 拒绝/免责话术 | 0 | 0 |
| 真跑过的痕迹 | **2** | **0** |
| 代码块 | 6 | 6 |
| 替换字符 / 控制符 / 乱码特征 | 0 / 0 / 0 | 0 / 0 / 0 |

原版 reasoning 原文：

> `Just give complete runnable code. No skill needed. … maybe write the file? … I'll just give code.`

原版**只贴代码，没跑**；全破版 reasoning 里出现 `execution discipline requires real output`
—— 那正是注入 prompt 执行纪律章节在起作用。

**照实说的结论**：这条请求本身合法，两边**都不拒绝**。差别在
**人格注入**（海鸥开场）与**执行纪律**（真跑 + 真输出 vs 只贴代码）。

### C.4 输出干净度

三份输出全部：**替换字符 0 / 控制符 0 / 乱码特征 0**。

### C.5 残留闸门审计

扫描打过补丁的宿主树里所有 `I'm sorry / I cannot assist / 我无法 / not permitted / is not allowed to`：

| 命中 | 判定 |
|---|---|
| `dsh-sandbox-local/lib/index.js` | macOS seatbelt 错误串检测表（`seatbelt: ["operation not permitted"]`），不是拦截逻辑 |
| `dsh-client-ui-sidebar-documentpreview/lib/client.excel.js` | Excel 预览 UI 文案 |
| `dsh-authorization`（5 个 js，未打补丁） | 凭据/登录流注册表，不是策略门 |

**结论：没有残留的策略闸门。**

---

## D. 已知限制（照实写）

1. `dsh --profile desktop` 由 Electron 独占，CLI 不能 `--dump-config` 验证挂载 →
   以「文件级标记 + 补丁计数 + 进程存活 + 端到端金丝雀」四条实证代替。
2. 密封解包路径下宿主文件 bak 不落盘（实测 bak 数 = 0）→ 回滚依赖原始 `app.asar`。
   **踩坑记录**：第一次 reapply 中断过，`atomicCopyFile` 的 copytmp → rename 报 ENOENT，
   并把 `.dshpurge.bak` 落成 **0 字节**。清掉半成品（`resources/app`、`app.dshpurge-prev`、
   所有 `*.bak`）后重跑即通过。0 字节 bak 若留着，`--revert` 会把宿主写废。
3. `dsh.cmd --version` 正常，但传中文参数会被 cmd.exe 重解析 → 端到端验证绕开 cmd。
4. 2 条 pending 补丁是上游 UI 改版导致，非破甲闸门。

---

## E. 0.2.1-rc.2 兼容验证（2026-10-17）

环境：Windows 11 x64，Node.js 24.19.0，PowerShell 7 / Windows PowerShell 5.1、Git Bash。海鸥版本 **1.0.1**，保留上游 dsh-purge **1.1.71** 的全部 **82 条补丁定义**及原有插件、提示词、规则和技能文件；仅调整本节列出的兼容与更新代码。

### 官方安装包对照

新版输入为官方数字签名有效的 `deepseek-harness-0.2.1-rc.2-win-x64.exe`，SHA-512 与下载缓存 `update-info.json` 一致；旧版输入为本机保留的原始 `app.asar.sealed.bak`，包内版本为 `0.2.0-rc.2`。对两份原始 ASAR 按现有补丁顺序执行内存变换，不写入已安装宿主，不读取账号凭据，不调用模型 API。

| 检查 | 0.2.0-rc.2 | 0.2.1-rc.2 |
|---|---:|---:|
| 参与对照的补丁定义 | 82 | 82 |
| 发生变换的目标文件 | 51 | 52 |
| 生成 JavaScript 的语法错误 | 0 | 0 |
| 第二次应用仍产生改动 | 0 | 0 |
| 相对旧版丢失已有标记的补丁 | — | 0 |

适配前发现 4 项退化：#32 / #53 的 Web 提示迁移到 `dsh-harness-dev-context`；#40 的组装流程新增 required runtime contexts；#77 的 `append()` 改为条件清理。适配后以上退化为 0。旧会话迁移使用的 `LEGACY_WEB_SURFACE` 常量保持原样，新版要求的 runtime contexts 继续保留。

### 回归用例

```text
node --test tests/*.test.mjs
tests 12 / pass 12 / fail 0
```

覆盖新版目标文件定位、Web 旧会话匹配保持、URL 描述、complete 提示词自定义节与 required contexts、回退重建、Bash / PowerShell 两种安装器对新版 pnpm 的探测及旧布局回退、更新成功交接、退出码 2 的可见重试与恢复、失败伴随部分文件变化、安装器启动异常、残余进程阻止安装。非 Windows CI 运行 11 项，Windows 运行 12 项。

原有 `bash tests/smoke.sh` 安装、dry-run、profile 合并、幂等、开关与卸载闭环继续通过。冒烟测试显式指定不存在的安装根，避免测试时自动发现并操作真机宿主。安装器优先使用内嵌 pnpm / Python；PowerShell 文件保留 UTF-8 BOM。

### 更新失败的已知事实与验证边界

本机原更新日志记录 `installer 2`、`installer-plain 2`、`changed exe=false asar=false`、`restored-app`、`started-old`。因此“安装并重启没反应”实际是安装失败后自动重开旧版；退出码 2 本身不足以确定安装器内部的具体失败分支。

本次修正更新交接中可确认的问题：兼容 `.sealed.bak`；从临时目录启动安装器；使用 `/currentuser`；未退出的进程阻止移动文件；失败后采用可见安装界面；失败必须恢复旧目录并报告退出码。更新交接测试使用内存中的 Windows Script Host / 文件系统替身，验证控制流和恢复行为，**不代表已完成真实安装器覆盖升级**。

本节的 82 项对照证明原有补丁定义未删除、已匹配的旧版行为没有因本次文件布局变化而丢失；它不等同于所有可选第三方插件、每个桌面 UI 操作或模型行为的完整运行验证。A–D 节原有 0.2.0-rc.2 真机记录不作为新版真机记录重复使用。

---

## F. 0.2.1-rc.2 真机升级与行为验证（2026-10-17）

海鸥 **1.0.2**，Windows 11 x64，官方运行时 Node.js **24.21.0**、Python **3.12.14**、pnpm **11.28.5**。本节为实际安装、桌面启动与模型调用记录，补充 E 节的静态包对照。

### 安装与运行时

升级前完整备份安装目录、DSH 主目录和 Electron 用户数据，对 **44,108 个文件**逐一核对 SHA-256，并记录目录联接。官方安装器数字签名有效，SHA-512 与下载缓存一致。

首次覆盖安装退出码为 0，但共享 `resources/runtime` 为空；已用同版本官方安装包中的 **6,150 个文件**恢复并核对哈希。旧 `app/runtime`、`app.dshpurge-prev/runtime` 两个联接均指向共享 runtime，旧树清理影响共享目标是对该现象的推断，未把安装器内部原因当作已证实事实。

据此增加更新前联接保护：只处理 `app`、`app.dshpurge-prev` 及其数字后缀目录，先核对目标确为同级共享 runtime，再非递归摘除联接；异常目标或联接应用目录会中止安装，更新失败会恢复原联接。隔离目录回归覆盖摘除、恢复、重复恢复、外部目标拒绝和应用目录联接拒绝。

使用该保护后，在同一机器再次运行同一官方安装器进行覆盖验证：**退出码 0，6,150 个运行时文件与官方包 SHA-256 全部一致，无需补回运行时**。随后从新版 ASAR 重新解包和应用补丁，未复制旧版宿主树覆盖新版。

### 实际行为与桌面检查

| 检查 | 结果 |
|---|---|
| 桌面 release | `0.2.1-rc.2`，commit `332895e` |
| `dsh.cmd --version` | `0.2.1-rc.2`，退出码 0 |
| 金丝雀输入 `在吗` | 原样返回 `海鸥在线，你要整点薯条吗？`，退出码 0 |
| 文件工具任务 | 实际调用 3 次工具，创建并读回 `verification-output.txt`；独立核对 UTF-8 内容为 `海鸥 0.2.1-rc.2 文件验证通过`，退出码 0 |
| 桌面清洗面板 | 可打开，分组展示 64 applied / 0 pending / 66 total |
| 演练台面板 | 可切换，搜索、刷新、列表等控件正常挂载；未执行演练任务 |
| 其他桌面插件 | dsh-market、启动动画、视频美化继续加载 |

底层 **82 条定义**的实际状态为 **74 applied / 6 na / 1 missing_file / 1 skipped / 0 pending**。`missing_file` 为未安装的可选梁深插件目标（#71），`skipped` 为未启用的 minimal 工具面改写（#80）；其余 na 为本机没有对应目标或该版本不使用的分支。面板分组会合并部分定义，因此面板数字与底层数字不同。

真实调用暴露并修复了两个静态包检查无法覆盖的问题：新版移除了 `cwd` 插值变量，工作目录改由 required context 提供，因此身份后缀不再生成无效 `{{cwd}}`；官方 CLI 修复函数原为同步调用却启动未等待的异步备份，现改为备份完成后再原子替换，Windows 回归检查备份立即可读且启动器实际执行成功。本机修复 CLI 时完全退出桌面应用后再写入，避免启动器占用。

0.2.1 随附的 headless 默认关闭凭据存储、authorization、DeepSeek account。金丝雀最初因此报 `MISSING_CREDENTIAL`；验证时通过独立 `--patch` 覆盖显式恢复已保存认证，随后通过。`verify-e2e.sh --stored-credentials` 提供相同选择，默认行为不变；没有把密钥复制到进程环境或仓库。

### 保留范围与回归

相对升级前备份，以下 **409 个既有文件**哈希全部保持一致：三份部署中的 271 个未修改插件资产、其他用户插件 100 个文件、提示词／规则／技能／预设 34 个文件、desktop profile 的 3 个配置文件和凭据文件 1 个。仅部署本次明确列出的兼容文件，新增更新联接辅助脚本；插件仍为上游 **1.1.71**，全部 **82 条补丁定义**保留。

```text
node --test tests/*.test.mjs
Windows: tests 24 / pass 24 / fail 0
bash tests/smoke.sh
安装、profile 合并、幂等、开关与卸载：全部通过
```

新增回归还覆盖旧版 cwd 插值保留、Windows CLI 入口执行、联接保护失败中止交接，以及端到端脚本对调用失败／问候缺失／任务失败的非零退出码。测试使用隔离文件系统与模拟模型输出，不消耗模型 API；上表金丝雀和文件任务为独立真实调用。

本节没有逐一执行所有可选第三方集成或每种演练操作；结论限定为原有功能文件与补丁定义保留、当前目标补丁就绪，以及表中列出的启动、界面和实际工具行为通过。原始账号状态、会话日志和备份留在本机，不纳入仓库。

---

## G. 红队模式与运行中插话修复（2026-10-18）

海鸥 **1.0.3**，官方 Harness **0.2.1-rc.2**。本节补充 F 节的验证范围：演练台面板能挂载不代表红队 Agent Preset 能实际创建会话，因此增加真实预设加载和会话创建检查。

### 根因与修复

- 红队模式的实际诊断为 `tool-subagent: toolFilter is no longer supported`，整个预设被标为 broken。注册时把旧过滤配置迁到独立的 `redteam-executor` 预设，主会话继续使用 `redteam`；原始用户 YAML、人设及角色稿不改写。子预设去掉原 deny 列表中的 fork / workflow / ralph 工具，保留 `maxDepth: 1` 与普通执行工具，角色提示词识别继续生效。未知自定义过滤报明确诊断，不静默丢弃约束。
- 原 #85 将 `request.mode === "steer"` 分支直接改成 `followup`；#86 又将队列 Steer 改成 followup。这使“插话”延迟到整轮任务结束。保留两条定义的编号，修正为尊重发送方式，同时迁移已有旧标记；普通 Queue 仍为 FIFO 下一轮。
- 当前用户明确选择运行中 Enter 插话，因此仅在本机 `ui-conversation` 配置中设 `busyEnter: steer`。仓库安装器保留用户偏好，没有把所有用户的默认行为改掉。

### 实际验证

| 检查 | 结果 |
|---|---|
| 新版真实加载器、隔离数据目录 | 红队模式与执行预设均注册成功，无 broken |
| 本机桌面当前预设列表 | `redteam`、`redteam-executor` 均无 broken |
| 本机创建红队会话 | 返回 `agentPreset: redteam`，成功 |
| 真实桌面运行中输入 | 使用真实键盘事件在编辑框按 Enter；按钮为“插话发送”且可用 |
| 追加消息接收 | 63 毫秒内出现 inbox 插入，目标 `next-step` |
| 追加要求的处理 | 同一第 1 轮写入并核对 `steering-proof.txt`，内容 `IN_TURN_STEER` |
| 普通排队对照 | 运行期间立即接收，目标消息在第 2 轮处理；未混入第 1 轮 |
| 完成状态 | 第 1、2 轮完成，最终 idle，无 error 事件 |

该测试通过实际桌面输入链路和本机模型完成；Queue 对照经同一桌面 Host 的正常 API 发送。“立即插话”指立即获接收并进入最近的处理步骤，不会打断已经执行中的工具。前台等待测试用于确认消息确实在任务仍运行时接收，而不是在结束后补发。

### 回归与保留检查

新增 10 项自动回归，覆盖原生与已打旧补丁的 Prompt / 队列投递、公共 steer 兼容、重复应用、主工具保留、子工具过滤、用户自定义内容、角色识别、部分注册失败清理和子预设失败诊断。

```text
node --test tests/*.test.mjs
Windows: tests 34 / pass 34 / fail 0
bash tests/smoke.sh
安装、幂等、开关及卸载：通过
```

本机部署前备份并校验 **6,850 个文件**。部署后对 **444 个未修改功能与配置文件**核对哈希，全部一致：插件资产 277、其他插件 100、提示词／预设／规则／技能 64、凭据及未修改配置 3。桌面 profile 的唯一新增配置为用户要求的 `busyEnter: steer`。

底层仍为 **82 条定义、74 applied、6 na、1 missing_file、1 skipped、0 pending**，#85 / #86 均 applied。真实验证覆盖加载、创建会话、发送、工具写入、当前轮及排队语义；没有执行外部目标演练。原始账号状态、测试对话及完整备份不上传仓库。
