Set-StrictMode -Version 2.0

$script:MaximumHeaderBytes = 32768
$script:MaximumBodyBytes = 16777216
$script:UsedSendRequests = New-Object 'Collections.Generic.HashSet[string]'

function Invoke-HL7ReviewedSend {
    param([object]$Payload)
    if ($null -eq $Payload -or $Payload -is [Array]) { throw 'SEND_ONE_MESSAGE_REQUIRED' }
    if ((Get-HL7PropertyValue $Payload 'reviewed') -isnot [bool] -or -not $Payload.reviewed) { throw 'SEND_REVIEW_REQUIRED' }
    # Access message directly: PowerShell pipeline helpers unwrap a one-element array.
    if ($null -eq $Payload.PSObject.Properties['message'] -or $Payload.message -isnot [string]) { throw 'SEND_ONE_MESSAGE_REQUIRED' }
    $message = $Payload.message
    $profile = Assert-HL7EndpointProfile $Payload.profile
    $mode = Get-HL7PropertyValue $Payload 'contentMode'
    if ($mode -notin @('original', 'sanitized')) { throw 'SEND_MODE_REQUIRED' }
    if ($mode -eq 'original' -and $profile.environment -eq 'Production') {
        $confirmation = Get-HL7PropertyValue $Payload 'productionConfirmed'
        if ($confirmation -isnot [bool] -or -not $confirmation) { throw 'SEND_PRODUCTION_CONFIRMATION_REQUIRED' }
    }
    $hashAlgorithm = [Security.Cryptography.SHA256]::Create()
    try { $hash = ([BitConverter]::ToString($hashAlgorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($message)))).Replace('-', '').ToLowerInvariant() }
    finally { $hashAlgorithm.Dispose() }
    if ($hash -cne (Get-HL7PropertyValue $Payload 'messageHash')) { throw 'SEND_REVIEW_EXPIRED' }
    $requestId = Get-HL7PropertyValue $Payload 'requestId'
    if ($requestId -isnot [string] -or $requestId -notmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') { throw 'SEND_REQUEST_ID_REQUIRED' }
    if ($script:UsedSendRequests.Count -ge 100000) { throw 'SEND_SESSION_LIMIT' }
    if (-not $script:UsedSendRequests.Add($requestId)) { throw 'SEND_REQUEST_ALREADY_USED' }
    return Send-HL7MllpMessage -Profile $profile -Message $message
}

function Read-HL7HttpRequest {
    param([Parameter(Mandatory = $true)][IO.Stream]$Stream)

    $headerBytes = New-Object Collections.Generic.List[byte]
    $matched = 0
    $boundary = [byte[]](13, 10, 13, 10)
    $deadline = [Diagnostics.Stopwatch]::StartNew()
    while ($matched -lt $boundary.Length) {
        if ($deadline.ElapsedMilliseconds -ge 2000) { throw 'HTTP_HEADER_TIMEOUT' }
        if ($Stream.CanTimeout) { $Stream.ReadTimeout = [math]::Max(1, 2000 - [int]$deadline.ElapsedMilliseconds) }
        $value = $Stream.ReadByte()
        if ($value -lt 0) { throw 'HTTP_REQUEST_INCOMPLETE' }
        $headerBytes.Add([byte]$value)
        if ($headerBytes.Count -gt $script:MaximumHeaderBytes) { throw 'HTTP_HEADERS_TOO_LARGE' }
        if ($value -eq $boundary[$matched]) {
            $matched += 1
        }
        elseif ($value -eq $boundary[0]) {
            $matched = 1
        }
        else {
            $matched = 0
        }
    }

    $headerText = [Text.Encoding]::ASCII.GetString($headerBytes.ToArray())
    $lines = $headerText.Split(@("`r`n"), [StringSplitOptions]::None)
    $requestLine = $lines[0].Split(' ')
    if ($requestLine.Count -ne 3) { throw 'HTTP_REQUEST_LINE_INVALID' }

    $headers = @{}
    for ($index = 1; $index -lt $lines.Count; $index += 1) {
        $line = $lines[$index]
        if ([string]::IsNullOrEmpty($line)) { continue }
        $separator = $line.IndexOf(':')
        if ($separator -lt 1) { throw 'HTTP_HEADER_INVALID' }
        $name = $line.Substring(0, $separator).Trim().ToLowerInvariant()
        if ($headers.ContainsKey($name)) { throw 'HTTP_DUPLICATE_HEADER' }
        $headers[$name] = $line.Substring($separator + 1).Trim()
    }

    $contentLength = 0
    if ($headers.ContainsKey('transfer-encoding')) { throw 'HTTP_TRANSFER_ENCODING_REJECTED' }
    if ($headers.ContainsKey('content-length')) {
        if (-not [int]::TryParse($headers['content-length'], [ref]$contentLength)) { throw 'HTTP_CONTENT_LENGTH_INVALID' }
        if ($contentLength -lt 0 -or $contentLength -gt $script:MaximumBodyBytes) { throw 'HTTP_BODY_TOO_LARGE' }
    }
    $bodyBytes = New-Object byte[] $contentLength
    $offset = 0
    $deadline.Restart()
    while ($offset -lt $contentLength) {
        if ($deadline.ElapsedMilliseconds -ge 10000) { throw 'HTTP_BODY_TIMEOUT' }
        if ($Stream.CanTimeout) { $Stream.ReadTimeout = [math]::Max(1, 10000 - [int]$deadline.ElapsedMilliseconds) }
        $read = $Stream.Read($bodyBytes, $offset, $contentLength - $offset)
        if ($read -le 0) { throw 'HTTP_BODY_INCOMPLETE' }
        $offset += $read
    }

    return [pscustomobject]@{
        Method = $requestLine[0].ToUpperInvariant()
        Target = $requestLine[1]
        Version = $requestLine[2]
        Headers = $headers
        Body = [Text.Encoding]::UTF8.GetString($bodyBytes)
    }
}

