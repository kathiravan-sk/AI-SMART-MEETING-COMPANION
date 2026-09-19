@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, then run this file again.
  pause
  exit /b 1
)
where py >nul 2>nul
if errorlevel 1 (
  python -m venv backend\.venv
) else (
  py -3 -m venv backend\.venv
)
if errorlevel 1 goto failed
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 goto failed
if not exist backend\.env copy backend\.env.example backend\.env >nul
if not exist frontend\.env copy frontend\.env.example frontend\.env >nul
call npm install
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo.
echo MeetMind is ready. Run start.bat, then open http://127.0.0.1:5173
echo Load extension\dist in Chrome Developer mode to install the companion.
pause
exit /b 0
:failed
echo.
echo Setup stopped. Read the error above. Check Python 3.11/3.12 and Node.js 22+.
pause
exit /b 1
