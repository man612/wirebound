param(
  [string] $ExePath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'dist\win-unpacked\wirebound.exe'),
  [ValidateRange(1, 10)] [int] $Rounds = 1,
  [ValidateRange(5, 120)] [int] $WaitSeconds = 70,
  [switch] $StartWithSkip,
  [switch] $DeferAdbRuntimeForQa,
  [string] $OutputRoot = (Join-Path ([System.IO.Path]::GetTempPath()) ('wirebound-icon-ab-' + [guid]::NewGuid().ToString('N')))
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'Window icon startup QA requires Windows.' }
$resolvedExe = (Resolve-Path -LiteralPath $ExePath).Path
if (Test-Path -LiteralPath $OutputRoot) { throw "QA results directory already exists: $OutputRoot" }
# Presence of a normal installed app is not a conflict: only a running app is.
# Never launch a QA executable from the user's installed program directory.
$installedRoot = Join-Path $env:LOCALAPPDATA 'Programs\Wirebound'
if ($resolvedExe.StartsWith($installedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Selected executable belongs to installed Wirebound; use a QA copy.'
}
if (@(Get-Process -Name wirebound -ErrorAction SilentlyContinue).Count -gt 0) {
  throw 'Another Wirebound process is running; refusing isolated A/B QA.'
}
$base = Split-Path -Parent $resolvedExe
if (-not (Test-Path -LiteralPath (Join-Path $base 'resources\app.asar'))) {
  throw 'Packaged app.asar does not exist beside the selected executable.'
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
# Counterbalance cold OS caches by optionally reversing the first condition.
$sequence = if ($StartWithSkip) {
  @('skip', 'normal', 'normal', 'skip')
} else {
  @('normal', 'skip', 'skip', 'normal')
}
$index = 0
$results = [System.Collections.Generic.List[object]]::new()
$startTool = Join-Path $PSScriptRoot 'electron-cold-start.ps1'

function FirstMs([object[]] $Events, [string] $Name) {
  $match = $Events | Where-Object { $_.event -eq $Name } | Select-Object -First 1
  if ($null -eq $match) { return $null }
  return [int]$match.elapsedMs
}

$savedDeferred = [Environment]::GetEnvironmentVariable('WIREBOUND_QA_DEFER_ADB_RUNTIME', 'Process')
try {
for ($round = 1; $round -le $Rounds; $round++) {
  foreach ($mode in $sequence) {
    $index++
    $id = 'trial-{0:00}-{1}' -f $index, $mode
    $dir = Join-Path $OutputRoot $id
    $log = Join-Path $OutputRoot ($id + '.log')
    $arguments = @(
      '-NoProfile', '-File', $startTool,
      '-ExePath', $resolvedExe,
      '-Attempts', '1',
      '-WaitSeconds', [string]$WaitSeconds,
      '-OutputRoot', $dir
    )
    if ($mode -eq 'skip') { $arguments += '-SkipWindowIcon' }

    if (@(Get-Process -Name wirebound -ErrorAction SilentlyContinue).Count -gt 0) {
      throw 'A Wirebound instance appeared before the next trial; stopping safely.'
    }
    if ($DeferAdbRuntimeForQa) { $env:WIREBOUND_QA_DEFER_ADB_RUNTIME = '1' }
    & pwsh @arguments *> $log
    $runnerExit = $LASTEXITCODE
    $trace = Join-Path $dir 'attempt-1\startup.jsonl'
    $events = @()
    if (Test-Path -LiteralPath $trace) {
      $events = @(Get-Content -LiteralPath $trace -ErrorAction SilentlyContinue | ForEach-Object {
        try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { $null }
      } | Where-Object { $null -ne $_ })
    }
    $shown = FirstMs $events 'window-shown'
    $root = $events | Where-Object { $_.event -eq 'renderer-root-probe' -and $_.rootChildren -gt 0 } | Select-Object -First 1
    $iconStart = FirstMs $events 'window-icon-load-start'
    $iconReady = FirstMs $events 'window-icon-load-ready'
    $ctorStart = FirstMs $events 'window-creating'
    $ctorReady = FirstMs $events 'window-created'
    $navStart = FirstMs $events 'did-start-loading'
    $navReady = FirstMs $events 'dom-ready'
    $pulses = @($events | Where-Object { $_.event -eq 'main-loop-heartbeat' -and $null -ne $_.delayMs })
    $maxDelay = if ($pulses.Count) {
      ($pulses | Measure-Object -Property delayMs -Maximum).Maximum
    } else { $null }
    $iconEvent = $events | Where-Object { $_.event -eq 'window-icon-load-start' } | Select-Object -First 1
    $expectedSkip = $mode -eq 'skip'
    $iconConfirmed = $null -ne $iconEvent -and $null -ne $iconEvent.skipped -and
      [bool]$iconEvent.skipped -eq $expectedSkip
    $pass = $runnerExit -eq 0 -and $null -ne $shown -and $null -ne $root -and $iconConfirmed

    $row = [pscustomobject]@{
      trial = $index
      round = $round
      mode = $mode
      passed = $pass
      runnerExit = $runnerExit
      mainStartMs = FirstMs $events 'main-module-start'
      iconLoadMs = if ($null -ne $iconStart -and $null -ne $iconReady) { $iconReady - $iconStart } else { $null }
      windowCreateMs = if ($null -ne $ctorStart -and $null -ne $ctorReady) { $ctorReady - $ctorStart } else { $null }
      rendererLoadMs = if ($null -ne $navStart -and $null -ne $navReady) { $navReady - $navStart } else { $null }
      windowShownMs = $shown
      reactReadyMs = if ($null -ne $root) { [int]$root.elapsedMs } else { $null }
      maxHeartbeatDelayMs = $maxDelay
      firstPaintNavigationMs = if ($null -ne $root -and $root.firstPaintMs -ge 0) { [int]$root.firstPaintMs } else { $null }
      firstContentfulPaintNavigationMs = if ($null -ne $root -and $root.firstContentfulPaintMs -ge 0) { [int]$root.firstContentfulPaintMs } else { $null }
    }
    $results.Add($row)
    # Persist immediately: a later slow/timed-out trial must not erase prior evidence.
    $results | Export-Csv -LiteralPath (Join-Path $OutputRoot 'icon-ab-results.csv') -NoTypeInformation -Encoding utf8
    # The child harness stops only the exact QA process it launched. Wait a
    # short cleanup grace period, then fail closed instead of killing by name.
    for ($retry = 0; $retry -lt 10 -and @(Get-Process -Name wirebound -ErrorAction SilentlyContinue).Count -gt 0; $retry++) {
      Start-Sleep -Milliseconds 700
    }
    if (@(Get-Process -Name wirebound -ErrorAction SilentlyContinue).Count -gt 0) {
      throw 'Wirebound still running after trial. Stop further QA without touching user processes.'
    }
    Write-Output ('TRIAL={0} MODE={1} PASS={2} WINDOW_MS={3} ICON_MS={4} CONSTRUCTOR_MS={5} HEARTBEAT_MAX_MS={6}' -f $index, $mode, $pass, $shown, $row.iconLoadMs, $row.windowCreateMs, $maxDelay)
  }
} finally {
  [Environment]::SetEnvironmentVariable('WIREBOUND_QA_DEFER_ADB_RUNTIME', $savedDeferred, 'Process')
}

$results | Export-Csv -LiteralPath (Join-Path $OutputRoot 'icon-ab-results.csv') -NoTypeInformation -Encoding utf8
Write-Output 'RESULTS BY VARIANT (seconds / integer milliseconds as logged)'
foreach ($mode in @('normal', 'skip')) {
  $set = @($results | Where-Object { $_.mode -eq $mode })
  $shown = @($set | Where-Object { $null -ne $_.windowShownMs } | ForEach-Object { [int]$_.windowShownMs } | Sort-Object)
  $median = if ($shown.Count) {
    if ($shown.Count % 2 -eq 1) { $shown[[int][math]::Floor($shown.Count / 2)] }
    else { ($shown[$shown.Count / 2 - 1] + $shown[$shown.Count / 2]) / 2 }
  } else { $null }
  $max = if ($shown.Count) { $shown[-1] } else { $null }
  Write-Output ('VARIANT={0} COUNT={1} PASS={2} MEDIAN_SHOWN_MS={3} MAX_SHOWN_MS={4}' -f $mode, $set.Count, @($set | Where-Object passed).Count, $median, $max)
}

$failures = @($results | Where-Object { -not $_.passed }).Count
Write-Output "ICON_AB_TRIALS=$($results.Count) FAILURES=$failures"
if ($failures) { exit 1 }
