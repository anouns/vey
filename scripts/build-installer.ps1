param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

Write-Host "=== VEY.AI Installer Builder ===" -ForegroundColor Green
Write-Host ""

$projectRoot = (Resolve-Path $ProjectRoot).Path
$distDir = Join-Path $projectRoot 'dist'
$stageDir = Join-Path $distDir 'iexpress-stage'
$payloadRoot = Join-Path $distDir 'payload-root'
$packageRoot = Join-Path $payloadRoot 'VEY-AI'
$payloadZip = Join-Path $stageDir 'payload.zip'
$installerPath = Join-Path $distDir 'vey-setup.exe'
$sedPath = Join-Path $distDir 'vey-setup.sed'

# Check for Tauri build output
$tauriBuildDir = Join-Path $projectRoot 'vey-v2\src-tauri\target\release'
$tauriExe = Join-Path $tauriBuildDir 'vey-desktop.exe'

if (!(Test-Path $tauriExe)) {
  Write-Host "[WARN] Tauri build not found at $tauriExe" -ForegroundColor Yellow
  Write-Host "Run 'cd vey-v2 && npm run tauri build' first." -ForegroundColor Yellow
  
  # Try NSIS installer from Tauri bundle
  $nsisInstaller = Get-ChildItem -Path (Join-Path $tauriBuildDir 'bundle\nsis\*.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($nsisInstaller) {
    Write-Host "Found Tauri NSIS installer: $($nsisInstaller.FullName)" -ForegroundColor Green
    Copy-Item $nsisInstaller.FullName -Destination (Join-Path $distDir 'vey-setup.exe') -Force
    Write-Host "Installer copied to: $(Join-Path $distDir 'vey-setup.exe')"
    exit 0
  }
  
  throw "No Tauri build found. Please build the Tauri app first."
}

if (!(Get-Command iexpress.exe -ErrorAction SilentlyContinue)) {
  throw 'iexpress.exe is not available on this machine.'
}

# Clean staging
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
if (Test-Path $stageDir) { Remove-Item $stageDir -Recurse -Force }
if (Test-Path $payloadRoot) { Remove-Item $payloadRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

Write-Host "[1/4] Copying Tauri executable..." -ForegroundColor Cyan
Copy-Item $tauriExe -Destination $packageRoot -Force

# Copy WebView2 Loader if present
$webview2 = Join-Path $tauriBuildDir 'WebView2Loader.dll'
if (Test-Path $webview2) {
  Copy-Item $webview2 -Destination $packageRoot -Force
}

Write-Host "[2/4] Copying AI backend..." -ForegroundColor Cyan
$aiServiceDir = Join-Path $distDir 'ai_service'
if (Test-Path $aiServiceDir) {
  Copy-Item $aiServiceDir -Destination (Join-Path $packageRoot 'ai_service') -Recurse -Force
} else {
  Write-Host "[WARN] AI backend bundle not found. Run build-backend.ps1 first." -ForegroundColor Yellow
  # Copy Python script as fallback
  $scriptsSrc = Join-Path $projectRoot 'scripts'
  $scriptsDst = Join-Path $packageRoot 'scripts'
  New-Item -ItemType Directory -Force -Path $scriptsDst | Out-Null
  Copy-Item (Join-Path $scriptsSrc 'ai_service.py') -Destination $scriptsDst -Force
}

Write-Host "[3/4] Creating payload archive..." -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $payloadRoot '*') -DestinationPath $payloadZip -Force

# Copy install scripts
Copy-Item (Join-Path $projectRoot 'scripts\install-global.cmd') -Destination (Join-Path $stageDir 'install-global.cmd') -Force

$uninstallScript = Join-Path $projectRoot 'scripts\uninstall-global.cmd'
if (Test-Path $uninstallScript) {
  Copy-Item $uninstallScript -Destination (Join-Path $stageDir 'uninstall-global.cmd') -Force
}

Write-Host "[4/4] Building installer EXE..." -ForegroundColor Cyan
$escapedStage = $stageDir.TrimEnd('\')

$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=I
InstallPrompt=
DisplayLicense=
FinishMessage=VEY.AI installation finished successfully!
TargetName=$installerPath
FriendlyName=VEY.AI Desktop Setup
AppLaunched=install-global.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=install-global.cmd
SourceFiles=SourceFiles
[Strings]
FILE0="payload.zip"
FILE1="install-global.cmd"
[SourceFiles]
SourceFiles0=$escapedStage\
[SourceFiles0]
%FILE0%=
%FILE1%=
"@

Set-Content -Path $sedPath -Value $sed -Encoding ASCII
& iexpress.exe /N $sedPath | Out-Null

if (!(Test-Path $installerPath)) {
  throw 'Installer EXE was not created.'
}

Write-Host ""
Write-Host "=== Installer created ===" -ForegroundColor Green
Write-Host "Path: $installerPath"
