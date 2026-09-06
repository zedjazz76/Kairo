param([int]$Port, [string]$Token, [string]$DataRoot, [switch]$NoBrowser)
# Synthetic restriction: compilation is unavailable. Do not change any OS policy.
function global:Add-Type {
    [CmdletBinding()]param([string]$Path)
    throw 'Synthetic runtime policy denied compilation.'
}
& (Join-Path $PSScriptRoot '../../../hl7-toolkit/service/Start-HL7Toolkit.ps1') @PSBoundParameters
