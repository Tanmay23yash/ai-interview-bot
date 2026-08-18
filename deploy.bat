@echo off

echo Starting AI Interview Bot deployment...

if not exist "dist\index.html" (
    echo ERROR: Production build not found.
    exit /b 1
)

echo Starting production server on port 3000...

start "AI Interview Bot Server" /B cmd /c "npx serve -s dist -l 3000"

timeout /t 5 /nobreak >nul

echo Deployment completed successfully.
echo Application available at http://localhost:3000

exit /b 0