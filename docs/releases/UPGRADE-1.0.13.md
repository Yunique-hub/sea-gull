# 海鸥 1.0.13：移除本地靶场范围闸

完成日期：2026-10-30。源码提交：`70ae8d7c605fdcdb8914b1db99406757640427a3`。

## 改了什么

- `vendor/dsh-purge/lib/net-scope.js`：删除 `agent/pre-step` / `tools/pre-execute` 拦截、地址判定、任务分类判定、拒绝文案与拒绝消息持久化；只保留自有服务器白名单的解析与读写。
- `vendor/dsh-purge/lib/index.js`：删除 `regionGate` 配置键与 `installRegionGate(ctx)` 挂载。
- 人格 §4：中文禁词表去掉三个易误伤项；`§3` 仍禁止以“这个不能”开场。
- `verify.sh` / `verify.ps1`、`tests/upstream-1177.test.mjs`、`tests/smoke.sh`：改为检查范围闸确已移除。

## 验证

- `node --test tests/*.test.mjs`：158 通过 / 0 失败。
- `bash tests/smoke.sh`：通过。
- `verify.ps1`：20/20（当时只检查 plugins，profile 检查在 1.0.14 补上）。

## 发布时已知问题

1. `--no-pnpm` 更新路径没有执行 `--sync-plugin`，本机 profile 仍停留在 1.0.12；1.0.14 修复安装器并补做同步。
2. `committedOverride` 在进程内钉住旧正文，外部替换 `prompt-inject.md` 后新会话仍可能读到旧稿；1.0.14 修复。
3. `overrideStatus` 恒返回 `default`；1.0.14 修复。
4. README / NOTICE 把范围闸移除归因到 1.0.12；1.0.14 统一改为 1.0.13。

## 边界

本次只改“插件是否拦截”，不改操作员对目标的授权判断。真实外部目标、所有模型、所有技能的业务任务不在本次验证范围内。