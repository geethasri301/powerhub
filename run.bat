@echo off
title Campus Energy Detective Server
:: Always navigate to the folder where this batch script lives
cd /d "%~dp0"

echo ========================================================
echo    Starting Campus Energy Detective Server...
echo ========================================================
echo Current Directory: %CD%
echo.

set PYTHON_CMD=

:: Check specific installed Python 3.13 first
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" (
    set PYTHON_CMD="%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    goto found
)

:: Check direct python command
python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python
    goto found
)

:: Check Python Launcher py
py --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py
    goto found
)

echo ERROR: Python executable could not be found automatically.
echo Please ensure Python is installed.
pause
exit /b 1

:found
echo Starting server using: %PYTHON_CMD%
echo Open your browser to: http://localhost:5000
echo.
%PYTHON_CMD% server.py
pause
