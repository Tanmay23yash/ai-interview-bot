@echo off
setlocal

echo Starting AI Interview Bot Frontend deployment...

if not exist "dist\index.html" (
    echo ERROR: Production build not found.
    exit /b 1
)

echo Checking port 3000...

powershell -NoProfile -Command ^
    "$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $p.OwningProcess -Force }"

echo Starting production server on port 3000...

start "" /b node node_modules\serve\build\main.js -s dist -l 3000 <nul >frontend.log 2>&1

timeout /t 5 /nobreak >nul

echo Checking frontend health...

curl -f http://localhost:3000/

if errorlevel 1 (
    echo ERROR: Frontend failed to start.
    echo.
    echo ===== Frontend Error Log =====
    if exist frontend.log type frontend.log
    exit /b 1
)

echo.
echo Frontend deployment completed successfully.
echo Application available at http://localhost:3000

exit /b 0