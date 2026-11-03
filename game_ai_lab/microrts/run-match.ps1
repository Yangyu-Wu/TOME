param(
    [int]$Seed = 7,
    [int]$Episodes = 4
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path .\.venv\Scripts\python.exe)) {
    throw 'Run .\bootstrap-microrts.ps1 first.'
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$java = & (Join-Path $root 'game_ai_lab\find-java.ps1') | Select-Object -Last 1
$env:JAVA_HOME = Split-Path (Split-Path $java -Parent) -Parent
& .\.venv\Scripts\python.exe .\run_match.py --seed $Seed --episodes $Episodes
