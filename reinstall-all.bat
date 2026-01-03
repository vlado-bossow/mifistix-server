@echo off
chcp 65001 >nul
echo ========================================
echo   ПОЛНАЯ ПЕРЕУСТАНОВКА ВСЕХ ЗАВИСИМОСТЕЙ
echo ========================================
echo.
echo ⚠️  ВНИМАНИЕ: Это удалит все node_modules и переустановит зависимости!
echo.
set /p CONFIRM="Продолжить? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo Отменено.
    pause
    exit /b 0
)

cd /d "%~dp0"

echo.
echo [1/2] Удаление всех node_modules...
echo.

REM Удаление node_modules из всех папок
if exist "DatabaseServer\node_modules" (
    echo Удаление DatabaseServer\node_modules...
    rmdir /s /q "DatabaseServer\node_modules"
)

if exist "Server\node_modules" (
    echo Удаление Server\node_modules...
    rmdir /s /q "Server\node_modules"
)

if exist "shared\node_modules" (
    echo Удаление shared\node_modules...
    rmdir /s /q "shared\node_modules"
)

if exist "Subdomains\api\node_modules" (
    echo Удаление Subdomains\api\node_modules...
    rmdir /s /q "Subdomains\api\node_modules"
)

if exist "Subdomains\id\node_modules" (
    echo Удаление Subdomains\id\node_modules...
    rmdir /s /q "Subdomains\id\node_modules"
)

if exist "Subdomains\promo\node_modules" (
    echo Удаление Subdomains\promo\node_modules...
    rmdir /s /q "Subdomains\promo\node_modules"
)

if exist "Subdomains\blog\node_modules" (
    echo Удаление Subdomains\blog\node_modules...
    rmdir /s /q "Subdomains\blog\node_modules"
)

if exist "Subdomains\support\node_modules" (
    echo Удаление Subdomains\support\node_modules...
    rmdir /s /q "Subdomains\support\node_modules"
)

if exist "Subdomains\test\node_modules" (
    echo Удаление Subdomains\test\node_modules...
    rmdir /s /q "Subdomains\test\node_modules"
)

if exist "Subdomains\staging\node_modules" (
    echo Удаление Subdomains\staging\node_modules...
    rmdir /s /q "Subdomains\staging\node_modules"
)

if exist "Subdomains\dev\node_modules" (
    echo Удаление Subdomains\dev\node_modules...
    rmdir /s /q "Subdomains\dev\node_modules"
)

if exist "Subdomains\cron\node_modules" (
    echo Удаление Subdomains\cron\node_modules...
    rmdir /s /q "Subdomains\cron\node_modules"
)

if exist "Subdomains\backup\node_modules" (
    echo Удаление Subdomains\backup\node_modules...
    rmdir /s /q "Subdomains\backup\node_modules"
)

if exist "Subdomains\analytics\node_modules" (
    echo Удаление Subdomains\analytics\node_modules...
    rmdir /s /q "Subdomains\analytics\node_modules"
)

if exist "Subdomains\mail\node_modules" (
    echo Удаление Subdomains\mail\node_modules...
    rmdir /s /q "Subdomains\mail\node_modules"
)

echo.
echo [2/2] Установка всех зависимостей...
echo.

call install-all.bat

echo.
echo ========================================
echo   Переустановка завершена!
echo ========================================
pause

