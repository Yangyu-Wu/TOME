param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$serverDir = Join-Path $PSScriptRoot 'server'
$jar = Join-Path $serverDir 'server.jar'
$eula = Join-Path $serverDir 'eula.txt'

if (-not (Test-Path $jar)) { throw 'Run .\bootstrap-minecraft.ps1 first.' }
if (-not (Test-Path $eula) -or -not (Select-String -Path $eula -Pattern '^eula=true$' -Quiet)) {
    throw 'Read the Minecraft EULA and run .\accept-eula.ps1 only if you agree.'
}

$java = & (Join-Path $root 'game_ai_lab\find-java.ps1') | Select-Object -Last 1
$config = Join-Path $serverDir 'server.properties'
if (-not (Test-Path $config)) {
    @(
        'server-port=25565',
        'server-ip=127.0.0.1',
        'online-mode=false',
        'motd=Game AI Lab local server',
        'max-players=4',
        'spawn-protection=0',
        'difficulty=normal',
        'gamemode=creative',
        'allow-flight=true',
        'view-distance=8',
        'simulation-distance=6'
    ) | Set-Content -Path $config -Encoding ascii
}

Push-Location $serverDir
try {
    & $java '-Xms1G' '-Xmx2G' '-jar' 'server.jar' 'nogui'
} finally {
    Pop-Location
}
