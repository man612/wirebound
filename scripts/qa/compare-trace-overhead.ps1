param(
  [string] $ExePath = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'dist\win-unpacked\wirebound.exe'),
  [ValidateRange(1, 10)] [int] $Rounds = 3,
  [ValidateRange(10, 120)] [int] $WaitSeconds = 70,
  [ValidateRange(1, 20)] [int] $BetweenSeconds = 2,
  [switch] $StartWithoutTrace,
  [string] $OutputRoot = (Join-Path ([IO.Path]::GetTempPath()) ('wirebound-trace-ab-' + [guid]::NewGuid().ToString('N')))
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'Windows only.' }
$exe = (Resolve-Path -LiteralPath $ExePath).Path
$base = Split-Path -Parent $exe
if (Test-Path $OutputRoot) { throw "QA results directory exists: $OutputRoot" }
if (-not (Test-Path (Join-Path $base 'resources\app.asar'))) { throw 'Expected ASAR is missing.' }
if (Test-Path "$env:LOCALAPPDATA\Programs\Wirebound") {
  throw 'Normal Wirebound installation found. Refusing QA.'
}
if (@(Get-CimInstance Win32_Process -Filter "name='wirebound.exe'" -ErrorAction SilentlyContinue).Count -gt 0) {
  throw 'Running Wirebound process detected. Refusing QA.'
}

# MainWindowHandle plus IsWindowVisible provide a window-visibility signal
# without a trace file or injecting a debugger into the production renderer.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WireboundQAVisibility {
  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hwnd);
}
'@ -ErrorAction Stop

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$rows = [Collections.Generic.List[object]]::new()

function Single([string] $mode, [int] $index) {
  $dirname = 'trial-{0:00}-{1}' -f $index,$mode
  $dir = Join-Path $OutputRoot $dirname
  New-Item -ItemType Directory -Force -Path "$dir\appdata","$dir\localappdata" | Out-Null
  $trace = Join-Path $dir 'startup.jsonl'
  $oApp=$env:APPDATA;$oLocal=$env:LOCALAPPDATA
  $oTrace=$env:WIREBOUND_QA_STARTUP_TRACE
  $oIcon=$env:WIREBOUND_QA_SKIP_WINDOW_ICON
  $oIso=$env:WIREBOUND_QA_PROFILE_ISOLATION
  $oDir=$env:WIREBOUND_QA_PROFILE_DIR
  $child=$null
  $status='timeout'
  $shownMs=$null
  $sw=[Diagnostics.Stopwatch]::StartNew()
  try {
    $env:APPDATA="$dir\appdata"
    $env:LOCALAPPDATA="$dir\localappdata"
    $env:WIREBOUND_QA_STARTUP_TRACE=if($mode -eq 'trace-on'){$trace}else{$null}
    $env:WIREBOUND_QA_SKIP_WINDOW_ICON=$null
    $env:WIREBOUND_QA_PROFILE_ISOLATION='1'
    $env:WIREBOUND_QA_PROFILE_DIR=Join-Path $dir 'user-data'
    $child=Start-Process -FilePath $exe -WorkingDirectory $base -PassThru
    $env:APPDATA=$oApp;$env:LOCALAPPDATA=$oLocal
    $env:WIREBOUND_QA_STARTUP_TRACE=$oTrace;$env:WIREBOUND_QA_SKIP_WINDOW_ICON=$oIcon
    $env:WIREBOUND_QA_PROFILE_ISOLATION=$oIso;$env:WIREBOUND_QA_PROFILE_DIR=$oDir
    while($sw.Elapsed.TotalSeconds -lt $WaitSeconds){
      Start-Sleep -Milliseconds 200
      $proc=Get-Process -Id $child.Id -ErrorAction SilentlyContinue
      if(-not $proc){$status='exited';break}
      $hwnd=$proc.MainWindowHandle
      if($hwnd -ne 0 -and [WireboundQAVisibility]::IsWindowVisible($hwnd)){
        $shownMs=[math]::Round($sw.Elapsed.TotalMilliseconds)
        $status='visible'
        break
      }
    }
    # Give the React root probe enough time to run before terminating
    # trace-enabled QA. This delay does not count toward window-show metrics.
    if($status -eq 'visible'){Start-Sleep -Seconds 3}
    $traceShown=$null;$traceReact=$null;$traceFirst=$null;$heartbeatMax=$null
    if(Test-Path -LiteralPath $trace){
      $events=@(Get-Content -LiteralPath $trace | ForEach-Object {
        try { $_ | ConvertFrom-Json -ErrorAction Stop } catch {$null}
      } | Where-Object {$null -ne $_})
      $a=$events|Where-Object event -eq 'window-shown'|Select-Object -First 1
      $b=$events|Where-Object { $_.event -eq 'renderer-root-probe' -and $_.rootChildren -gt 0 }|Select-Object -First 1
      $c=$events|Where-Object event -eq 'main-module-start'|Select-Object -First 1
      $p=@($events|Where-Object event -eq 'main-loop-heartbeat')
      if($a){$traceShown=[int]$a.elapsedMs}
      if($b){$traceReact=[int]$b.elapsedMs}
      if($c){$traceFirst=[int]$c.elapsedMs}
      if($p.Count){$heartbeatMax=($p|Measure-Object delayMs -Maximum).Maximum}
    }
    # Both variants are judged by the SAME external window-visible signal.
    # A delayed/missing root probe is captured as metadata, not a separate
    # failure condition available only to trace-enabled trials.
    $pass=$status -eq 'visible'
    $row=[pscustomobject]@{
      trial=$index; mode=$mode; passed=$pass; outcome=$status
      externalShownMs=$shownMs; internalShownMs=$traceShown
      reactRootMs=$traceReact; mainFirstMs=$traceFirst
      maxHeartbeatDelayMs=$heartbeatMax
    }
    $rows.Add($row)
    Write-Output ('TRACE_AB_TRIAL={0} MODE={1} PASS={2} EXTERNAL_SHOWN_MS={3} INTERNAL_SHOWN_MS={4} REACT_MS={5} HEARTBEAT_MAX_MS={6}' -f $index,$mode,$pass,$shownMs,$traceShown,$traceReact,$heartbeatMax)
  } finally {
    $env:APPDATA=$oApp;$env:LOCALAPPDATA=$oLocal
    $env:WIREBOUND_QA_STARTUP_TRACE=$oTrace;$env:WIREBOUND_QA_SKIP_WINDOW_ICON=$oIcon
    $env:WIREBOUND_QA_PROFILE_ISOLATION=$oIso;$env:WIREBOUND_QA_PROFILE_DIR=$oDir
    if($child){
      $live=Get-CimInstance Win32_Process -Filter "ProcessId=$($child.Id)" -ErrorAction SilentlyContinue
      if($live -and $live.ExecutablePath -eq $exe){& taskkill.exe /PID $child.Id /T /F|Out-Null}
    }
  }
}

