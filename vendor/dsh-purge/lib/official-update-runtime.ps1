param(
    [Parameter(Mandatory=$true)][ValidateSet('Detach','Restore')][string]$Action,
    [Parameter(Mandatory=$true)][string]$Resources,
    [Parameter(Mandatory=$true)][string]$Manifest
)
$ErrorActionPreference = 'Stop'

# Only detach known runtime junctions; never recurse into their shared target.
$root = Get-Item -LiteralPath $Resources -Force
if (-not $root.PSIsContainer -or $root.Name -ne 'resources' -or
    ($root.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Invalid resources directory' }
$runtime = Join-Path $root.FullName 'runtime'
$names = @()
if ($Action -eq 'Detach') {
    foreach ($app in Get-ChildItem -LiteralPath $root.FullName -Directory -Force) {
        if ($app.Name -notmatch '^app(?:\.dshpurge-prev(?:-\d+)?)?$') { continue }
        if ($app.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Application directory is a link' }
        $link = Get-Item -LiteralPath (Join-Path $app.FullName 'runtime') -Force -ErrorAction SilentlyContinue
        if (-not $link -or -not ($link.Attributes -band [IO.FileAttributes]::ReparsePoint)) { continue }
        $target = [string]@($link.Target)[0]
        if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path $app.FullName $target }
        if ([IO.Path]::GetFullPath($target).TrimEnd('\') -ne $runtime.TrimEnd('\')) { throw 'Unexpected runtime link target' }
        $names += $app.Name
    }
    ConvertTo-Json -InputObject $names | Set-Content -LiteralPath $Manifest -Encoding UTF8
} elseif (Test-Path -LiteralPath $Manifest -PathType Leaf) {
    $names = ConvertFrom-Json -InputObject (Get-Content -LiteralPath $Manifest -Raw)
}
foreach ($name in $names) {
    if ($name -notmatch '^app(?:\.dshpurge-prev(?:-\d+)?)?$') { throw 'Invalid saved application directory' }
    $appPath = Join-Path $root.FullName $name
    $linkPath = Join-Path $appPath 'runtime'
    if ([IO.Path]::GetFullPath($linkPath) -ne ($root.FullName + '\' + $name + '\runtime')) { throw 'Runtime path escaped resources' }
    $app = Get-Item -LiteralPath $appPath -Force -ErrorAction SilentlyContinue
    if (-not $app) { continue }
    if (-not $app.PSIsContainer -or ($app.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Application directory is not a regular directory' }
    if ($Action -eq 'Detach') {
        [IO.Directory]::Delete($linkPath)
    } elseif (-not (Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue)) {
        New-Item -ItemType Junction -Path $linkPath -Target $runtime | Out-Null
    }
}
