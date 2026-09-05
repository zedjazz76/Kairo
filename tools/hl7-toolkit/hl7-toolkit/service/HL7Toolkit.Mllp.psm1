Set-StrictMode -Version 2.0
Import-Module (Join-Path $PSScriptRoot 'HL7Toolkit.Profiles.psm1') -DisableNameChecking

function Get-HL7WireEncoding {
    param([string]$Name = 'utf-8')
    return [Text.Encoding]::GetEncoding($Name, (New-Object Text.EncoderExceptionFallback), (New-Object Text.DecoderExceptionFallback))
}

function ConvertTo-HL7MllpFrame {
    param([object]$Message, [Text.Encoding]$Encoding, [byte]$StartByte = 11, [byte[]]$EndBytes = @(28,13))
    if ($Message -isnot [string] -or $Message.Length -lt 8 -or $Message.Length -gt 8388608) { throw 'SEND_ONE_MESSAGE_REQUIRED' }
    $wire = $Message.Replace("`r`n", "`r").Replace("`n", "`r")
    if ($wire -notmatch '^MSH[^A-Za-z0-9\s]' -or [regex]::Matches($wire, '(?:^|\r)MSH[^A-Za-z0-9\s]').Count -ne 1 -or $wire -match '[\x00\x0b\x1c]') { throw 'SEND_ONE_MESSAGE_REQUIRED' }
    try { $payload = $Encoding.GetBytes($wire) } catch { throw 'SEND_ENCODING_UNSUPPORTED_CHARACTER' }
    # Framing markers may not occur inside the encoded message.
    if ($payload -contains $StartByte) { throw 'SEND_EMBEDDED_FRAMING' }
    for ($index = 0; $index -le $payload.Length - $EndBytes.Length; $index += 1) {
        $same = $true
        for ($endIndex = 0; $endIndex -lt $EndBytes.Length; $endIndex += 1) { if ($payload[$index + $endIndex] -ne $EndBytes[$endIndex]) { $same = $false; break } }
        if ($same) { throw 'SEND_EMBEDDED_FRAMING' }
    }
    $frame = New-Object byte[] ($payload.Length + 1 + $EndBytes.Length)
    $frame[0] = $StartByte
    [Array]::Copy($payload, 0, $frame, 1, $payload.Length)
    [Array]::Copy($EndBytes, 0, $frame, $payload.Length + 1, $EndBytes.Length)
    return ,$frame
}

function Connect-HL7TcpClient {
    param([Net.Sockets.TcpClient]$Client, [object]$Profile)
    $pending = $Client.BeginConnect($Profile.host, $Profile.port, $null, $null)
    try {
        if (-not $pending.AsyncWaitHandle.WaitOne($Profile.connectTimeoutMs)) { throw 'CONNECT_TIMEOUT' }
        $Client.EndConnect($pending)
    } finally { $pending.AsyncWaitHandle.Close() }
}

function Read-HL7MllpFrame {
    param([IO.Stream]$Stream, [int]$TimeoutMs = 10000, [Text.Encoding]$Encoding = (Get-HL7WireEncoding), [byte]$StartByte = 11, [byte[]]$EndBytes = @(28,13))
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $bytes = New-Object Collections.Generic.List[byte]
    $started = $false
    while ($true) {
        $remaining = $TimeoutMs - [int]$timer.ElapsedMilliseconds
        if ($remaining -le 0) { throw 'RESPONSE_TIMEOUT' }
        $Stream.ReadTimeout = [math]::Max(1, $remaining)
        $value = $Stream.ReadByte()
        if ($value -lt 0) { throw 'RESPONSE_INCOMPLETE' }
        if (-not $started) {
            if ($value -ne $StartByte) { throw 'RESPONSE_MALFORMED' }
            $started = $true
            continue
        }
        $bytes.Add([byte]$value)
        if ($bytes.Count -gt 1048576) { throw 'RESPONSE_MALFORMED' }
        if ($bytes.Count -ge $EndBytes.Length) {
            $same = $true
            for ($index = 0; $index -lt $EndBytes.Length; $index += 1) {
                if ($bytes[$bytes.Count - $EndBytes.Length + $index] -ne $EndBytes[$index]) { $same = $false; break }
            }
            if ($same) {
                try { return $Encoding.GetString($bytes.ToArray(), 0, $bytes.Count - $EndBytes.Length) }
                catch { throw 'RESPONSE_MALFORMED' }
            }
        }
    }
}

function Write-HL7MllpFrame {
    param([IO.Stream]$Stream, [string]$Text, [Text.Encoding]$Encoding = (Get-HL7WireEncoding), [byte]$StartByte = 11, [byte[]]$EndBytes = @(28,13))
    $frame = ConvertTo-HL7MllpFrame -Message $Text -Encoding $Encoding -StartByte $StartByte -EndBytes $EndBytes
    $Stream.Write($frame, 0, $frame.Length)
    $Stream.Flush()
}

function Test-HL7Endpoint {
    param([object]$Profile)
    $clean = Assert-HL7EndpointProfile $Profile
    $client = New-Object Net.Sockets.TcpClient
    $timer = [Diagnostics.Stopwatch]::StartNew()
    try {
        Connect-HL7TcpClient $client $clean
        return [pscustomobject]@{ status = 'reachable'; latencyMs = $timer.ElapsedMilliseconds; bytesSent = 0 }
    } catch { return [pscustomobject]@{ status = 'connect-failed'; latencyMs = $timer.ElapsedMilliseconds; bytesSent = 0 } }
    finally { $client.Dispose() }
}

function Send-HL7MllpMessage {
    param([object]$Profile, [object]$Message)
    $clean = Assert-HL7EndpointProfile $Profile
    $encoding = Get-HL7WireEncoding $clean.encoding
    $frame = ConvertTo-HL7MllpFrame -Message $Message -Encoding $encoding -StartByte $clean.startByte -EndBytes $clean.endBytes
    $client = New-Object Net.Sockets.TcpClient
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $result = [ordered]@{ status = 'connect-failed'; bytesSent = 0; latencyMs = 0; connectMs = 0; responseMs = 0; writeAttempted = $false; deliveryUncertain = $false; response = '' }
    try {
        Connect-HL7TcpClient $client $clean
        $result.connectMs = $timer.ElapsedMilliseconds
        $stream = $client.GetStream()
        $stream.WriteTimeout = $clean.connectTimeoutMs
        # A failed write can be partial. Never report a safe-to-retry failure after attempting it.
        $result.writeAttempted = $true
        $stream.Write($frame, 0, $frame.Length)
        $stream.Flush()
        $result.bytesSent = $frame.Length
        $responseStart = $timer.ElapsedMilliseconds
        $result.response = Read-HL7MllpFrame -Stream $stream -TimeoutMs $clean.responseTimeoutMs -Encoding $encoding -StartByte $clean.startByte -EndBytes $clean.endBytes
        $result.responseMs = $timer.ElapsedMilliseconds - $responseStart
        $result.status = 'response'
    } catch {
        if ($result.writeAttempted) {
            $result.deliveryUncertain = $true
            $result.status = if ($_.Exception.Message -eq 'RESPONSE_MALFORMED') { 'malformed-response' } else { 'unknown-delivery' }
        }
    } finally { $client.Dispose(); $result.latencyMs = $timer.ElapsedMilliseconds }
    return [pscustomobject]$result
}

Export-ModuleMember -Function Test-HL7Endpoint, Send-HL7MllpMessage, Read-HL7MllpFrame, Write-HL7MllpFrame
