Set-StrictMode -Version 2.0
if (-not ('Kairo.Diagnostics.EndpointProbe' -as [type])) {
    Add-Type -Path @((Join-Path $PSScriptRoot 'EndpointDiagnostics.cs'), (Join-Path $PSScriptRoot 'HttpTlsDiagnostics.cs')) -ErrorAction Stop
}
function Invoke-KairoEndpointDiagnostic {
    param([object]$Payload)
    if ($null -eq $Payload -or $Payload -is [Array]) { throw 'DIAGNOSTIC_INPUT_REJECTED' }
    if ($null -eq $Payload.PSObject.Properties['mode'] -or $Payload.mode -isnot [string]) { throw 'DIAGNOSTIC_INPUT_REJECTED' }
    $timeout = 3000
    if ($null -ne $Payload.PSObject.Properties['timeoutMs']) {
        if (($Payload.timeoutMs -isnot [int] -and $Payload.timeoutMs -isnot [long]) -or $Payload.timeoutMs -lt 100 -or $Payload.timeoutMs -gt 10000) { throw 'DIAGNOSTIC_INPUT_REJECTED' }
        $timeout = [int]$Payload.timeoutMs
    }
    if ($Payload.mode -eq 'http') {
        if ($null -eq $Payload.PSObject.Properties['target'] -or $Payload.target -isnot [string]) { throw 'DIAGNOSTIC_INPUT_REJECTED' }
        try { return [Kairo.Diagnostics.HttpTlsProbe]::Run($Payload.target, $timeout) } catch { throw 'DIAGNOSTIC_INPUT_REJECTED' }
    }
    foreach ($field in @('host', 'port')) {
        if ($null -eq $Payload.PSObject.Properties[$field]) { throw 'DIAGNOSTIC_INPUT_REJECTED' }
    }
    if ($Payload.host -isnot [string]) { throw 'DIAGNOSTIC_INPUT_REJECTED' }
    if (($Payload.port -isnot [int] -and $Payload.port -isnot [long]) -or $Payload.port -lt 1 -or $Payload.port -gt 65535) { throw 'DIAGNOSTIC_INPUT_REJECTED' }
    $calling = ''; $called = ''
    if ($Payload.mode -eq 'dicom') {
        foreach ($field in @('callingAe', 'calledAe')) {
            if ($null -eq $Payload.PSObject.Properties[$field] -or $Payload.$field -isnot [string]) { throw 'DIAGNOSTIC_AE_REJECTED' }
        }
        $calling = $Payload.callingAe; $called = $Payload.calledAe
    }
    try { return [Kairo.Diagnostics.EndpointProbe]::Run($Payload.mode, $Payload.host, [int]$Payload.port, $timeout, $calling, $called) }
    catch { throw 'DIAGNOSTIC_INPUT_REJECTED' }
}
Export-ModuleMember -Function Invoke-KairoEndpointDiagnostic
