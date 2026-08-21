$ErrorActionPreference = 'Stop'
$wikiRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $wikiRoot 'site'
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$destination = Join-Path $wikiRoot (Join-Path 'versions' $stamp)
Copy-Item -LiteralPath $source -Destination $destination -Recurse
$indexFile = Join-Path $source 'index.html'
$hash = (Get-FileHash -LiteralPath $indexFile -Algorithm SHA256).Hash
$historyFile = Join-Path $wikiRoot 'versions\VERSION-HISTORY.csv'
if (-not (Test-Path -LiteralPath $historyFile)) {
    'SavedAt,VersionFolder,IndexSHA256' | Set-Content -LiteralPath $historyFile -Encoding UTF8
}
'"{0}","{1}","{2}"' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss K'), $stamp, $hash | Add-Content -LiteralPath $historyFile -Encoding UTF8
Write-Host "Saved complete MANA Wiki version: $destination"
Write-Host "Recorded SHA-256 checksum: $hash"
Write-Host 'This timestamped snapshot is your local version history; Git is not required.'
