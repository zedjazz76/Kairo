$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$securityModule = Join-Path $repoRoot 'hl7-toolkit\service\HL7Toolkit.Security.psm1'
$startScript = Join-Path $repoRoot 'hl7-toolkit\service\Start-HL7Toolkit.ps1'
Import-Module $securityModule -Force

$token = New-HL7SessionToken
$portProbe = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
$portProbe.Start()
$port = ([Net.IPEndPoint]$portProbe.LocalEndpoint).Port
$portProbe.Stop()

$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$dataRoot = [IO.Path]::GetFullPath((Join-Path $temporaryRoot ('hl7-toolkit-probe-' + [Guid]::NewGuid().ToString('N'))))
if (-not $dataRoot.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'temporary data path escaped the temp directory'
}

$processInfo = New-Object Diagnostics.ProcessStartInfo
$processInfo.FileName = 'powershell.exe'
$processInfo.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Port {1} -Token {2} -DataRoot "{3}" -NoBrowser' -f $startScript, $port, $token, $dataRoot
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true
$processInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$process = New-Object Diagnostics.Process
$process.StartInfo = $processInfo
if (-not $process.Start()) { throw 'toolkit helper did not start' }

try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 50; $attempt += 1) {
        try {
            $healthUri = 'http://127.0.0.1:' + $port + '/health?token=' + $token
            $healthResponse = Invoke-WebRequest -UseBasicParsing -Uri $healthUri
            $health = $healthResponse.Content | ConvertFrom-Json
            $ready = $health.status -eq 'ok' -and $health.loopback -eq $true
            if ($ready) { break }
        }
        catch {}
        Start-Sleep -Milliseconds 100
    }
    if (-not $ready) { throw 'health contract failed' }

    if ($healthResponse.Headers['Cache-Control'] -notmatch 'no-store') { throw 'missing no-store header' }
    if ($healthResponse.Headers['Content-Security-Policy'] -notmatch "default-src 'self'") { throw 'missing local CSP' }
    if ($healthResponse.Headers['X-Content-Type-Options'] -ne 'nosniff') { throw 'missing nosniff header' }

    $staticResponse = Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:' + $port + '/')
    if ($staticResponse.StatusCode -ne 200 -or $staticResponse.Content -notmatch '<title>KAIRO Guardian \| HL7 Toolkit</title>') {
        throw 'static application contract failed'
    }
    if ($staticResponse.Content -notmatch '<script\s+type="module"\s+src="/scripts/app\.mjs"') {
        throw 'the page is not using the CSP-compatible startup module'
    }
    $moduleResponse = Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:' + $port + '/scripts/app.mjs')
    if ($moduleResponse.StatusCode -ne 200 -or $moduleResponse.Headers['Content-Type'] -notmatch 'text/javascript') {
        throw 'startup module contract failed'
    }

    $baseUri = 'http://127.0.0.1:' + $port
    $authHeaders = @{ 'X-HL7-Token' = $token }
    $event = @{ schema = 'hl7-toolkit.sanitized-event.v1'; type = 'message-save'; sanitizedText = 'MRN-0001'; policyVersion = 'patient-phi-1.0.0'; mode = 'chat-safe'; warningCounts = @{}; overrideCount = 0 }
    $payload = @{ sessionId = 'probe-session'; event = $event } | ConvertTo-Json -Depth 10 -Compress
    $saved = Invoke-RestMethod -Uri ($baseUri + '/api/history/events') -Method Post -Headers $authHeaders -ContentType 'application/json' -Body $payload
    if (-not $saved.saved) { throw 'history API save failed' }
    $history = Invoke-RestMethod -Uri ($baseUri + '/api/history') -Headers $authHeaders
    if ($history.sessions.Count -ne 1) { throw 'history API list failed' }
    $detail = Invoke-RestMethod -Uri ($baseUri + '/api/history?sessionId=probe-session') -Headers $authHeaders
    if ($detail.sanitizedText -notmatch 'MRN-0001') { throw 'history API detail failed' }
    $removed = Invoke-RestMethod -Uri ($baseUri + '/api/history/session') -Method Delete -Headers $authHeaders -ContentType 'application/json' -Body '{"sessionIds":["probe-session"]}'
    if ($removed.deletedCount -ne 1) { throw 'history API delete failed' }

    try {
        Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:' + $port + '/api/session') | Out-Null
        throw 'unauthorized request unexpectedly succeeded'
    }
    catch {
        if ($null -eq $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -notin @(401, 403)) { throw }
    }

    try {
        Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:' + $port + '/%2e%2e/%2e%2e/Windows/win.ini') | Out-Null
        throw 'path traversal unexpectedly succeeded'
    }
    catch {
        if ($null -eq $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -notin @(400, 404)) { throw }
    }

    Write-Output 'service probe passed'
}
finally {
    if (-not $process.HasExited) {
        $process.Kill()
        $process.WaitForExit()
    }
    if ([IO.Directory]::Exists($dataRoot) -and $dataRoot.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $dataRoot -Recurse -Force
    }
}
