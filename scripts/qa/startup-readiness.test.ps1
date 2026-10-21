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
