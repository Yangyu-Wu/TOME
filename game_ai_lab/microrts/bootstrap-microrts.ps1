param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$java = & (Join-Path $root 'game_ai_lab\find-java.ps1') | Select-Object -Last 1
if (-not (Test-Path $java)) { throw 'A working JDK 21 is required by MicroRTS.' }

$py = Get-Command py -ErrorAction SilentlyContinue
$pythonExe = $null
if ($py) {
    $pythonList = & $py.Source -0p 2>$null | Out-String
    if ($pythonList -match '3\.11') {
        & $py.Source -3.11 -m venv .venv
        $pythonExe = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
    }
}
if (-not $pythonExe -and (Test-Path .\.venv\Scripts\python.exe)) {
    $pythonExe = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
}
if (-not $pythonExe) {
    $python = Get-Command python -ErrorAction Stop
    & $python.Source -m venv .venv
    $pythonExe = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
}
& $pythonExe -m pip install --upgrade pip
& $pythonExe -m pip install --index-url https://pypi.org/simple --timeout 60 --retries 3 -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Failed to install the Python runtime requirements.' }
& $pythonExe -m pip install --index-url https://pypi.org/simple --timeout 60 --retries 3 --no-deps gym-microrts==0.4.3
if ($LASTEXITCODE -ne 0) { throw 'Failed to install gym-microrts.' }

Write-Host 'MicroRTS environment installed. Run .\run-match.ps1 or .\run-visual.ps1.'
