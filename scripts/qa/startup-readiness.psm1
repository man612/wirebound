# Evaluate renderer initialization and window visibility independently.
# A QA-only DOM probe can precede the first 'ready-to-show' event.
function Get-WireboundStartupReadiness {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]] $Events)

  $mounted = $false
  $shown = $false
  $failedBeforeReady = $false
  $ready = $false

  # The event stream is chronological. Stop at the FIRST success or failure.
  # A QA-initiated taskkill may append render-process-gone (reason='killed')
  # AFTER the renderer was already ready; that does not invalidate startup.
  foreach ($entry in $Events) {
    if ($entry.event -in @('renderer-load-rejected', 'render-process-gone', 'bootstrap-rejected')) {
      $failedBeforeReady = $true
      break
    }
    if ($entry.event -eq 'renderer-root-probe' -and
        $entry.rootChildren -is [ValueType] -and $entry.rootChildren -gt 0) {
      $mounted = $true
    }
    if ($entry.event -eq 'window-shown') {
      $shown = $true
    }
    if ($mounted -and $shown) {
      $ready = $true
      break
    }
  }

  [pscustomobject]@{
    rootMounted = $mounted
    windowShown = $shown
    failureRecorded = $failedBeforeReady
    ready = $ready
  }
}

Export-ModuleMember -Function Get-WireboundStartupReadiness
