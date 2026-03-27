$ErrorActionPreference = 'Stop'

Write-Host "------------------------------------------" -ForegroundColor Green
Write-Host "       VEY.AI TOTAL BUILD SYSTEM          " -ForegroundColor Green
Write-Host "------------------------------------------" -ForegroundColor Green
Write-Host ""

# Fix for Stack Overflow during Rust build
$env:RUST_MIN_STACK = "8388608"

# Automatically determine the root folder (where scripts/ folder is)
$scriptPath = $MyInvocation.MyCommand.Path
$root = Split-Path (Split-Path $scriptPath -Parent) -Parent

Write-Host "Project Root: $root" -ForegroundColor Gray

# 0. Clean previous installers
Write-Host "STEP 0: Cleaning old installers..." -ForegroundColor Gray
$tauriBuildDir = "$root\vey-v2\src-tauri\target\release"
if (Test-Path $tauriBuildDir) {
    Remove-Item (Join-Path $tauriBuildDir "bundle") -Recurse -ErrorAction SilentlyContinue
}

# 1. Build Backend
Write-Host "STEP 1: Building Python AI Backend..." -ForegroundColor Cyan
Set-Location $root
& powershell -File "scripts\build-backend.ps1"

# 2. Build Frontend & Tauri App
Write-Host ""
Write-Host "STEP 2: Building Tauri Application..." -ForegroundColor Cyan
Set-Location "$root\vey-v2"
npm install
npm run tauri build

# 3. Finalize Installer
Write-Host ""
Write-Host "STEP 3: Preparing Final Installer..." -ForegroundColor Cyan
Set-Location $root

# Check if Tauri made an NSIS installer
$tauriBuildDir = "$root\vey-v2\src-tauri\target\release\bundle\nsis"
if (Test-Path $tauriBuildDir) {
    $nsisInstaller = Get-ChildItem -Path "$tauriBuildDir\*.exe" | Select-Object -First 1
    
    if ($nsisInstaller) {
        Write-Host "  Found NSIS Installer: $($nsisInstaller.Name)" -ForegroundColor Gray
        
        if (-not (Test-Path "dist")) { New-Item -ItemType Directory "dist" }
        Copy-Item $nsisInstaller.FullName -Destination "dist\vey-setup-v2.exe" -Force
        
        Write-Host ""
        Write-Host "  SUCCESS! Installer is ready at:" -ForegroundColor Green
        Write-Host "  dist\vey-setup-v2.exe" -ForegroundColor Yellow
    } else {
        Write-Host "  ERROR: No .exe found in $tauriBuildDir" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ERROR: Tauri NSIS folder not found: $tauriBuildDir" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  DONE. Build process finished successfully." -ForegroundColor Green
Write-Host ""
