@echo off
setlocal
cd /d "%~dp0"
echo.
echo ================================================
echo  ARMA REFORGER FIRE CONTROL - WINDOWS BUILD
 echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found. Install Node.js 22 LTS.
  pause
  exit /b 1
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo ERROR: Rust/Cargo not found. Install Rust and MSVC C++ Build Tools.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 goto error
call npm run check
if errorlevel 1 goto error
call npm run build
if errorlevel 1 goto error
echo.
echo SUCCESS. Installer directory:
echo %CD%\src-tauri\target\release\bundle\nsis
explorer "%CD%\src-tauri\target\release\bundle\nsis"
pause
exit /b 0
:error
echo.
echo BUILD FAILED. Check the messages above.
pause
exit /b 1
