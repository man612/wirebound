param(
  [string] $ExePath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'dist\win-unpacked\wirebound.exe'),
  [ValidateRange(1, 6)] [int] $Rounds = 1,
  [ValidateRange(10, 120)] [int] $WaitSeconds = 45,
  [switch] $StartWithSkip,
  [string] $OutputRoot = (Join-Path ([IO.Path]::GetTempPath()) ('wirebound-adb-cache-ab-' + [guid]::NewGuid().ToString('N')))
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This QA harness runs on Windows only.' }
$resolvedExe = (Resolve-Path -LiteralPath $ExePath).Path
if (Test-Path -LiteralPath $OutputRoot) { throw "QA output exists, refusing overwrite: $OutputRoot" }
if (@(Get-Process -Name wirebound -ErrorAction SilentlyContinue).Count -gt 0) {
  throw 'Existing Wirebound process: refusing to interfere with a user session.'
}
$archive = Join-Path (Split-Path $resolvedExe -Parent) 'resources\app.asar'
if (-not (Test-Path $archive)) { throw 'Packaged app.asar missing; do not time an incomplete package.' }
$runner = Join-Path $PSScriptRoot 'electron-cold-start.ps1'
if (-not (Test-Path $runner)) { throw 'Isolated Electron cold-start harness missing.' }

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$sequence = if ($StartWithSkip) { @('skip','normal','normal','skip') } else { @('normal','skip','skip','normal') }
$rows = [Collections.Generic.List[object]]::new()
$savedSkip = [Environment]::GetEnvironmentVariable('WIREBOUND_QA_SKIP_ADB_CACHE', 'Process')
$index = 0

function FirstMs([object[]] $Events, [string] $Name) {
  $e = $Events | Where-Object { $_.event -eq $Name } | Select-Object -First 1
  if ($null -eq $e) { return $null }
  return [int]$e.elapsedMs
}

try {
  for ($round = 1; $round -le $Rounds; $round++) {
    foreach ($mode in $sequence) {
      $index++
      $id = 'trial-{0:D2}-{1}' -f $index,$mode
      $folder = Join-Path $OutputRoot $id
      $log = Join-Path $OutputRoot ($id + '.log')
      # The child harness creates a fresh QA-only userData/sessionData, isolated
      # LOCALAPPDATA/APPDATA, and an absolute trace. Without these requirements
      # the native app MUST NOT honor the cache skip flag.
      $env:WIREBOUND_QA_SKIP_ADB_CACHE = if ($mode -eq 'skip') { '1' } else { '0' }
      Write-Output "TRIAL_START=$index MODE=$mode"
      & pwsh -NoProfile -File $runner -ExePath $resolvedExe -Attempts 1 -WaitSeconds $WaitSeconds -OutputRoot $folder *> $log
      $runnerExit = $LASTEXITCODE
      $trace = Join-Path $folder 'attempt-1\startup.jsonl'
      $events = @()
      if (Test-Path $trace) {
        $events = @(Get-Content $trace -ErrorAction SilentlyContinue | ForEach-Object {
          try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { $null }
        } | Where-Object { $null -ne $_ })
      }

      $shown = FirstMs $events 'window-shown'
      $fingerprintStart = FirstMs $events 'adb-cache-fingerprint-start'
      $fingerprintReady = FirstMs $events 'adb-cache-fingerprint-ready'
      $nativeStart = FirstMs $events 'window-creating'
      $nativeReady = FirstMs $events 'window-created'
      $rendererStart = FirstMs $events 'did-start-loading'
      $rendererReady = FirstMs $events 'dom-ready'
      $root = @($events | Where-Object { $_.event -eq 'renderer-root-probe' -and $_.rootChildren -gt 0 }).Count -gt 0
      $observedSkip = @($events | Where-Object { $_.event -eq 'adb-cache-skipped-qa' }).Count -gt 0
      $expectedSkip = ($mode -eq 'skip')
      $passed = ($runnerExit -eq 0 -and $null -ne $shown -and $root -and $observedSkip -eq $expectedSkip)
      $row = [pscustomobject]@{
        trial = $index; round = $round; mode = $mode; passed = $passed
        runnerExit = $runnerExit; windowShownMs = $shown
        adbFingerprintMs = if ($null -ne $fingerprintStart -and $null -ne $fingerprintReady) { $fingerprintReady - $fingerprintStart } else { $null }
        windowCreateMs = if ($null -ne $nativeStart -and $null -ne $nativeReady) { $nativeReady - $nativeStart } else { $null }
        rendererLoadMs = if ($null -ne $rendererStart -and $null -ne $rendererReady) { $rendererReady - $rendererStart } else { $null }
        rootMounted = $root; skipMarker = $observedSkip
      }
      $rows.Add($row)
      # Persist after EACH trial, even if a subsequent trial aborts.
      $rows | Export-Csv (Join-Path $OutputRoot 'results.csv') -NoTypeInformation -Encoding utf8
      Write-Output ('TRIAL={0} MODE={1} PASS={2} SHOWN_MS={3} HASH_MS={4}' -f $index,$mode,$passed,$shown,$row.adbFingerprintMs)
      # Allow the cold-start runner a short cleanup grace period. Never kill a
      # process by name; fail closed if another Wirebound is still running.
      for ($retry = 0; $retry -lt 10 -and @(Get-Process -Name wirebound -ErrorAction SilentlyContinue).Count -gt 0; $retry++) {
        Start-Sleep -Milliseconds 700
      }
      if (@(Get-Process -Name wirebound -ErrorAction SilentlyContinue).Count -gt 0) {
        throw 'Wirebound process remained after QA cleanup; stopped without touching user processes.'
      }
    }
  }
} finally {
  [Environment]::SetEnvironmentVariable('WIREBOUND_QA_SKIP_ADB_CACHE', $savedSkip, 'Process')
}

foreach ($mode in @('normal','skip')) {
  $valid = @($rows | Where-Object { $_.mode -eq $mode -and $_.passed })
  $elapsed = @($valid | ForEach-Object { [double]$_.windowShownMs } | Sort-Object)
  $median = $null
  if ($elapsed.Count) {
    if ($elapsed.Count % 2) { $median = $elapsed[[int][math]::Floor($elapsed.Count / 2)] }
    else { $median = ($elapsed[$elapsed.Count / 2 - 1] + $elapsed[$elapsed.Count / 2]) / 2 }
  }
  Write-Output ('VARIANT={0} SUCCESS={1} MEDIAN_SHOWN_MS={2}' -f $mode,$elapsed.Count,$median)
}
Write-Output ('RESULTS_CSV=' + (Join-Path $OutputRoot 'results.csv'))
if (@($rows | Where-Object { -not $_.passed }).Count) { exit 1 }
