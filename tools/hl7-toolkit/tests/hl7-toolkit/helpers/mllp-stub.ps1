[CmdletBinding()]
param([ValidateRange(1,65535)][int]$Port = 2575, [ValidateSet('AA','AE','AR','CA','CE','CR')][string]$AckCode = 'AA')
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\..\..\hl7-toolkit\service\HL7Toolkit.Mllp.psm1') -DisableNameChecking
$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Output ('Synthetic one-message receiver ready on 127.0.0.1:' + $Port)
try {
    $client = $listener.AcceptTcpClient()
    try {
        $stream = $client.GetStream()
        $received = Read-HL7MllpFrame -Stream $stream -TimeoutMs 10000
        if ($received -notmatch '^MSH\|') { throw 'Synthetic stub expects standard delimiters' }
        $fields = $received.Split("`r")[0].Split('|')
        $controlId = $fields[9]
        $ack = 'MSH|^~\&|STUB|SYNTHETIC|TOOL|TEST|202609031200||ACK|SYNTHETIC-ACK|P|2.5.1' + "`rMSA|" + $AckCode + '|' + $controlId + "`r"
        Write-HL7MllpFrame -Stream $stream -Text $ack
        Write-Output 'One frame received and acknowledged. Message content was not logged.'
    } finally { $client.Dispose() }
} finally { $listener.Stop() }
