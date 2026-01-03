@echo off
chcp 65001 >nul
echo ========================================
echo   Установка серверов как служб Windows
echo ========================================
echo.

REM Проверка прав администратора
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ОШИБКА: Запустите от имени администратора!
    echo.
    echo Правый клик на файле → Запуск от имени администратора
    pause
    exit /b 1
)

echo ✅ Права администратора подтверждены
echo.

REM Проверка наличия node-windows или pm2
where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ PM2 найден
    goto :use_pm2
)

echo [INFO] PM2 не найден. Установка PM2...
call npm install -g pm2
if %errorlevel% neq 0 (
    echo ❌ Ошибка установки PM2
    pause
    exit /b 1
)

:use_pm2
echo.
echo Установка PM2 Windows Service...
call pm2 install pm2-windows-service
call pm2-startup install

echo.
echo ========================================
echo   Службы установлены!
echo ========================================
echo.
echo Теперь запустите: start-all-pm2.bat
echo.
pause

