@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
echo ========================================
echo   Installing all dependencies
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if not errorlevel 0 (
    echo [ERROR] Node.js not found! Please install Node.js.
    pause
    exit /b 1
)

REM Check npm
where npm >nul 2>&1
if not errorlevel 0 (
    echo [ERROR] npm not found! Please install npm.
    pause
    exit /b 1
)

echo [INFO] Node.js and npm found
echo.

REM Go to project root
cd /d "%~dp0"

REM Install DatabaseServer dependencies
echo [1/4] Installing DatabaseServer dependencies...
cd DatabaseServer
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install DatabaseServer dependencies
    pause
    exit /b 1
)
cd ..

REM Install main Server dependencies
echo [2/4] Installing main Server dependencies...
cd Server
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Server dependencies
    pause
    exit /b 1
)
cd ..

REM Install shared modules dependencies
echo [3/5] Installing shared modules dependencies...
cd shared
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install shared modules dependencies
    pause
    exit /b 1
)
cd ..

REM Install subdomains dependencies
set COUNTER=4
set TOTAL=14

echo [%COUNTER%/%TOTAL%] Installing API subdomain dependencies...
cd Subdomains\api
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install API subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing ID subdomain dependencies...
cd Subdomains\id
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install ID subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Promo subdomain dependencies...
cd Subdomains\promo
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Promo subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Blog subdomain dependencies...
cd Subdomains\blog
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Blog subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Support subdomain dependencies...
cd Subdomains\support
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Support subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Test subdomain dependencies...
cd Subdomains\test
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Test subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Staging subdomain dependencies...
cd Subdomains\staging
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Staging subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Dev subdomain dependencies...
cd Subdomains\dev
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Dev subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Cron subdomain dependencies...
cd Subdomains\cron
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Cron subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Backup subdomain dependencies...
cd Subdomains\backup
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Backup subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Analytics subdomain dependencies...
cd Subdomains\analytics
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Analytics subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

set /a COUNTER+=1
echo [%COUNTER%/%TOTAL%] Installing Mail subdomain dependencies...
cd Subdomains\mail
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Mail subdomain dependencies
    pause
    exit /b 1
)
cd ..\..

echo.
echo ========================================
echo   All dependencies installed!
echo ========================================
echo.
echo dotenv and nodemon installed automatically
echo.
echo Now you can:
echo   - Start all servers: start-all.bat
echo   - Start in dev mode: start-dev.bat (auto-restart)
echo   - Reinstall everything: reinstall-all.bat
echo.
pause
