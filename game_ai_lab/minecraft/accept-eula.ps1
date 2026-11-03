param()

$ErrorActionPreference = 'Stop'
$eula = Join-Path $PSScriptRoot 'server\eula.txt'
@(
    '# By changing the setting below to TRUE you are indicating your agreement to the Minecraft EULA.',
    '# https://aka.ms/MinecraftEULA',
    'eula=true'
) | Set-Content -Path $eula -Encoding ascii
Write-Host "Recorded acceptance in $eula"
