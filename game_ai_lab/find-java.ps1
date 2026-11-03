param()

$candidates = @()
if ($env:JAVA_HOME) {
    $candidates += (Join-Path $env:JAVA_HOME 'bin\java.exe')
}

$onPath = Get-Command java -ErrorAction SilentlyContinue
if ($onPath) {
    $candidates += $onPath.Source
}

$candidates += (Join-Path $PSScriptRoot '..\tools\jdk-21\bin\java.exe')
$bundledJava = Get-ChildItem (Join-Path $PSScriptRoot '..\tools\jdk-21') -Recurse -Filter java.exe -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
if ($bundledJava) {
    $candidates += $bundledJava
}

foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
        $resolved = (Resolve-Path $candidate).Path
        $resolved
        exit 0
    }
}

Write-Error 'JDK 21 was not found. Set JAVA_HOME or extract a JDK into tools\jdk-21.'
exit 1