function Write-HL7HttpResponse {
    param(
        [Parameter(Mandatory = $true)][IO.Stream]$Stream,
        [int]$StatusCode = 200,
        [string]$Reason = 'OK',
        [string]$ContentType = 'application/json; charset=utf-8',
        [AllowEmptyString()][string]$Body = '',
        [AllowNull()][byte[]]$BodyBytes = $null,
        [hashtable]$AdditionalHeaders = @{}
    )

    $responseBytes = if ($null -ne $BodyBytes) { $BodyBytes } else { [Text.Encoding]::UTF8.GetBytes($Body) }
    $headers = Get-HL7SecurityHeaders
    foreach ($entry in $AdditionalHeaders.GetEnumerator()) { $headers[$entry.Key] = $entry.Value }
    $headers['Connection'] = 'close'
    $headers['Content-Length'] = $responseBytes.Length.ToString([Globalization.CultureInfo]::InvariantCulture)
    $headers['Content-Type'] = $ContentType

    $builder = New-Object Text.StringBuilder
    [void]$builder.Append("HTTP/1.1 $StatusCode $Reason`r`n")
    foreach ($entry in $headers.GetEnumerator()) {
        [void]$builder.Append($entry.Key).Append(': ').Append($entry.Value).Append("`r`n")
    }
    [void]$builder.Append("`r`n")
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($builder.ToString())
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if ($responseBytes.Length -gt 0) { $Stream.Write($responseBytes, 0, $responseBytes.Length) }
    $Stream.Flush()
}

function Get-HL7QueryValues {
    param([Parameter(Mandatory = $true)][string]$Target)

    $values = @{}
    $question = $Target.IndexOf('?')
    if ($question -lt 0) { return $values }
    foreach ($pair in $Target.Substring($question + 1).Split('&')) {
        if ([string]::IsNullOrWhiteSpace($pair)) { continue }
        $parts = $pair.Split('=', 2)
        $name = [Uri]::UnescapeDataString($parts[0])
        $value = if ($parts.Count -gt 1) { [Uri]::UnescapeDataString($parts[1]) } else { '' }
        $values[$name] = $value
    }
    return $values
}

function Test-HL7RequestAuthorized {
    param(
        [Parameter(Mandatory = $true)]$Request,
        [Parameter(Mandatory = $true)][string]$Token
    )

    if ($Request.Headers.ContainsKey('origin')) {
        if (-not $Request.Headers.ContainsKey('host') -or $Request.Headers['origin'] -cne ('http://' + $Request.Headers['host'])) { return $false }
    }
    $candidate = $null
    if ($Request.Headers.ContainsKey('x-hl7-token')) { $candidate = $Request.Headers['x-hl7-token'] }
    if ([string]::IsNullOrEmpty($candidate)) {
        $query = Get-HL7QueryValues -Target $Request.Target
        if ($query.ContainsKey('token')) { $candidate = $query['token'] }
    }
    return Test-HL7SessionToken -Candidate $candidate -Expected $Token
}

