@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Настройка DNS для localhost через Cloudflare Tunnel
echo ========================================
echo.

REM Проверка cloudflared
where cloudflared >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/4] Установка cloudflared...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%TEMP%\cloudflared.exe'"
    if exist "%TEMP%\cloudflared.exe" (
        if not exist "%ProgramFiles%\cloudflared" mkdir "%ProgramFiles%\cloudflared"
        copy "%TEMP%\cloudflared.exe" "%ProgramFiles%\cloudflared\cloudflared.exe" >nul
        set PATH=%PATH%;%ProgramFiles%\cloudflared
        echo ✅ cloudflared установлен
    ) else (
        echo ❌ Ошибка установки
        pause
        exit /b 1
    )
) else (
    echo ✅ cloudflared уже установлен
)

echo.
echo [2/4] Авторизация в Cloudflare (откроется браузер)...
cloudflared tunnel login
if %errorlevel% neq 0 (
    echo ❌ Ошибка авторизации
    pause
    exit /b 1
)

echo.
echo [3/4] Создание туннеля...
set TUNNEL_NAME=mifistix-local
cloudflared tunnel create %TUNNEL_NAME%
if %errorlevel% neq 0 (
    echo ⚠️  Туннель уже существует, используем существующий
)

REM Получаем Tunnel ID
for /f "tokens=1" %%a in ('cloudflared tunnel list ^| findstr %TUNNEL_NAME%') do set TUNNEL_ID=%%a

if "%TUNNEL_ID%"=="" (
    echo ❌ Не удалось найти Tunnel ID
    pause
    exit /b 1
)

echo ✅ Tunnel ID: %TUNNEL_ID%

echo.
echo [4/4] Настройка DNS записей через Tunnel...
echo.

set COUNTER=0
set SUBDOMAINS=mifistix.pl api.mifistix.pl id.mifistix.pl promo.mifistix.pl blog.mifistix.pl support.mifistix.pl test.mifistix.pl staging.mifistix.pl dev.mifistix.pl cron.mifistix.pl backup.mifistix.pl analytics.mifistix.pl mail.mifistix.pl

for %%d in (%SUBDOMAINS%) do (
    set /a COUNTER+=1
    echo [%COUNTER%/13] Настройка %%d...
    cloudflared tunnel route dns %TUNNEL_NAME% %%d
    if !errorlevel! equ 0 (
        echo   ✅ %%d настроен
    ) else (
        echo   ⚠️  %%d - проверьте результат выше
    )
    timeout /t 1 /nobreak >nul
)

echo.
echo Создание config.yml...
(
echo tunnel: %TUNNEL_ID%
echo credentials-file: C:\Users\%USERNAME%\.cloudflared\%TUNNEL_ID%.json
echo.
echo ingress:
echo   - hostname: api.mifistix.pl
echo     service: http://localhost:3001
echo   - hostname: id.mifistix.pl
echo     service: http://localhost:3002
echo   - hostname: promo.mifistix.pl
echo     service: http://localhost:3003
echo   - hostname: blog.mifistix.pl
echo     service: http://localhost:3004
echo   - hostname: support.mifistix.pl
echo     service: http://localhost:3005
echo   - hostname: test.mifistix.pl
echo     service: http://localhost:3006
echo   - hostname: staging.mifistix.pl
echo     service: http://localhost:3007
echo   - hostname: dev.mifistix.pl
echo     service: http://localhost:3008
echo   - hostname: cron.mifistix.pl
echo     service: http://localhost:3009
echo   - hostname: backup.mifistix.pl
echo     service: http://localhost:3010
echo   - hostname: analytics.mifistix.pl
echo     service: http://localhost:3011
echo   - hostname: mail.mifistix.pl
echo     service: http://localhost:3012
echo   - hostname: mifistix.pl
echo     service: http://localhost:5000
echo   - service: http_status:404
) > config.yml
echo ✅ config.yml создан

echo.
echo ========================================
echo   Готово! DNS записи настроены на localhost
echo ========================================
echo.
echo Теперь запустите:
echo   start-all-with-tunnel.bat - запуск всех серверов + туннель
echo.
echo Или отдельно:
echo   1. ..\start-all.bat - запуск всех серверов
echo   2. start-tunnel.bat - запуск туннеля
echo.
pause

