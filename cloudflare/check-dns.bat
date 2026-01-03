@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set CF_TOKEN=d065de72-a59d-4d36-bbc9-4b57e27155f4
set CF_ZONE_ID=d065de72-a59d-4d36-bbc9-4b57e27155f4

echo ========================================
echo   Проверка DNS записей в Cloudflare
echo ========================================
echo.

REM Проверка curl
where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ curl не найден!
    pause
    exit /b 1
)

set SUBDOMAINS=mifistix.pl api.mifistix.pl id.mifistix.pl promo.mifistix.pl blog.mifistix.pl support.mifistix.pl test.mifistix.pl staging.mifistix.pl dev.mifistix.pl cron.mifistix.pl backup.mifistix.pl analytics.mifistix.pl mail.mifistix.pl

echo Проверка DNS записей...
echo.

for %%d in (%SUBDOMAINS%) do (
    echo Проверка: %%d
    curl -s -X GET "https://api.cloudflare.com/client/v4/zones/%CF_ZONE_ID%/dns_records?name=%%d" -H "Authorization: Bearer %CF_TOKEN%" -H "Content-Type: application/json" | findstr /C:"%%d" >nul
    if !errorlevel! equ 0 (
        echo   ✅ Запись существует
    ) else (
        echo   ❌ Запись НЕ найдена
    )
    echo.
)

echo ========================================
echo   Проверка завершена
echo ========================================
pause

