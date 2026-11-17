param(
    # Folder that contains Puerts 3.x Unity packages: core/ and v8/
    [Parameter(Mandatory = $true)][string]$Source
)
# NOTE: keep this file ASCII-only. Windows PowerShell 5 reads BOM-less scripts as ANSI.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'third_party/puerts'
foreach ($name in 'core', 'v8') {
    $from = Join-Path $Source $name
    if (-not (Test-Path (Join-Path $from 'package.json'))) { throw "missing $from/package.json" }
}
New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($name in 'core', 'v8') {
    $to = Join-Path $dest $name
    if (Test-Path $to) { Remove-Item -Recurse -Force $to }
    Copy-Item -Recurse -Path (Join-Path $Source $name) -Destination $to
    $json = Get-Content -Raw -Encoding UTF8 (Join-Path $to 'package.json')
    if ($json -match '"version"\s*:\s*"([^"]+)"') { $version = $Matches[1] } else { $version = '?' }
    Write-Host "installed puerts/$name $version -> $to"
}
