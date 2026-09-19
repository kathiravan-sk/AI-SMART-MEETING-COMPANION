@echo off
setlocal
cd /d "%~dp0"
if not exist backend\.venv\Scripts\python.exe (
  echo Please run setup.bat first.
  pause
  exit /b 1
)
start "MeetMind API" /D "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "MeetMind Dashboard" /D "%~dp0" cmd /k "npm run dev"
echo Open http://127.0.0.1:5173 when Vite shows Ready.
echo Keep the two terminal windows open. Close them to stop the app.
pause
