# docs/archive

只读存档。这里的东西**不随安装包投放**，也不参与运行时注入。

| 文件 | 来源 | 为什么留着 |
|---|---|---|
| `seagull-fullbreak-1.0.7.md` | 1.0.7 的 `src/rules/seagull-fullbreak.md` | 海鸥全破内核（13 节行为契约）的历史版本，用于对比与溯源 |
| `seagull-fullbreak-1.0.7.json` | 1.0.7 的规则集元数据（`{name, target: AGENTS.md}`） | 说明它当时被写成 `AGENTS.md`，即第二次人格注入的入口 |

## 为什么取消规则集投放（1.0.8）

1.0.7 及更早版本把同一份人格文本同时落成两个文件：`prompt-inject.md`（注入 system 段）和
`rules/seagull-fullbreak.md`（由 `activateRule()` 整文件覆盖 `AGENTS.md`）。设计意图是「互为备份」，
但 `AGENTS.md` 是宿主 `dsh-agent-instructions` 的**真实指令入口** —— 每个会话都会读它。
结果是同一份人格被注入两次，且出现两份内容不一致时（插件内置默认「小码酱」被写进
`prompt-inject.md`）人格互相冲突。

1.0.8 起：人格只由 `src/prompt/prompt-inject.md` 一份提供；插件加密槽与它同源；
安装器把运行目录里的 `rules/seagull-fullbreak.*`、`rules/archived/` 副本及其激活状态一并清理。
回归断言见 `tests/single-prompt-source.test.mjs`。