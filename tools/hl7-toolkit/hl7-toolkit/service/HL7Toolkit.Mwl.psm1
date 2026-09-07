Set-StrictMode -Version 2.0

if (-not ('Kairo.Diagnostics.MwlQueryClient' -as [type])) {
    try { Add-Type -Path (Join-Path $PSScriptRoot 'DicomQueryDiagnostics.cs') -ErrorAction Stop } catch { }
}

function Get-KairoMwlValue { param($Object,[string]$Name) if ($null -eq $Object) { return $null }; $p=$Object.PSObject.Properties[$Name]; if ($null -eq $p) { return $null }; return $p.Value }
function Assert-KairoMwlText { param($Value,[string]$Code,[int]$Maximum) if ($Value -isnot [string] -or [string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt $Maximum -or $Value -cne $Value.Trim()) { throw $Code }; return $Value }
function Assert-KairoMwlQueryPayload {
    param([object]$Payload)
    if ($null -eq $Payload -or $Payload -is [Array]) { throw 'MWL_INPUT_REJECTED' }
    $allowed=@('schema','host','port','callingAe','calledAe','timeoutMs','criteria')
    foreach($p in $Payload.PSObject.Properties) { if ($p.Name -notin $allowed) { throw 'MWL_INPUT_REJECTED' } }
    if ((Get-KairoMwlValue $Payload 'schema') -cne 'kairo.mwl-query.v1') { throw 'MWL_SCHEMA_REJECTED' }
    $host=Assert-KairoMwlText (Get-KairoMwlValue $Payload 'host') 'MWL_HOST_INVALID' 253
    if ([Uri]::CheckHostName($host) -eq [UriHostNameType]::Unknown -or $host.Contains('*') -or $host.Contains('/')) { throw 'MWL_HOST_INVALID' }
    $port=Get-KairoMwlValue $Payload 'port'; $timeout=Get-KairoMwlValue $Payload 'timeoutMs'
    if ($port -isnot [int] -or $port -lt 1 -or $port -gt 65535) { throw 'MWL_PORT_INVALID' }
    if ($timeout -isnot [int] -or $timeout -lt 100 -or $timeout -gt 10000) { throw 'MWL_TIMEOUT_INVALID' }
    foreach($n in @('callingAe','calledAe')) { $v=Assert-KairoMwlText (Get-KairoMwlValue $Payload $n) 'MWL_AE_INVALID' 16; if ($v -notmatch '^[\x20-\x7e]+$' -or $v.Contains('\')) { throw 'MWL_AE_INVALID' } }
    $criteria=Get-KairoMwlValue $Payload 'criteria'; if ($null -eq $criteria -or $criteria -is [Array]) { throw 'MWL_CRITERION_REQUIRED' }
    $allowedCriteria=@('scheduledDate','scheduledDateRange','modality','scheduledStationAe','patientId','accessionNumber','requestedProcedureId','requestedProcedureDescription','procedureCode','scheduledLocation')
    $count=0
    foreach($p in $criteria.PSObject.Properties) { if ($p.Name -notin $allowedCriteria) { throw 'MWL_INPUT_REJECTED' }; if ($null -ne $p.Value -and -not [string]::IsNullOrWhiteSpace([string]$p.Value)) { $count++ } }
    if ($count -eq 0) { throw 'MWL_CRITERION_REQUIRED' }
    $date=Get-KairoMwlValue $criteria 'scheduledDate'; if ($null -ne $date -and $date -notmatch '^\d{8}$') { throw 'MWL_DATE_INVALID' }
    return $Payload
}
function Invoke-KairoMwlQuery {
    param([object]$Payload)
    $clean=Assert-KairoMwlQueryPayload $Payload
    if (-not ('Kairo.Diagnostics.MwlQueryClient' -as [type])) { throw 'MWL_RUNTIME_UNAVAILABLE' }
    $request = New-Object Kairo.Diagnostics.MwlQueryRequest
    $request.host = $clean.host; $request.port = [int]$clean.port
    $request.callingAe = $clean.callingAe; $request.calledAe = $clean.calledAe
    $request.timeoutMs = [int]$clean.timeoutMs
    $scheduledDate = Get-KairoMwlValue $clean.criteria 'scheduledDate'
    $request.scheduledDate = if ($null -eq $scheduledDate) { '' } else { [string]$scheduledDate }
    return [Kairo.Diagnostics.MwlQueryClient]::Run($request)
}
Export-ModuleMember -Function Assert-KairoMwlQueryPayload,Invoke-KairoMwlQuery
