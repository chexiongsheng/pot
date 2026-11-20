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

# Patch: Puerts 3.0.3 JsEnv.cs references PuertsIl2cpp.TypeUtils in the WebGL branch,
# but TypeUtils lives in namespace Puerts -> CS0234 on WebGL builds.
$jsenv = Join-Path $dest 'core/Runtime/Src/JsEnv.cs'
if (Test-Path $jsenv) {
    $text = [System.IO.File]::ReadAllText($jsenv)
    $fixed = $text.Replace('PuertsIl2cpp.TypeUtils.GetType("Puerts.BackendWebGL")', 'Puerts.TypeUtils.GetType("Puerts.BackendWebGL")')
    if ($fixed -ne $text) {
        [System.IO.File]::WriteAllText($jsenv, $fixed, (New-Object System.Text.UTF8Encoding $true))
        Write-Host "patched $jsenv (PuertsIl2cpp.TypeUtils -> Puerts.TypeUtils)"
    }
}

# Patch: Puerts 3.0.3 puerts.jslib only knows the old Emscripten of Unity 2022
# (updateGlobalBufferAndViews, preamble UTF16ToString ...). Unity 6 fails at runtime with
# "updateGlobalBufferAndViews is not defined". Overlay the compatible copy kept in
# tools/puerts-patches (works on both). Only applied to the version it was made for.
$patchRoot = Join-Path $PSScriptRoot 'puerts-patches'
$webglPkg = Join-Path $dest 'webgl/package.json'
if ((Test-Path $webglPkg) -and (Test-Path $patchRoot)) {
    $json = Get-Content -Raw -Encoding UTF8 $webglPkg
    $webglVersion = if ($json -match '"version"\s*:\s*"([^"]+)"') { $Matches[1] } else { '?' }
    if ($webglVersion -eq '3.0.3') {
        $base = Join-Path $patchRoot 'webgl'
        foreach ($file in Get-ChildItem -Recurse -File $base) {
            $rel = $file.FullName.Substring($base.Length + 1)
            $to = Join-Path (Join-Path $dest 'webgl') $rel
            Copy-Item -Force $file.FullName $to
            Write-Host "patched $to"
        }
    } else {
        Write-Warning "puerts webgl $webglVersion != 3.0.3, skipped tools/puerts-patches (check Unity 6 compatibility)"
    }
}
