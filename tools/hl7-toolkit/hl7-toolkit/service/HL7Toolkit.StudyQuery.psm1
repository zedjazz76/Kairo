Set-StrictMode -Version 2.0

if (-not ('Kairo.Diagnostics.StudyQueryClient' -as [type])) {
    try { Add-Type -Path (Join-Path $PSScriptRoot 'DicomQueryDiagnostics.cs') -ErrorAction Stop } catch { }
}

function Get-KairoStudyValue { param($Object,[string]$Name) if ($null -eq $Object) { return $null }; $property=$Object.PSObject.Properties[$Name]; if ($null -eq $property) { return $null }; return $property.Value }
function Assert-KairoStudyText {
    param($Value,[string]$Code,[int]$Maximum)
    if ($Value -isnot [string] -or [string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt $Maximum -or $Value -cne $Value.Trim()) { throw $Code }
    if ($Value.Contains('*') -or $Value.Contains('?')) { throw 'STUDY_WILDCARD_NOT_SUPPORTED' }
    return $Value
}
function Assert-KairoStudyDate {
    param($Value,[string]$Code)
    if ($Value -isnot [string] -or $Value -notmatch '^\d{8}$') { throw $Code }
    $parsed=[DateTime]::MinValue
    if (-not [DateTime]::TryParseExact($Value,'yyyyMMdd',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$parsed)) { throw $Code }
    return $Value
}
function Assert-KairoStudyQueryPayload {
    param([object]$Payload)
    if ($null -eq $Payload -or $Payload -is [Array]) { throw 'STUDY_INPUT_REJECTED' }
    $allowed=@('schema','host','port','callingAe','calledAe','timeoutMs','criteria')
    foreach($property in $Payload.PSObject.Properties) { if ($property.Name -notin $allowed) { throw 'STUDY_INPUT_REJECTED' } }
    if ((Get-KairoStudyValue $Payload 'schema') -cne 'kairo.study-query.v1') { throw 'STUDY_SCHEMA_REJECTED' }
    $host=Assert-KairoStudyText (Get-KairoStudyValue $Payload 'host') 'STUDY_HOST_INVALID' 253
    if ([Uri]::CheckHostName($host) -eq [UriHostNameType]::Unknown -or $host.Contains('/') -or $host.Contains('\\')) { throw 'STUDY_HOST_INVALID' }
    $port=Get-KairoStudyValue $Payload 'port'; $timeout=Get-KairoStudyValue $Payload 'timeoutMs'
    if ($port -isnot [int] -or $port -lt 1 -or $port -gt 65535) { throw 'STUDY_PORT_INVALID' }
    if ($timeout -isnot [int] -or $timeout -lt 100 -or $timeout -gt 10000) { throw 'STUDY_TIMEOUT_INVALID' }
    foreach($name in @('callingAe','calledAe')) {
        $value=Assert-KairoStudyText (Get-KairoStudyValue $Payload $name) 'STUDY_AE_INVALID' 16
        if ($value -notmatch '^[\x20-\x7e]+$' -or $value.Contains('\')) { throw 'STUDY_AE_INVALID' }
    }
    $criteria=Get-KairoStudyValue $Payload 'criteria'
    if ($null -eq $criteria -or $criteria -is [Array]) { throw 'STUDY_CRITERION_REQUIRED' }
    $allowedCriteria=@('accessionNumber','patientId','studyInstanceUid','studyDate','studyDateRange','modalitiesInStudy')
    foreach($property in $criteria.PSObject.Properties) { if ($property.Name -notin $allowedCriteria) { throw 'STUDY_INPUT_REJECTED' } }
    $count=0
    foreach($name in @('accessionNumber','patientId','studyInstanceUid','studyDate','studyDateRange','modalitiesInStudy')) { if ($null -ne (Get-KairoStudyValue $criteria $name)) { $count++ } }
    if ($count -eq 0) { throw 'STUDY_CRITERION_REQUIRED' }
    $limits=@{ accessionNumber=16; patientId=64; studyInstanceUid=64; modalitiesInStudy=16 }
    foreach($name in $limits.Keys) {
        $value=Get-KairoStudyValue $criteria $name
        if ($null -ne $value) { $null=Assert-KairoStudyText $value 'STUDY_CRITERION_INVALID' $limits[$name] }
    }
    $uid=Get-KairoStudyValue $criteria 'studyInstanceUid'
    if ($null -ne $uid -and $uid -notmatch '^[0-9]+(\.[0-9]+)+$') { throw 'STUDY_UID_INVALID' }
    $date=Get-KairoStudyValue $criteria 'studyDate'
    if ($null -ne $date) { $null=Assert-KairoStudyDate $date 'STUDY_DATE_INVALID' }
    $range=Get-KairoStudyValue $criteria 'studyDateRange'
    if ($null -ne $range) {
        if ($range -is [Array] -or $null -ne $date) { throw 'STUDY_DATE_RANGE_INVALID' }
        foreach($property in $range.PSObject.Properties) { if ($property.Name -notin @('start','end')) { throw 'STUDY_DATE_RANGE_INVALID' } }
        $start=Assert-KairoStudyDate (Get-KairoStudyValue $range 'start') 'STUDY_DATE_RANGE_INVALID'
        $end=Assert-KairoStudyDate (Get-KairoStudyValue $range 'end') 'STUDY_DATE_RANGE_INVALID'
        if ($start -gt $end) { throw 'STUDY_DATE_RANGE_INVALID' }
    }
    return $Payload
}
function Invoke-KairoStudyQuery {
    param([object]$Payload)
    $clean=Assert-KairoStudyQueryPayload $Payload
    if (-not ('Kairo.Diagnostics.StudyQueryClient' -as [type])) { throw 'STUDY_RUNTIME_UNAVAILABLE' }
    $request=New-Object Kairo.Diagnostics.StudyQueryRequest
    $request.host=$clean.host; $request.port=[int]$clean.port; $request.callingAe=$clean.callingAe; $request.calledAe=$clean.calledAe; $request.timeoutMs=[int]$clean.timeoutMs
    foreach($name in @('accessionNumber','patientId','studyInstanceUid','studyDate','modalitiesInStudy')) { $value=Get-KairoStudyValue $clean.criteria $name; $request.$name=if($null -eq $value){''}else{[string]$value} }
    $range=Get-KairoStudyValue $clean.criteria 'studyDateRange'; $request.studyDateRange=if($null -eq $range){''}else{([string]$range.start + '-' + [string]$range.end)}
    return [Kairo.Diagnostics.StudyQueryClient]::Run($request)
}
Export-ModuleMember -Function Assert-KairoStudyQueryPayload,Invoke-KairoStudyQuery
