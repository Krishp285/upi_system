@echo off
cd /d "%~dp0"
@echo on
venv\Scripts\python -m uvicorn app.main:app --port 8000
