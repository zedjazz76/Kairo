Set-StrictMode -Version 2.0

function Assert-HL7LocalDataPath {
    param([string]$Root, [string]$Target)
    $base = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    $path = [IO.Path]::GetFullPath($Target).TrimEnd('\')
    if ($path -ne $base -and -not $path.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'STORAGE_PATH_REJECTED' }
    $cursor = $path
    while ($true) {
        if ([IO.File]::Exists($cursor) -or [IO.Directory]::Exists($cursor)) {
            if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'STORAGE_LINK_REJECTED' }
        }
        if ($cursor -eq $base) { break }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
        if ([string]::IsNullOrEmpty($cursor)) { throw 'STORAGE_PATH_REJECTED' }
    }
}

function Assert-HL7NoLinkedDescendants {
    param([string]$Path)
    if (-not [IO.Directory]::Exists($Path)) { return }
    $pending = New-Object 'Collections.Generic.Stack[string]'
    $pending.Push($Path)
    while ($pending.Count -gt 0) {
        foreach ($entry in [IO.Directory]::GetFileSystemEntries($pending.Pop())) {
            $attributes = [IO.File]::GetAttributes($entry)
            if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'STORAGE_LINK_REJECTED' }
            if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) { $pending.Push($entry) }
        }
    }
}

Export-ModuleMember -Function Assert-HL7LocalDataPath, Assert-HL7NoLinkedDescendants
