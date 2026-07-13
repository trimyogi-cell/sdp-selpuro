@echo off
title Install Sistem Pembayaran SDN 1 Selopuro
color 0A
cls

echo ==================================================
echo   INSTALLER - SISTEM PEMBAYARAN SDN 1 SELOPURO
echo ==================================================
echo.

cd /d "%~dp0"

:: ===== STEP 1: Check if Node.js exists =====
echo [1/4] Mengecek Node.js...
set "NODE="
set "NPM="

:: Check system Node.js first
where node >nul 2>&1
if %errorlevel% equ 0 (
    set "NODE=node"
    set "NPM=npm"
    echo   [OK] Node.js ditemukan di system.
    goto :found_node
)

:: Check common install locations
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE=C:\Program Files\nodejs\node.exe"
    set "NPM=C:\Program Files\nodejs\npm.cmd"
    echo   [OK] Node.js ditemukan.
    goto :found_node
)

:: Check bundled portable
if exist "node-portable\node.exe" (
    set "NODE=node-portable\node.exe"
    set "NPM=node-portable\npm.cmd"
    echo   [OK] Node.js portable ditemukan.
    goto :found_node
)

:: ===== STEP 2: Download Node.js Portable =====
echo   Node.js tidak ditemukan. Mendownload Node.js portable...
echo   (ukuran ~30MB, tunggu sebentar)
echo.

if not exist "node-portable" mkdir "node-portable"

:: Download Node.js v20.11.1 LTS (stable)
set "NODE_URL=https://nodejs.org/dist/v20.11.1/node-v20.11.1-win-x64.zip"
set "NODE_ZIP=node-portable.zip"

powershell -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
    "Write-Host '  Downloading Node.js v20.11.1...'; " ^
    "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%' -UseBasicParsing; " ^
    "Write-Host '  Extracting...'"

if not exist "%NODE_ZIP%" (
    echo   [ERROR] Gagal download Node.js!
    echo   Download manual dari: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Extract
powershell -Command ^
    "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath 'node-temp' -Force; " ^
    "$f = Get-ChildItem 'node-temp' -Directory | Select-Object -First 1; " ^
    "Copy-Item -Path ($f.FullName + '\*') -Destination 'node-portable' -Recurse -Force; " ^
    "Remove-Item 'node-temp' -Recurse -Force; " ^
    "Remove-Item '%NODE_ZIP%' -Force"

if not exist "node-portable\node.exe" (
    echo   [ERROR] Gagal extract Node.js!
    pause
    exit /b 1
)

set "NODE=node-portable\node.exe"
set "NPM=node-portable\npm.cmd"
echo   [OK] Node.js portable terinstall.

:found_node
echo.

:: ===== STEP 3: Install dependencies =====
echo [2/4] Install dependencies...
if not exist node_modules (
    call "%NPM%" install --production >nul 2>&1
    echo   [OK] Dependencies terinstall.
) else (
    echo   [OK] Dependencies sudah ada.
)
echo.

:: ===== STEP 4: Get IP =====
echo [3/4] Menyiapkan...
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    if not defined LOCAL_IP set "LOCAL_IP=%%a"
)
set "LOCAL_IP=%LOCAL_IP: =%"
echo.

:: ===== STEP 5: Create START.bat =====
echo [4/4] Membuat shortcut...
(
echo @echo off
echo title Sistem Pembayaran SDN 1 Selopuro
echo cd /d "%%~dp0"
echo.
echo if exist "node-portable\node.exe" ^(
echo     set "NODE=node-portable\node.exe"
echo ^) else if exist "C:\Program Files\nodejs\node.exe" ^(
echo     set "NODE=C:\Program Files\nodejs\node.exe"
echo ^) else ^(
echo     set "NODE=node"
echo ^)
echo.
echo echo.
echo echo   ============================================
echo echo     Sistem Pembayaran SD Negeri 1 Selopuro
echo echo   ============================================
echo echo     Server: http://localhost:3000
if defined LOCAL_IP echo echo     HP/PC  : http://%LOCAL_IP%:3000
echo echo     Login  : admin / admin123
echo echo   ============================================
echo echo.
echo start "" /b cmd /c "timeout /t 2 ^>nul ^&^& start http://localhost:3000"
echo "%%NODE%%" server.js
echo pause
) > START.bat

:: Create desktop shortcut
powershell -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Pembayaran SDN1 Selopuro.lnk'); " ^
    "$s.TargetPath = '%cd%\START.bat'; " ^
    "$s.WorkingDirectory = '%cd%'; " ^
    "$s.Description = 'Sistem Pembayaran SDN 1 Selopuro'; " ^
    "$s.Save()"

echo   [OK] Shortcut dibuat di Desktop.
echo.

:: ===== DONE =====
echo ==================================================
echo.
echo   INSTALLASI BERHASIL!
echo.
echo   CARA PAKAI:
echo   1. Klik 2x START.bat (atau shortcut di Desktop)
echo   2. Browser otomatis buka aplikasi
echo   3. Login: admin / admin123
echo.
if defined LOCAL_IP (
echo   Untuk akses dari PC/HP lain:
echo   Buka browser, ketik: http://%LOCAL_IP%:3000
echo   (Pastikan 1 WiFi yang sama)
echo.
)
echo   CATATAN:
echo   - PC ini adalah SERVER (harus tetap menyala)
echo   - PC/HP lain cukup buka browser, TIDAK perlu install apapun
echo   - Semua data tersimpan di PC ini, real-time sync
echo.
echo ==================================================
echo.

:: Ask to start now
set /p "START_NOW=Mulai sekarang? (Y/n): "
if /i "%START_NOW%"=="n" goto :end
if /i "%START_NOW%"=="N" goto :end

:: Start
if exist "node-portable\node.exe" (
    set "NODE=node-portable\node.exe"
) else if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE=C:\Program Files\nodejs\node.exe"
) else (
    set "NODE=node"
)
start "" /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"
"%NODE%" server.js
pause

:end
