Set-StrictMode -Version 2.0
Import-Module (Join-Path $PSScriptRoot 'HL7Toolkit.History.psm1') -DisableNameChecking
Import-Module (Join-Path $PSScriptRoot 'HL7Toolkit.Paths.psm1') -DisableNameChecking

function Assert-HL7EndpointProfile {
    param([object]$Profile)
    if ($null -eq $Profile -or $Profile -is [Array]) { throw 'PROFILE_OBJECT_REQUIRED' }
    $allowed = @('schema','id','label','environment','type','host','port','callingAe','calledAe','connectTimeoutMs','responseTimeoutMs','encoding','startByte','endBytes','notes')
    foreach ($name in (Get-HL7PropertyNames $Profile)) { if ($name -notin $allowed) { throw 'PROFILE_PROPERTY_REJECTED' } }
    if ((Get-HL7PropertyValue $Profile 'schema') -ne 'hl7-toolkit.endpoint-profile.v1') { throw 'PROFILE_SCHEMA_REJECTED' }
    $clean = [ordered]@{ schema = 'hl7-toolkit.endpoint-profile.v1' }
    foreach ($name in @('id','label','environment','host','encoding','notes')) {
        $value = Get-HL7PropertyValue $Profile $name ''
        if ($value -isnot [string]) { throw 'PROFILE_TEXT_REJECTED' }
        $clean[$name] = $value.Trim()
    }
    $clean['type'] = Get-HL7PropertyValue $Profile 'type' 'mllp'
    if ($clean.type -isnot [string] -or $clean.type -notin @('tcp','dicom','http','https','mllp')) { throw 'PROFILE_TYPE_REJECTED' }
    foreach ($name in @('callingAe','calledAe')) {
        $value = Get-HL7PropertyValue $Profile $name ''
        if ($value -isnot [string] -or $value.Length -gt 16 -or $value -match '[^ -~\\]' -or $value -match '\\') { throw 'PROFILE_AE_REJECTED' }
        $clean[$name] = $value.Trim()
    }
    if ($clean.id -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { throw 'PROFILE_ID_REJECTED' }
    if ($clean.label.Length -lt 1 -or $clean.label.Length -gt 80 -or $clean.notes.Length -gt 500) { throw 'PROFILE_LABEL_REJECTED' }
    if (($clean.label + ' ' + $clean.notes) -match '[\x00-\x1f]|https?://|MSH[|^]|PID[|^]|BEGIN .*KEY|BEGIN CERTIFICATE|password\s*[:=]|token\s*[:=]|secret\s*[:=]') { throw 'PROFILE_NONCLINICAL_TEXT_REQUIRED' }
    if ($clean.environment -notin @('Test','Production')) { throw 'PROFILE_ENVIRONMENT_REJECTED' }
    if ($clean.host.Length -gt 253 -or [Uri]::CheckHostName($clean.host) -eq [UriHostNameType]::Unknown) { throw 'PROFILE_HOST_REJECTED' }
    if ($clean.encoding -notin @('utf-8','ascii','windows-1252','iso-8859-1')) { throw 'PROFILE_ENCODING_REJECTED' }
    foreach ($name in @('port','connectTimeoutMs','responseTimeoutMs','startByte')) {
        $number = Get-HL7PropertyValue $Profile $name
        if ($number -isnot [ValueType] -or $number -is [bool] -or [math]::Floor([double]$number) -ne $number) { throw 'PROFILE_NUMBER_REJECTED' }
        $maximum = 120000; $minimum = 100
        if ($name -eq 'port') { $maximum = 65535; $minimum = 1 }
        if ($name -eq 'startByte') { $maximum = 255; $minimum = 0 }
        if ($number -lt $minimum -or $number -gt $maximum) { throw 'PROFILE_NUMBER_REJECTED' }
        $clean[$name] = [int]$number
    }
    $end = @(Get-HL7PropertyValue $Profile 'endBytes')
    if ($end.Count -lt 1 -or $end.Count -gt 8) { throw 'PROFILE_FRAMING_REJECTED' }
    foreach ($number in $end) {
        if ($number -isnot [ValueType] -or $number -is [bool] -or $number -lt 0 -or $number -gt 255 -or [math]::Floor([double]$number) -ne $number) { throw 'PROFILE_FRAMING_REJECTED' }
    }
    $clean['endBytes'] = [int[]]$end
    return [pscustomobject]$clean
}

function Get-HL7ProfilePath {
    param([string]$DataRoot, [string]$Id)
    if ($Id -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { throw 'PROFILE_ID_REJECTED' }
    $folder = [IO.Path]::GetFullPath((Join-Path $DataRoot 'profiles')).TrimEnd('\') + '\'
    $target = [IO.Path]::GetFullPath((Join-Path $folder ($Id + '.json')))
    if (-not $target.StartsWith($folder, [StringComparison]::OrdinalIgnoreCase)) { throw 'PROFILE_PATH_REJECTED' }
    Assert-HL7LocalDataPath -Root $DataRoot -Target $target
    return $target
}

function Save-HL7EndpointProfile {
    param([string]$DataRoot, [object]$Profile)
    $clean = Assert-HL7EndpointProfile $Profile
    $target = Get-HL7ProfilePath $DataRoot $clean.id
    Write-HL7AtomicJson -Path $target -Value $clean
    return $clean
}

function Get-HL7EndpointProfiles {
    param([string]$DataRoot)
    $folder = Join-Path $DataRoot 'profiles'
    Assert-HL7LocalDataPath -Root $DataRoot -Target $folder
    $profiles = New-Object Collections.Generic.List[object]
    $invalidCount = 0
    if ([IO.Directory]::Exists($folder)) {
        foreach ($file in [IO.Directory]::GetFiles($folder, '*.json')) {
            try {
                Assert-HL7LocalDataPath -Root $DataRoot -Target $file
                $profile = Assert-HL7EndpointProfile ([IO.File]::ReadAllText($file) | ConvertFrom-Json)
                if ([IO.Path]::GetFileNameWithoutExtension($file) -cne $profile.id) { throw 'PROFILE_ID_REJECTED' }
                $profiles.Add($profile)
            } catch { $invalidCount += 1 }
        }
    }
    return [pscustomobject]@{ profiles = @($profiles.ToArray() | Sort-Object label); invalidCount = $invalidCount }
}

function Remove-HL7EndpointProfile {
    param([string]$DataRoot, [string]$Id)
    $target = Get-HL7ProfilePath $DataRoot $Id
    $exists = [IO.File]::Exists($target)
    if ($exists) { [IO.File]::Delete($target) }
    return [pscustomobject]@{ deleted = $exists }
}

function Get-HL7DiagnosticBaselinePath {
    param([string]$DataRoot, [string]$ProfileId)
    if ($ProfileId -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { throw 'DIAGNOSTIC_BASELINE_ID_REJECTED' }
    $folder = [IO.Path]::GetFullPath((Join-Path $DataRoot 'diagnostic-baselines')).TrimEnd('\') + '\'
    $target = [IO.Path]::GetFullPath((Join-Path $folder ($ProfileId + '.json')))
    if (-not $target.StartsWith($folder, [StringComparison]::OrdinalIgnoreCase)) { throw 'DIAGNOSTIC_BASELINE_ID_REJECTED' }
    Assert-HL7LocalDataPath -Root $DataRoot -Target $target
    return $target
}

function Assert-HL7DiagnosticBaseline {
    param([object]$Baseline)
    if ($null -eq $Baseline -or $Baseline -is [Array]) { throw 'DIAGNOSTIC_BASELINE_REJECTED' }
    $allowed = @('schema','profileId','type','endpoint','savedAt','classification','totalMs','layers','certificateDaysUntilExpiration','tlsVersion','httpStatus','acknowledgmentCode')
    foreach ($name in (Get-HL7PropertyNames $Baseline)) { if ($name -notin $allowed) { throw 'DIAGNOSTIC_BASELINE_REJECTED' } }
    if ((Get-HL7PropertyValue $Baseline 'schema') -ne 'kairo.diagnostic-baseline.v1' -or (Get-HL7PropertyValue $Baseline 'profileId') -notmatch '^[a-z0-9][a-z0-9-]{0,63}$' -or (Get-HL7PropertyValue $Baseline 'type') -notin @('tcp','dicom','http','https','mllp')) { throw 'DIAGNOSTIC_BASELINE_REJECTED' }
    if ((Get-HL7PropertyValue $Baseline 'classification') -notmatch '^[A-Z0-9_]{1,64}$' -or (Get-HL7PropertyValue $Baseline 'savedAt') -isnot [string]) { throw 'DIAGNOSTIC_BASELINE_REJECTED' }
    $total = Get-HL7PropertyValue $Baseline 'totalMs'; if ($total -isnot [ValueType] -or $total -lt 0 -or $total -gt 600000) { throw 'DIAGNOSTIC_BASELINE_REJECTED' }
    $endpoint = Get-HL7PropertyValue $Baseline 'endpoint'; $layers = Get-HL7PropertyValue $Baseline 'layers'
    if ($null -eq $endpoint -or $null -eq $layers -or (Get-HL7PropertyValue $endpoint 'label') -isnot [string] -or (Get-HL7PropertyValue $endpoint 'host') -isnot [string]) { throw 'DIAGNOSTIC_BASELINE_REJECTED' }
    foreach ($name in (Get-HL7PropertyNames $layers)) {
        if ($name -notin @('dns','tcp','association','echo','tls','http','mllp','ack','application')) { throw 'DIAGNOSTIC_BASELINE_REJECTED' }
        $layer = Get-HL7PropertyValue $layers $name; $code = Get-HL7PropertyValue $layer 'code'; $elapsed = Get-HL7PropertyValue $layer 'elapsedMs'
        if ($code -isnot [string] -or $code -notmatch '^[A-Z0-9_]{1,64}$' -or $elapsed -isnot [ValueType] -or $elapsed -lt 0 -or $elapsed -gt 600000) { throw 'DIAGNOSTIC_BASELINE_REJECTED' }
    }
    return $Baseline
}

function Save-HL7DiagnosticBaseline {
    param([string]$DataRoot, [object]$Baseline)
    $clean = Assert-HL7DiagnosticBaseline $Baseline; $target = Get-HL7DiagnosticBaselinePath -DataRoot $DataRoot -ProfileId $clean.profileId
    Write-HL7AtomicJson -Path $target -Value $clean
    return $clean
}

function Get-HL7DiagnosticBaseline {
    param([string]$DataRoot, [string]$ProfileId)
    $target = Get-HL7DiagnosticBaselinePath -DataRoot $DataRoot -ProfileId $ProfileId
    if (-not [IO.File]::Exists($target)) { return [pscustomobject]@{ baseline = $null } }
    try { return [pscustomobject]@{ baseline = Assert-HL7DiagnosticBaseline ([IO.File]::ReadAllText($target) | ConvertFrom-Json) } }
    catch { throw 'DIAGNOSTIC_BASELINE_REJECTED' }
}

Export-ModuleMember -Function Assert-HL7EndpointProfile, Save-HL7EndpointProfile, Get-HL7EndpointProfiles, Remove-HL7EndpointProfile, Save-HL7DiagnosticBaseline, Get-HL7DiagnosticBaseline
