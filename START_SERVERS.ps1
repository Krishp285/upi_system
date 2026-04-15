# START_SERVERS.ps1 - One-click startup for TruePayID dev servers

Write-Host "🚀 Starting TruePayID Application" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $rootDir "TruePayID" "backend"
$frontendDir = Join-Path $rootDir "TruePayID" "frontend"

# Start Backend
Write-Host "Starting Backend API (port 8000)..." -ForegroundColor Blue
Write-Host "Installing dependencies..."
Set-Location $backendDir

# Install dependencies silently
& .\venv\Scripts\python -m pip install -q --no-warn-script-location -r requirements.txt 2>$null

Write-Host "✅ Backend server starting..." -ForegroundColor Green
Write-Host "   URL: http://localhost:8000" -ForegroundColor Green
Write-Host "   Docs: http://localhost:8000/docs" -ForegroundColor Green

# Launch backend in new window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backendDir'; & .\venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"
)

Start-Sleep -Seconds 2

# Start Frontend
Write-Host ""
Write-Host "Starting Frontend Dev Server (port 5173)..." -ForegroundColor Blue
Write-Host "Installing dependencies..."
Set-Location $frontendDir

& npm install -q 2>$null

Write-Host "✅ Frontend server starting..." -ForegroundColor Green
Write-Host "   URL: http://localhost:5173" -ForegroundColor Green

# Launch frontend in new window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$frontendDir'; npm run dev"
)

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "✅ Servers launching in new windows" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Open Browser: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Account:" -ForegroundColor Yellow
Write-Host "  Email: test@truepay.com" -ForegroundColor Gray
Write-Host "  Password: Test@123456" -ForegroundColor Gray
Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
