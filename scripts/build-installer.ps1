param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path $ProjectRoot).Path
$distDir = Join-Path $projectRoot 'dist'
$stageDir = Join-Path $distDir 'iexpress-stage'
$payloadRoot = Join-Path $distDir 'payload-root'
$packageRoot = Join-Path $payloadRoot 'vey-tui'
$payloadZip = Join-Path $stageDir 'payload.zip'
$installerPath = Join-Path $distDir 'vey-setup.exe'
$sedPath = Join-Path $distDir 'vey-setup.sed'

if (!(Get-Command iexpress.exe -ErrorAction SilentlyContinue)) {
  throw 'iexpress.exe is not available on this machine.'
}

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
if (Test-Path $stageDir) {
  Remove-Item $stageDir -Recurse -Force
}
if (Test-Path $payloadRoot) {
  Remove-Item $payloadRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

$copyItems = @(
  'src',
  'books',
  'docs',
  'node_modules',
  'scripts\install-global.cmd',
  'scripts\uninstall-global.cmd',
  'package.json',
  'package-lock.json',
  'README.md',
  'WORKSPACE_RAG_RULES.md',
  'tsconfig.json'
)

foreach ($item in $copyItems) {
  $source = Join-Path $projectRoot $item
  if (Test-Path $source) {
    $destination = Join-Path $packageRoot $item
    $destinationParent = Split-Path -Parent $destination
    if ($destinationParent -and !(Test-Path $destinationParent)) {
      New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    }
    Copy-Item -Path $source -Destination $destination -Recurse -Force
  }
}

Compress-Archive -Path (Join-Path $payloadRoot '*') -DestinationPath $payloadZip -Force
Copy-Item -Path (Join-Path $projectRoot 'scripts\install-global.cmd') -Destination (Join-Path $stageDir 'install-global.cmd') -Force
Copy-Item -Path (Join-Path $projectRoot 'scripts\uninstall-global.cmd') -Destination (Join-Path $stageDir 'uninstall-global.cmd') -Force

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
FinishMessage=vey.TUI installation finished.
TargetName=$installerPath
FriendlyName=vey.TUI Setup
AppLaunched=install-global.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=install-global.cmd
SourceFiles=SourceFiles
[Strings]
FILE0="payload.zip"
FILE1="install-global.cmd"
FILE2="uninstall-global.cmd"
[SourceFiles]
SourceFiles0=$escapedStage\
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
"@

Set-Content -Path $sedPath -Value $sed -Encoding ASCII

& iexpress.exe /N $sedPath | Out-Null

if (!(Test-Path $installerPath)) {
  throw 'Installer EXE was not created.'
}

Write-Host "Installer created: $installerPath"
