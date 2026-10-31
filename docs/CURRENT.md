# 当前状态

本页只记录“现在是什么状态”。历史版本、评审过程和早期设计见 [文档索引](README.md)。

## 版本与依赖

| 项 | 当前值 |
|---|---|
| 海鸥 | **1.0.15** |
| 官方 Harness | 0.2.1-rc.3（Windows 桌面） |
| dsh-purge | 1.1.82（固定上游 `6318442a88ea7459d0135d0a07f31776c5d6a7b1`） |
| AgentTeams | 0.1.26 |
| 插件市场 | plugin 0.4.16 / core 0.4.13 |
| 补丁定义 | **88**（`ALL_PATCHES` 实测，id 不连续） |

## 运行副本

实际加载副本：`$DSH_HOME/profiles/<profile>/node_modules/dsh-purge`。源：`$DSH_HOME/plugins/dsh-purge`。

| 文件 | 期望 |
|---|---|
| `package.json` → `seagull.version` | 1.0.15 |
| `lib/net-scope.js` | SHA-256 前 16 位 `0CCA874540F5D11C`，约 6,027B |
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
| `node --test tests/*.test.mjs` | **167 pass / 0 fail**（2026-10-31） |
| `bash tests/smoke.sh` | 全绿 |
| `verify.ps1` / `verify.sh` | **25/25、28/28**，均包含 profile 副本检查 |
| `--no-pnpm` 更新 | 只要 profile `node_modules/dsh-purge` 存在，仍执行 `--sync-plugin` |
| 真实桌面点击 / 重启 | 2026-10-31 已执行 1.0.14 重启、问候、项目、Steer/Queue、市场和须知场景；1.0.15 面板文案/双版本/空名校验待重启后确认。未覆盖项见[客户端验证补充](releases/DESKTOP-1.0.14-2026-10-31.md)，不代表发布清单全部通过 |

## 已知边界

- 1.0.13 的发布过程中，`--no-pnpm` 更新跳过了 profile 同步；1.0.14 修复安装器，并对本机 profile 做了同步。
- 1.0.14 修复了“外部改人格后新会话仍读旧 pin”和 `overrideStatus` 恒 `default`；旧版仍可能存在这两个现象。
- 1.0.15 修正面板旧文案、增加海鸥/purge 双版本显示、空项目名可见错误；真实桌面重启确认待执行。
- 上游只声明支持 rc.2；rc.3 适配属于海鸥定制，不能用原版更新覆盖。
- 历史 23 个红队技能只在 `src/skills/redteam` 作源码存档，不自动部署。