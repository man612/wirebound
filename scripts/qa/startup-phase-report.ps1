param(
  [Parameter(Mandatory = $true)] [string] $OutputRoot
)

$ErrorActionPreference = 'Stop'

function Get-Duration {
  param([hashtable] $Times, [string] $From, [string] $To)
  if (-not $Times.ContainsKey($From) -or -not $Times.ContainsKey($To)) { return $null }
  return ([int]$Times[$To] - [int]$Times[$From])
}

$rows = foreach ($dir in (Get-ChildItem -LiteralPath $OutputRoot -Directory | Sort-Object Name)) {
  $file = Join-Path $dir.FullName 'startup.jsonl'
  if (-not (Test-Path $file)) { continue }
  $times = @{}
  $lastEvent = $null
  $heartbeatEvents = 0
  $largestHeartbeatDelayMs = $null
  $traceWriteTotalMs = $null
  $traceWriteMaxMs = $null
  $traceWriteBeforeWindowShownMs = $null
  $fcpNavigationMs = $null
  foreach ($line in (Get-Content -LiteralPath $file)) {
    try { $event = $line | ConvertFrom-Json -ErrorAction Stop } catch { continue }
    if (-not $times.ContainsKey([string]$event.event)) {
      $times[[string]$event.event] = [int]$event.elapsedMs
    }
    $lastEvent = $event.event
    # Older startup traces do not include the writer self-timing fields.
    if ($null -ne $event.traceTotalWriteMs) {
      $traceWriteTotalMs = [double]$event.traceTotalWriteMs
      $traceWriteMaxMs = [double]$event.traceMaxWriteMs
      if ($event.event -eq 'window-shown') {
        $traceWriteBeforeWindowShownMs = $traceWriteTotalMs
      }
    }
    if ($event.event -eq 'renderer-root-probe' -and $null -ne $event.firstContentfulPaintMs -and
        [double]$event.firstContentfulPaintMs -ge 0) {
      $fcpNavigationMs = [double]$event.firstContentfulPaintMs
    }
    if ($event.event -eq 'main-loop-heartbeat' -and $null -ne $event.delayMs) {
      $heartbeatEvents += 1
      $delay = [int]$event.delayMs
      if ($null -eq $largestHeartbeatDelayMs -or $delay -gt $largestHeartbeatDelayMs) {
        $largestHeartbeatDelayMs = $delay
      }
    }
  }

  [pscustomobject]@{
    attempt = $dir.Name
    firstMainMs = if ($times.ContainsKey('main-module-start')) { $times['main-module-start'] } else { $null }
    heartbeatEvents = $heartbeatEvents
    maxHeartbeatDelayMs = $largestHeartbeatDelayMs
    traceTotalWriteMs = $traceWriteTotalMs
    traceMaxWriteMs = $traceWriteMaxMs
    traceWriteBeforeShownMs = $traceWriteBeforeWindowShownMs
    displayQueryMs = Get-Duration $times 'display-query-start' 'display-query-ready'
    iconLoadMs = Get-Duration $times 'window-icon-load-start' 'window-icon-load-ready'
    runtimePathsMs = Get-Duration $times 'runtime-paths-start' 'runtime-paths-ready'
    adbFingerprintMs = Get-Duration $times 'adb-cache-fingerprint-start' 'adb-cache-fingerprint-ready'
    adbCacheVerifyMs = Get-Duration $times 'adb-cache-verify-start' 'adb-cache-verify-ready'
    settingsLoadMs = Get-Duration $times 'settings-load-start' 'settings-load-ready'
    windowCreateMs = Get-Duration $times 'window-creating' 'window-created'
    loadStartLagMs = Get-Duration $times 'renderer-load-requested' 'did-start-loading'
    rendererLoadMs = Get-Duration $times 'did-start-loading' 'dom-ready'
    paintAfterLoadMs = Get-Duration $times 'did-finish-load' 'ready-to-show'
    shownMs = if ($times.ContainsKey('window-shown')) { $times['window-shown'] } else { $null }
    rootProbeMs = if ($times.ContainsKey('renderer-root-probe')) { $times['renderer-root-probe'] } else { $null }
    fcpNavigationMs = $fcpNavigationMs
    lastEvent = $lastEvent
  }
}

Write-Output 'MAIN PROCESS AND EVENT LOOP (milliseconds)'
$rows | Select-Object attempt,firstMainMs,runtimePathsMs,displayQueryMs,iconLoadMs,windowCreateMs,heartbeatEvents,maxHeartbeatDelayMs | Format-Table -AutoSize
Write-Output 'ADB / SETTINGS DETAILS (milliseconds)'
$rows | Select-Object attempt,adbFingerprintMs,adbCacheVerifyMs,settingsLoadMs | Format-Table -AutoSize
Write-Output 'RENDERER AND WINDOW STAGES (milliseconds)'
$rows | Select-Object attempt,loadStartLagMs,rendererLoadMs,paintAfterLoadMs,shownMs,rootProbeMs,fcpNavigationMs,lastEvent | Format-Table -AutoSize
Write-Output 'QA TRACE-WRITER OVERHEAD (milliseconds; null means old trace)'
$rows | Select-Object attempt,shownMs,traceWriteBeforeShownMs,traceTotalWriteMs,traceMaxWriteMs | Format-Table -AutoSize
Write-Output 'NOTE: write time on the current/final line is known only by the next trace event; FCP is renderer-navigation-relative.'
Write-Output ('ATTEMPTS_ANALYZED='+@($rows).Count)
