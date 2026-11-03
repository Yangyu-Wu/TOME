$manifest = Import-Csv -LiteralPath (Join-Path (Get-Location) 'literature/download_manifest.csv')
$results = @()
foreach ($item in $manifest) {
  $targetDir = Join-Path (Get-Location) ('literature/pdfs/' + $item.category)
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  $destination = Join-Path $targetDir $item.filename
  try {
    Invoke-WebRequest -Uri $item.url -OutFile $destination -MaximumRedirection 5 -TimeoutSec 90 -UseBasicParsing
    $size = (Get-Item -LiteralPath $destination).Length
    $status = if ($size -ge 5000) { 'downloaded' } else { 'small_response' }
    $results += [pscustomobject]@{ category=$item.category; filename=$item.filename; status=$status; bytes=$size; url=$item.url }
  } catch {
    $results += [pscustomobject]@{ category=$item.category; filename=$item.filename; status='failed'; bytes=0; url=$item.url }
  }
}
$results | Export-Csv -NoTypeInformation -Encoding UTF8 -LiteralPath (Join-Path (Get-Location) 'literature/download_results.csv')
$results | Format-Table -AutoSize
