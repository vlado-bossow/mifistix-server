@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set CF_TOKEN=d065de72-a59d-4d36-bbc9-4b57e27155f4
set CF_ZONE_ID=d065de72-a59d-4d36-bbc9-4b57e27155f4

echo ========================================
echo   Настройка DNS записей через Cloudflare API
echo ========================================
echo.

REM Проверка curl
where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ curl не найден! Установите curl или используйте setup-dns-localhost.bat
    pause
    exit /b 1
)

echo [INFO] Используется Zone ID: %CF_ZONE_ID%
echo [INFO] Используется Token: %CF_TOKEN:~0,10%...
echo.

REM Функция добавления DNS записи
set SUBDOMAINS=mifistix.pl api.mifistix.pl id.mifistix.pl promo.mifistix.pl blog.mifistix.pl support.mifistix.pl test.mifistix.pl staging.mifistix.pl dev.mifistix.pl cron.mifistix.pl backup.mifistix.pl analytics.mifistix.pl mail.mifistix.pl

set COUNTER=0
for %%d in (%SUBDOMAINS%) do (
    set /a COUNTER+=1
    set DOMAIN=%%d
    
    REM Определяем имя записи
    if "%%d"=="mifistix.pl" (
        set RECORD_NAME=@
    ) else (
        for /f "tokens=1 delims=." %%a in ("%%d") do set RECORD_NAME=%%a
    )
    
    echo [%COUNTER%/13] Настройка DNS для %%d...
    
    REM Получаем Tunnel ID (если туннель существует)
    for /f "tokens=1" %%t in ('cloudflared tunnel list 2^>nul ^| findstr mifistix-local') do set TUNNEL_ID=%%t
    
    if defined TUNNEL_ID (
        REM Используем CNAME на туннель
        for /f "tokens=*" %%i in ('curl -s -X GET "https://api.cloudflare.com/client/v4/zones/%CF_ZONE_ID%/dns_records?name=%%d" -H "Authorization: Bearer %CF_TOKEN%" -H "Content-Type: application/json"') do set EXISTING=%%i
        
        echo | findstr /C:"%%d" >nul
        if !errorlevel! equ 0 (
            echo   ⚠️  Запись уже существует, пропускаем...
        ) else (
            REM Создаём CNAME запись на туннель
            curl -s -X POST "https://api.cloudflare.com/client/v4/zones/%CF_ZONE_ID%/dns_records" ^
                -H "Authorization: Bearer %CF_TOKEN%" ^
                -H "Content-Type: application/json" ^
                --data "{\"type\":\"CNAME\",\"name\":\"!RECORD_NAME!\",\"content\":\"%TUNNEL_ID%.cfargotunnel.com\",\"ttl\":1,\"proxied\":true}" >nul
            
            if !errorlevel! equ 0 (
                echo   ✅ DNS запись создана
            ) else (
                echo   ❌ Ошибка создания записи
            )
        )
    ) else (
        echo   ⚠️  Туннель не найден! Сначала запустите setup-dns-localhost.bat
    )
)

echo.
echo ========================================
echo   Готово!
echo ========================================
echo.
echo Если туннель не был найден, сначала запустите:
echo   setup-dns-localhost.bat
echo.
pause

