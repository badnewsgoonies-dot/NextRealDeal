@echo off
:: NextRealDeal - Continuous Testing (Watch Mode)
:: Automatically re-runs tests whenever you save a file

cls
echo ========================================
echo    NextRealDeal - Continuous Testing
echo ========================================
echo.
echo This will start Vitest in WATCH MODE.
echo.
echo What this means:
echo  - Tests run automatically when you save ANY file
echo  - Only changed tests re-run (super fast!)
echo  - See results instantly in the terminal
echo  - Perfect for TDD (Test-Driven Development)
echo.
echo ========================================
echo.
echo Starting watch mode...
echo Press 'q' to quit, 'a' to run all tests
echo.
echo ========================================
echo.

:: Start Vitest in watch mode
call npm test -- --watch

:: This line only executes if watch mode exits
echo.
echo ========================================
echo Watch mode stopped.
echo ========================================
pause

