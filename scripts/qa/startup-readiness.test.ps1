$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'startup-readiness.psm1') -Force

function Event([string] $name, [int] $children = -1, [bool] $visible = $false) {
  [pscustomobject]@{
    event = $name
    rootChildren = $children
    visible = $visible
  }
}

$cases = @(
  [pscustomobject]@{
    name = 'React mounts while hidden, window shows later'
    events = @((Event 'renderer-root-probe' 1 $false), (Event 'window-shown'))
    expected = $true
  },
  [pscustomobject]@{
    name = 'Window shows before React mounting'
    events = @((Event 'window-shown'), (Event 'renderer-root-probe' 1 $true))
    expected = $true
  },
  [pscustomobject]@{
    name = 'Visible window but empty React root'
    events = @((Event 'window-shown'), (Event 'renderer-root-probe' 0 $true))
    expected = $false
  },
  [pscustomobject]@{
    name = 'Mounted React but window never shows'
    events = @((Event 'renderer-root-probe' 1 $false))
    expected = $false
  },
  [pscustomobject]@{
    name = 'QA cleanup killed renderer only after startup succeeded'
    events = @((Event 'window-shown'), (Event 'renderer-root-probe' 1 $true), (Event 'render-process-gone'))
    expected = $true
  },
  [pscustomobject]@{
    name = 'Renderer crash before the window is ready'
    events = @((Event 'renderer-root-probe' 1 $false), (Event 'render-process-gone'), (Event 'window-shown'))
    expected = $false
  },
  [pscustomobject]@{
    name = 'Load rejection before root mounting'
    events = @((Event 'window-shown'), (Event 'renderer-load-rejected'), (Event 'renderer-root-probe' 1 $true))
    expected = $false
  },
  [pscustomobject]@{
    name = 'No events'
    events = @()
    expected = $false
  }
)

foreach ($case in $cases) {
  $actual = Get-WireboundStartupReadiness -Events $case.events
  if ($actual.ready -ne $case.expected) {
    throw ("FAIL: {0}; expected={1}; actual={2}" -f $case.name, $case.expected, $actual.ready)
  }
  Write-Output ("PASS: {0}" -f $case.name)
}
Write-Output ("READINESS_CASES={0} FAILURES=0" -f $cases.Count)

# New renderer instrumentation includes a numeric UI-ready mark. A mounted
# placeholder alone must no longer pass when that field is present.
function MarkEvent([string] $name, [int] $children, [double] $uiReadyMs) {
  $entry = Event $name $children
  $entry | Add-Member -NotePropertyName uiSettingsReadyMs -NotePropertyValue $uiReadyMs
  return $entry
}

$modernCases = @(
  [pscustomobject]@{
    name = 'New trace: visible placeholder with UI mark unavailable is NOT ready'
    events = @((Event 'window-shown'), (MarkEvent 'renderer-root-probe' 1 -1))
    expected = $false
  },
  [pscustomobject]@{
    name = 'New trace: mounted UI mark before window show succeeds'
    events = @((MarkEvent 'renderer-root-probe' 1 156), (Event 'window-shown'))
    expected = $true
  },
  [pscustomobject]@{
    name = 'New trace: later full probe can confirm UI after early placeholder'
    events = @((Event 'window-shown'), (MarkEvent 'renderer-timing-early' 1 -1), (MarkEvent 'renderer-root-probe' 1 1300))
    expected = $true
  },
  [pscustomobject]@{
    name = 'New trace: positive UI mark without actual React root is NOT ready'
    events = @((Event 'window-shown'), (MarkEvent 'renderer-root-probe' 0 350))
    expected = $false
  },
  [pscustomobject]@{
    name = 'New trace: fatal renderer failure before UI readiness is NOT success'
    events = @((Event 'window-shown'), (MarkEvent 'renderer-timing-early' 1 -1), (Event 'render-process-gone'), (MarkEvent 'renderer-root-probe' 1 1400))
    expected = $false
  },
  [pscustomobject]@{
    name = 'New trace: QA-initiated kill after UI success cannot undo pass'
    events = @((Event 'window-shown'), (MarkEvent 'renderer-root-probe' 1 210), (Event 'render-process-gone'))
    expected = $true
  }
)
foreach ($case in $modernCases) {
  $actual = Get-WireboundStartupReadiness -Events $case.events
  if ($actual.ready -ne $case.expected) {
    throw ("FAIL: {0}; expected={1}; actual={2}" -f $case.name, $case.expected, $actual.ready)
  }
  if (-not $actual.uiMarkObserved) {
    throw ("FAIL: {0}; new instrumentation field not recognized" -f $case.name)
  }
  Write-Output ("PASS: {0}" -f $case.name)
}
Write-Output ("READINESS_MODERN_CASES={0} FAILURES=0" -f $modernCases.Count)

# Early probes are for diagnostics. A full renderer-root-probe must be retained
# for backwards-compatible reports and consumers.
$earlyOnly = Get-WireboundStartupReadiness -Events @(
  (Event 'window-shown'), (MarkEvent 'renderer-timing-early' 1 300)
)
if ($earlyOnly.ready) { throw 'FAIL: early-only renderer probe prematurely reported success' }
Write-Output 'PASS: Early probe cannot prematurely terminate QA before full probe'
