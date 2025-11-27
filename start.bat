@echo off
echo Starting Poultry Management System...
echo.
cd /d "%~dp0"
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies
    pause
    exit /b %errorlevel%
)
echo.
echo Dependencies installed successfully!
echo Starting server...
echo.
call npm start
pause
