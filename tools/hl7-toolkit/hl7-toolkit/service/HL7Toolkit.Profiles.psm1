Set-StrictMode -Version 2.0
Import-Module (Join-Path $PSScriptRoot 'HL7Toolkit.History.psm1') -DisableNameChecking
Import-Module (Join-Path $PSScriptRoot 'HL7Toolkit.Paths.psm1') -DisableNameChecking

function Assert-HL7EndpointProfile {
    param([object]$Profile)
    if ($null -eq $Profile -or $Profile -is [Array]) { throw 'PROFILE_OBJECT_REQUIRED' }
    $allowed = @('schema','id','label','environment','host','port','connectTimeoutMs','responseTimeoutMs','encoding','startByte','endBytes','notes')
    foreach ($name in (Get-HL7PropertyNames $Profile)) { if ($name -notin $allowed) { throw 'PROFILE_PROPERTY_REJECTED' } }
    if ((Get-HL7PropertyValue $Profile 'schema') -ne 'hl7-toolkit.endpoint-profile.v1') { throw 'PROFILE_SCHEMA_REJECTED' }
    $clean = [ordered]@{ schema = 'hl7-toolkit.endpoint-profile.v1' }
    foreach ($name in @('id','label','environment','host','encoding','notes')) {
        $value = Get-HL7PropertyValue $Profile $name ''
        if ($value -isnot [string]) { throw 'PROFILE_TEXT_REJECTED' }
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

Export-ModuleMember -Function Assert-HL7EndpointProfile, Save-HL7EndpointProfile, Get-HL7EndpointProfiles, Remove-HL7EndpointProfile
