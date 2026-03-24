@echo off
setlocal EnableExtensions

echo ==========================================
echo   VEY.AI Desktop - Installer
echo ==========================================
echo.

set "SCRIPT_DIR=%~dp0"
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\VEY-AI"
set "BIN_DIR=%INSTALL_DIR%\bin"
set "DESKTOP_SHORTCUT=%USERPROFILE%\Desktop\VEY.AI.lnk"

:: Check for payload
set "PAYLOAD_ZIP=%SCRIPT_DIR%payload.zip"
if not exist "%PAYLOAD_ZIP%" (
  set "PAYLOAD_ZIP=%SCRIPT_DIR%..\payload.zip"
)
if not exist "%PAYLOAD_ZIP%" (
  echo [ERROR] payload.zip not found!
  pause
  exit /b 1
)

echo Installing VEY.AI to:
echo   %INSTALL_DIR%
echo.

:: Clean previous install
if exist "%INSTALL_DIR%" (
  echo Removing previous installation...
  rmdir /s /q "%INSTALL_DIR%"
)

mkdir "%INSTALL_DIR%" >nul 2>nul
mkdir "%BIN_DIR%" >nul 2>nul

:: Extract payload
echo Extracting files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%PAYLOAD_ZIP%' -DestinationPath '%INSTALL_DIR%' -Force"
if errorlevel 1 (
  echo [ERROR] Failed to unpack payload.zip
  pause
  exit /b 1
)

:: Create launcher batch file
(
  echo @echo off
  echo start "" "%INSTALL_DIR%\vey-desktop.exe"
) > "%BIN_DIR%\vey.cmd"

:: Add to PATH
echo Adding to user PATH...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$bin = [IO.Path]::GetFullPath('%BIN_DIR%');" ^
  "$current = [Environment]::GetEnvironmentVariable('Path','User');" ^
  "if ([string]::IsNullOrWhiteSpace($current)) { $current = '' };" ^
  "$parts = @($current -split ';' | Where-Object { $_ });" ^
  "if ($parts -notcontains $bin) { $parts += $bin; [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User') }"

:: Create Desktop Shortcut
echo Creating desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WshShell = New-Object -comObject WScript.Shell;" ^
  "$Shortcut = $WshShell.CreateShortcut('%DESKTOP_SHORTCUT%');" ^
  "$Shortcut.TargetPath = '%INSTALL_DIR%\vey-desktop.exe';" ^
  "$Shortcut.WorkingDirectory = '%INSTALL_DIR%';" ^
  "$Shortcut.Description = 'VEY.AI Desktop';" ^
  "$Shortcut.Save()"

echo.
echo ==========================================
echo   VEY.AI installed successfully!
echo ==========================================
echo.
echo You can:
echo   1. Double-click the desktop shortcut "VEY.AI"
echo   2. Open a new terminal and type: vey
echo.
pause
