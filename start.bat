@echo off
TITLE Tournament Simulator - Launcher
COLOR 0B

echo ===================================================
echo     TOURNAMENT SIMULATOR - STARTING SERVICES
echo ===================================================
echo.

:: 1. Start Backend (Flask)
echo [1/2] Starting Backend API...
start "TS-Backend" cmd /k "cd backend && venv\Scripts\activate && python app.py"

:: 2. Start Frontend (Vite)
echo [2/2] Starting Frontend Dev Server...
start "TS-Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ---------------------------------------------------
echo  All services are launching in separate windows.
echo  - Backend: http://localhost:5000
echo  - Frontend: http://localhost:5173 (usually)
echo ---------------------------------------------------
echo.
echo Press any key to exit this launcher...
pause > nul
