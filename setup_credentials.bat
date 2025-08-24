@echo off
chcp 65001 >nul
echo ================================================
echo Taiwan Judicial Yuan API Credentials Setup
echo CiteRight Project - Official API Version
echo ================================================
echo.

set /p JUDICIAL_USER="Enter username: "
set /p JUDICIAL_PASS="Enter password: "

echo.
echo Setting environment variables...

setx JUDICIAL_USER "%JUDICIAL_USER%" >nul
setx JUDICIAL_PASS "%JUDICIAL_PASS%" >nul

echo.
echo Credentials setup complete!
echo.
echo Now you can run the server with:
echo node official_server.js
echo.
echo Or use the Manual Sync feature on the test page
echo to download real case data from the official API
echo.
pause
