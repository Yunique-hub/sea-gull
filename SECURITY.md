# 安全策略

## 报告漏洞

**不要**开公开 issue。用 GitHub 的
[Private vulnerability reporting](https://github.com/Yunique-hub/sea-gull/security/advisories/new)，
或在 issue 里只写"需要私下联系"。

请包含：影响版本、复现步骤、预期与实际、影响面判断。

## 本项目的安全模型（重要）

这个项目**主动移除宿主策略层**，所以它的安全责任边界必须说清楚：

| 项 | 说明 |
|---|---|
| 作用域 | 只对**你自己机器上、你自己装的** DeepSeek Harness 生效 |
| 不改上游包 | 只改本机 `resources/app` 下的宿主文件与 `$DSH_HOME` 下的配置 |
| 不外联 | 安装器访问本仓库的 GitHub tarball；环境适配只下载固定官方发布文件并校验 SHA-256；不主动向第三方目标发包 |
| 可回滚 | `install.sh --uninstall`；原始 `app.asar` 从不修改，可完整还原 |
| 备份 | profile `package.json` 写 `.bak-seagull`；注入文件与规则集写时间戳备份 |

## 使用者责任

1. **你自己的机器**：装完等于把审批门与沙箱围栏拆了，模型执行命令不再要你确认。
   别在存着生产凭据的机器上无脑装。
2. **模型输出不可盲信**：宿主层放行 ≠ 输出正确。它跑出来的东西要自己核。
3. **法律边界**：针对真实第三方生产系统的未授权入侵、欺诈取数（薅积分/兑换礼品/
   白拿实物）由《刑法》《网络安全法》《数据安全法》《个人信息保护法》划定，
   本项目不提供、也不因"目标默认自有"的假设而豁免这类用法。
4. **上游条款**：`vendor/dsh-purge/` 的许可与署名以 `vendor/dsh-purge/LICENSE`、`LICENSE-COMMERCIAL.md` 和根 `NOTICE` 为准。海鸥自身按根 `LICENSE` 分发；历史技能保留各自 MIT 许可。商业使用前请自行核对上游条款与署名要求。

## 供应链

- 安装器不执行远程脚本（管道模式下载的是本仓库 tarball，解包后跑本地文件）
- 无 postinstall 钩子，无二进制分发
- `vendor/` 与上游 1.1.82 的差异在 `NOTICE` 中逐条列出（104 个 blob：76 一致 / 17 差异 / 11 图片不分发），便于复核
