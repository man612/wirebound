param(
  [string] $ExePath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'dist\win-unpacked\wirebound.exe'),
  [ValidateRange(1, 20)] [int] $Attempts = 3,
  [ValidateRange(5, 120)] [int] $WaitSeconds = 20,
  [string] $OutputRoot = (Join-Path ([System.IO.Path]::GetTempPath()) 'wirebound-cold-start-qa')
)

$ErrorActionPreference = 'Stop'
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
  $child = $null
  $result = 'not-started'
  try {
    # Start-Process inherits these variables. No real settings profile is touched.
    $env:APPDATA = $appData
    $env:LOCALAPPDATA = $localAppData
    $env:WIREBOUND_QA_STARTUP_TRACE = $timeline
    $child = Start-Process -FilePath $resolvedExe -WorkingDirectory (Split-Path $resolvedExe) -PassThru
    $env:APPDATA = $savedAppData
    $env:LOCALAPPDATA = $savedLocalAppData
    $env:WIREBOUND_QA_STARTUP_TRACE = $savedTrace

    for ($step = 1; $step -le $WaitSeconds; $step++) {
      Start-Sleep -Seconds 1
      if (Test-Path $timeline) {
        $events = @(Get-Content -LiteralPath $timeline -ErrorAction SilentlyContinue | ForEach-Object {
          try { $_ | ConvertFrom-Json } catch { $null }
        } | Where-Object { $null -ne $_ })
        $root = @($events | Where-Object { $_.event -eq 'renderer-root-probe' } | Select-Object -Last 1)
        if ($root.Count -gt 0 -and $root[-1].rootChildren -gt 0 -and $root[-1].visible) {
          $result = 'pass'
          break
        }
        if (@($events | Where-Object { $_.event -in @('renderer-load-rejected', 'render-process-gone', 'bootstrap-rejected') }).Count -gt 0) {
          $result = 'startup-failure-recorded'
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
    Write-Output "ATTEMPT=$attempt RESULT=$result TRACE=$timeline"
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
    $env:APPDATA = $savedAppData
    $env:LOCALAPPDATA = $savedLocalAppData
    $env:WIREBOUND_QA_STARTUP_TRACE = $savedTrace
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
