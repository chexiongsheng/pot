param(
    # Folder that contains Puerts 3.x Unity packages: core/ and v8/ (optional: webgl/)
    [Parameter(Mandatory = $true)][string]$Source
)
# NOTE: keep this file ASCII-only. Windows PowerShell 5 reads BOM-less scripts as ANSI.
# webgl/ comes from PuerTS_Webgl_<ver>.tar.gz on the GitHub release page; it is only
# needed for WebGL player builds (pot release --platform webgl).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'third_party/puerts'
foreach ($name in 'core', 'v8') {
    $from = Join-Path $Source $name
    if (-not (Test-Path (Join-Path $from 'package.json'))) { throw "missing $from/package.json" }
}
$names = @('core', 'v8')
if (Test-Path (Join-Path $Source 'webgl/package.json')) { $names += 'webgl' }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($name in $names) {
    $to = Join-Path $dest $name
    if (Test-Path $to) { Remove-Item -Recurse -Force $to }
    Copy-Item -Recurse -Path (Join-Path $Source $name) -Destination $to
    $json = Get-Content -Raw -Encoding UTF8 (Join-Path $to 'package.json')
    if ($json -match '"version"\s*:\s*"([^"]+)"') { $version = $Matches[1] } else { $version = '?' }
    Write-Host "installed puerts/$name $version -> $to"
}

# webgl post-build step runs node Cli/Javascripts~/index.js; it would "npm i" from the
# public registry on first use, so install its deps up front from the internal mirror.
$cli = Join-Path $dest 'webgl/Cli/Javascripts~'
if (Test-Path (Join-Path $cli 'package.json')) {
    Push-Location $cli
    try { & npm install --registry=https://mirrors.tencent.com/npm --no-audit --no-fund | Out-Host } finally { Pop-Location }
    if (-not (Test-Path (Join-Path $cli 'node_modules/glob/package.json'))) { throw "npm install failed in $cli" }
    Write-Host "installed webgl cli deps -> $cli/node_modules"
}
