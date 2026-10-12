@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js is required. & pause & exit /b 1)
where cargo >nul 2>&1 || (echo Rust/Cargo is required. & pause & exit /b 1)
call npm install || exit /b 1
call npm run icon || exit /b 1
call npm run check || exit /b 1
call npm run build || exit /b 1
echo Done. Installer: src-tauri\target\release\bundle\nsis\
pause
