[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$TracePath)

$ErrorActionPreference = 'Stop'
if (-not(Test-Path -LiteralPath $TracePath)) { throw 'Startup trace not found.' }
$events = @(Get-Content -LiteralPath $TracePath | ForEach-Object {
  try { $_ | ConvertFrom-Json -ErrorAction Stop }
  catch { throw 'Invalid JSONL startup event.' }
})
if (-not $events.Count) { throw 'Startup trace is empty.' }
$root = $events | Where-Object { $_.event -eq 'renderer-root-probe' } | Select-Object -First 1
if (-not $root -or $root.rootChildren -le 0) {
  throw 'Full renderer root probe missing or has no child elements.'
}
$start = [double]$root.entryEvaluatedMs
$commit = [double]$root.reactFirstCommitMs
$ready = [double]$root.uiSettingsReadyMs
if ($null -eq $root.entryEvaluatedMs -or $null -eq $root.reactFirstCommitMs -or
    $null -eq $root.uiSettingsReadyMs -or
    $start -lt 0 -or $commit -lt 0 -or $ready -lt 0) {
  throw 'Renderer ESM/React/settings readiness marks were not observed.'
}
if ($start -gt $commit -or $commit -gt $ready) {
  throw 'Renderer milestones are not monotonic.'
}
Write-Output ('RENDERER_MILESTONES_PASS entryNavMs={0} reactCommitNavMs={1} uiReadyNavMs={2} fcpNavMs={3} domInteractiveNavMs={4}' -f
  $start, $commit, $ready, $root.firstContentfulPaintMs, $root.domInteractiveMs)
Write-Output 'All values are navigation-relative milliseconds, not process-uptime values.'
