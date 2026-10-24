[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $DeferredTrace,
  [Parameter(Mandatory = $true)] [string] $NormalTrace
)
$ErrorActionPreference = 'Stop'

function Read-Trace([string] $Path) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "Startup trace missing: $Path" }
  $events = @(Get-Content -LiteralPath $Path | ForEach-Object {
    try { $_ | ConvertFrom-Json -ErrorAction Stop }
    catch { throw 'Malformed startup JSONL event.' }
  })
  if (-not $events.Count) { throw 'Startup trace is empty.' }
  return $events
}

function First-Event([object[]] $Events, [string] $Name) {
  return $Events | Where-Object { $_.event -eq $Name } | Select-Object -First 1
}

function At([object[]] $Events, [string] $Name) {
  $event = First-Event $Events $Name
  if ($null -eq $event) { throw "Required event not recorded: $Name" }
  return [double] $event.elapsedMs
}

function Require-Root([object[]] $Events) {
  if (-not (@($Events | Where-Object {
    $_.event -eq 'renderer-root-probe' -and $_.rootChildren -gt 0
  }).Count -gt 0)) { throw 'React root never verified with content.' }
}

$deferred = @(Read-Trace $DeferredTrace)
$normal = @(Read-Trace $NormalTrace)
Require-Root $deferred
Require-Root $normal
$shown = At $deferred 'window-shown'
$scheduled = At $deferred 'deferred-runtime-scheduled'
$started = At $deferred 'deferred-runtime-start'
$hashStart = At $deferred 'adb-cache-fingerprint-start'
$hashReady = At $deferred 'adb-cache-fingerprint-ready'
$verified = At $deferred 'adb-cache-verify-ready'
$ready = At $deferred 'deferred-runtime-ready'
$server = At $deferred 'adb-server-ready'

if (-not ($shown -le $scheduled -and $scheduled -le $started -and
           $started -le $hashStart -and $hashStart -le $hashReady -and
           $hashReady -le $verified -and $verified -le $ready -and $ready -le $server)) {
  throw 'UI-first readiness order invalid: cache must not run before the visible window.'
}
if (First-Event $deferred 'runtime-paths-start') {
  throw 'Deferred mode unexpectedly took the eager ADB runtime path.'
}
if (First-Event $normal 'deferred-runtime-start') {
  throw 'Normal launch unexpectedly enabled deferred runtime.'
}
if (-not ((At $normal 'runtime-paths-start') -le (At $normal 'adb-cache-fingerprint-start') -and
          (At $normal 'adb-cache-verify-ready') -lt (At $normal 'window-shown'))) {
  throw 'Normal ADB cache startup ordering changed unexpectedly.'
}
Write-Output ('UI_FIRST_TRACE_PASS windowShownMs={0} runtimeReadyMs={1} serverReadyMs={2}' -f $shown,$ready,$server)
Write-Output ('NORMAL_TRACE_PASS windowShownMs=' + (At $normal 'window-shown'))
