@echo off
setlocal
cd /d "%~dp0"
echo =================================================
echo  ARMA REFORGER FIRE CONTROL - SIGNED UPDATES BUILD
 echo =================================================
echo.
if not exist "src-tauri\tauri.updater.conf.json" (
 echo ERROR: First run the updater configuration with your public key and GitHub repository.
 echo See UPDATES.md
 pause
 exit /b 1
)
if "%TAURI_SIGNING_PRIVATE_KEY%"=="" (
 echo ERROR: Set TAURI_SIGNING_PRIVATE_KEY in the environment.
 echo NEVER commit or share the private key.
 pause
 exit /b 1
)
call npm install
if errorlevel 1 goto error
call npm run check
if errorlevel 1 goto error
call npm run build:updates
if errorlevel 1 goto error
echo Signed NSIS installer and .sig files:
echo %CD%\src-tauri\target\release\bundle\nsis
explorer "%CD%\src-tauri\target\release\bundle\nsis"
pause
exit /b 0
:error
echo BUILD FAILED
pause
exit /b 1
