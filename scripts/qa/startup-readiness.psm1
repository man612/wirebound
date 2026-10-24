# QA-only startup readiness. Legacy traces lack the UI mark; newer traces must
# confirm the post-settings UI commit, not merely a blank React placeholder.
function Get-WireboundStartupReadiness {
  [CmdletBinding()]
  param([Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]] $Events)

  $mounted = $false
  $shown = $false
  $hasUiMarkField = $false
  $uiCommitted = $false
  $failedBeforeReady = $false
  $ready = $false

  # Evaluate chronologically. QA cleanup may kill the renderer AFTER success.
  foreach ($entry in $Events) {
    if ($entry.event -in @('renderer-load-rejected', 'render-process-gone', 'bootstrap-rejected')) {
      $failedBeforeReady = $true
      break
    }
    if ($entry.event -eq 'renderer-timing-early' -and
        $null -ne $entry.PSObject.Properties['uiSettingsReadyMs']) {
      $hasUiMarkField = $true
    }
    # Only the full compatibility probe can complete readiness. Accepting the
    # early probe would stop the QA process before its full trace is recorded.
    if ($entry.event -eq 'renderer-root-probe') {
      $mark = $entry.PSObject.Properties['uiSettingsReadyMs']
      if ($null -ne $mark) { $hasUiMarkField = $true }
      if ($entry.rootChildren -is [ValueType] -and $entry.rootChildren -gt 0) {
        $mounted = $true
        # A mark without actual mounted content is insufficient. -1 means
        # unavailable *at this probe*, not proof that the UI later completed.
        if ($null -ne $mark -and $mark.Value -is [ValueType] -and
            [double]$mark.Value -ge 0) {
          $uiCommitted = $true
        }
      }
    }
    if ($entry.event -eq 'window-shown') { $shown = $true }
    if ($mounted -and $shown -and (-not $hasUiMarkField -or $uiCommitted)) {
      $ready = $true
      break
    }
  }

  [pscustomobject]@{
    rootMounted = $mounted
    windowShown = $shown
    uiMarkObserved = $hasUiMarkField
    uiCommitted = $uiCommitted
    failureRecorded = $failedBeforeReady
    ready = $ready
  }
}

Export-ModuleMember -Function Get-WireboundStartupReadiness
