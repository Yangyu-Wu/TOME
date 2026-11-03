param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
python .\server.py --port $Port
