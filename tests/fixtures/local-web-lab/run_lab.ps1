param(
  [Parameter(Mandatory = $true)][string]$FfufPath,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
& py -3 (Join-Path $PSScriptRoot 'verify_lab.py') --ffuf $FfufPath --output-dir $OutputDirectory
exit $LASTEXITCODE
