param(
  [string] $ExePath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'dist\win-unpacked\wirebound.exe'),
  [ValidateRange(1, 10)] [int] $Rounds = 4,
  [ValidateRange(5, 120)] [int] $WaitSeconds = 70,
  [string] $OutputRoot = (Join-Path ([System.IO.Path]::GetTempPath()) ('wirebound-icon-ab-' + [guid]::NewGuid().ToString('N')))
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'Window icon startup QA requires Windows.' }
$resolvedExe = (Resolve-Path -LiteralPath $ExePath).Path
if (Test-Path -LiteralPath $OutputRoot) { throw "QA results directory already exists: $OutputRoot" }
if (Test-Path -LiteralPath "$env:LOCALAPPDATA\Programs\Wirebound") {
  throw 'A normal Wirebound installation exists; refusing isolated A/B QA.'
}
if (@(Get-CimInstance Win32_Process -Filter "name='wirebound.exe'" -ErrorAction SilentlyContinue).Count -gt 0) {
  throw 'Another Wirebound process is running; refusing isolated A/B QA.'
}
$base = Split-Path -Parent $resolvedExe
if (-not (Test-Path -LiteralPath (Join-Path $base 'resources\app.asar'))) {
  throw 'Packaged app.asar does not exist beside the selected executable.'
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$sequence = @('normal', 'skip', 'skip', 'normal')
$index = 0
$results = [System.Collections.Generic.List[object]]::new()
$startTool = Join-Path $PSScriptRoot 'electron-cold-start.ps1'

function FirstMs([object[]] $Events, [string] $Name) {
  $match = $Events | Where-Object { $_.event -eq $Name } | Select-Object -First 1
  if ($null -eq $match) { return $null }
  return [int]$match.elapsedMs
}

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
      '-OutputRoot', $dir,
      '-ObserveResources'
    )
    if ($mode -eq 'skip') { $arguments += '-SkipWindowIcon' }

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
    }
    $results.Add($row)
    Write-Output ('TRIAL={0} MODE={1} PASS={2} WINDOW_MS={3} ICON_MS={4} CONSTRUCTOR_MS={5} HEARTBEAT_MAX_MS={6}' -f $index, $mode, $pass, $shown, $row.iconLoadMs, $row.windowCreateMs, $maxDelay)
  }
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
