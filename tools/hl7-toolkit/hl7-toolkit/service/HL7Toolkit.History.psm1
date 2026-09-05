Set-StrictMode -Version 2.0
Import-Module (Join-Path $PSScriptRoot 'HL7Toolkit.Paths.psm1') -DisableNameChecking

function Get-HL7PropertyValue {
    param([object]$Value, [string]$Name, $Default = $null)
    if ($Value -is [Collections.IDictionary]) {
        if ($Value.Contains($Name)) { return $Value[$Name] }
    }
    elseif ($null -ne $Value -and $null -ne $Value.PSObject.Properties[$Name]) {
        return $Value.PSObject.Properties[$Name].Value
    }
    return $Default
}

function Get-HL7PropertyNames {
    param([object]$Value)
    if ($Value -is [Collections.IDictionary]) { return @($Value.Keys) }
    return @($Value.PSObject.Properties | ForEach-Object { $_.Name })
}

function Assert-HL7SanitizedSchema {
    param([Parameter(Mandatory = $true)][object]$Event)

    $allowed = @('schema', 'type', 'sanitizedText', 'sanitizedResponse', 'policyVersion', 'mode', 'warningCounts', 'overrideCount', 'outcome', 'latencyMs', 'bytesSent', 'profileLabel', 'ackCode', 'correlated')
    foreach ($name in (Get-HL7PropertyNames $Event)) {
        if ($name -notin $allowed) { throw 'HISTORY_PROPERTY_REJECTED' }
    }
    if ((Get-HL7PropertyValue $Event 'schema') -ne 'hl7-toolkit.sanitized-event.v1') { throw 'HISTORY_SCHEMA_REJECTED' }
    $type = Get-HL7PropertyValue $Event 'type'
    if ($type -notin @('clipboard-copy', 'message-save', 'send-result', 'comparison-save')) { throw 'HISTORY_EVENT_TYPE_REJECTED' }
    $policyVersion = [string](Get-HL7PropertyValue $Event 'policyVersion')
    if ($policyVersion -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]{0,63}$') { throw 'HISTORY_POLICY_REJECTED' }
    $mode = [string](Get-HL7PropertyValue $Event 'mode' 'chat-safe')
    if ($mode -notin @('chat-safe', 'synthetic-test')) { throw 'HISTORY_MODE_REJECTED' }

    $clean = [ordered]@{
        schema = 'hl7-toolkit.sanitized-event.v1'
        type = $type
        eventId = [Guid]::NewGuid().ToString('N')
        timestamp = [DateTime]::UtcNow.ToString('o')
        policyVersion = $policyVersion
        mode = $mode
    }
    foreach ($name in @('sanitizedText', 'sanitizedResponse')) {
        $value = Get-HL7PropertyValue $Event $name ''
        if ($value -isnot [string] -or $value.Length -gt 8388608) { throw 'HISTORY_CONTENT_REJECTED' }
        $clean[$name] = $value
    }
    $counts = Get-HL7PropertyValue $Event 'warningCounts' @{}
    $safeCounts = [ordered]@{}
    foreach ($name in (Get-HL7PropertyNames $counts)) {
        $number = Get-HL7PropertyValue $counts $name
        if ($name -notmatch '^[A-Z][A-Z0-9_]{0,63}$' -or $number -isnot [ValueType] -or $number -lt 0 -or $number -gt 1000000 -or [math]::Floor($number) -ne $number) { throw 'HISTORY_WARNING_COUNT_REJECTED' }
        $safeCounts[$name] = [int]$number
    }
    $clean['warningCounts'] = $safeCounts
    foreach ($name in @('overrideCount', 'latencyMs', 'bytesSent')) {
        $value = Get-HL7PropertyValue $Event $name 0
        if ($value -isnot [ValueType] -or $value -lt 0 -or $value -gt 2147483647) { throw 'HISTORY_NUMBER_REJECTED' }
        $clean[$name] = $value
    }
    $outcome = [string](Get-HL7PropertyValue $Event 'outcome' 'saved')
    if ($outcome -notin @('saved', 'authorized', 'response', 'refused', 'timeout', 'unknown-delivery', 'malformed-response', 'connect-failed', 'send-failed', 'canceled')) { throw 'HISTORY_OUTCOME_REJECTED' }
    $clean['outcome'] = $outcome
    $profileLabel = [string](Get-HL7PropertyValue $Event 'profileLabel' '')
    if ($profileLabel.Length -gt 80 -or $profileLabel -match '[\r\n\x00-\x1f]') { throw 'HISTORY_LABEL_REJECTED' }
    $clean['profileLabel'] = $profileLabel
    $ackCode = [string](Get-HL7PropertyValue $Event 'ackCode' '')
    if ($ackCode -notin @('', 'AA', 'AE', 'AR', 'CA', 'CE', 'CR', 'UNKNOWN')) { throw 'HISTORY_ACK_CODE_REJECTED' }
    $clean['ackCode'] = $ackCode
    $clean['correlated'] = [bool](Get-HL7PropertyValue $Event 'correlated' $false)
    return [pscustomobject]$clean
}

