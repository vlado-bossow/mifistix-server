@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM Check Node.js
where node >nul 2>&1
if not errorlevel 0 (
    echo [ERROR] Node.js not found! Please install Node.js.
    pause
    exit /b 1
)

:menu
cls
echo ========================================
echo   Mifistix Server Manager
echo ========================================
echo.
echo   1. Start all servers
echo   2. Stop all servers
echo   3. Restart all servers
echo   4. Exit
echo.
set /p choice="Select action (1-4): "

if "%choice%"=="1" goto start_servers
if "%choice%"=="2" goto stop_servers
if "%choice%"=="3" goto restart_servers
if "%choice%"=="4" goto end
goto menu

:start_servers
cls
echo ========================================
echo   Starting all Mifistix servers
echo ========================================
echo.
echo [INFO] Stopping any existing processes on server ports...
echo.

REM Always try to kill processes on ports before starting (safe approach)
call :kill_port 8484
call :kill_port 5000
call :kill_port 3001
call :kill_port 3002
call :kill_port 3003
call :kill_port 3004
call :kill_port 3005
call :kill_port 3006
call :kill_port 3007
call :kill_port 3008
call :kill_port 3009
call :kill_port 3010
call :kill_port 3011
call :kill_port 3012
call :kill_port 3013

timeout /t 2 /nobreak >nul

echo.
echo [INFO] Node.js found
echo [INFO] Starting servers...
echo.

set COUNTER=1

REM Start DatabaseServer
echo [%COUNTER%/16] Starting DatabaseServer...
start "DatabaseServer" cmd /k "cd DatabaseServer && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

REM Start main Server
echo [%COUNTER%/15] Starting main Server...
start "MainServer" cmd /k "cd Server && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

REM Start subdomains
echo [%COUNTER%/15] Starting API subdomain (api.mifistix.pl)...
start "API" cmd /k "cd Subdomains\api && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting ID subdomain (id.mifistix.pl)...
start "ID" cmd /k "cd Subdomains\id && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Promo subdomain (promo.mifistix.pl)...
start "Promo" cmd /k "cd Subdomains\promo && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Blog subdomain (blog.mifistix.pl)...
start "Blog" cmd /k "cd Subdomains\blog && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Support subdomain (support.mifistix.pl)...
start "Support" cmd /k "cd Subdomains\support && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Test subdomain (test.mifistix.pl)...
start "Test" cmd /k "cd Subdomains\test && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Staging subdomain (staging.mifistix.pl)...
start "Staging" cmd /k "cd Subdomains\staging && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Dev subdomain (dev.mifistix.pl)...
start "Dev" cmd /k "cd Subdomains\dev && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Cron subdomain (cron.mifistix.pl)...
start "Cron" cmd /k "cd Subdomains\cron && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Backup subdomain (backup.mifistix.pl)...
start "Backup" cmd /k "cd Subdomains\backup && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/15] Starting Analytics subdomain (analytics.mifistix.pl)...
start "Analytics" cmd /k "cd Subdomains\analytics && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/16] Starting Mail subdomain (mail.mifistix.pl)...
start "Mail" cmd /k "cd Subdomains\mail && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

echo [%COUNTER%/16] Starting Admin subdomain (admin.mifistix.pl)...
start "Admin" cmd /k "cd Subdomains\admin && npm start"
set /a COUNTER+=1
timeout /t 1 /nobreak >nul

@REM echo [%COUNTER%/17] Starting Admin subdomain (admin.mifistix.pl)...
@REM start "Admin" cmd /k "cd Subdomains\server && npm start"
@REM set /a COUNTER+=1
@REM timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo   All servers started!
echo ========================================
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
echo   - Admin: http://localhost:3013
echo.
pause
goto menu

:stop_servers
cls
echo ========================================
echo   Stopping all Mifistix servers
echo ========================================
echo.
echo [INFO] Stopping Node.js processes on server ports...
echo.

REM Kill processes by port
call :kill_port 8484
call :kill_port 5000
call :kill_port 3001
call :kill_port 3002
call :kill_port 3003
call :kill_port 3004
call :kill_port 3005
call :kill_port 3006
call :kill_port 3007
call :kill_port 3008
call :kill_port 3009
call :kill_port 3010
call :kill_port 3011
call :kill_port 3012
call :kill_port 3013

REM Also close windows by title (backup method)
taskkill /FI "WINDOWTITLE eq DatabaseServer*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq MainServer*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq API*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq ID*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Promo*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Blog*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Support*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Test*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Staging*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Dev*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Cron*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Backup*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Analytics*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Mail*" /F /T >nul 2>&1

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   All servers stopped!
echo ========================================
echo.
pause
goto menu

:restart_servers
cls
echo ========================================
echo   Restarting all Mifistix servers
echo ========================================
echo.
echo [INFO] Stopping servers...
echo.

REM Kill processes by port
call :kill_port 8484
call :kill_port 5000
call :kill_port 3001
call :kill_port 3002
call :kill_port 3003
call :kill_port 3004
call :kill_port 3005
call :kill_port 3006
call :kill_port 3007
call :kill_port 3008
call :kill_port 3009
call :kill_port 3010
call :kill_port 3011
call :kill_port 3012
call :kill_port 3013

REM Close windows by title (more aggressive)
taskkill /FI "WINDOWTITLE eq DatabaseServer*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq MainServer*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq API*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq ID*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Promo*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Blog*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Support*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Test*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Staging*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Dev*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Cron*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Backup*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Analytics*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Mail*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Admin*" /F /T >nul 2>&1

REM Also kill all node processes that might be running the servers (more thorough)
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /I "PID:"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [INFO] Waiting 3 seconds for processes to terminate...
timeout /t 3 /nobreak >nul

REM Verify ports are free
echo [INFO] Verifying ports are free...
call :kill_port 8484
call :kill_port 5000
call :kill_port 3001
call :kill_port 3002
call :kill_port 3003
call :kill_port 3004
call :kill_port 3005
call :kill_port 3006
call :kill_port 3007
call :kill_port 3008
call :kill_port 3009
call :kill_port 3010
call :kill_port 3011
call :kill_port 3012
call :kill_port 3013

timeout /t 1 /nobreak >nul

echo.
echo [INFO] Servers stopped. Starting servers...
echo.
goto start_servers

:stop_servers_helper
REM Kill processes by port
call :kill_port 8484
call :kill_port 5000
call :kill_port 3001
call :kill_port 3002
call :kill_port 3003
call :kill_port 3004
call :kill_port 3005
call :kill_port 3006
call :kill_port 3007
call :kill_port 3008
call :kill_port 3009
call :kill_port 3010
call :kill_port 3011
call :kill_port 3012
call :kill_port 3013

REM Close windows by title
taskkill /FI "WINDOWTITLE eq DatabaseServer*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq MainServer*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq API*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq ID*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Promo*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Blog*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Support*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Test*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Staging*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Dev*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Cron*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Backup*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Analytics*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Mail*" /F /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Admin*" /F /T >nul 2>&1
exit /b

:kill_port
REM Function to kill process on specific port
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%1 " ^| findstr "LISTENING"') do (
    if not "%%a"=="" (
        taskkill /F /PID %%a /T >nul 2>&1
    )
)
exit /b

:end
echo.
echo Goodbye!
timeout /t 1 /nobreak >nul
exit /b 0
