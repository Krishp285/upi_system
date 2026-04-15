@echo off
REM ============================================
REM TruePayID - Quick Start Both Servers
REM ============================================
REM This is the simplest way to start everything

echo.
echo ============================================
echo  TruePayID - Start Servers
echo ============================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Show what's about to happen
echo Backend will start on:  http://localhost:8000
echo Frontend will start on: http://localhost:5173
echo.
echo 1. Backend server opens in Terminal 1
echo 2. Frontend server opens in Terminal 2
echo 3. Browser should open automatically
echo.
pause

REM Start Backend in new window
echo Starting Backend...
start "Backend" cmd /k "cd TruePayID\backend && venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"

REM Wait a moment for backend to start
timeout /t 3 /nobreak

REM Start Frontend in new window
echo Starting Frontend...
start "Frontend" cmd /k "cd TruePayID\frontend && npm run dev"

REM Open browser
timeout /t 2 /nobreak
start http://localhost:5173

echo.
echo ============================================
echo  Servers Started!
echo ============================================
echo Test Account:
echo  Email: test@truepay.com
echo  Password: Test@123456
echo.
echo To stop:
echo  - Close the Terminal windows
echo  - Or press CTRL+C in each
echo.
pause
