$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8765
$prefix = "http://127.0.0.1:$port/"
$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  if ($_.Exception.Message -match 'conflict|already|used') { exit 0 }
  throw
}

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.js'='application/javascript; charset=utf-8';
  '.json'='application/json; charset=utf-8'; '.png'='image/png'; '.jpg'='image/jpeg';
  '.jpeg'='image/jpeg'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'
}

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }
    $candidate = [IO.Path]::GetFullPath((Join-Path $root $path))
    if (-not $candidate.StartsWith([IO.Path]::GetFullPath($root), [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('Not found')
    } else {
      $context.Response.StatusCode = 200
      $ext = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
      $context.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($candidate)
      $context.Response.Headers['Cache-Control'] = 'no-store'
    }
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes,0,$bytes.Length)
    $context.Response.OutputStream.Close()
  } catch {
    try { $context.Response.StatusCode = 500; $context.Response.Close() } catch {}
  }
}

