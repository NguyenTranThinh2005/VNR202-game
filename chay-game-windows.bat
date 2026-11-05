@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Ban Bong Lich Su - server
where node >nul 2>nul
if %errorlevel%==0 (
  start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:3000/admin"
  node server.js
  goto end
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:3000/admin"
  python server.py
  goto end
)
echo Chua co Node.js hoac Python. Cai Node.js tai https://nodejs.org roi chay lai file nay.
:end
pause
