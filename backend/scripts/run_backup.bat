@echo off
REM ==============================================================================
REM Automated Database Backup Script for Windows Task Scheduler
REM Project: Smart FYP Management System (UTC)
REM ==============================================================================

setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%.."
set "LOG_DIR=%BACKEND_DIR%\backups"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "LOG_FILE=%LOG_DIR%\backup_cron.log"

echo ======================================================== >> "%LOG_FILE%"
echo [%date% %time%] Starting automated backup job... >> "%LOG_FILE%"

cd /d "%BACKEND_DIR%"

REM Find Python in virtualenv or system PATH
set "PY_CMD="
if exist "%BACKEND_DIR%\..\.venv\Scripts\python.exe" (
    set "PY_CMD=%BACKEND_DIR%\..\.venv\Scripts\python.exe"
) else if exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
    set "PY_CMD=%BACKEND_DIR%\.venv\Scripts\python.exe"
) else if exist "%BACKEND_DIR%\venv\Scripts\python.exe" (
    set "PY_CMD=%BACKEND_DIR%\venv\Scripts\python.exe"
) else (
    set "PY_CMD=python"
)

echo [%date% %time%] Using Python: !PY_CMD! >> "%LOG_FILE%"

REM Run backup management command via run_backup.py
"!PY_CMD!" scripts\run_backup.py --keep-days 7 >> "%LOG_FILE%" 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] [SUCCESS] Database backup completed successfully. >> "%LOG_FILE%"
    exit /b 0
) else (
    echo [%date% %time%] [ERROR] Database backup failed with exit code %ERRORLEVEL%. >> "%LOG_FILE%"
    exit /b %ERRORLEVEL%
)
