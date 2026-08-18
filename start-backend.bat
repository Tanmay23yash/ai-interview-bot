@echo off
setlocal

echo Starting AI Interview Bot Backend...

cd /d "%~dp0backend"

if not exist "main.py" (
    echo ERROR: backend\main.py not found.
    exit /b 1
)

echo Checking port 8000...

powershell -NoProfile -Command ^
    "$p = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $p.OwningProcess -Force }"

if exist "venv\Scripts\python.exe" (
    echo Using backend virtual environment...
    set "PYTHON=venv\Scripts\python.exe"
) else (
    echo Using system/Jenkins Python...
    set "PYTHON=python"
)

echo Starting FastAPI server on port 8000...

start "" /b "%PYTHON%" -m uvicorn main:app --host 0.0.0.0 --port 8000 <nul >backend.log 2>&1

timeout /t 5 /nobreak >nul

echo Checking backend health...

curl -f http://localhost:8000/

if errorlevel 1 (
    echo ERROR: Backend failed to start.
    echo.
    echo ===== Backend Error Log =====
    if exist backend.log type backend.log
    exit /b 1
)

echo.
echo Backend deployment completed successfully.
echo API available at http://localhost:8000

exit /b 0