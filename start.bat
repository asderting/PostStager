@echo off
REM PostStager – One-command start (Windows)
cd /d "%~dp0"

if not exist "venv" (
    echo First-time setup: creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    echo.
    echo Setup complete!
) else (
    call venv\Scripts\activate.bat
)

echo Starting PostStager...
python app.py
pause
