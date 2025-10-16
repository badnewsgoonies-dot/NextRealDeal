@echo off
REM NextRealDeal v1.0.0 - Quick Start Script
REM This script starts the web UI development server

echo ========================================
echo NextRealDeal v1.0.0 - Starting...
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting development server...
echo.
echo The game will open at: http://localhost:3000/
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

call npm run dev

pause

