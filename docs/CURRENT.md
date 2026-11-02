# 当前状态

本页只记录“现在是什么状态”。历史版本、评审过程和早期设计见 [文档索引](README.md)。

## 版本与依赖

| 项 | 当前值 |
|---|---|
| 海鸥 | **1.1.2** |
| 官方 Harness | **0.2.1-rc.5**（Windows 桌面） |
| dsh-purge | 1.1.87（固定上游 `335ddee90f4887981a4b2d2982c056a8f035c929`） |
| AgentTeams | 0.1.26 |
| 插件市场 | 内置 vendored：plugin 0.4.16 / core 0.4.13 / schema 0.1.4 / fuse.js 7.5.0 |
| 补丁定义 | **91**（`ALL_PATCHES` 实测，id 不连续） |

## 运行副本

实际加载副本：`$DSH_HOME/profiles/<profile>/node_modules/dsh-purge`。源：`$DSH_HOME/plugins/dsh-purge`。

| 文件 | 期望 |
|---|---|
| `package.json` → `seagull.version` | 1.1.2 |
| `lib/net-scope.js` | SHA-256 前 16 位 `2E185E1C8D8ABCE7`，6,044B |
| `lib/default-prompt-inject.md` | `24581A9E8511890E`，34,138B，与 `src/prompt/prompt-inject.md` 逐字节一致 |
| `lib/asset-table.js` | `4F46EDE9FC533704` |
| `lib/index.js` | 不出现 `installRegionGate` |

`verify.ps1` / `verify.sh` 现在会同时检查 **plugins 与 profile 运行副本**；只查 plugins 的绿灯不再算通过。

## 人格

- 唯一真源：`src/prompt/prompt-inject.md`（同时落到 `$DSH_HOME/prompt-inject.md` 与 vendor 加密槽）。
- 当前 SHA-256：`24581A9E8511890E987355F3D43BCB674C84F5341F55ED4DE5F2912924757049`，34,138 字节。
- 外部替换人格文件后，1.0.14 起会在刷新路径清掉进程内旧 pin；插件模块更新仍需重启。新会话是否立即生效还取决于宿主 system 段缓存，发布验收以重启后为准。

## 验证状态

| 检查 | 状态 |
|---|---|
| `node --test tests/*.test.mjs` | **175/175** 通过，详见 [VERIFICATION U](VERIFICATION.md) |
| `bash tests/smoke.sh` | 全绿 |
| `verify.ps1` / `verify.sh` | **25/25、28/28**，均包含 profile 副本检查 |
| dsh-purge rc.5 运行状态 | **70/72 已应用、0 待处理、0 漂移、2 无需处理** |
| `--no-pnpm` 更新 | 只要 profile `node_modules/dsh-purge` 存在，仍执行 `--sync-plugin` |
| 真实桌面卸载 / 官方还原 / 重装 | 1.1.2 / rc.5 发布验收结果记入 [VERIFICATION U](VERIFICATION.md)；1.1.1 补丁验收见 T 节 |

## 已知边界

- 1.0.13 的发布过程中，`--no-pnpm` 更新跳过了 profile 同步；1.0.14 修复安装器，并对本机 profile 做了同步。
- 1.0.14 修复了“外部改人格后新会话仍读旧 pin”和 `overrideStatus` 恒 `default`；旧版仍可能存在这两个现象。
- 1.0.15 已完成本轮桌面复核；本机教学样本的独立复现与证据见[公开复核报告](validation/local-web-lab-2026-10-31/README.md)，不代表模型或技能业务能力的完整验证。
- 海鸥的 rc.5 合并与人格/范围闸差异不能被 purge 原版更新覆盖；继续使用海鸥更新入口。
- `70/72` 的另外两项为 rc.5 不存在对应旧组件（#71 梁神预设身份行、#80 历史官方工具集清理），面板统一显示“无需处理”，不计为待处理或漂移。
- 历史 23 个红队技能只在 `src/skills/redteam` 作源码存档，不自动部署。
