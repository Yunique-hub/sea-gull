param(
  [Parameter(Mandatory = $true)][string]$AppRoot,
  [switch]$PrepareOnly,
  [switch]$StartOfficialOnly,
  [switch]$ValidateRestoreOnly,
  [switch]$RestoreOfficial
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$root = [IO.Path]::GetFullPath($AppRoot).TrimEnd('\')
$exe = Join-Path $root "DeepSeek Harness.exe"
$resources = Join-Path $root "resources"
$asar = Join-Path $resources "app.asar"
$appDir = Join-Path $resources "app"
$pending = "$asar.rename-pending"
$sealedBak = "$asar.sealed.bak"

if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw "找不到桌面程序: $exe" }
$selectedModes = @($PrepareOnly, $StartOfficialOnly, $ValidateRestoreOnly, $RestoreOfficial) | Where-Object { $_ }
if ($selectedModes.Count -gt 1) { throw "桌面生命周期模式不能同时使用" }

$resourcesPrefix = [IO.Path]::GetFullPath($resources).TrimEnd('\') + '\'
$appFull = [IO.Path]::GetFullPath($appDir)
if (-not $appFull.StartsWith($resourcesPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "拒绝操作安装根之外的展开目录: $appFull"
}

function Assert-OfficialRestoreReady {
  if (-not (Test-Path -LiteralPath $asar -PathType Leaf) -and -not (Test-Path -LiteralPath $sealedBak -PathType Leaf)) {
    throw "找不到官方 app.asar 或密封备份: $resources"
  }
  if (Test-Path -LiteralPath $appDir -PathType Container) {
    $item = Get-Item -LiteralPath $appDir -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "拒绝递归清理链接形式的 resources\app: $appDir"
    }
  }
}

if ($ValidateRestoreOnly) {
  Assert-OfficialRestoreReady
  Write-Output "已确认官方密封包可用于一键卸载还原"
  exit 0
}

$rootPrefix = $root + '\'
function Get-InstallProcesses {
  @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    if (-not $_.ExecutablePath) { return $false }
    $ep = [IO.Path]::GetFullPath([string]$_.ExecutablePath)
    $ep.Equals($exe, [StringComparison]::OrdinalIgnoreCase) -or
      $ep.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)
  })
}

foreach ($proc in (Get-InstallProcesses)) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}
$deadline = (Get-Date).AddSeconds(15)
do {
  Start-Sleep -Milliseconds 250
  $holding = @(Get-InstallProcesses)
  foreach ($proc in $holding) { Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue }
} while ($holding.Count -gt 0 -and (Get-Date) -lt $deadline)
if ($holding.Count -gt 0) { throw "无法完全退出本安装根的 DeepSeek Harness，未执行换包" }

if ($PrepareOnly) {
  if (-not (Test-Path -LiteralPath $asar -PathType Leaf) -and (Test-Path -LiteralPath $sealedBak -PathType Leaf)) {
    Move-Item -LiteralPath $sealedBak -Destination $asar
  }
  if (-not (Test-Path -LiteralPath $asar -PathType Leaf) -and -not (Test-Path -LiteralPath $appDir -PathType Container)) {
    throw "既没有官方 app.asar，也没有已解包宿主: $resources"
  }
  Remove-Item -LiteralPath $pending -Force -ErrorAction SilentlyContinue
  Write-Output "已退出 DeepSeek Harness，并准备好官方宿主基线"
  exit 0
}

if ($StartOfficialOnly) {
  if (-not (Test-Path -LiteralPath $asar -PathType Leaf)) { throw "找不到可回退启动的官方密封包: $asar" }
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Start-Process -FilePath $exe
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 500
    $started = @(Get-InstallProcesses).Count -gt 0
  } while (-not $started -and (Get-Date) -lt $deadline)
  if (-not $started) { throw "官方桌面程序回退启动失败" }
  Write-Output "补丁应用失败，已回退启动官方密封包"
  exit 0
}

if ($RestoreOfficial) {
  Assert-OfficialRestoreReady
  if (-not (Test-Path -LiteralPath $asar -PathType Leaf)) {
    Move-Item -LiteralPath $sealedBak -Destination $asar
    Write-Output "已恢复官方 resources\app.asar"
  }
  Remove-Item -LiteralPath $pending -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $appDir -PathType Container) {
    Remove-Item -LiteralPath $appDir -Recurse -Force
    Write-Output "已清理海鸥补丁展开目录 resources\app"
  }
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Start-Process -FilePath $exe

  $officialStarted = $false
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 500
    $officialStarted = @(Get-InstallProcesses | Where-Object {
      $_.CommandLine -and $_.CommandLine.IndexOf("resources\app.asar", [StringComparison]::OrdinalIgnoreCase) -ge 0
    }).Count -gt 0
  } while (-not $officialStarted -and (Get-Date) -lt $deadline)
  if (-not $officialStarted) { throw "官方桌面程序已启动，但未确认它加载 resources\app.asar" }
  Write-Output "已确认 DeepSeek Harness 从官方 resources\app.asar 重新启动"
  exit 0
}

if (-not (Test-Path -LiteralPath $appDir -PathType Container)) { throw "找不到已解包宿主: $appDir" }
$moved = $false
try {
  if (Test-Path -LiteralPath $asar -PathType Leaf) {
    if (Test-Path -LiteralPath $sealedBak) {
      $archive = "$sealedBak.previous-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
      Move-Item -LiteralPath $sealedBak -Destination $archive
      Write-Output "已归档旧密封备份: $archive"
    }
    Move-Item -LiteralPath $asar -Destination $sealedBak
    $moved = $true
    Write-Output "已切换到补丁后的 resources\app"
  }
  Remove-Item -LiteralPath $pending -Force -ErrorAction SilentlyContinue
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Start-Process -FilePath $exe

  $started = $false
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 500
    $started = @(Get-InstallProcesses | Where-Object {
      $_.CommandLine -and $_.CommandLine.IndexOf("resources\app\", [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        $_.CommandLine.IndexOf("app.asar", [StringComparison]::OrdinalIgnoreCase) -lt 0
    }).Count -gt 0
  } while (-not $started -and (Get-Date) -lt $deadline)
  if (-not $started) { throw "桌面程序已启动，但未确认它加载 resources\app" }
  Write-Output "已确认 DeepSeek Harness 从 resources\app 重新启动"
} catch {
  if (-not @(Get-InstallProcesses).Count -and $moved -and -not (Test-Path -LiteralPath $asar) -and (Test-Path -LiteralPath $sealedBak)) {
    Move-Item -LiteralPath $sealedBak -Destination $asar
    Start-Process -FilePath $exe
  }
  throw
}
