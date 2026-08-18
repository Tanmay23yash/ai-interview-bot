@echo off

echo Starting AI Interview Bot Backend...

cd /d "%~dp0backend"

if not exist "main.py" (
    echo ERROR: backend\main.py not found.
    exit /b 1
)

echo Starting FastAPI server on port 8000...

start "AI Interview Bot Backend" /B cmd /c "venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000"

timeout /t 5 /nobreak >nul

echo Backend deployment completed.
echo API available at http://localhost:8000

exit /b 0