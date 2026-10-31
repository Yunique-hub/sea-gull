# 海鸥 1.0.15：面板文案、双版本显示与空项目名反馈

完成日期：2026-10-31。基线：1.0.14 / `04bddcc`。

## 修复

### 面板本地靶场文案

`vendor/dsh-purge/client.js` 的 `own.hint` 不再写“开源版攻击任务只放行本机/内网 IP”。新文案：

> 插件不再按目标地址或任务类别拦截；这里只维护自有服务器名单，用于记录/展示，不参与放行判定。

这解决桌面记录里“面板仍显示旧说明，与维护文档行为不一致”的问题。名单仍然可读写，但不参与放行判定。

### 面板双版本

- `core.gatherState()` 增加 `seagull_version`（读取 vendor `package.json` 的 `seagull.version`）。
- 面板顶部改为“海鸥 v1.0.15 · purge v1.1.82”，不再只显示 purge 版本。
- `purge_status` 增加 `海鸥版本 / seagull` 行。

### 空项目名可见错误

`client.js` 项目创建函数原先是：

```js
if (!name || creating) return
```

空名静默返回，用户看不到提示。现在：

```js
if (!name) { setErr('项目名称不能为空'); return }
if (creating) return
```

后端 `store-core.js` 仍负责最终校验；前端补上可见错误。

## 验证

- `node --test tests/*.test.mjs`：**167 pass / 0 fail**。
- `bash tests/smoke.sh`：全绿。
- `verify.ps1` / `verify.sh`：通过（含 profile 检查）。
- 新增 `tests/redteam-projects.test.mjs` 空项目名可见错误用例。
- `tests/docs-consistency.test.mjs` 锁定：面板不得再出现旧文案，必须包含 `channel.seagull` / `seagull_version`，`index.js` 必须包含“海鸥版本 / seagull”。

## 部署

```powershell
cd E:\codex_my_project\海鸥
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Update -NoPnpm -Profile desktop
```

然后完全退出并重开 DeepSeek Harness，打开清洗面板确认：

1. 顶部显示海鸥 1.0.15 和 purge 1.1.82。
2. “本地靶场”说明不再出现“只放行本机/内网 IP”。
3. 新建项目留空提交，看到“项目名称不能为空”。

## 边界

- 本次只改 UI 文案、版本展示和前端校验反馈；不改变目标范围策略，也不恢复任何拦截。
- 真实桌面重启确认待操作员执行；自动化结果不替代桌面结论。