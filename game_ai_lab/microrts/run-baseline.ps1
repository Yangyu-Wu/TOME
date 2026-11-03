param(
    [int]$Episodes = 3,
    [int]$Seed = 7,
    [int]$MaxSteps = 2000,
    [string[]]$AIs = @('RandomAI','PassiveAI','WorkerRush','LightRush','Coac','NaiveMCTS')
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path .\.venv\Scripts\python.exe)) { throw 'Run .\bootstrap-microrts.ps1 first.' }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$java = & (Join-Path $root 'game_ai_lab\find-java.ps1') | Select-Object -Last 1
$env:JAVA_HOME = Split-Path (Split-Path $java -Parent) -Parent
$args = @('.\baseline_experiment.py','--episodes', $Episodes, '--seed', $Seed, '--max-steps', $MaxSteps, '--ais') + $AIs
& .\.venv\Scripts\python.exe @args
if ($LASTEXITCODE -ne 0) { throw 'MicroRTS baseline experiment failed.' }
