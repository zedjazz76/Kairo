[CmdletBinding()]
param(
    [ValidateRange(0, 65535)][int]$Port = 0,
    [ValidatePattern('^[a-f0-9]{64}$')][string]$Token,
    [string]$DataRoot,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$serviceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolkitRoot = Split-Path -Parent $serviceRoot
$appRoot = Join-Path $toolkitRoot 'app'
if ([string]::IsNullOrWhiteSpace($DataRoot)) {
    $DataRoot = Join-Path $toolkitRoot 'data\runtime'
}

Import-Module (Join-Path $serviceRoot 'HL7Toolkit.Security.psm1') -Force
Import-Module (Join-Path $serviceRoot 'HL7Toolkit.History.psm1') -Force
Import-Module (Join-Path $serviceRoot 'HL7Toolkit.Profiles.psm1') -Force -DisableNameChecking
Import-Module (Join-Path $serviceRoot 'HL7Toolkit.Mllp.psm1') -Force -DisableNameChecking
Import-Module (Join-Path $serviceRoot 'HL7Toolkit.Mwl.psm1') -Force -DisableNameChecking
Import-Module (Join-Path $serviceRoot 'HL7Toolkit.Http.psm1') -Force

if ([string]::IsNullOrWhiteSpace($Token)) { $Token = New-HL7SessionToken }
[IO.Directory]::CreateDirectory([IO.Path]::GetFullPath($DataRoot)) | Out-Null

$onStarted = {
    param($ActualPort)
    $url = 'http://127.0.0.1:' + $ActualPort + '/?token=' + $Token
    Write-Host ''
    Write-Host 'HL7 Toolkit is running locally.' -ForegroundColor Green
    Write-Host ('Address: http://127.0.0.1:' + $ActualPort + '/')
    Write-Host 'When finished, choose End session in the browser, then close the tab and this window.'
    Write-Host 'Closing only this helper does not erase content already displayed in the browser.'
    if (-not $NoBrowser) { Start-Process $url }
}

Start-HL7ToolkitServer -Root $appRoot -DataRoot $DataRoot -Token $Token -Port $Port -OnStarted $onStarted
