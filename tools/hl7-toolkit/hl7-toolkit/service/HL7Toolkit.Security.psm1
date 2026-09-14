Set-StrictMode -Version 2.0

function New-HL7SessionToken {
    [CmdletBinding()]
    param()

    $bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }

    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function Test-HL7LoopbackAddress {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][Net.IPAddress]$Address)

    return [Net.IPAddress]::IsLoopback($Address)
}

function Test-HL7SessionToken {
    [CmdletBinding()]
    param(
        [AllowNull()][string]$Candidate,
        [Parameter(Mandatory = $true)][string]$Expected
    )

    if ([string]::IsNullOrEmpty($Candidate) -or $Candidate.Length -ne $Expected.Length) {
        return $false
    }

    $left = [Text.Encoding]::UTF8.GetBytes($Candidate)
    $right = [Text.Encoding]::UTF8.GetBytes($Expected)
    $difference = 0
    for ($index = 0; $index -lt $left.Length; $index += 1) {
        $difference = $difference -bor ($left[$index] -bxor $right[$index])
    }
    return $difference -eq 0
}

function Get-HL7SafeStaticPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RequestPath
    )

    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $decoded = [Uri]::UnescapeDataString($RequestPath.Split('?')[0])
    if ($decoded -eq '/') { $decoded = '/index.html' }
    $relative = $decoded.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $candidate = [IO.Path]::GetFullPath((Join-Path $rootPath $relative))
    if (-not $candidate.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'STATIC_PATH_REJECTED'
    }
    return $candidate
}

function Get-HL7SecurityHeaders {
    [CmdletBinding()]
    param()

    return [ordered]@{
        'Cache-Control' = 'no-store, max-age=0'
        'Content-Security-Policy' = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
        'Cross-Origin-Opener-Policy' = 'same-origin'
        'Referrer-Policy' = 'no-referrer'
        'X-Content-Type-Options' = 'nosniff'
        'X-Frame-Options' = 'DENY'
    }
}

Export-ModuleMember -Function New-HL7SessionToken, Test-HL7LoopbackAddress, Test-HL7SessionToken, Get-HL7SafeStaticPath, Get-HL7SecurityHeaders
