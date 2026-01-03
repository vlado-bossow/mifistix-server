@echo off
chcp 65001 >nul
echo ========================================
echo   Запуск всех серверов + Cloudflare Tunnel
echo ========================================
echo.

cd /d "%~dp0\.."

REM Запуск всех серверов
call start-all.bat

timeout /t 3 /nobreak >nul

REM Запуск туннеля
echo.
echo Запуск Cloudflare Tunnel...
start "CloudflareTunnel" cmd /k "cd cloudflare && start-tunnel.bat"

echo.
echo ✅ Все серверы и туннель запущены!
echo.
pause

