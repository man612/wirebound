$ErrorActionPreference = 'Stop'
$checker = Join-Path $PSScriptRoot 'check-renderer-milestones.ps1'
$folder = Join-Path ([System.IO.Path]::GetTempPath()) ('wirebound-late-probes-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$trace = Join-Path $folder 'startup.jsonl'
try {
  $placeholder = @{
    event = 'renderer-root-probe'; rootChildren = 1; entryEvaluatedMs = 220
    reactFirstCommitMs = 225; uiSettingsReadyMs = -1; firstContentfulPaintMs = -1
    domInteractiveMs = 205
  }
  $full = @{
    event = 'renderer-root-probe'; rootChildren = 1; entryEvaluatedMs = 220
    reactFirstCommitMs = 225; uiSettingsReadyMs = 440; firstContentfulPaintMs = 490
    domInteractiveMs = 205
  }
  @($placeholder, $full) | ForEach-Object { ConvertTo-Json -InputObject $_ -Compress } |
    Set-Content -LiteralPath $trace -Encoding utf8
  $valid = (& $checker -TracePath $trace | Out-String)
  if ($valid -notmatch 'RENDERER_MILESTONES_PASS' -or $valid -notmatch 'uiReadyNavMs=440') {
    throw 'Later UI-ready full probe was not selected'
  }
  Write-Output 'PASS: later complete renderer probe overrides early placeholder'

  @($placeholder) | ForEach-Object { ConvertTo-Json -InputObject $_ -Compress } |
    Set-Content -LiteralPath $trace -Encoding utf8
  $didReject = $false
  try { & $checker -TracePath $trace | Out-Null } catch { $didReject = $true }
  if (-not $didReject) { throw 'Placeholder-only trace was falsely accepted' }
  Write-Output 'PASS: placeholder-only full probe is rejected'

  $badOrder = $full.Clone()
  $badOrder.reactFirstCommitMs = 200
  @($badOrder) | ForEach-Object { ConvertTo-Json -InputObject $_ -Compress } |
    Set-Content -LiteralPath $trace -Encoding utf8
  $didReject = $false
  try { & $checker -TracePath $trace | Out-Null } catch { $didReject = $true }
  if (-not $didReject) { throw 'Out-of-order renderer milestones were falsely accepted' }
  Write-Output 'PASS: invalid milestone order is rejected'
  Write-Output 'RENDERER_MILESTONE_CHECK_CASES=3 FAILURES=0'
} finally {
  Remove-Item -LiteralPath $folder -Force -Recurse -ErrorAction SilentlyContinue
}