# One unscored warm-up; both modes are then counterbalanced.
Single 'warmup' 0
$trial=0
for($round=1;$round -le $Rounds;$round++){
  $traceFirst = $round % 2 -eq 1
  if($StartWithoutTrace){$traceFirst = -not $traceFirst}
  $sequence=if($traceFirst){@('trace-on','trace-off','trace-off','trace-on')}else{@('trace-off','trace-on','trace-on','trace-off')}
  foreach($mode in $sequence){
    $trial++
    Start-Sleep -Seconds $BetweenSeconds
    Single $mode $trial
  }
}

$rows|Export-Csv -LiteralPath (Join-Path $OutputRoot 'trace-ab-results.csv') -NoTypeInformation -Encoding utf8
foreach($mode in @('trace-on','trace-off')){
  $s=@($rows|Where-Object{$_.mode -eq $mode})
  $v=@($s|Where-Object {$null -ne $_.externalShownMs}|ForEach-Object{[int]$_.externalShownMs}|Sort-Object)
  $median=if($v.Count%2 -eq 0){($v[$v.Count/2-1]+$v[$v.Count/2])/2}else{$v[[int][math]::Floor($v.Count/2)]}
  $timeoutCount=@($s|Where-Object {$_.outcome -eq 'timeout'}).Count
  Write-Output ('TRACE_VARIANT={0} COUNT={1} VISIBLE={2} TIMEOUTS={3} MEDIAN_VISIBLE_MS={4} MAX_VISIBLE_MS={5}' -f $mode,$s.Count,@($s|Where-Object passed).Count,$timeoutCount,$median,$v[-1])
}
$failed=@($rows|Where-Object{-not $_.passed}).Count
Write-Output ('TRACE_AB_TOTAL={0} FAILURES={1}' -f $rows.Count,$failed)
if($failed){exit 1}
