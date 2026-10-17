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
      $kp = (Select-String -Path $sp -Pattern "complete prompt keeps inject" -ErrorAction SilentlyContinue).Count
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
Chk "规则集" (Test-Path (Join-Path $DH "rules\seagull-fullbreak.md")) "rules/seagull-fullbreak.md"
$sk = @()
if (Test-Path (Join-Path $DH "skills")) { $sk = Get-ChildItem (Join-Path $DH "skills") -Directory }
Chk "技能已落地 >= 6" ($sk.Count -ge 6) ("{0} 个目录" -f $sk.Count)

$cp = Get-Content "$Plug\cordis.patch.yml" -Raw
Chk "regionGate: false" ($cp -match "regionGate:\s*false") "地域闸门已关"
Chk "hooksDenyBypass: true" ($cp -match "hooksDenyBypass:\s*true") "hook deny 旁路开"
$idx = Get-Content "$Plug\lib\index.js" -Raw
Chk "index.js 开关" ($idx -match "cfg\.regionGate !== false") "代码级开关存在"

Write-Host ""
$color = if ($Fail -eq 0) { "Green" } else { "Yellow" }
Write-Host ("通过 $Pass 项，失败 $Fail 项") -ForegroundColor $color
if ($Fail -gt 0) { exit 1 }
