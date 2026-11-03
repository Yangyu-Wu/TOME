$manifest = Import-Csv -LiteralPath (Join-Path (Get-Location) 'literature/download_manifest.csv')
$results = @()
foreach ($item in $manifest) {
  $dir = Join-Path (Get-Location) ('literature/pdfs/' + $item.category)
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $file = Join-Path $dir $item.filename
  $needsDownload = -not (Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -lt 5000
  if ($needsDownload) {
    Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    & curl.exe --fail --location --max-time 40 --retry 1 --output $file $item.url 2>$null
  }
  $bytes = if (Test-Path -LiteralPath $file) { (Get-Item -LiteralPath $file).Length } else { 0 }
  $isPdf = $false
  if ($bytes -ge 5000) {
    $head = [System.IO.File]::ReadAllBytes($file)[0..3]
    $isPdf = ([System.Text.Encoding]::ASCII.GetString($head) -eq '%PDF')
  }
  if (-not $isPdf -and (Test-Path -LiteralPath $file)) { Remove-Item -LiteralPath $file -Force }
  $results += [pscustomobject]@{category=$item.category;filename=$item.filename;status=$(if ($isPdf) {'downloaded'} else {'unavailable'});url=$item.url;note=$item.source_note}
}
$results | Export-Csv -NoTypeInformation -Encoding UTF8 -LiteralPath (Join-Path (Get-Location) 'literature/download_results.csv')
$results | Group-Object status | Select-Object Name,Count | Format-Table -AutoSize
