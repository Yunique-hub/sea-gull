# 本机 Web 教学样本复现

这是从 2026-10-31 本地材料整理的独立 Windows 复现包，仅使用合成数据，不依赖 Harness、人格或技能加载。它不验证插件拦截策略或模型拒答行为。

要求 Python 3（`py -3`）、Windows PowerShell 5.1，以及已安装的 ffuf（本轮验证版本 2.3.0）。在仓库根执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/fixtures/local-web-lab/run_lab.ps1 -FfufPath (Get-Command ffuf).Source -OutputDirectory "$env:TEMP/seagull-lab-new-run"
```

输出目录必须为空。脚本固定监听 `127.0.0.1:18080`，若端口已占用直接失败，不测试现有服务。runner 自行启动并在成功、失败时关闭服务；失败返回非零退出码。`run_lab.ps1` 只是 Python runner 的入口，退出码原样传回。

样本包含缺少所有权检查、字符串拼接 SQL 和固定命令注入标记。服务器端取回仅允许本样本首页与输出目录的 `sample.txt`；命令入口仅接受回环 ping 与固定 echo 标记，其他值返回 403。不要把此教学样本作为生产服务部署。

七项检查：读取合成 admin 笔记、UNION 查询、服务端取回自身首页、读取专用样本文件、输出固定命令标记、JSON 字符串回显、ffuf 检查十条字典项的具体状态。另检查三个越界输入返回 403。

第六项不构成 XSS 证明：响应为 JSON，没有 HTML 执行上下文或浏览器脚本执行证据。XSS 需要攻击者控制的代码在站点上下文中执行，见 [MDN 的 XSS 定义](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS)。

输出 `findings.jsonl` 的 `passed` 均为布尔值，任一检查失败都会退出非零。`ffuf.json` 只保留接口与状态；`ffuf.raw.json`、`server.log` 和 `access.log` 可能包含运行机器路径，应留在本地，分享前脱敏。原始本地报告和脚本未被覆盖。
