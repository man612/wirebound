param(
  [switch]$IncludePackage,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Run-Checked([string]$Label, [string]$Executable, [string[]]$Arguments) {
  Write-Host ('=== ' + $Label + ' ===') -ForegroundColor Cyan
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed (exit $LASTEXITCODE)."
  }
}

Push-Location $root
try {
  if (-not $IsWindows) {
    throw 'Wirebound local validation requires Windows.'
  }
  if (-not $SkipInstall) {
    Run-Checked 'Install locked dependencies' 'npm' @('ci')
  }
  Run-Checked 'Check runtime-watch parser' 'pwsh' @('-NoProfile', '-File', 'scripts/test-runtime-watch-pins.ps1')
  Run-Checked 'Prepare pinned runtime' 'npm' @('run', 'runtime:prepare')
  Run-Checked 'Lint' 'npm' @('run', 'lint', '--', '--no-cache')
  Run-Checked 'Typecheck' 'npm' @('run', 'typecheck')
  Run-Checked 'Unit and scenario tests' 'npm' @('test')
  Run-Checked 'Production build' 'npm' @('run', 'build')
  if ($IncludePackage) {
    Run-Checked 'Windows package smoke test' 'npm' @('run', 'package:check')
  }
  Write-Host 'Local validation passed. This does not replace physical Android USB/VPN testing.' -ForegroundColor Green
}
finally {
  Pop-Location
}
