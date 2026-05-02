@echo off
REM RDKit Virtual Environment Setup Script for Windows
REM This script creates a virtual environment and installs RDKit

echo ========================================
echo RDKit Virtual Environment Setup
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found! Please install Python 3.8+ first.
    pause
    exit /b 1
)

echo Step 1: Creating virtual environment...
if exist venv_rdkit (
    echo Virtual environment already exists. Removing old one...
    rmdir /s /q venv_rdkit
)

python -m venv venv_rdkit
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment!
    pause
    exit /b 1
)

echo.
echo Step 2: Activating virtual environment...
call venv_rdkit\Scripts\activate.bat

echo.
echo Step 3: Upgrading pip...
python -m pip install --upgrade pip

echo.
echo Step 4: Installing RDKit...
echo This may take several minutes...
pip install rdkit

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install RDKit!
    echo.
    echo Alternative installation method:
    echo Try: conda install -c conda-forge rdkit
    echo Or: pip install rdkit-pypi
    pause
    exit /b 1
)

echo.
echo Step 5: Verifying installation...
python -c "from rdkit import Chem; print('✅ RDKit installed successfully!')"

if errorlevel 1 (
    echo ERROR: RDKit verification failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Setup completed successfully!
echo ========================================
echo.
echo Virtual environment location:
echo %CD%\venv_rdkit
echo.
echo To activate manually:
echo venv_rdkit\Scripts\activate
echo.
pause
