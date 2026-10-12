@echo off
setlocal
cd /d "%~dp0"
if "%FIRE_CONTROL_REPOSITORY%"=="" (echo Set FIRE_CONTROL_REPOSITORY=owner/repo & pause & exit /b 1)
if "%TAURI_UPDATER_PUBLIC_KEY%"=="" if "%TAURI_UPDATER_PUBLIC_KEY_FILE%"=="" (echo Set TAURI_UPDATER_PUBLIC_KEY_FILE to your public key & pause & exit /b 1)
if "%TAURI_SIGNING_PRIVATE_KEY%"=="" (echo Set TAURI_SIGNING_PRIVATE_KEY to your private key path or content & pause & exit /b 1)
call npm install || exit /b 1
call npm run icon || exit /b 1
call npm run configure:updates || exit /b 1
call npm run release:verify || exit /b 1
call npm run build:updates || exit /b 1
echo Signed installer is ready in src-tauri\target\release\bundle\nsis\
pause
