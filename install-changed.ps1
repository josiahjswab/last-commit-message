param(
  [string]$FunctionName = "changed",
  [ValidateSet("plain", "path", "file", "vscode", "cursor", "visualstudio")]
  [string]$Links = "path",
  [string]$ProfilePath = $PROFILE
)

$ErrorActionPreference = "Stop"

function ConvertTo-SingleQuotedPowerShellString {
  param([Parameter(Mandatory = $true)][string]$Value)

  return "'$($Value.Replace("'", "''"))'"
}

if ($FunctionName -notmatch '^[A-Za-z_][A-Za-z0-9_-]*$') {
  throw "Invalid function name: $FunctionName"
}

$scriptPath = Join-Path $PSScriptRoot "last-commit-message.js"

if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
  throw "Unable to find last-commit-message.js next to install-changed.ps1"
}

$resolvedScriptPath = (Resolve-Path -LiteralPath $scriptPath).Path
$profileDirectory = Split-Path -Parent $ProfilePath

if ($profileDirectory -and -not (Test-Path -LiteralPath $profileDirectory)) {
  New-Item -ItemType Directory -Path $profileDirectory -Force | Out-Null
}

if (Test-Path -LiteralPath $ProfilePath) {
  $profileContent = Get-Content -LiteralPath $ProfilePath -Raw
} else {
  $profileContent = ""
}

$beginMarker = "# BEGIN last-commit-message $FunctionName"
$endMarker = "# END last-commit-message $FunctionName"
$quotedScriptPath = ConvertTo-SingleQuotedPowerShellString $resolvedScriptPath
$block = @"
$beginMarker
function $FunctionName {
  node $quotedScriptPath --links $Links @args
}
$endMarker
"@

$escapedBegin = [regex]::Escape($beginMarker)
$escapedEnd = [regex]::Escape($endMarker)
$existingBlockPattern = "(?s)\r?\n?$escapedBegin.*?$escapedEnd\r?\n?"

if ($profileContent -match $existingBlockPattern) {
  $profileContent = [regex]::Replace($profileContent, $existingBlockPattern, "`r`n$block`r`n")
} else {
  if ($profileContent.Trim().Length -gt 0) {
    $profileContent = $profileContent.TrimEnd() + "`r`n`r`n"
  }

  $profileContent += $block + "`r`n"
}

Set-Content -LiteralPath $ProfilePath -Value $profileContent -Encoding UTF8

Write-Host "Installed '$FunctionName' in $ProfilePath"
Write-Host "Default link mode: $Links"
Write-Host "Reload with: . `$PROFILE"
