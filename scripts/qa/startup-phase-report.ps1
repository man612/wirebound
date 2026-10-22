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
  foreach ($line in (Get-Content -LiteralPath $file)) {
    try { $event = $line | ConvertFrom-Json -ErrorAction Stop } catch { continue }
    if (-not $times.ContainsKey([string]$event.event)) {
      $times[[string]$event.event] = [int]$event.elapsedMs
    }
    $lastEvent = $event.event
  }

  [pscustomobject]@{
    attempt = $dir.Name
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
    lastEvent = $lastEvent
  }
}

Write-Output 'MAIN PROCESS / RUNTIME STAGES (milliseconds)'
$rows | Select-Object attempt,runtimePathsMs,adbFingerprintMs,adbCacheVerifyMs,settingsLoadMs,windowCreateMs | Format-Table -AutoSize
Write-Output 'RENDERER AND WINDOW STAGES (milliseconds)'
$rows | Select-Object attempt,loadStartLagMs,rendererLoadMs,paintAfterLoadMs,shownMs,rootProbeMs,lastEvent | Format-Table -AutoSize
Write-Output ('ATTEMPTS_ANALYZED='+@($rows).Count)
