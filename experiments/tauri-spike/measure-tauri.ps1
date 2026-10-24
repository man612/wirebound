# Safe, standalone benchmark for the isolated Tauri Lab executable only.
# WARNING: This does NOT measure full React readiness and is NOT directly
# comparable to Electron without matching measurement instrumentation.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Exe,
  [ValidateRange(1, 100)][int]$Runs = 10,
  [ValidateRange(5, 180)][int]$TimeoutSeconds = 90,
  [string]$OutputCsv = (Join-Path $PSScriptRoot 'measurements\tauri-startup.csv')
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TauriLabNative {
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
'@ -ErrorAction Stop

$exePath = (Resolve-Path -LiteralPath $Exe -ErrorAction Stop).Path
if (-not [System.IO.Path]::GetFileName($exePath).ToLowerInvariant().Contains('tauri')) {
  throw 'Refusing arbitrary executables. Only use the Wirebound Tauri Lab executable.'
}

# Prevent interference with a pre-existing application/session.
$existing = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $exePath }
if ($existing) { throw 'A Tauri Lab instance already exists. Close it manually before benchmarking.' }

function Get-ProcessFamily {
  param([int]$ParentPid)
  $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
  $members = @($ParentPid)
  $queue = [System.Collections.Generic.Queue[int]]::new()
  $queue.Enqueue($ParentPid)
  while ($queue.Count -gt 0) {
    $id = $queue.Dequeue()
    foreach ($child in $all) {
      if ($child.ParentProcessId -eq $id -and $members -notcontains [int]$child.ProcessId) {
        $childId = [int]$child.ProcessId
        $members += $childId
        $queue.Enqueue($childId)
      }
    }
  }
  return $members
}

$rows = [System.Collections.Generic.List[object]]::new()
for ($run = 1; $run -le $Runs; $run++) {
  $process = $null
  $shownMs = $null
  $errorText = ''
  $mainPrivateMb = $null
  $mainWorkingMb = $null
  $familyPrivateMb = $null
  $familyWorkingMb = $null
  $familyCount = $null
  $started = (Get-Date).ToUniversalTime().ToString('o')

  try {
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    $process = Start-Process -FilePath $exePath -WorkingDirectory (Split-Path $exePath) -PassThru
    while ($timer.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
      Start-Sleep -Milliseconds 40
      $process.Refresh()
      if ($process.HasExited) { throw 'Process exited before displaying a window.' }
      $handle = $process.MainWindowHandle
      if ($handle -ne [IntPtr]::Zero -and [TauriLabNative]::IsWindowVisible($handle)) {
        $shownMs = [math]::Round($timer.Elapsed.TotalMilliseconds, 1)
        break
      }
    }
    if ($null -eq $shownMs) { throw 'Timeout: no visible native window.' }
    # Sample memory AFTER first-window timing to avoid polluting the timing.
    Start-Sleep -Milliseconds 750
    $family = @(Get-ProcessFamily -ParentPid $process.Id)
    $procs = @($family | ForEach-Object {
      Get-Process -Id $_ -ErrorAction SilentlyContinue
    } | Where-Object { $null -ne $_ })
    $main = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
    if ($main) {
      $mainPrivateMb = [math]::Round($main.PrivateMemorySize64 / 1MB, 1)
      $mainWorkingMb = [math]::Round($main.WorkingSet64 / 1MB, 1)
    }
    $familyCount = $procs.Count
    $familyPrivateMb = [math]::Round(($procs | Measure-Object -Property PrivateMemorySize64 -Sum).Sum / 1MB, 1)
    $familyWorkingMb = [math]::Round(($procs | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB, 1)
  } catch {
    $errorText = $_.Exception.Message
  } finally {
    # Only terminate the parent process started by this script; NEVER kill
    # existing adb, WebView2, Wirebound sessions or arbitrary child processes.
    if ($null -ne $process) {
      $ownProcess = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
      if ($ownProcess) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
      $process.Dispose()
    }
    Start-Sleep -Milliseconds 1000
  }

  $rows.Add([pscustomobject]@{
    run = $run
    startedUtc = $started
    visibleWindowMs = $shownMs
    mainPrivateMb = $mainPrivateMb
    mainWorkingSetMb = $mainWorkingMb
    familyProcessCount = $familyCount
    familyPrivateMb = $familyPrivateMb
    familyWorkingSetMb = $familyWorkingMb
    error = $errorText
  })
  Write-Host ('Run {0}/{1} visible={2}ms error={3}' -f $run,$Runs,$shownMs,$errorText)
}

$parent = Split-Path -Parent $OutputCsv
if (-not (Test-Path -LiteralPath $parent)) {
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
$rows | Export-Csv -Path $OutputCsv -NoTypeInformation -Encoding UTF8
Write-Host "Raw measurements: $OutputCsv"
Write-Host 'Window-visible timing != React fully rendered. Child process coverage is best-effort.'
