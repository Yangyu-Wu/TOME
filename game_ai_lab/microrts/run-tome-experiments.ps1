param(
    [ValidateSet('collect', 'train', 'evaluate', 'aggregate')]
    [string]$Command = 'evaluate',
    [int]$Episodes = 3,
    [int]$MaxSteps = 500,
    [int]$DecisionInterval = 50,
    [string]$Map = 'maps/10x10/basesTwoWorkers10x10.xml',
    [string[]]$Opponents = @('PassiveAI', 'RandomAI', 'WorkerRush', 'LightRush', 'Coac', 'NaiveMCTS'),
    [switch]$UseApi,
    [switch]$SaveReplays,
    [int]$FrameInterval = 10
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path .\.venv\Scripts\python.exe)) { throw 'Run .\bootstrap-microrts.ps1 first.' }

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$java = & (Join-Path $root 'game_ai_lab\find-java.ps1') | Select-Object -Last 1
$env:JAVA_HOME = Split-Path (Split-Path $java -Parent) -Parent
$pythonArgs = @('.\tome_experiments.py', $Command)

if ($Command -eq 'collect') {
    $pythonArgs += @('--episodes', $Episodes, '--max-steps', $MaxSteps, '--map', $Map, '--opponents') + $Opponents
} elseif ($Command -eq 'train') {
    $data = Join-Path $root 'logs\microrts\tome\data\latest.jsonl'
    if (-not (Test-Path $data)) { throw 'Run collection before training.' }
    $pythonArgs += @('--data', $data)
} elseif ($Command -eq 'evaluate') {
    $pythonArgs += @('--episodes', $Episodes, '--max-steps', $MaxSteps, '--decision-interval', $DecisionInterval, '--map', $Map, '--opponents') + $Opponents
    if ($UseApi) {
        $pythonArgs += @('--methods', 'tome_api', '--use-api')
    }
    if ($SaveReplays) { $pythonArgs += @('--save-replays', '--frame-interval', $FrameInterval) }
} else {
    $pythonArgs += @('--episodes', $Episodes, '--opponents') + $Opponents
}

& .\.venv\Scripts\python.exe @pythonArgs
if ($LASTEXITCODE -ne 0) { throw "TOME experiment '$Command' failed." }
