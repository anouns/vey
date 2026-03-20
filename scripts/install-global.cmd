@echo off
setlocal EnableExtensions

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found in PATH.
  echo Install Node.js 20+ and run this installer again.
  pause
  exit /b 1
)

set "SCRIPT_DIR=%~dp0"
set "PAYLOAD_ZIP=%SCRIPT_DIR%payload.zip"
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\vey-tui"
set "BIN_DIR=%INSTALL_DIR%\bin"
set "LAUNCHER=%BIN_DIR%\vey.cmd"

if not exist "%PAYLOAD_ZIP%" (
  set "PAYLOAD_ZIP=%SCRIPT_DIR%..\payload.zip"
)

if not exist "%PAYLOAD_ZIP%" (
  echo payload.zip was not found next to the installer script.
  pause
  exit /b 1
)

echo Installing vey.TUI to:
echo   %INSTALL_DIR%

if exist "%INSTALL_DIR%" (
  rmdir /s /q "%INSTALL_DIR%"
)

mkdir "%INSTALL_DIR%" >nul 2>nul
mkdir "%BIN_DIR%" >nul 2>nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%PAYLOAD_ZIP%' -DestinationPath '%LOCALAPPDATA%\Programs' -Force"
if errorlevel 1 (
  echo Failed to unpack payload.zip
  pause
  exit /b 1
)

(
  echo @echo off
  echo setlocal
  echo node "%INSTALL_DIR%\src\index.js" %%*
) > "%LAUNCHER%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$bin = [IO.Path]::GetFullPath('%BIN_DIR%');" ^
  "$current = [Environment]::GetEnvironmentVariable('Path','User');" ^
  "if ([string]::IsNullOrWhiteSpace($current)) { $current = '' };" ^
  "$parts = @($current -split ';' | Where-Object { $_ });" ^
  "if ($parts -notcontains $bin) { $parts += $bin; [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User') }"
if errorlevel 1 (
  echo Failed to update user PATH.
  pause
  exit /b 1
)

echo.
echo vey.TUI installed successfully.
echo Open a new terminal and run:
echo   vey
pause
