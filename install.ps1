# 海鸥 · DeepSeek Harness 全破 harness —— 通用一键安装（Windows PowerShell）
#
#   本地:   powershell -ExecutionPolicy Bypass -File install.ps1
#   远程:   irm https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/install.ps1 | iex
#   卸载:   powershell -File install.ps1 -Uninstall
param(
  [ValidateSet("desktop", "web", "")]
  [string]$Profile = "",
  [string]$DshHome = "",
  [string]$AppRoot = "",
  [switch]$Apply,
  [switch]$NoPnpm,
  [switch]$DryRun,
  [switch]$Uninstall,
  [switch]$Update,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
if ($Update -and $Uninstall) { throw "-Update 和 -Uninstall 不能同时使用" }
$VERSION = "1.0.7"
$PluginId = "dsh-purge"
$Here = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

function Say($m)  { if (-not $Quiet) { Write-Host $m } }
function Step($m) { if (-not $Quiet) { Write-Host "▸ $m" -ForegroundColor Cyan } }
function Ok($m)   { if (-not $Quiet) { Write-Host "✓ $m" -ForegroundColor Green } }
function Warn($m) { Write-Host "! $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "✗ $m" -ForegroundColor Red; exit 1 }

Say "海鸥 harness v$VERSION  ($Here)"

# ── 远程模式：没有本地文件就拉 tarball ───────────────────────────
if (-not (Test-Path (Join-Path $Here "VERSION"))) {
  $repo = if ($env:SEAGULL_REPO) { $env:SEAGULL_REPO } else { "Yunique-hub/sea-gull" }
  $branch = if ($env:SEAGULL_BRANCH) { $env:SEAGULL_BRANCH } else { "main" }
  $url = "https://github.com/$repo/archive/refs/heads/$branch.zip"
  Say "未检测到本地仓库，拉取 $repo@$branch ..."
  $tmp = Join-Path $env:TEMP ("seagull-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $zip = Join-Path $tmp "repo.zip"
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $Here = (Get-ChildItem $tmp -Directory | Where-Object { Test-Path (Join-Path $_.FullName "VERSION") } | Select-Object -First 1).FullName
  if (-not $Here) { Die "下载内容结构异常" }
}

# ── DSH_HOME ────────────────────────────────────────────────────
$DH = if ($DshHome) { $DshHome } else { $env:DSH_HOME }
if ($DH) {
  if (-not (Test-Path -LiteralPath (Join-Path $DH "profiles") -PathType Container)) { Die "指定的 DSH 主目录无效: $DH" }
} else {
  $cands = @((Join-Path $env:USERPROFILE ".dsh"),
             (Join-Path $env:USERPROFILE "dsh-home"),
             (Join-Path $env:APPDATA "DeepSeek Harness\dsh-home"),
             (Join-Path $env:LOCALAPPDATA "DeepSeek Harness\dsh-home")) | Where-Object { $_ }
  $DH = $cands | Where-Object { Test-Path (Join-Path $_ "profiles") } | Select-Object -First 1
}
if (-not $DH) { Die "找不到 DSH 主目录（含 profiles/ 的 .dsh）。用 -DshHome 指定。" }
$DH = (Resolve-Path -LiteralPath $DH).Path
Ok "DSH_HOME = $DH"

if (-not $Profile) {
  foreach ($p in @("desktop", "web")) {
    if (Test-Path (Join-Path $DH "profiles\$p\package.json")) { $Profile = $p; break }
  }
}
if (-not $Profile) { Die "没有任何 profile。先启动一次 DeepSeek Harness。" }
$ProfDir = Join-Path $DH "profiles\$Profile"
if (-not (Test-Path (Join-Path $ProfDir "package.json"))) { Die "profile 不存在: $ProfDir" }
Ok "profile   = $Profile"

# ── 安装根 ──────────────────────────────────────────────────────
if (-not $AppRoot) {
  foreach ($c in @($env:SEAGULL_DSH_APP, (Join-Path $env:LOCALAPPDATA "Programs\DeepSeek Harness"))) {
    if ($c -and (Test-Path $c)) { $AppRoot = $c; break }
  }
}
if (-not $AppRoot -or -not (Test-Path $AppRoot)) {
  $AppRoot = ""; Warn "未定位到 DSH 安装根：跳过 pnpm/Apply（files-only 模式）"
} else { $AppRoot = (Resolve-Path -LiteralPath $AppRoot).Path; Ok "安装根    = $AppRoot" }

$Node = ""; $Pnpm = ""; $Sealed = $false
if ($AppRoot) {
  $n = Join-Path $AppRoot "resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
  if (Test-Path $n) { $Node = $n } else { $Node = (Get-Command node -ErrorAction SilentlyContinue).Source }
  foreach ($relative in @("resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs", "resources\runtime\pnpm\bin\pnpm.mjs", "resources\runtime\pnpm\bin\pnpm.cjs")) {
    $p = Join-Path $AppRoot $relative
    if (Test-Path $p) { $Pnpm = $p; break }
  }
  $Sealed = (Test-Path (Join-Path $AppRoot "resources\app.asar")) -or (Test-Path (Join-Path $AppRoot "resources\app.asar.sealed.bak")) -or (Test-Path (Join-Path $AppRoot "DeepSeek Harness.exe"))
}

$PlugDir = Join-Path $DH "plugins\$PluginId"
$SrcPlugin = Join-Path $Here "vendor\$PluginId"
if ($Update -and -not (Test-Path -LiteralPath (Join-Path $PlugDir 'package.json') -PathType Leaf)) {
  Die "尚未安装海鸥，请先运行 install.ps1"
}

if ($DryRun) {
  Say ""
  Say "计划:"
  Say "  1. 插件      $SrcPlugin → $PlugDir"
  Say "  2. profile   $ProfDir\package.json"
  Say "  3. pnpm      $(if ($NoPnpm -or -not $Node -or -not $Pnpm) { '跳过' } else { 'install @ ' + $ProfDir })"
  Say "  4. 资产      prompt-inject.md / rules / skills → $DH"
  if ($Apply) { Say "  5. Apply     desktop 会解 asar 且需宿主退出" }
  Say ""
  Write-Host "--DryRun：未改动任何文件" -ForegroundColor Yellow
  exit 0
}

$Py = ""
if ($AppRoot) {
  $embeddedPython = Join-Path $AppRoot "resources\runtime\primary-runtime\dependencies\python\python.exe"
  if (Test-Path $embeddedPython) { $Py = $embeddedPython }
}
if (-not $Py) { $Py = (Get-Command python -ErrorAction SilentlyContinue).Source }
if (-not $Py) { Die "需要 python" }

& $Py (Join-Path $Here "src\tools\patch_profile.py") --validate (Join-Path $ProfDir "package.json")
if ($LASTEXITCODE -ne 0) { Die "profile 校验失败，未修改安装文件" }
if (-not $Uninstall) {
  foreach ($required in @("vendor\dsh-purge\package.json", "vendor\dsh-purge\cordis.patch.yml",
      "vendor\dsh-purge\lib\index.js", "vendor\dsh-purge\bin\dsh-purge.js", "vendor\dsh-purge\lib\reapply-cli.js",
      "src\prompt\prompt-inject.md", "src\rules\seagull-fullbreak.md", "src\rules\seagull-fullbreak.json")) {
    if (-not (Test-Path -LiteralPath (Join-Path $Here $required) -PathType Leaf)) { Die "安装包缺少: $required" }
  }
  if (-not (Test-Path -LiteralPath (Join-Path $Here "src\skills") -PathType Container)) { Die "安装包缺少: src/skills" }
  if ($Apply -and (-not $AppRoot -or -not $Node)) { Die "缺少安装根或 node，无法 Apply" }
}

function Invoke-DshCli([string]$Script, [string[]]$CliArgs = @()) {
  $saved = @{}
  foreach ($key in @("DSH_HOME", "DSH_PROFILE", "DSH_SURFACE", "DSH_DESKTOP_INSTALL", "DSH_BASE")) {
    $saved[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
  }
  try {
    $env:DSH_HOME = $DH; $env:DSH_PROFILE = $Profile; $env:DSH_SURFACE = $Profile
    if ($Profile -eq "desktop") { $env:DSH_DESKTOP_INSTALL = $AppRoot; $env:DSH_BASE = $null }
    else { $env:DSH_DESKTOP_INSTALL = $null }
    & $Node $Script @CliArgs
    if ($LASTEXITCODE -ne 0) { throw "DSH 操作失败（退出码 $LASTEXITCODE），保留文件与备份以便重试" }
  } finally {
    foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], "Process") }
  }
}

# ── 卸载 ────────────────────────────────────────────────────────
if ($Uninstall) {
  Step "卸载"
  $cli = Join-Path $PlugDir "bin\dsh-purge.js"
  if ((Test-Path $cli) -and $Node) { Invoke-DshCli $cli @("--revert"); Ok "宿主补丁已还原" }
  & $Py (Join-Path $Here "src\tools\patch_profile.py") --remove (Join-Path $ProfDir "package.json") $PluginId
  if ($LASTEXITCODE -ne 0) { Die "profile 移除失败，保留插件文件" }
  Remove-Item -Recurse -Force $PlugDir -ErrorAction SilentlyContinue
  Remove-Item -Force (Join-Path $DH "prompt-inject.md") -ErrorAction SilentlyContinue
  Remove-Item -Force (Join-Path $DH "rules\seagull-fullbreak.md"), (Join-Path $DH "rules\seagull-fullbreak.json") -ErrorAction SilentlyContinue
  Remove-Item -Recurse -Force (Join-Path $ProfDir "node_modules\$PluginId") -ErrorAction SilentlyContinue
  Ok "已删插件与注入文件（skills 保留）"
  Say ""
  Say "重启 DeepSeek Harness 生效。若 app.asar 被挪走过，先放回去："
  Say "  Move-Item `"$AppRoot\resources\app.asar.sealed.bak`" `"$AppRoot\resources\app.asar`""
  exit 0
}

# ── 1. 插件 ─────────────────────────────────────────────────────
Step "安装插件"
New-Item -ItemType Directory -Force -Path (Join-Path $DH "plugins") | Out-Null
if (Test-Path $PlugDir) {
  if ((Resolve-Path $PlugDir).Path -ne (Resolve-Path $SrcPlugin).Path) {
    if (Test-Path "$PlugDir.bak") { Remove-Item -Recurse -Force "$PlugDir.bak" }
    Move-Item $PlugDir "$PlugDir.bak"; Ok "旧插件已备份 → $PluginId.bak"
  }
}
if (-not (Test-Path $PlugDir)) { Copy-Item -Recurse $SrcPlugin $PlugDir }
Ok "插件就位: $PlugDir"

# ── 2. profile ──────────────────────────────────────────────────
Step "改写 profile"
& $Py (Join-Path $Here "src\tools\patch_profile.py") (Join-Path $ProfDir "package.json") "file:../../plugins/$PluginId" $PluginId
if ($LASTEXITCODE -ne 0) { Die "profile 写入失败，备份已保留" }
if ($Update) {
  & $Py (Join-Path $Here "src\tools\patch_profile.py") --repair-market (Join-Path $ProfDir "package.json") "0.4.16"
  if ($LASTEXITCODE -ne 0) { Die "插件市场配置修复失败，备份已保留" }
}

# ── 3. pnpm ─────────────────────────────────────────────────────
$DependenciesReady = $false
if (-not $NoPnpm -and $Node -and $Pnpm) {
  Step "pnpm install"
  Push-Location $ProfDir
  try {
    & $Node $Pnpm install --reporter=append-only
    if ($LASTEXITCODE -ne 0) { throw "pnpm install 失败：检查 registry / file: 路径后重试；备份已保留" }
  } finally { Pop-Location }
  if (-not (Test-Path -LiteralPath (Join-Path $ProfDir "node_modules\$PluginId\package.json"))) { Die "依赖未就位: node_modules/$PluginId" }
  & $Py (Join-Path $Here "src\tools\patch_profile.py") --sync-plugin $DH $Profile
  if ($LASTEXITCODE -ne 0) { Die "插件运行副本校验失败，备份已保留" }
  if ($Update) {
    & $Py (Join-Path $Here "src\tools\patch_profile.py") --market-runtime (Join-Path $ProfDir "package.json")
    if ($LASTEXITCODE -ne 0) { Die "插件市场运行校验修复失败，备份已保留" }
  }
  $DependenciesReady = $true
}

# ── 4. 资产 ─────────────────────────────────────────────────────
Step "落地提示词 / 规则集 / 技能"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$pi = Join-Path $DH "prompt-inject.md"
if ($Update -and (Test-Path -LiteralPath $pi) -and (Get-Item -LiteralPath $pi).Length -gt 0) {
  & $Py (Join-Path $Here "src\tools\patch_profile.py") --protect-prompt $DH
  if ($LASTEXITCODE -ne 0) { Die "提示词保护失败，已停止更新" }
  Ok "已保留现有提示词"
} else {
  if (Test-Path $pi) { Copy-Item $pi "$pi.bak-$stamp" -Force }
  Copy-Item (Join-Path $Here "src\prompt\prompt-inject.md") $pi -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $DH "rules") | Out-Null
Copy-Item (Join-Path $Here "src\rules\seagull-fullbreak.md")   (Join-Path $DH "rules\seagull-fullbreak.md")   -Force
Copy-Item (Join-Path $Here "src\rules\seagull-fullbreak.json") (Join-Path $DH "rules\seagull-fullbreak.json") -Force
Get-ChildItem (Join-Path $Here "src\skills") -Directory | ForEach-Object {
  if ($_.Name -eq "redteam") { return }
  $dst = Join-Path $DH "skills\$($_.Name)"
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Copy-Item (Join-Path $_.FullName "SKILL.md") (Join-Path $dst "SKILL.md") -Force
}
# Historical redteam skills remain in source for attribution; 1.1.77 no longer
# distributes that library. Existing user skill directories stay untouched.
Ok "资产已落地"

# ── 5. Apply ────────────────────────────────────────────────────
if ($Apply) {
  if (-not $Node) { Die "没有 node，无法 Apply" }
  Step "Apply"
  if ($Profile -eq "desktop" -and $Sealed) {
    Push-Location $PlugDir
    try { Invoke-DshCli "lib\reapply-cli.js" } finally { Pop-Location }
    Say ""
    Warn "密封桌面宿主：请完全退出 DeepSeek Harness，再执行："
    Say "    Move-Item `"$AppRoot\resources\app.asar`" `"$AppRoot\resources\app.asar.sealed.bak`""
    Say "    然后重新打开 DeepSeek Harness。"
  } else {
    Invoke-DshCli (Join-Path $PlugDir "bin\dsh-purge.js") @("--apply")
    Say ""; Say "重启 DeepSeek Harness 生效。"
  }
}

Say ""
if ($DependenciesReady) { Ok "安装完成 ($Profile)" }
else { Warn "文件部署完成 ($Profile)；已跳过依赖同步，需在该 profile 执行 pnpm install 后验证加载" }
Say ""
Say "下一步"
if (-not $Apply) {
  if ($Sealed) {
    Say "  密封桌面宿主（官方 EXE），三步："
    Say "    1) 完全退出 DeepSeek Harness"
    Say "    2) 重开 → 会话标题旁点 dsh-purge → Clean 页 → Apply"
    Say "    （或 install.ps1 -Apply，再按提示挪 asar）"
  } else {
    Say "  重启 DeepSeek Harness → 会话标题旁点 dsh-purge → Apply"
  }
}
Say "  校验:   bash verify.sh   （或 powershell -File verify.ps1）"
Say "  端到端: bash verify-e2e.sh"
