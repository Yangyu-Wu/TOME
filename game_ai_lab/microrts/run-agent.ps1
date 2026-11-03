param(
    [string]$Opponent = 'WorkerRush',
    [int]$Episodes = 3,
    [int]$MaxSteps = 1000,
    [int]$DecisionInterval = 50,
    [switch]$UseApi
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path .\.venv\Scripts\python.exe)) { throw 'Run .\bootstrap-microrts.ps1 first.' }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$java = & (Join-Path $root 'game_ai_lab\find-java.ps1') | Select-Object -Last 1
$env:JAVA_HOME = Split-Path (Split-Path $java -Parent) -Parent
$args = @('.\run_agent.py', '--opponent', $Opponent, '--episodes', $Episodes, '--max-steps', $MaxSteps, '--decision-interval', $DecisionInterval)
if ($UseApi) { $args += '--use-api' }
& .\.venv\Scripts\python.exe @args
if ($LASTEXITCODE -ne 0) { throw 'MicroRTS adaptive agent run failed.' }
