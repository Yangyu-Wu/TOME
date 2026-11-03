param(
    [string]$Map = 'maps/16x16/basesWorkers16x16.xml',
    [ValidateSet('easy', 'normal')]
    [string]$Difficulty = 'easy'
)

$ErrorActionPreference = 'Stop'
$originalLocation = Get-Location
Set-Location $PSScriptRoot
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$java = & (Join-Path $root 'game_ai_lab\find-java.ps1') | Select-Object -Last 1
$site = (Resolve-Path '.\.venv\Lib\site-packages\gym_microrts\microrts').Path
$env:JAVA_HOME = Split-Path (Split-Path $java -Parent) -Parent
Set-Location $site
$mainClass = if ($Difficulty -eq 'easy') { 'tests.PlayGameWithMouseTest' } else { 'gui.frontend.FrontEnd' }
if ($mainClass -eq 'tests.PlayGameWithMouseTest') {
    & $java '-cp' 'microrts.jar;lib/*' $mainClass
} else {
    & $java '-cp' 'microrts.jar;lib/*' $mainClass
}
Set-Location $originalLocation
