param(
  [Parameter(Mandatory = $true)] [string] $OutputRoot
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'startup-readiness.psm1') -Force

$rows = foreach ($attemptDir in (Get-ChildItem -LiteralPath $OutputRoot -Directory | Sort-Object Name)) {
  $timeline = Join-Path $attemptDir.FullName 'startup.jsonl'
  $events = @()
  if (Test-Path $timeline) {
    $events = @(Get-Content -LiteralPath $timeline | ForEach-Object {
      try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { $null }
    } | Where-Object { $null -ne $_ })
  }
  $status = Get-WireboundStartupReadiness -Events $events
  $shown = $events | Where-Object event -eq 'window-shown' | Select-Object -First 1
  $root = $events | Where-Object {
    $_.event -eq 'renderer-root-probe' -and $_.rootChildren -gt 0
  } | Select-Object -First 1

  $samplesPath = Join-Path $attemptDir.FullName 'process-samples.json'
  $samples = @()
  if (Test-Path $samplesPath) {
    $samples = @(Get-Content -LiteralPath $samplesPath -Raw | ConvertFrom-Json)
  }
  $maxMemory = $null
  $defenderDelta = $null
  if ($samples.Count -gt 0) {
    $maxMemory = ($samples | Measure-Object -Property qaWorkingSetMiB -Maximum).Maximum
  }
  if ($samples.Count -gt 1 -and $null -ne $samples[0].defenderCpuSeconds -and
      $null -ne $samples[-1].defenderCpuSeconds) {
    $defenderDelta = [math]::Round(
      [double]$samples[-1].defenderCpuSeconds - [double]$samples[0].defenderCpuSeconds, 3
    )
  }

  [pscustomobject]@{
    attempt = $attemptDir.Name
    readyFromTrace = $status.ready
    windowShownMs = if ($shown) { $shown.elapsedMs } else { $null }
    reactMountedMs = if ($root) { $root.elapsedMs } else { $null }
    failureEvent = $status.failureRecorded
    sampleCount = $samples.Count
    maxMainProcessMiB = $maxMemory
    defenderCpuDeltaSeconds = $defenderDelta
  }
}

$rows | Format-Table -AutoSize
Write-Output ("TRACES={0} READY={1} NOT_READY={2}" -f $rows.Count,
  @($rows | Where-Object readyFromTrace).Count,
  @($rows | Where-Object { -not $_.readyFromTrace }).Count)
