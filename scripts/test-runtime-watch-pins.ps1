$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$workflowPath = Join-Path $root '.github/workflows/runtime-watch.yml'
$preparePath = Join-Path $root 'scripts/prepare-runtime.ps1'

# Evaluate the exact version parsers embedded in the workflow.
# This catches PowerShell quoting regressions without any downloads.
$watch = Get-Content $workflowPath -Raw
$script = Get-Content $preparePath -Raw
$parsers = @($watch -split '\r?\n' | Where-Object {
  $_ -match '^\s*\$(platformMatch|gnirehtetMatch)\s*=\s*\[regex\]::Match\('
})
if ($parsers.Count -ne 2) {
  throw "Expected 2 runtime-version parsing statements, found $($parsers.Count)."
}

foreach ($parser in $parsers) {
  . ([scriptblock]::Create($parser.Trim()))
}
if (-not $platformMatch.Success -or -not $gnirehtetMatch.Success) {
  throw 'Runtime-watch failed to parse one or both pinned versions.'
}
if ($platformMatch.Groups[1].Value -notmatch '^\d+(\.\d+)+$' -or
    $gnirehtetMatch.Groups[1].Value -notmatch '^\d+(\.\d+)+$') {
  throw 'A parsed runtime version has an unexpected format.'
}

Write-Host "Runtime pin parser OK: Platform-Tools $($platformMatch.Groups[1].Value), Gnirehtet $($gnirehtetMatch.Groups[1].Value)"
