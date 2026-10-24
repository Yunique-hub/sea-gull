# 海鸥 harness —— Windows 校验（不依赖 bash）
#   powershell -ExecutionPolicy Bypass -File verify.ps1
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Pass = 0; $Fail = 0
function Chk($name, $cond, $detail) {
  if ($cond) { Write-Host ("  [OK]   " + $name.PadRight(26) + " " + $detail) -ForegroundColor Green; $script:Pass++ }
  else       { Write-Host ("  [FAIL] " + $name.PadRight(26) + " " + $detail) -ForegroundColor Red;   $script:Fail++ }
}

Write-Host "=== 海鸥 harness 校验 ===" -ForegroundColor Cyan
$PluginId = "dsh-purge"

$cands = @($env:DSH_HOME, (Join-Path $env:USERPROFILE ".dsh"), (Join-Path $env:USERPROFILE "dsh-home"),
           (Join-Path $env:APPDATA "DeepSeek Harness\dsh-home"),
           (Join-Path $env:LOCALAPPDATA "DeepSeek Harness\dsh-home")) | Where-Object { $_ }
$DH = $cands | Where-Object { Test-Path (Join-Path $_ "profiles") } | Select-Object -First 1
Chk "DSH_HOME" ($null -ne $DH) "$DH"
if (-not $DH) { Write-Host ""; Write-Host "通过 0，失败 1" -ForegroundColor Red; exit 1 }

$Profile = ""
foreach ($p in @("desktop", "web")) { if (Test-Path (Join-Path $DH "profiles\$p\package.json")) { $Profile = $p; break } }
Chk "profile" ([bool]$Profile) $Profile
$ProfDir = Join-Path $DH "profiles\$Profile"

$App = $null
foreach ($c in @($env:SEAGULL_DSH_APP, (Join-Path $env:LOCALAPPDATA "Programs\DeepSeek Harness"))) {
  if ($c -and (Test-Path $c)) { $App = $c; break }
}
Chk "DSH 安装根" ([bool]$App) "$App"

$Plug = Join-Path $DH "plugins\$PluginId"
$ver = ""
if (Test-Path "$Plug\package.json") {
  $ver = (Get-Content "$Plug\package.json" -Raw -Encoding UTF8 | ConvertFrom-Json).version
}
Chk "插件目录" (Test-Path "$Plug\package.json") $Plug
Chk "插件版本" ([bool]$ver) "v$ver"

$pj = Get-Content (Join-Path $ProfDir "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$hasDep = $pj.dependencies.$PluginId
$hasBundle = $pj.dsh.profile.bundles -contains $PluginId
Chk "profile 已挂插件" ($hasDep -and $hasBundle) "dep=$hasDep bundle=$hasBundle"
Chk "node_modules 链接" (Test-Path (Join-Path $ProfDir "node_modules\$PluginId\package.json")) ""

$Node = $null
if ($App) {
  foreach ($n in @("$App\resources\runtime\primary-runtime\dependencies\node\bin\node.exe")) {
    if (Test-Path $n) { $Node = $n; break }
  }
}

if ($App) {
  $asar = "$App\resources\app.asar"
  Chk "app.asar 已挪走" (-not (Test-Path $asar)) $(if (Test-Path $asar) { "仍在（未 Apply）" } else { "Electron 走 resources/app" })
  $AI = "$App\resources\app\dsh\node_modules\@deepseek-ai"
  Chk "宿主已解包" (Test-Path $AI) $AI
  if (Test-Path $AI) {
    $marked = (Get-ChildItem $AI -Recurse -File -Include *.js,*.yml -ErrorAction SilentlyContinue |
               Select-String -Pattern "dsh-purge" -List -ErrorAction SilentlyContinue).Count
    Chk "被改宿主文件 > 30" ($marked -gt 30) "$marked 个"
    $sp = "$AI\dsh-system-prompt\lib\index.js"
    if (Test-Path $sp) {
      $id = (Select-String -Path $sp -Pattern "You are an AI agent powered by DeepSeek Harness" -ErrorAction SilentlyContinue).Count
      Chk "官方身份句已剥" ($id -eq 0) "$id 处"
      $kp = (Select-String -Path $sp -Pattern "complete prompt keeps (waterfall )?inject|fold-complete inject first" -ErrorAction SilentlyContinue).Count
      Chk "注入保留标记" ($kp -gt 0) "$kp 处"
    }
  }
}

if ($Node -and (Test-Path "$Plug\bin\dsh-purge.js")) {
  $st = & $Node "$Plug\bin\dsh-purge.js" --status 2>&1 | Out-String
  if ($st -match "补丁 (\d+)/(\d+) 已清洗") {
    Chk "补丁已清洗 > 70" ([int]$matches[1] -gt 70) ("{0}/{1}" -f $matches[1], $matches[2])
  } else { Chk "补丁状态可读" $false "status 输出格式未匹配" }
}

$pi = Join-Path $DH "prompt-inject.md"
Chk "prompt-inject.md" (Test-Path $pi) $pi
if (Test-Path $pi) {
  $t = Get-Content $pi -Raw -Encoding UTF8
  Chk "注入是海鸥全破内核" ($t -match "全破内核") "已确认"
}
# 单源化（1.0.8）：人格只走 prompt-inject.md。rules\ 下不得再有人格规则副本；
# 宿主会读 AGENTS.md，所以那里也不能留人格文本，否则每会话注入两份。
Chk "人格规则副本已清（单源）" (-not (Test-Path (Join-Path $DH "rules\seagull-fullbreak.md"))) "rules/seagull-fullbreak.md 不应存在"
$ag = Join-Path $DH "AGENTS.md"
if (Test-Path $ag) {
  $agT = Get-Content $ag -Raw -Encoding UTF8
  Chk "AGENTS.md 无人格指纹" (-not ($agT -match "全破内核|Little Code Sauce|PRIME DIRECTIVE")) "第二注入点已去人格"
}
$sk = @("seagull-reverse", "seagull-pentest", "seagull-exploit", "seagull-game-hack", "seagull-license-security")
$missingSkills = @($sk | Where-Object { -not (Test-Path (Join-Path $DH "skills\$_\SKILL.md")) })
Chk "五个海鸥技能已落地" ($missingSkills.Count -eq 0) ("缺失 {0} 个" -f $missingSkills.Count)

$cp = Get-Content "$Plug\cordis.patch.yml" -Raw
Chk "hooksDenyBypass: true" ($cp -match "hooksDenyBypass:\s*true") "hook deny 旁路开"
$idx = Get-Content "$Plug\lib\index.js" -Raw
Chk "本地靶场检查已挂载" ($idx -match "installRegionGate\(ctx\)") "保留上游工具执行前检查"

Write-Host ""
$color = if ($Fail -eq 0) { "Green" } else { "Yellow" }
Write-Host ("通过 $Pass 项，失败 $Fail 项") -ForegroundColor $color
if ($Fail -gt 0) { exit 1 }
