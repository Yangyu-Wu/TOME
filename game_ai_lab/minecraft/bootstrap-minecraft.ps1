param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$serverDir = Join-Path $PSScriptRoot 'server'
New-Item -ItemType Directory -Force -Path $serverDir | Out-Null

node --version
npm install

$targetVersion = if ($env:MC_VERSION) { $env:MC_VERSION } else { '1.21.4' }
if (-not (Test-Path (Join-Path $serverDir 'server.jar'))) {
    $manifest = Invoke-RestMethod 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
    $releaseUrl = ($manifest.versions | Where-Object { $_.id -eq $targetVersion } | Select-Object -First 1).url
    if (-not $releaseUrl) { throw "Minecraft version $targetVersion was not found in the official manifest." }
    $metadata = Invoke-RestMethod $releaseUrl
    $jarUrl = $metadata.downloads.server.url
    Write-Host "Downloading Minecraft server $targetVersion ..."
    & curl.exe --fail --location --ssl-no-revoke --retry 6 --retry-all-errors --output (Join-Path $serverDir 'server.jar') $jarUrl
    if ($LASTEXITCODE -ne 0) { throw 'Minecraft server download failed.' }
}

Write-Host 'Minecraft dependencies are installed.'
Write-Host 'Read the Minecraft EULA, then run .\accept-eula.ps1 only if you agree.'
