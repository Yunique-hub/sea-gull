# 上游署名 / Upstream attribution

本目录是 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 的快照。

- 版本：1.1.71（master 分支，2026-10-12）
- 作者：小杨（YuJunZhiXue）
- 许可：MIT，Copyright (c) 2026 小杨 —— 全文见同目录 `LICENSE`

## 本仓库对它的全部改动（仅 3 处）

1. `lib/index.js` — `DEFAULTS` 新增 `regionGate: true`
2. `lib/index.js` — `applyHostHooks()` 中 `installRegionGate(ctx)` 改为
   `if (cfg.regionGate !== false) installRegionGate(ctx);`
3. `cordis.patch.yml` — 增加 `regionGate: false`，`autoApplyOnStart` 改为 `true`

其余文件与上游逐字节一致。

## 上游的使用条款声明

上游 README 写明：非营利公开项目，禁止商业销售、付费转售、以及从非法或灰产活动中获利；
**二开必须署名并指明来源仓库**。

MIT 许可本身允许商用与再分发，但本仓库尊重上游意愿，按**非营利**项目分发，
并在根目录 `NOTICE`、`README`、`SECURITY.md` 中保留完整署名。

若你要商业使用本目录下的代码，请先联系上游作者取得明确同意。

## 上游已知状态

上游 README 声明「维护暂停」（作者无稳定收入，暂停更新，不接 issue/PR）。
本项目按 1.1.71 快照固定；上游恢复维护或 dsh 升级导致锚点不匹配时，
未匹配的补丁会显示 skipped / pending，不会盲写。