function Get-HL7ContentType {
    param([Parameter(Mandatory = $true)][string]$Path)

    switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.css' { return 'text/css; charset=utf-8' }
        '.js' { return 'text/javascript; charset=utf-8' }
        '.mjs' { return 'text/javascript; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.svg' { return 'image/svg+xml' }
        '.png' { return 'image/png' }
        default { return 'application/octet-stream' }
    }
}

function Invoke-HL7HttpConnection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][Net.Sockets.TcpClient]$Client,
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$DataRoot,
        [Parameter(Mandatory = $true)][string]$Token
    )

    try {
        if (-not (Test-HL7LoopbackAddress -Address $Client.Client.RemoteEndPoint.Address)) {
            $Client.Dispose()
            return
        }
        $stream = $Client.GetStream()
        $stream.WriteTimeout = 5000
        $request = Read-HL7HttpRequest -Stream $stream
        $path = $request.Target.Split('?')[0]
        $hostHeader = if ($request.Headers.ContainsKey('host')) { $request.Headers['host'] } else { '' }
        $localPort = $Client.Client.LocalEndPoint.Port
        if ($hostHeader -notin @(('127.0.0.1:' + $localPort), ('localhost:' + $localPort))) {
            Write-HL7HttpResponse -Stream $stream -StatusCode 403 -Reason 'Forbidden' -Body '{"error":"HOST_REJECTED"}'
            return
        }

        if ($path -eq '/health') {
            if (-not (Test-HL7RequestAuthorized -Request $request -Token $Token)) {
                Write-HL7HttpResponse -Stream $stream -StatusCode 403 -Reason 'Forbidden' -Body '{"error":"FORBIDDEN"}'
                return
            }
            Write-HL7HttpResponse -Stream $stream -Body '{"status":"ok","version":"1.0.0-phase1","loopback":true}'
            return
        }

        if ($path.StartsWith('/api/', [StringComparison]::OrdinalIgnoreCase)) {
            if (-not (Test-HL7RequestAuthorized -Request $request -Token $Token)) {
                Write-HL7HttpResponse -Stream $stream -StatusCode 403 -Reason 'Forbidden' -Body '{"error":"FORBIDDEN"}'
                return
            }
            if ($path -eq '/api/session' -and $request.Method -eq 'GET') {
                Write-HL7HttpResponse -Stream $stream -Body '{"status":"ready","version":"1.0.0-phase1"}'
                return
            }
            if ($path -eq '/api/diagnostics/run') {
                try {
                    if ($request.Method -ne 'POST') { throw 'DIAGNOSTIC_METHOD_REJECTED' }
                    if ($request.Body.Length -gt 2048) { throw 'DIAGNOSTIC_INPUT_REJECTED' }
                    $payload = $request.Body | ConvertFrom-Json
                    if (-not (Get-Command Invoke-KairoEndpointDiagnostic -ErrorAction SilentlyContinue)) {
                        try { Import-Module (Join-Path $PSScriptRoot 'HL7Toolkit.Diagnostics.psm1') -ErrorAction Stop }
                        catch { throw 'DIAGNOSTIC_RUNTIME_UNAVAILABLE' }
                    }
                    $result = Invoke-KairoEndpointDiagnostic -Payload $payload
                    Write-HL7HttpResponse -Stream $stream -Body ($result | ConvertTo-Json -Depth 8 -Compress)
                } catch {
                    $code = if ($_.Exception.Message -match '^DIAGNOSTIC_[A-Z_]+$') { $_.Exception.Message } else { 'DIAGNOSTIC_INPUT_REJECTED' }
                    $statusCode = if ($code -eq 'DIAGNOSTIC_RUNTIME_UNAVAILABLE') { 503 } else { 400 }
                    $reason = if ($statusCode -eq 503) { 'Service Unavailable' } else { 'Bad Request' }
                    Write-HL7HttpResponse -Stream $stream -StatusCode $statusCode -Reason $reason -Body ('{"error":"' + $code + '"}')
                }
                return
            }
            if ($path -eq '/api/dicom/mwl/find') {
                try {
                    if ($request.Method -ne 'POST') { throw 'MWL_METHOD_REJECTED' }
                    if ($request.Body.Length -gt 8192) { throw 'MWL_INPUT_REJECTED' }
                    $result = Invoke-KairoMwlQuery -Payload ($request.Body | ConvertFrom-Json)
                    Write-HL7HttpResponse -Stream $stream -Body ($result | ConvertTo-Json -Depth 16 -Compress)
                } catch {
                    $code = if ($_.Exception.Message -match '^MWL_[A-Z_]+$') { $_.Exception.Message } else { 'MWL_INPUT_REJECTED' }
                    $statusCode = if ($code -eq 'MWL_RUNTIME_UNAVAILABLE') { 503 } else { 400 }
                    Write-HL7HttpResponse -Stream $stream -StatusCode $statusCode -Reason $(if($statusCode -eq 503){'Service Unavailable'}else{'Bad Request'}) -Body ('{"error":"' + $code + '"}')
                }
                return
            }
            if ($path -eq '/api/dicom/studies/find') {
                try {
                    if ($request.Method -ne 'POST') { throw 'STUDY_METHOD_REJECTED' }
                    if ($request.Body.Length -gt 4096) { throw 'STUDY_INPUT_REJECTED' }
                    $result = Invoke-KairoStudyQuery -Payload ($request.Body | ConvertFrom-Json)
                    Write-HL7HttpResponse -Stream $stream -Body ($result | ConvertTo-Json -Depth 16 -Compress)
                } catch {
                    $code = if ($_.Exception.Message -match '^STUDY_[A-Z_]+$') { $_.Exception.Message } else { 'STUDY_INPUT_REJECTED' }
                    $statusCode = if ($code -eq 'STUDY_RUNTIME_UNAVAILABLE') { 503 } else { 400 }
                    Write-HL7HttpResponse -Stream $stream -StatusCode $statusCode -Reason $(if($statusCode -eq 503){'Service Unavailable'}else{'Bad Request'}) -Body ('{"error":"' + $code + '"}')
                }
                return
            }
            if ($path -in @('/api/profiles/endpoint', '/api/diagnostics/baseline', '/api/mllp/check', '/api/mllp/send-one')) {
                try {
                    $payload = if ($request.Body) { $request.Body | ConvertFrom-Json } else { $null }
                    if ($path -eq '/api/profiles/endpoint') {
                        switch ($request.Method) {
                            'GET' { $result = Get-HL7EndpointProfiles -DataRoot $DataRoot }
                            'POST' { $result = Save-HL7EndpointProfile -DataRoot $DataRoot -Profile $payload.profile }
                            'DELETE' { $result = Remove-HL7EndpointProfile -DataRoot $DataRoot -Id (Get-HL7PropertyValue $payload 'id') }
                            default { throw 'PROFILE_METHOD_REJECTED' }
                        }
                    }
                    elseif ($path -eq '/api/diagnostics/baseline') {
                        if ($request.Method -ne 'POST') { throw 'DIAGNOSTIC_BASELINE_METHOD_REJECTED' }
                        if ((Get-HL7PropertyValue $payload 'action') -eq 'save') { $result = Save-HL7DiagnosticBaseline -DataRoot $DataRoot -Baseline $payload.baseline }
                        elseif ((Get-HL7PropertyValue $payload 'action') -eq 'get') { $result = Get-HL7DiagnosticBaseline -DataRoot $DataRoot -ProfileId (Get-HL7PropertyValue $payload 'profileId') }
                        else { throw 'DIAGNOSTIC_BASELINE_ACTION_REJECTED' }
                    }
                    elseif ($request.Method -ne 'POST') { throw 'SEND_METHOD_REJECTED' }
                    elseif ($path -eq '/api/mllp/check') { $result = Test-HL7Endpoint -Profile $payload.profile }
                    else { $result = Invoke-HL7ReviewedSend -Payload $payload }
                    Write-HL7HttpResponse -Stream $stream -Body ($result | ConvertTo-Json -Depth 20 -Compress)
                } catch {
                    $code = if ($_.Exception.Message -match '^(PROFILE|SEND|DIAGNOSTIC_BASELINE)_[A-Z_]+$') { $_.Exception.Message } else { 'SEND_REQUEST_FAILED' }
                    Write-HL7HttpResponse -Stream $stream -StatusCode 400 -Reason 'Bad Request' -Body ('{"error":"' + $code + '"}')
                }
                return
            }
            if ($path -in @('/api/history', '/api/history/events', '/api/history/session')) {
                try {
                    if ($path -eq '/api/history' -and $request.Method -eq 'GET') {
                        $query = Get-HL7QueryValues -Target $request.Target
                        $sessionId = if ($query.ContainsKey('sessionId')) { $query['sessionId'] } else { '' }
                        $result = Get-HL7History -DataRoot $DataRoot -SessionId $sessionId
                    }
                    elseif ($path -eq '/api/history/events' -and $request.Method -eq 'POST') {
                        $payload = $request.Body | ConvertFrom-Json
                        $result = Write-HL7SanitizedEvent -DataRoot $DataRoot -SessionId (Get-HL7PropertyValue $payload 'sessionId') -Event (Get-HL7PropertyValue $payload 'event')
                    }
                    elseif ($path -eq '/api/history/session' -and $request.Method -eq 'DELETE') {
                        $payload = $request.Body | ConvertFrom-Json
                        $result = Remove-HL7History -DataRoot $DataRoot -SessionIds @(Get-HL7PropertyValue $payload 'sessionIds')
                    }
                    else { throw 'HISTORY_METHOD_REJECTED' }
                    Write-HL7HttpResponse -Stream $stream -Body ($result | ConvertTo-Json -Depth 20 -Compress)
                }
                catch {
                    $code = if ($_.Exception.Message -match '^HISTORY_[A-Z_]+$') { $_.Exception.Message } else { 'HISTORY_REQUEST_FAILED' }
                    Write-HL7HttpResponse -Stream $stream -StatusCode 400 -Reason 'Bad Request' -Body ('{"error":"' + $code + '"}')
                }
                return
            }
            Write-HL7HttpResponse -Stream $stream -StatusCode 404 -Reason 'Not Found' -Body '{"error":"NOT_FOUND"}'
            return
        }

        if ($request.Method -ne 'GET') {
            Write-HL7HttpResponse -Stream $stream -StatusCode 405 -Reason 'Method Not Allowed' -Body '{"error":"METHOD_NOT_ALLOWED"}' -AdditionalHeaders @{ 'Allow' = 'GET' }
            return
        }

        try {
            $staticPath = Get-HL7SafeStaticPath -Root $Root -RequestPath $request.Target
        }
        catch {
            Write-HL7HttpResponse -Stream $stream -StatusCode 400 -Reason 'Bad Request' -Body '{"error":"INVALID_PATH"}'
            return
        }
        if (-not [IO.File]::Exists($staticPath)) {
            Write-HL7HttpResponse -Stream $stream -StatusCode 404 -Reason 'Not Found' -Body '{"error":"NOT_FOUND"}'
            return
        }
        $bytes = [IO.File]::ReadAllBytes($staticPath)
        Write-HL7HttpResponse -Stream $stream -ContentType (Get-HL7ContentType -Path $staticPath) -BodyBytes $bytes
    }
    catch {
        if ($Client.Connected) {
            try {
                Write-HL7HttpResponse -Stream $Client.GetStream() -StatusCode 400 -Reason 'Bad Request' -Body '{"error":"BAD_REQUEST"}'
            }
            catch {}
        }
    }
    finally {
        $Client.Dispose()
    }
}

function Start-HL7ToolkitServer {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$DataRoot,
        [Parameter(Mandatory = $true)][string]$Token,
        [int]$Port = 0,
        [scriptblock]$OnStarted
    )

    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Parse('127.0.0.1'), $Port)
    $listener.Start()
    try {
        $actualPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
        if ($null -ne $OnStarted) { & $OnStarted $actualPort }
        while ($true) {
            $client = $listener.AcceptTcpClient()
            Invoke-HL7HttpConnection -Client $client -Root $Root -DataRoot $DataRoot -Token $Token
        }
    }
    finally {
        $listener.Stop()
    }
}

Export-ModuleMember -Function Start-HL7ToolkitServer, Invoke-HL7HttpConnection
