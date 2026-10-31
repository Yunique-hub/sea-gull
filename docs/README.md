# 文档索引

先读三份，再按需跳转：

| 文档 | 用途 |
|---|---|
| [当前状态](CURRENT.md) | 版本、哈希、运行副本、验证边界；**唯一“现在是什么状态”的入口** |
| [架构](ARCHITECTURE.md) | 合并结构、宿主层/人格层/工具层、关键机制 |
| [部署](DEPLOY.md) | 安装、更新、卸载、宿主解包与回滚 |
| [验证](VERIFICATION.md) | 按版本积累的实测记录；当前版本先看 P 节及以后 |
| [发布流程](RELEASE.md) | 发布前检查、桌面验收、推送与回滚清单 |

## 发布记录

| 版本 | 文档 |
|---|---|
| 1.0.15 | [UPGRADE-1.0.15](releases/UPGRADE-1.0.15.md) |
| 1.0.14 | [UPGRADE-1.0.14](releases/UPGRADE-1.0.14.md) |
| 1.0.13 | [UPGRADE-1.0.13](releases/UPGRADE-1.0.13.md) |
| 1.0.12 | [UPGRADE-1.0.12](releases/UPGRADE-1.0.12.md) |

## 评审与整合记录

| 文档 | 内容 |
|---|---|
| [PROJECT-REVIEW-2026-10-29](reviews/PROJECT-REVIEW-2026-10-29.md) | 1.0.11 全面复核与部署一致性 |
| [PROJECT-REVIEW-2026-10-25](reviews/PROJECT-REVIEW-2026-10-25.md) | 1.0.9 全面审查与桌面回归 |
| [INTEGRATION-1.0.10](reviews/INTEGRATION-1.0.10.md) | 市场、工具目录与 AgentTeams 整合 |
| [FUJIANG-REVIEW](reviews/FUJIANG-REVIEW.md) | 富江工程评审参考；不含其人格/资产 |

## 历史

- `docs/archive/` 保存 1.0.7 及更早的规则集与归档材料。
- 旧版本文档中的“地域闸门”“23 技能自动部署”“00a–00r”等描述属于历史设计，不作为当前行为依据；当前行为以 [当前状态](CURRENT.md)、根 `NOTICE` 与源码为准。