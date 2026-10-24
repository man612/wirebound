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
using System.Text;
using System.Runtime.InteropServices;
public static class TauriLabNative {
    public delegate bool EnumProc(IntPtr hwnd, IntPtr data);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr data);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern int GetClassName(IntPtr hwnd, StringBuilder buffer, int length);
    public static IntPtr FindVisibleMainWindow(uint processId) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hwnd, data) => {
            uint owner;
            GetWindowThreadProcessId(hwnd, out owner);
            if (owner != processId || !IsWindowVisible(hwnd)) return true;
            RECT rect;
            if (!GetWindowRect(hwnd, out rect)) return true;
            int width = rect.Right - rect.Left, height = rect.Bottom - rect.Top;
            var cls = new StringBuilder(128);
            GetClassName(hwnd, cls, cls.Capacity);
            // Tauri/Tao also owns a visible 16x16 event-target helper.
            // Do NOT count it as a dashboard window or use MainWindowHandle.
            if (cls.ToString() == "Tauri Window" && width >= 760 && height >= 560) {
                found = hwnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
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
      $handle = [TauriLabNative]::FindVisibleMainWindow([uint32]$process.Id)
      if ($handle -ne [IntPtr]::Zero) {
        $shownMs = [math]::Round($timer.Elapsed.TotalMilliseconds, 1)
        break
      }
    }
    if ($null -eq $shownMs) { throw 'Timeout: no verified visible 760x560+ Tauri Window. 16x16 helper windows do not count.' }
    # Sample memory AFTER verified full-size Tauri window visibility.
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
Write-Host 'Verified visible Tauri Window size >=760x560; not a guaranteed completed paint. Helper windows excluded. Child process coverage best-effort.'
