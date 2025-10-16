@echo off
:: NextRealDeal - Game Engine Launcher
:: Quick access to development and testing commands

cls
echo ========================================
echo    NextRealDeal Game Engine
echo    Version 0.1.0 - 86%% Complete
echo ========================================
echo.
echo Select an option:
echo.
echo [1] Run All Tests
echo [2] Run Tests with Coverage
echo [3] Run Full CI Pipeline
echo [4] Start Development (TypeCheck + Watch)
echo [5] Build Production
echo [6] Lint Code
echo [7] Check Dependencies (Circular)
echo [8] Check Architecture Rules
echo [9] Install Dependencies
echo [0] Exit
echo.
echo ========================================

set /p choice="Enter your choice (0-9): "

if "%choice%"=="1" goto run_tests
if "%choice%"=="2" goto run_coverage
if "%choice%"=="3" goto run_ci
if "%choice%"=="4" goto dev_mode
if "%choice%"=="5" goto build
if "%choice%"=="6" goto lint
if "%choice%"=="7" goto check_cycles
if "%choice%"=="8" goto check_arch
if "%choice%"=="9" goto install
if "%choice%"=="0" goto end

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto start

:run_tests
cls
echo ========================================
echo Running Test Suite (210 tests)
echo ========================================
echo.
call npm test
echo.
echo ========================================
echo Tests Complete!
echo ========================================
pause
goto end

:run_coverage
cls
echo ========================================
echo Running Tests with Coverage Report
echo ========================================
echo.
call npm run coverage
echo.
echo ========================================
echo Coverage Report Generated!
echo ========================================
pause
goto end

:run_ci
cls
echo ========================================
echo Running Full CI Pipeline
echo ========================================
echo.
echo Running: typecheck, lint, dep:cycles, dep:cruise, tests
echo.
call npm run ci
echo.
echo ========================================
echo CI Pipeline Complete!
echo ========================================
pause
goto end

:dev_mode
cls
echo ========================================
echo Development Mode
echo ========================================
echo.
echo Running TypeScript compiler in watch mode...
echo Press Ctrl+C to exit
echo.
call npm run typecheck -- --watch
pause
goto end

:build
cls
echo ========================================
echo Building Production Version
echo ========================================
echo.
call npm run build
echo.
echo ========================================
echo Build Complete!
echo ========================================
pause
goto end

:lint
cls
echo ========================================
echo Running ESLint
echo ========================================
echo.
call npm run lint
echo.
echo ========================================
echo Linting Complete!
echo ========================================
pause
goto end

:check_cycles
cls
echo ========================================
echo Checking for Circular Dependencies
echo ========================================
echo.
call npm run dep:cycles
echo.
echo ========================================
echo Dependency Check Complete!
echo ========================================
pause
goto end

:check_arch
cls
echo ========================================
echo Validating Architecture Rules
echo ========================================
echo.
call npm run dep:cruise
echo.
echo ========================================
echo Architecture Validation Complete!
echo ========================================
pause
goto end

:install
cls
echo ========================================
echo Installing Dependencies
echo ========================================
echo.
call npm install
echo.
echo ========================================
echo Installation Complete!
echo ========================================
pause
goto end

:end
echo.
echo Thank you for using NextRealDeal!
echo.

