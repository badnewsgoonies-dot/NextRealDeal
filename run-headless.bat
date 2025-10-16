@echo off
REM NextRealDeal v1.0.0 - Headless Demo
REM Runs the CLI demo (no browser required)

echo ========================================
echo NextRealDeal v1.0.0 - Headless Demo
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Running headless demo...
echo.

call npm run demo

echo.
echo Demo complete!
pause

