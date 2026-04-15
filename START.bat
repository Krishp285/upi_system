#!/usr/bin/env bash
# Start both backend and frontend servers
# This script handles directory navigation and runs servers properly

echo "🚀 Starting TruePayID Application"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd "$(dirname "$0")/TruePayID"

echo -e "${BLUE}Starting Backend API (port 8000)...${NC}"
cd backend
echo "Installing/updating dependencies..."
venv\Scripts\python -m pip install -q --no-warn-script-location -r requirements.txt 2>/dev/null

echo -e "${GREEN}✅ Backend server starting...${NC}"
echo "   URL: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
start "TruePayID Backend" cmd /k "venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"

cd ..

echo ""
echo -e "${BLUE}Starting Frontend Dev Server (port 5173)...${NC}"
cd frontend
echo "Installing/updating dependencies..."
call npm install -q 2>nul

echo -e "${GREEN}✅ Frontend server starting...${NC}"
echo "   URL: http://localhost:5173"
start "TruePayID Frontend" cmd /k "npm run dev"

echo ""
echo "=================================="
echo -e "${GREEN}✅ Servers launching in new windows${NC}"
echo ""
echo "📱 Open: http://localhost:5173"
echo ""
echo "Test credentials:"
echo "  Email: test@truepay.com"
echo "  Password: Test@123456"
echo ""
echo "Press CTRL+C in each window to stop servers"
