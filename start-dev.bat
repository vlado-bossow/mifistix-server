@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
echo ========================================
echo   Starting all servers in DEV mode
echo   (with auto-restart on file changes)
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if not errorlevel 0 (
    echo [ERROR] Node.js not found! Please install Node.js.
    pause
    exit /b 1
)

echo [INFO] Node.js found
echo [INFO] Mode: DEVELOPMENT (nodemon)
echo.

REM Go to project root
cd /d "%~dp0"

set COUNTER=1

REM Start DatabaseServer
echo [%COUNTER%/15] Starting DatabaseServer (dev mode)...
start "DatabaseServer-Dev" cmd /k "cd DatabaseServer && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

REM Start main Server
echo [%COUNTER%/15] Starting main Server (dev mode)...
start "MainServer-Dev" cmd /k "cd Server && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

REM Start subdomains
echo [%COUNTER%/15] Starting API subdomain (dev mode)...
start "API-Dev" cmd /k "cd Subdomains\api && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting ID subdomain (dev mode)...
start "ID-Dev" cmd /k "cd Subdomains\id && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Promo subdomain (dev mode)...
start "Promo-Dev" cmd /k "cd Subdomains\promo && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Blog subdomain (dev mode)...
start "Blog-Dev" cmd /k "cd Subdomains\blog && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Support subdomain (dev mode)...
start "Support-Dev" cmd /k "cd Subdomains\support && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Test subdomain (dev mode)...
start "Test-Dev" cmd /k "cd Subdomains\test && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Staging subdomain (dev mode)...
start "Staging-Dev" cmd /k "cd Subdomains\staging && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Dev subdomain (dev mode)...
start "Dev-Dev" cmd /k "cd Subdomains\dev && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Cron subdomain (dev mode)...
start "Cron-Dev" cmd /k "cd Subdomains\cron && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Backup subdomain (dev mode)...
start "Backup-Dev" cmd /k "cd Subdomains\backup && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Analytics subdomain (dev mode)...
start "Analytics-Dev" cmd /k "cd Subdomains\analytics && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Mail subdomain (dev mode)...
start "Mail-Dev" cmd /k "cd Subdomains\mail && npm run dev"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo   All servers started in DEV mode!
echo ========================================
echo.
echo Auto-restart enabled
echo Each server will restart only when its files change
echo.
echo Servers running in separate windows:
echo   - DatabaseServer: http://localhost:8484
echo   - MainServer: http://localhost:5000
echo   - API: http://localhost:3001
echo   - ID: http://localhost:3002
echo   - Promo: http://localhost:3003
echo   - Blog: http://localhost:3004
echo   - Support: http://localhost:3005
echo   - Test: http://localhost:3006
echo   - Staging: http://localhost:3007
echo   - Dev: http://localhost:3008
echo   - Cron: http://localhost:3009
echo   - Backup: http://localhost:3010
echo   - Analytics: http://localhost:3011
echo   - Mail: http://localhost:3012
echo.
echo Change a file in any server - it will restart automatically!
echo Other servers will continue running without changes.
echo.
echo To stop servers, close all windows or press Ctrl+C
echo.
pause
