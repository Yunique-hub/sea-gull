# 贡献指南

## 提交前必过

```bash
make lint     # bash -n + py_compile + node --check
make test     # 假 DSH_HOME 装/验/幂等/卸闭环 + Node 兼容与更新回归
make docs-check  # 版本号、补丁数、范围闸归因
```

CI 会在 ubuntu + windows 上跑同一套。本地不过的不要在 PR 里赌。

## 目录约定

| 路径 | 放什么 | 注意 |
|---|---|---|
| `src/prompt/` | 注入提示词 | **不能出现** `{{ }}`（除 `cwd`/`model`/`provider`），不能有 ChatML 标签 |
| `src/rules/`（已移除） | — | 1.0.8 起人格只走 `src/prompt/prompt-inject.md`；旧规则集移到 `docs/archive/`，**禁止再随包投放** —— 它会被写成 `AGENTS.md`，而宿主会读 `AGENTS.md`，等于注入第二份人格 |
| `src/skills/` | 技能 | 目录名 `[a-z0-9-]`，必须有 `SKILL.md` 带 `name`/`description` frontmatter |
| `vendor/dsh-purge/` | 上游引擎 | **尽量不改**；若必须改，同步更新 `NOTICE` 的改动表 |
| `docs/CURRENT.md` | 当前版本/哈希/验证边界 | 改版本、改运行副本、改验证口径时一起改 |
| `docs/releases/` | 每个版本的发布说明 | 文件名 `UPGRADE-x.y.z.md` |
| `docs/reviews/` | 评审、整合、上游对照 | 历史结论不作为当前行为依据 |
| `tests/` | 测试 | 必须能不装 DSH 就跑（假 `DSH_HOME`） |
| `_src/`、`_verify/` | 本地快照/证据 | 已被 `.gitignore` 排除；`make clean` 不删，`make clean-local` 才删 |

## 改上游代码的规矩

1. 改动必须能在 `NOTICE` 的「本仓库对上游的改动」表里**逐条列出**。
2. 改完跑 `make test`，并在 `docs/VERIFICATION.md` 补一条实测。
3. 保持上游署名与 `vendor/dsh-purge/LICENSE` 不动。

## 加技能的规矩

```
src/skills/<id>/SKILL.md
---
name: <id>              # 必须与目录名一致
description: <一句话>    # 会被注入技能目录，别写废话
---

正文（操作手册：判据 / 命令 / 坑 / 验收）
```

技能正文要写**可执行的命令和判据**，不是"建议你去了解一下"。

## 提交信息

Conventional Commits：

```
feat: 增加 xxx
fix: 修复 xxx
docs: 更新 xxx
refactor: 重构 xxx
test: 补充 xxx
chore: 杂项
```

## 安全

发现安全问题请看 [SECURITY.md](SECURITY.md)，**不要**开公开 issue。
