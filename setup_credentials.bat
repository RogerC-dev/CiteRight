@echo off
echo ================================================
echo 台灣司法院API憑證設定 - CiteRight專案
echo ================================================
echo.

echo 請輸入您的司法院API憑證:
echo.

set /p JUDICIAL_USER="請輸入用戶名稱 (Username): "
set /p JUDICIAL_PASS="請輸入密碼 (Password): "

echo.
echo 正在設定環境變數...

setx JUDICIAL_USER "%JUDICIAL_USER%"
setx JUDICIAL_PASS "%JUDICIAL_PASS%"

echo.
echo ✅ 憑證設定完成!
echo.
echo 現在您可以執行以下命令啟動伺服器:
echo node official_server.js
echo.
echo 或使用測試頁面的"手動同步"功能來下載真實案例資料
echo.
pause
