param(
  [string] $ExePath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'dist\win-unpacked\wirebound.exe'),
  [ValidateRange(1, 20)] [int] $Attempts = 3,
  [ValidateRange(5, 120)] [int] $WaitSeconds = 20,
  [string] $OutputRoot = (Join-Path ([System.IO.Path]::GetTempPath()) 'wirebound-cold-start-qa'),
  [switch] $ObserveResources,
  [switch] $CountDefenderEvents,
  [switch] $SkipWindowIcon
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'startup-readiness.psm1') -Force -ErrorAction Stop
$resolvedExe = (Resolve-Path -LiteralPath $ExePath).Path
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$failures = 0

for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
  $attemptDir = Join-Path $OutputRoot "attempt-$attempt"
  $appData = Join-Path $attemptDir 'appdata'
  $localAppData = Join-Path $attemptDir 'localappdata'
  $timeline = Join-Path $attemptDir 'startup.jsonl'
  New-Item -ItemType Directory -Force -Path $appData, $localAppData | Out-Null
  if (Test-Path $timeline) { Remove-Item -LiteralPath $timeline -Force }

  $savedAppData = $env:APPDATA
  $savedLocalAppData = $env:LOCALAPPDATA
  $savedTrace = $env:WIREBOUND_QA_STARTUP_TRACE
  $savedIconSkip = $env:WIREBOUND_QA_SKIP_WINDOW_ICON
  $iconMode = if ($SkipWindowIcon) { 'skip' } else { 'normal' }
  $child = $null
  $result = 'not-started'
  $attemptStartedAt = Get-Date
  $samples = [System.Collections.Generic.List[object]]::new()
  try {
    # Start-Process inherits these variables. No real settings profile is touched.
    $env:APPDATA = $appData
    $env:LOCALAPPDATA = $localAppData
    $env:WIREBOUND_QA_STARTUP_TRACE = $timeline
    $env:WIREBOUND_QA_SKIP_WINDOW_ICON = if ($SkipWindowIcon) { '1' } else { '0' }
    $child = Start-Process -FilePath $resolvedExe -WorkingDirectory (Split-Path $resolvedExe) -PassThru
    $env:APPDATA = $savedAppData
    $env:LOCALAPPDATA = $savedLocalAppData
    $env:WIREBOUND_QA_STARTUP_TRACE = $savedTrace
    $env:WIREBOUND_QA_SKIP_WINDOW_ICON = $savedIconSkip

    for ($step = 1; $step -le $WaitSeconds; $step++) {
      Start-Sleep -Seconds 1
      if ($ObserveResources) {
        # Observation is opt-in: sample only the child started by this harness
        # and the Defender engine (if readable). No process lists, paths or usernames.
        $qaProcess = Get-Process -Id $child.Id -ErrorAction SilentlyContinue
        $defenderProcess = Get-Process -Name MsMpEng -ErrorAction SilentlyContinue | Select-Object -First 1
        $samples.Add([pscustomobject]@{
          elapsedSeconds = $step
          qaCpuSeconds = if ($qaProcess) { [math]::Round([double]$qaProcess.CPU, 3) } else { $null }
          qaWorkingSetMiB = if ($qaProcess) { [math]::Round($qaProcess.WorkingSet64 / 1MB, 1) } else { $null }
          qaHandles = if ($qaProcess) { $qaProcess.Handles } else { $null }
          defenderCpuSeconds = if ($defenderProcess) { [math]::Round([double]$defenderProcess.CPU, 3) } else { $null }
        })
      }
      if (Test-Path $timeline) {
        $events = @(Get-Content -LiteralPath $timeline -ErrorAction SilentlyContinue | ForEach-Object {
          try { $_ | ConvertFrom-Json } catch { $null }
        } | Where-Object { $null -ne $_ })
        $readiness = Get-WireboundStartupReadiness -Events $events
        # DOM mounting and window visibility may happen in either order.
        # A root probe made while the window is still hidden must not become
        # a false timeout once 'window-shown' arrives afterward.
        if ($readiness.failureRecorded) {
          $result = 'startup-failure-recorded'
          break
        }
        if ($readiness.ready) {
          $result = 'pass'
          break
        }
      }
      if ($child.HasExited) {
        $result = 'exited-before-renderer-ready'
        break
      }
    }
    if ($result -eq 'not-started') { $result = 'startup-timed-out' }
    if ($result -ne 'pass') { $failures++ }
    Write-Output "ATTEMPT=$attempt ICON_MODE=$iconMode RESULT=$result TRACE=$timeline"
    if (Test-Path $timeline) {
      Get-Content -LiteralPath $timeline | ForEach-Object {
        $entry = $_ | ConvertFrom-Json
        Write-Output ("  {0} {1}" -f $entry.elapsedMs, $entry.event)
      }
    } else {
      Write-Output '  NO_MAIN_PROCESS_TRACE'
    }
  } catch {
    $failures++
    Write-Output "ATTEMPT=$attempt ERROR=$($_.Exception.GetType().Name)"
  } finally {
    if ($ObserveResources) {
      try {
        $samples | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $attemptDir 'process-samples.json') -Encoding utf8
        Write-Output "  RESOURCE_SAMPLES=$($samples.Count)"
      } catch {
        Write-Output '  RESOURCE_SAMPLES_UNAVAILABLE'
      }
    }
    if ($CountDefenderEvents) {
      try {
        # Aggregate IDs only, never persist Defender event descriptions or paths.
        $counts = @(Get-WinEvent -FilterHashtable @{
          LogName = 'Microsoft-Windows-Windows Defender/Operational'
          StartTime = $attemptStartedAt
          EndTime = Get-Date
        } -MaxEvents 200 -ErrorAction SilentlyContinue | Group-Object Id | ForEach-Object {
          [pscustomobject]@{ eventId = [int]$_.Name; count = $_.Count }
        })
        ConvertTo-Json -InputObject $counts -Depth 3 | Set-Content -LiteralPath (Join-Path $attemptDir 'defender-event-counts.json') -Encoding utf8
        Write-Output "  DEFENDER_EVENT_TYPES=$($counts.Count)"
      } catch {
        Write-Output '  DEFENDER_EVENT_COUNTS_UNAVAILABLE'
      }
    }
    $env:APPDATA = $savedAppData
    $env:LOCALAPPDATA = $savedLocalAppData
    $env:WIREBOUND_QA_STARTUP_TRACE = $savedTrace
    $env:WIREBOUND_QA_SKIP_WINDOW_ICON = $savedIconSkip
    if ($child) {
      $live = Get-CimInstance Win32_Process -Filter "ProcessId=$($child.Id)" -ErrorAction SilentlyContinue
      # Never terminate an unrelated Wirebound or other user process.
      if ($live -and $live.ExecutablePath -eq $resolvedExe) {
        & taskkill.exe /PID $child.Id /T /F | Out-Null
      }
    }
    Start-Sleep -Seconds 1
  }
}
Write-Output "STARTUP_QA_ATTEMPTS=$Attempts FAILURES=$failures"
if ($failures -gt 0) { exit 1 }