function Write-HL7AtomicText {
    param([string]$Path, [AllowEmptyString()][string]$Text)
    $folder = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))
    [IO.Directory]::CreateDirectory($folder) | Out-Null
    $temporaryPath = Join-Path $folder ('.' + [IO.Path]::GetFileName($Path) + '.' + [Guid]::NewGuid().ToString('N') + '.tmp')
    try {
        $bytes = (New-Object Text.UTF8Encoding($false)).GetBytes($Text)
        $stream = New-Object IO.FileStream($temporaryPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) }
        finally { $stream.Dispose() }
        if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporaryPath, $Path, [NullString]::Value, $true) }
        else { [IO.File]::Move($temporaryPath, $Path) }
    }
    finally {
        if ([IO.File]::Exists($temporaryPath)) { [IO.File]::Delete($temporaryPath) }
    }
}

function Write-HL7AtomicJson {
    param([string]$Path, [object]$Value)
    Write-HL7AtomicText -Path $Path -Text ($Value | ConvertTo-Json -Depth 20 -Compress)
}

function Write-HL7AppendText {
    param([string]$Path, [AllowEmptyString()][string]$Text)
    $bytes = (New-Object Text.UTF8Encoding($false)).GetBytes($Text)
    $stream = New-Object IO.FileStream($Path, [IO.FileMode]::Append, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
}

function Sync-HL7HistoryIndex {
    param([string]$SessionPath, [string]$SessionId)
    $eventsPath = Join-Path $SessionPath 'events.jsonl'
    $messagesPath = Join-Path $SessionPath 'messages.hl7'
    $manifestPath = Join-Path $SessionPath 'manifest.json'
    foreach ($target in @($eventsPath, $messagesPath, $manifestPath)) { Assert-HL7LocalDataPath -Root $SessionPath -Target $target }
    $eventBytes = if ([IO.File]::Exists($eventsPath)) { (New-Object IO.FileInfo($eventsPath)).Length } else { 0L }
    $messageBytes = if ([IO.File]::Exists($messagesPath)) { (New-Object IO.FileInfo($messagesPath)).Length } else { 0L }
    if ([IO.File]::Exists($manifestPath)) {
        try {
            $manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
            if ((Get-HL7PropertyValue $manifest 'journalBytes' -1) -eq $eventBytes -and (Get-HL7PropertyValue $manifest 'contentBytes' -1) -eq $messageBytes) { return $manifest }
        } catch { }
    }
    # The newline-committed sanitized journal is authoritative. Rebuild disposable indexes after interruption.
    $journal = if ([IO.File]::Exists($eventsPath)) { [IO.File]::ReadAllText($eventsPath) } else { '' }
    if ($journal -and -not $journal.EndsWith("`n")) {
        $lastCommit = $journal.LastIndexOf("`n")
        $journal = if ($lastCommit -ge 0) { $journal.Substring(0, $lastCommit + 1) } else { '' }
        Write-HL7AtomicText -Path $eventsPath -Text $journal
    }
    $content = New-Object Text.StringBuilder
    $count = 0; $created = [DateTime]::UtcNow.ToString('o'); $updated = $created
    foreach ($line in $journal.Split(@("`n"), [StringSplitOptions]::RemoveEmptyEntries)) {
        try {
            $record = $line | ConvertFrom-Json
            $candidate = @{}
            foreach ($property in $record.PSObject.Properties) { if ($property.Name -notin @('eventId','timestamp')) { $candidate[$property.Name] = $property.Value } }
            $checked = Assert-HL7SanitizedSchema $candidate
            if ($record.eventId -notmatch '^[a-f0-9]{32}$') { throw 'invalid event ID' }
            [void][DateTime]::Parse($record.timestamp)
        } catch { throw 'HISTORY_JOURNAL_INVALID' }
        if ($count -eq 0) { $created = $record.timestamp }
        $updated = $record.timestamp; $count += 1
        [void]$content.Append($checked.sanitizedText)
        if ($checked.sanitizedResponse) { [void]$content.Append("`r").Append($checked.sanitizedResponse) }
        [void]$content.Append("`r`n")
    }
    $text = $content.ToString()
    Write-HL7AtomicText -Path $messagesPath -Text $text
    $manifest = [pscustomobject]@{ schema = 'hl7-toolkit.session.v1'; sessionId = $SessionId; createdUtc = $created; updatedUtc = $updated;
        eventCount = $count; contentCharacters = $text.Length; journalBytes = [Text.Encoding]::UTF8.GetByteCount($journal); contentBytes = [Text.Encoding]::UTF8.GetByteCount($text) }
    Write-HL7AtomicJson -Path $manifestPath -Value $manifest
    return $manifest
}

function Get-HL7SessionPath {
    param([string]$DataRoot, [string]$SessionId)
    if ($SessionId -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { throw 'HISTORY_SESSION_ID_REJECTED' }
    $historyRoot = [IO.Path]::GetFullPath((Join-Path $DataRoot 'history')).TrimEnd('\') + '\'
    $target = [IO.Path]::GetFullPath((Join-Path $historyRoot $SessionId))
    if (-not $target.StartsWith($historyRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'HISTORY_PATH_REJECTED' }
    Assert-HL7LocalDataPath -Root $DataRoot -Target $target
    return $target
}

function Write-HL7SanitizedEvent {
    [CmdletBinding()]
    param([string]$DataRoot, [string]$SessionId, [object]$Event)
    $clean = Assert-HL7SanitizedSchema -Event $Event
    $sessionPath = Get-HL7SessionPath -DataRoot $DataRoot -SessionId $SessionId
    [IO.Directory]::CreateDirectory($sessionPath) | Out-Null
    $eventsPath = Join-Path $sessionPath 'events.jsonl'
    $manifestPath = Join-Path $sessionPath 'manifest.json'
    $messagesPath = Join-Path $sessionPath 'messages.hl7'
    $previous = Sync-HL7HistoryIndex -SessionPath $sessionPath -SessionId $SessionId
    $newEvent = ($clean | ConvertTo-Json -Depth 20 -Compress) + "`n"
    $content = $clean.sanitizedText
    if ($clean.sanitizedResponse) { $content += "`r" + $clean.sanitizedResponse }
    $content += "`r`n"
    Write-HL7AppendText -Path $eventsPath -Text $newEvent
    Write-HL7AppendText -Path $messagesPath -Text $content
    $manifest = [pscustomobject]@{
        schema = 'hl7-toolkit.session.v1'; sessionId = $SessionId; createdUtc = $previous.createdUtc
        updatedUtc = $clean.timestamp; eventCount = $previous.eventCount + 1; contentCharacters = $previous.contentCharacters + $content.Length
        journalBytes = $previous.journalBytes + [Text.Encoding]::UTF8.GetByteCount($newEvent)
        contentBytes = $previous.contentBytes + [Text.Encoding]::UTF8.GetByteCount($content)
    }
    Write-HL7AtomicJson -Path $manifestPath -Value $manifest
    return [pscustomobject]@{ saved = $true; sessionId = $SessionId; eventId = $clean.eventId; eventCount = $manifest.eventCount }
}

function Get-HL7History {
    [CmdletBinding()]
    param([string]$DataRoot, [string]$SessionId)
    if (-not [string]::IsNullOrEmpty($SessionId)) {
        $sessionPath = Get-HL7SessionPath -DataRoot $DataRoot -SessionId $SessionId
        $manifestPath = Join-Path $sessionPath 'manifest.json'
        if (-not [IO.Directory]::Exists($sessionPath)) { throw 'HISTORY_SESSION_NOT_FOUND' }
        $manifest = Sync-HL7HistoryIndex -SessionPath $sessionPath -SessionId $SessionId
        $events = @([IO.File]::ReadAllLines((Join-Path $sessionPath 'events.jsonl')) | Where-Object { $_ } | ForEach-Object { $_ | ConvertFrom-Json })
        return [pscustomobject]@{ manifest = $manifest; events = $events; sanitizedText = [IO.File]::ReadAllText((Join-Path $sessionPath 'messages.hl7')) }
    }
    $historyRoot = Join-Path $DataRoot 'history'
    Assert-HL7LocalDataPath -Root $DataRoot -Target $historyRoot
    $sessions = New-Object Collections.Generic.List[object]
    $totalBytes = 0L
    if ([IO.Directory]::Exists($historyRoot)) {
        foreach ($folder in [IO.Directory]::GetDirectories($historyRoot)) {
            $id = [IO.Path]::GetFileName($folder)
            if ($id -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { continue }
            $manifestPath = Join-Path $folder 'manifest.json'
            try {
                $safePath = Get-HL7SessionPath -DataRoot $DataRoot -SessionId $id
                $manifest = Sync-HL7HistoryIndex -SessionPath $safePath -SessionId $id
            }
            catch { continue }
            $size = 0L
            foreach ($file in [IO.Directory]::GetFiles($folder)) { $size += (New-Object IO.FileInfo($file)).Length }
            $totalBytes += $size
            $sessions.Add([pscustomobject]@{ sessionId = $id; createdUtc = $manifest.createdUtc; updatedUtc = $manifest.updatedUtc; eventCount = $manifest.eventCount; bytes = $size })
        }
    }
    return [pscustomobject]@{ sessions = @($sessions.ToArray() | Sort-Object updatedUtc -Descending); totalBytes = $totalBytes }
}

function Remove-HL7History {
    [CmdletBinding()]
    param([string]$DataRoot, [string[]]$SessionIds)
    if ($null -eq $SessionIds -or $SessionIds.Count -eq 0) { throw 'HISTORY_SESSION_REQUIRED' }
    $targets = @($SessionIds | Select-Object -Unique | ForEach-Object { Get-HL7SessionPath -DataRoot $DataRoot -SessionId $_ })
    foreach ($target in $targets) { Assert-HL7NoLinkedDescendants -Path $target }
    $deleted = 0
    foreach ($target in $targets) {
        if ([IO.Directory]::Exists($target)) {
            Remove-Item -LiteralPath $target -Recurse -Force
            $deleted += 1
        }
    }
    return [pscustomobject]@{ deletedCount = $deleted }
}

Export-ModuleMember -Function Write-HL7SanitizedEvent, Get-HL7History, Remove-HL7History, Write-HL7AtomicJson, Get-HL7PropertyValue, Get-HL7PropertyNames
