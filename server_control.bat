@echo off
chcp 65001 >nul
title CiteRight Server Control Panel

:menu
cls
echo ================================================
echo       CiteRight Server Control Panel
echo       Taiwan Legal Case Recognition Tool
echo ================================================
echo.
echo [1] Start Server (Port 3002)
echo [2] Stop Server
echo [3] Check Server Status
echo [4] Manual Data Sync
echo [5] View Server Logs
echo [6] Exit
echo.
set /p choice="Please select an option (1-6): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto status
if "%choice%"=="4" goto sync
if "%choice%"=="5" goto logs
if "%choice%"=="6" goto exit

echo Invalid option, please try again
pause
goto menu

:start
echo Starting CiteRight server...
cd /d "%~dp0"
echo Server will run on http://localhost:3002
echo Press Ctrl+C to stop the server
echo.
node official_server.js
goto menu

:stop
echo Stopping CiteRight server...
taskkill /f /im node.exe 2>nul
if %errorlevel%==0 (
    echo ✅ Server stopped successfully
) else (
    echo ℹ️ No running Node.js processes found
)
pause
goto menu

:status
echo Checking server status...
curl -s http://localhost:3002/health >nul 2>&1
if %errorlevel%==0 (
    echo ✅ Server is running on http://localhost:3002
) else (
    echo ❌ Server is not responding
)
echo.
curl -s http://localhost:3002/api/stats 2>nul
pause
goto menu

:sync
echo Triggering manual data sync...
curl -X POST http://localhost:3002/api/sync-now
echo.
echo Sync request sent to server
pause
goto menu

:logs
echo Opening server logs...
echo Recent server activity:
echo.
netstat -ano | findstr :3002
echo.
echo For detailed logs, check the terminal where the server is running
pause
goto menu

:exit
echo Goodbye!
exit
