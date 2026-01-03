@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Запуск Cloudflare Tunnel...
echo Подключение localhost к Cloudflare...
echo.
cloudflared tunnel --config config.yml run
