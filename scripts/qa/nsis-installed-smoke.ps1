param(
  [Parameter(Mandatory = $true)] [string] $Installer,
  [ValidateRange(1, 20)] [int] $Attempts = 3,
  [ValidateRange(5, 120)] [int] $WaitSeconds = 60,
  [string] $OutputRoot = (Join-Path ([System.IO.Path]::GetTempPath()) ("wirebound-nsis-qa-" + [guid]::NewGuid().ToString('N')))
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$referenceAsar = Join-Path $repoRoot 'dist\win-unpacked\resources\app.asar'
$installDir = Join-Path $OutputRoot 'installed-app'
$executable = Join-Path $installDir 'wirebound.exe'
$installedAsar = Join-Path $installDir 'resources\app.asar'
$traceDir = Join-Path $OutputRoot 'cold-start-traces'
$uninstallExitCode = $null
$exitCode = 1

if (-not $IsWindows) { throw 'NSIS QA only supports Windows.' }
if (-not (Test-Path -LiteralPath $referenceAsar)) {
  throw 'Reference unpacked app.asar is missing; build the same source first.'
}
if (Test-Path -LiteralPath $installDir) {
  throw "QA target already exists: $installDir"
}
if (Test-Path -LiteralPath "$env:LOCALAPPDATA\Programs\Wirebound") {
  throw 'Existing default user installation detected; refusing to run installer.'
}
$registered = @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'Wirebound' })
if ($registered.Count -gt 0) {
  throw 'Existing registered user installation detected; refusing to run installer.'
}
$existingProcesses = @(Get-CimInstance Win32_Process -Filter "name='wirebound.exe'" -ErrorAction SilentlyContinue)
if ($existingProcesses.Count -gt 0) {
  throw 'An existing Wirebound process is running; refusing to interfere with it.'
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
Write-Output "QA_INSTALLER=$([System.IO.Path]::GetFileName($installerPath))"
Write-Output "QA_INSTALLER_SIGNING=$((Get-AuthenticodeSignature $installerPath).Status)"
Write-Output "QA_INSTALLER_SHA256=$((Get-FileHash $installerPath -Algorithm SHA256).Hash)"
Write-Output "QA_OUTPUT=$OutputRoot"

try {
  $install = Start-Process -FilePath $installerPath -ArgumentList @('/S', "/D=$installDir") -PassThru -Wait
  Write-Output "QA_INSTALL_EXIT=$($install.ExitCode)"
  if ($install.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $executable)) {
    throw 'Installer failed or did not create the expected QA executable.'
  }
  if (-not (Test-Path -LiteralPath $installedAsar)) {
    throw 'Installed app.asar is missing.'
  }

  $referenceHash = (Get-FileHash $referenceAsar -Algorithm SHA256).Hash
  $installedHash = (Get-FileHash $installedAsar -Algorithm SHA256).Hash
  Write-Output "QA_INSTALLED_ASAR_MATCH=$($referenceHash -eq $installedHash)"
  if ($referenceHash -ne $installedHash) {
    throw 'Installed ASAR does not match the unpacked artifact from this build.'
  }

  & node (Join-Path $PSScriptRoot 'verify-packaged-asar.cjs') $installedAsar
  if ($LASTEXITCODE -ne 0) {
    throw 'Installed ASAR payload integrity verification failed.'
  }

  & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'electron-cold-start.ps1') -ExePath $executable -Attempts $Attempts -WaitSeconds $WaitSeconds -OutputRoot $traceDir -ObserveResources -CountDefenderEvents
  $exitCode = $LASTEXITCODE
  Write-Output "QA_COLD_START_EXIT=$exitCode"
} catch {
  Write-Output "QA_FAILURE=$($_.Exception.Message)"
  $exitCode = 1
} finally {
  # No other Wirebound process may run during the QA. Clean only this executable.
  $qaProcesses = @(Get-CimInstance Win32_Process -Filter "name='wirebound.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -eq $executable })
  foreach ($process in $qaProcesses) {
    & taskkill.exe /PID $process.ProcessId /T /F | Out-Null
  }

  $uninstaller = Get-ChildItem -LiteralPath $installDir -File -Filter '*uninstall*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($uninstaller) {
    try {
      $uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -PassThru -Wait
      $uninstallExitCode = $uninstall.ExitCode
    } catch {
      Write-Output "QA_UNINSTALL_ERROR=$($_.Exception.GetType().Name)"
      $exitCode = 1
    }
  } else {
    Write-Output 'QA_UNINSTALLER_NOT_FOUND'
    $exitCode = 1
  }

  Write-Output "QA_UNINSTALL_EXIT=$uninstallExitCode"
  Start-Sleep -Seconds 2
  $executableRemains = Test-Path -LiteralPath $executable
  $defaultInstallRemains = Test-Path -LiteralPath "$env:LOCALAPPDATA\Programs\Wirebound"
  Write-Output "QA_EXECUTABLE_REMAINS=$executableRemains"
  Write-Output "QA_DEFAULT_USER_INSTALL_PRESENT=$defaultInstallRemains"
  if ($uninstallExitCode -ne 0 -or $executableRemains -or $defaultInstallRemains) {
    $exitCode = 1
  }
}
Write-Output "QA_NSIS_RESULT=$exitCode"
exit $exitCode
