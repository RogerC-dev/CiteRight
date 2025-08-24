Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Taiwan Judicial Yuan API Credentials Setup - CiteRight Project" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Please enter your Judicial Yuan API credentials:" -ForegroundColor Yellow
Write-Host ""

$JUDICIAL_USER = Read-Host "Enter username"
$JUDICIAL_PASS = Read-Host "Enter password" -AsSecureString

# Convert SecureString to plain text for environment variable
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($JUDICIAL_PASS)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""
Write-Host "Setting environment variables..." -ForegroundColor Yellow

# Set environment variables for current session
$env:JUDICIAL_USER = $JUDICIAL_USER
$env:JUDICIAL_PASS = $PlainPassword

# Set permanent environment variables
[Environment]::SetEnvironmentVariable("JUDICIAL_USER", $JUDICIAL_USER, "User")
[Environment]::SetEnvironmentVariable("JUDICIAL_PASS", $PlainPassword, "User")

Write-Host ""
Write-Host "Credentials setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Now you can run the server with:" -ForegroundColor Cyan
Write-Host "node official_server.js" -ForegroundColor White
Write-Host ""
Write-Host "Or use the 'Manual Sync' feature on the test page to download real case data" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
