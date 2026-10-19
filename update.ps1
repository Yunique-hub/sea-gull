# 海鸥一键更新：获取最新源码，保留现有提示词与配置。
# irm https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/update.ps1 | iex
param(
  [ValidateSet("desktop", "web", "")][string]$Profile = "",
  [string]$DshHome = "",
  [string]$AppRoot = "",
  [switch]$Apply,
  [switch]$NoPnpm,
  [switch]$DryRun,
  [switch]$Quiet
)
$ErrorActionPreference = "Stop"
$updateRepo = if ($env:SEAGULL_REPO) { $env:SEAGULL_REPO } else { "Yunique-hub/sea-gull" }
$updateBranch = if ($env:SEAGULL_BRANCH) { $env:SEAGULL_BRANCH } else { "main" }
$updateStage = Join-Path ([IO.Path]::GetTempPath()) ("seagull-update-" + [guid]::NewGuid().ToString("N"))
try {
  New-Item -ItemType Directory -Path $updateStage | Out-Null
  $archive = Join-Path $updateStage "repo.zip"
  Invoke-WebRequest -Uri "https://codeload.github.com/$updateRepo/zip/refs/heads/$updateBranch" -OutFile $archive -UseBasicParsing
  Expand-Archive -LiteralPath $archive -DestinationPath $updateStage
  $payload = @(Get-ChildItem -LiteralPath $updateStage -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "VERSION") })
  if ($payload.Count -ne 1) { throw "下载内容结构异常" }
  & (Join-Path $payload[0].FullName "install.ps1") -Update -Profile $Profile -DshHome $DshHome -AppRoot $AppRoot -Apply:$Apply -NoPnpm:$NoPnpm -DryRun:$DryRun -Quiet:$Quiet
  if ($LASTEXITCODE -ne 0) { throw "更新失败（退出码 $LASTEXITCODE），请检查以上输出" }
} finally {
  if (Test-Path -LiteralPath $updateStage) {
    $resolvedStage = [IO.Path]::GetFullPath($updateStage)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (!$resolvedStage.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw "临时目录越界" }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
  }
}
