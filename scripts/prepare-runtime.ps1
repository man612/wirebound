$ErrorActionPreference = 'Stop'

$PlatformToolsVersion = '37.0.1'
$PlatformToolsSha256 = '45f4d63113e895ebde0c90f194099a4676b6ac653bd28d54314a9e022bbc1a99'
$GnirehtetVersion = '2.5.1'
$GnirehtetSha256 = '7f5b1063e7895182aa60def1437e50363c3758144088dcd079037bb7c3c46a1c'
$RuntimeLayout = 'minimal-v1'

$Root = Split-Path -Parent $PSScriptRoot
$Bin = Join-Path $Root 'bin'
$Marker = Join-Path $Bin '.runtime-versions'
$ExpectedMarker = "platform-tools=$PlatformToolsVersion`ngnirehtet=$GnirehtetVersion`nlayout=$RuntimeLayout`n"
$AdbExe = Join-Path $Bin 'platform-tools\adb.exe'
$GnirehtetExe = Join-Path $Bin 'gnirehtet-rust-win64\gnirehtet.exe'

if ((Test-Path $AdbExe) -and (Test-Path $GnirehtetExe) -and (Test-Path $Marker)) {
  if ((Get-Content $Marker -Raw).Replace("`r`n", "`n") -eq $ExpectedMarker) {
    Write-Host "Wirebound runtime is already prepared."
    exit 0
  }
}

function Get-Sha256([string]$Path) {
  $Sha256 = [System.Security.Cryptography.SHA256]::Create()
  $Stream = [System.IO.File]::OpenRead($Path)

  try {
    $Hash = $Sha256.ComputeHash($Stream)
    return ([System.BitConverter]::ToString($Hash)).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $Stream.Dispose()
    $Sha256.Dispose()
  }
}

function Download-And-Verify([string]$Url, [string]$Destination, [string]$ExpectedSha256) {
  Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
  $Actual = Get-Sha256 $Destination
  if ($Actual -ne $ExpectedSha256) {
    throw "Checksum mismatch for $Url. Expected $ExpectedSha256, got $Actual."
  }
}

$Temp = Join-Path ([System.IO.Path]::GetTempPath()) "wirebound-runtime-$PID"
New-Item -ItemType Directory -Force $Temp | Out-Null

try {
  $PlatformZip = Join-Path $Temp 'platform-tools.zip'
  $GnirehtetZip = Join-Path $Temp 'gnirehtet.zip'

  Download-And-Verify "https://dl.google.com/android/repository/platform-tools_r$PlatformToolsVersion-win.zip" $PlatformZip $PlatformToolsSha256
  Download-And-Verify "https://github.com/Genymobile/gnirehtet/releases/download/v$GnirehtetVersion/gnirehtet-rust-win64-v$GnirehtetVersion.zip" $GnirehtetZip $GnirehtetSha256

  $PlatformExtract = Join-Path $Temp 'platform'
  $GnirehtetExtract = Join-Path $Temp 'gnirehtet'
  Expand-Archive -Path $PlatformZip -DestinationPath $PlatformExtract -Force
  Expand-Archive -Path $GnirehtetZip -DestinationPath $GnirehtetExtract -Force

  $PlatformSource = Join-Path $PlatformExtract 'platform-tools'
  $PlatformDestination = Join-Path $Bin 'platform-tools'
  $GnirehtetSource = Join-Path $GnirehtetExtract 'gnirehtet-rust-win64'
  $GnirehtetDestination = Join-Path $Bin 'gnirehtet-rust-win64'

  if (Test-Path $PlatformDestination) { Remove-Item $PlatformDestination -Recurse -Force }
  if (Test-Path $GnirehtetDestination) { Remove-Item $GnirehtetDestination -Recurse -Force }
  New-Item -ItemType Directory -Force $PlatformDestination | Out-Null
  New-Item -ItemType Directory -Force $GnirehtetDestination | Out-Null

  @('adb.exe', 'AdbWinApi.dll', 'AdbWinUsbApi.dll', 'NOTICE.txt', 'source.properties') | ForEach-Object {
    Copy-Item (Join-Path $PlatformSource $_) (Join-Path $PlatformDestination $_)
  }
  @('gnirehtet.exe', 'gnirehtet.apk') | ForEach-Object {
    Copy-Item (Join-Path $GnirehtetSource $_) (Join-Path $GnirehtetDestination $_)
  }
  [System.IO.File]::WriteAllText($Marker, $ExpectedMarker, [System.Text.UTF8Encoding]::new($false))

  Write-Host "Prepared Android Platform Tools $PlatformToolsVersion and Gnirehtet $GnirehtetVersion."
}
finally {
  Remove-Item $Temp -Recurse -Force -ErrorAction SilentlyContinue
}
