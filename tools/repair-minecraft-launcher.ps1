param(
    [string]$ManifestPath = "$PSScriptRoot\launcher-manifest.json"
)

$ErrorActionPreference = 'Stop'
$packageRoot = Join-Path $env:LOCALAPPDATA 'Packages\Microsoft.4297127D64EC6_8wekyb3d8bbwe\LocalCache\Local'
$target = Join-Path $packageRoot 'game'
$stage = Join-Path $packageRoot 'repair-staging'
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json

if (-not $manifest.files) { throw 'Launcher manifest has no files.' }
New-Item -ItemType Directory -Force -Path $target,$stage | Out-Null

$files = $manifest.files.psobject.Properties
$index = 0
foreach ($entry in $files) {
    $index++
    $relative = [string]$entry.Name
    if (-not $entry.Value.downloads -or -not $entry.Value.downloads.raw) {
        continue
    }
    $meta = $entry.Value.downloads.raw
    $destination = Join-Path $target ($relative -replace '/', '\')
    $directory = Split-Path $destination -Parent
    New-Item -ItemType Directory -Force -Path $directory | Out-Null

    $valid = $false
    if (Test-Path $destination) {
        $hash = (Get-FileHash -LiteralPath $destination -Algorithm SHA1).Hash.ToLowerInvariant()
        $valid = ($hash -eq ([string]$meta.sha1).ToLowerInvariant())
    }
    if ($valid) {
        Write-Host "[$index/$($files.Count)] OK $relative"
        continue
    }

    $part = Join-Path $stage (($relative -replace '/', '__') + '.part')
    Write-Host "[$index/$($files.Count)] Downloading $relative ($($meta.size) bytes)"
    if ([int64]$meta.size -gt 8MB) {
        if (Test-Path $part) { Remove-Item -LiteralPath $part -Force }
        $offset = [int64]0
        $chunkSize = [int64](8MB)
        while ($offset -lt [int64]$meta.size) {
            $end = [Math]::Min($offset + $chunkSize - 1, [int64]$meta.size - 1)
            $chunk = "$part.$offset.chunk"
            $expected = $end - $offset + 1
            & curl.exe -4 --fail --location --ssl-no-revoke --retry 8 --retry-all-errors --range "$offset-$end" --output $chunk $meta.url
            if ($LASTEXITCODE -ne 0) { throw "Download failed: $relative (range $offset-$end)" }
            if (-not (Test-Path $chunk) -or (Get-Item $chunk).Length -ne $expected) {
                throw "Invalid range length for $relative (range $offset-$end)"
            }
            $out = [System.IO.File]::Open($part, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            $inp = [System.IO.File]::OpenRead($chunk)
            try { $inp.CopyTo($out) } finally { $inp.Dispose(); $out.Dispose() }
            Remove-Item -LiteralPath $chunk -Force
            $offset = $end + 1
            Write-Host "  $offset / $($meta.size)"
        }
    } else {
        & curl.exe -4 --fail --location --ssl-no-revoke --retry 8 --retry-all-errors --continue-at - --output $part $meta.url
        if ($LASTEXITCODE -ne 0) { throw "Download failed: $relative" }
    }
    $actual = (Get-FileHash -LiteralPath $part -Algorithm SHA1).Hash.ToLowerInvariant()
    if ($actual -ne ([string]$meta.sha1).ToLowerInvariant()) {
        throw "SHA-1 mismatch for $relative. Expected $($meta.sha1), got $actual"
    }
    Move-Item -LiteralPath $part -Destination $destination -Force
}

Write-Host "Launcher core repaired in $target"
