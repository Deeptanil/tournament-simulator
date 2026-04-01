# Tournament Simulator - PowerShell Launcher
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "    TOURNAMENT SIMULATOR - STARTING SERVICES" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start Backend (Flask)
Write-Host "[1/2] Starting Backend API..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/k cd backend && venv\Scripts\activate && python app.py"

# 2. Start Frontend (Vite)
Write-Host "[2/2] Starting Frontend Dev Server..." -ForegroundColor Yellow
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/k cd frontend && npm run dev"

Write-Host ""
Write-Host "---------------------------------------------------" -ForegroundColor Cyan
Write-Host " All services are launching in separate windows." -ForegroundColor Cyan
Write-Host " - Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host " - Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "---------------------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close this launcher..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
