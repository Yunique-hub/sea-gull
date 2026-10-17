# 贡献指南

## 提交前必过

```bash
make lint     # bash -n + shellcheck(可选) + py_compile + node --check
make test     # 假 DSH_HOME 装/验/幂等/卸闭环 + Node 兼容与更新回归
```

CI 会在 ubuntu + windows 上跑同一套。本地不过的不要在 PR 里赌。

## 目录约定

| 路径 | 放什么 | 注意 |
|---|---|---|
| `src/prompt/` | 注入提示词 | **不能出现** `{{ }}`（除 `cwd`/`model`/`provider`），不能有 ChatML 标签 |
| `src/rules/` | 规则集 | `seagull-fullbreak.md` 与 `prompt-inject.md` 保持同步（互相备份用） |
| `src/skills/` | 技能 | 目录名 `[a-z0-9-]`，必须有 `SKILL.md` 带 `name`/`description` frontmatter |
| `vendor/dsh-purge/` | 上游引擎 | **尽量不改**；若必须改，同步更新 `NOTICE` 的改动表 |
| `tests/` | 测试 | 必须能不装 DSH 就跑（假 `DSH_HOME`） |

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
