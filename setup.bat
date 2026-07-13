@echo off
title Sistem Pembayaran SDN 1 Selopuro
cd /d "%~dp0"

:: Find Node.js
set "NODE=node"
if exist "node-portable\node.exe" (
    set "NODE=node-portable\node.exe"
) else (
    where node >nul 2>&1
    if %errorlevel% neq 0 (
        if exist "C:\Program Files\nodejs\node.exe" (
            set "NODE=C:\Program Files\nodejs\node.exe"
        ) else (
            echo.
            echo   [ERROR] Node.js tidak ditemukan!
            echo   Jalankan INSTALL.bat terlebih dahulu.
            echo.
            pause
            exit /b 1
        )
    )
)

echo.
echo   ============================================
echo     Sistem Pembayaran SDN 1 Selopuro
echo   ============================================
echo     Server: http://localhost:3000
echo     Login  : admin / admin123
echo   ============================================
echo.

start "" /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"
"%NODE%" server.js
pause
