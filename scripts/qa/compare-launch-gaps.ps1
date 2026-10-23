param(
  [string] $ExePath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'dist\win-unpacked\wirebound.exe'),
  [ValidateRange(1, 10)] [int] $Rounds = 3,
  [ValidateRange(1, 10)] [int] $ShortGapSeconds = 2,
  [ValidateRange(10, 120)] [int] $LongGapSeconds = 25,
  [ValidateRange(10, 120)] [int] $WaitSeconds = 70,
  [string] $OutputRoot = (Join-Path ([System.IO.Path]::GetTempPath()) ('wirebound-gap-ab-' + [guid]::NewGuid().ToString('N')))
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This launch-gap experiment requires Windows.' }
$resolvedExe = (Resolve-Path -LiteralPath $ExePath).Path
if (Test-Path -LiteralPath $OutputRoot) { throw "QA output must be a new directory: $OutputRoot" }
if ($ShortGapSeconds -ge $LongGapSeconds) { throw 'Short gap must be smaller than long gap.' }
if (Test-Path -LiteralPath "$env:LOCALAPPDATA\Programs\Wirebound") {
  throw 'Default user installation detected: refusing to run isolated QA.'
}
if (@(Get-CimInstance Win32_Process -Filter "name='wirebound.exe'" -ErrorAction SilentlyContinue).Count -gt 0) {
  throw 'An existing Wirebound process is running; refusing to interfere.'
}
if (-not (Test-Path -LiteralPath (Join-Path (Split-Path $resolvedExe) 'resources\app.asar'))) {
  throw 'Packaged app.asar missing beside selected executable.'
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$startTool = Join-Path $PSScriptRoot 'electron-cold-start.ps1'
$rows = [System.Collections.Generic.List[object]]::new()
$sequence = @('short', 'long', 'long', 'short')

function FirstEvent([object[]] $Events, [string] $Name) {
  return ($Events | Where-Object { $_.event -eq $Name } | Select-Object -First 1)
}

function RunSingle([string] $Mode, [int] $GapSeconds, [int] $Index) {
  if ($GapSeconds -gt 0) { Start-Sleep -Seconds $GapSeconds }

  $id = 'trial-{0:00}-{1}' -f $Index, $Mode
  $dir = Join-Path $OutputRoot $id
  $log = Join-Path $OutputRoot ($id + '.log')
  & pwsh -NoProfile -File $startTool -ExePath $resolvedExe -Attempts 1 -WaitSeconds $WaitSeconds -OutputRoot $dir -ObserveResources *> $log
  $rc = $LASTEXITCODE
  $trace = Join-Path $dir 'attempt-1\startup.jsonl'
  $events = @()
  if (Test-Path -LiteralPath $trace) {
    $events = @(Get-Content -LiteralPath $trace -ErrorAction SilentlyContinue | ForEach-Object {
      try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { $null }
    } | Where-Object { $null -ne $_ })
  }
  $first = FirstEvent $events 'main-module-start'
  $shown = FirstEvent $events 'window-shown'
  $root = $events | Where-Object { $_.event -eq 'renderer-root-probe' -and $_.rootChildren -gt 0 } | Select-Object -First 1
  $windowBefore = FirstEvent $events 'window-creating'
  $windowAfter = FirstEvent $events 'window-created'
  $loading = FirstEvent $events 'did-start-loading'
  $dom = FirstEvent $events 'dom-ready'
  $delays = @($events | Where-Object { $_.event -eq 'main-loop-heartbeat' })
  $row = [pscustomobject]@{
    index = $Index
    mode = $Mode
    gapSeconds = $GapSeconds
    passed = ($rc -eq 0 -and $null -ne $shown -and $null -ne $root)
    runnerExitCode = $rc
    mainFirstMs = if ($first) { [int]$first.elapsedMs } else { $null }
    windowCtorMs = if ($windowBefore -and $windowAfter) { [int]$windowAfter.elapsedMs - [int]$windowBefore.elapsedMs } else { $null }
    rendererLoadMs = if ($loading -and $dom) { [int]$dom.elapsedMs - [int]$loading.elapsedMs } else { $null }
    shownMs = if ($shown) { [int]$shown.elapsedMs } else { $null }
    rootMs = if ($root) { [int]$root.elapsedMs } else { $null }
    maxHeartbeatDelayMs = if ($delays.Count) { [int](($delays | Measure-Object -Property delayMs -Maximum).Maximum) } else { $null }
  }
  $rows.Add($row)
  Write-Output ('GAP_TRIAL={0} MODE={1} GAP_S={2} PASS={3} FIRST_MS={4} SHOWN_MS={5} HEARTBEAT_MAX_MS={6}' -f $Index,$Mode,$GapSeconds,$row.passed,$row.mainFirstMs,$row.shownMs,$row.maxHeartbeatDelayMs)
}

# One unscored warm-up establishes that the executable runs and helps avoid
# treating the first-ever launch after build as an ordinary short/long gap.
RunSingle 'warmup' 0 0
$index = 0
for ($round = 1; $round -le $Rounds; $round++) {
  $order = if ($round % 2 -eq 1) { $sequence } else { @('long','short','short','long') }
  foreach ($mode in $order) {
    $index++
    $gap = if ($mode -eq 'long') { $LongGapSeconds } else { $ShortGapSeconds }
    RunSingle $mode $gap $index
  }
}

$rows | Export-Csv -LiteralPath (Join-Path $OutputRoot 'gap-results.csv') -NoTypeInformation -Encoding utf8
foreach ($mode in @('short','long')) {
  $set = @($rows | Where-Object { $_.mode -eq $mode })
  $arr = @($set | Where-Object { $null -ne $_.shownMs } | ForEach-Object { [int]$_.shownMs } | Sort-Object)
  $median = if ($arr.Count % 2 -eq 0) {
    ($arr[$arr.Count / 2 - 1] + $arr[$arr.Count / 2]) / 2
  } elseif ($arr.Count) { $arr[[int][math]::Floor($arr.Count / 2)] } else { $null }
  $max = if ($arr.Count) { $arr[-1] } else { $null }
  Write-Output ('GAP_VARIANT={0} COUNT={1} PASS={2} MEDIAN_SHOWN_MS={3} MAX_SHOWN_MS={4}' -f $mode,$set.Count,@($set|Where-Object passed).Count,$median,$max)
}
$failures = @($rows | Where-Object { -not $_.passed }).Count
Write-Output ('GAP_AB_TOTAL={0} FAILURES={1}' -f $rows.Count,$failures)
if ($failures) { exit 1 }
