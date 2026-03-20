@echo off
setlocal EnableExtensions

set "INSTALL_DIR=%LOCALAPPDATA%\Programs\vey-tui"
set "BIN_DIR=%INSTALL_DIR%\bin"

if exist "%INSTALL_DIR%" (
  rmdir /s /q "%INSTALL_DIR%"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$bin = [IO.Path]::GetFullPath('%BIN_DIR%');" ^
  "$current = [Environment]::GetEnvironmentVariable('Path','User');" ^
  "$parts = @($current -split ';' | Where-Object { $_ -and $_ -ne $bin });" ^
  "[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')"

echo vey.TUI was removed from this user profile.
pause
