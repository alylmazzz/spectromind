#!/bin/bash
# RDKit Virtual Environment Setup Script for Mac/Linux

echo "========================================"
echo "RDKit Virtual Environment Setup"
echo "========================================"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found! Please install Python 3.8+ first."
    exit 1
fi

echo "Step 1: Creating virtual environment..."
if [ -d "venv_rdkit" ]; then
    echo "Virtual environment already exists. Removing old one..."
    rm -rf venv_rdkit
fi

python3 -m venv venv_rdkit
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create virtual environment!"
    exit 1
fi

echo ""
echo "Step 2: Activating virtual environment..."
source venv_rdkit/bin/activate

echo ""
echo "Step 3: Upgrading pip..."
python -m pip install --upgrade pip

echo ""
echo "Step 4: Installing RDKit..."
echo "This may take several minutes..."
pip install rdkit

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Failed to install RDKit!"
    echo ""
    echo "Alternative installation method:"
    echo "Try: conda install -c conda-forge rdkit"
    echo "Or: pip install rdkit-pypi"
    exit 1
fi

echo ""
echo "Step 5: Verifying installation..."
python -c "from rdkit import Chem; print('✅ RDKit installed successfully!')"

if [ $? -ne 0 ]; then
    echo "ERROR: RDKit verification failed!"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ Setup completed successfully!"
echo "========================================"
echo ""
echo "Virtual environment location:"
echo "$(pwd)/venv_rdkit"
echo ""
echo "To activate manually:"
echo "source venv_rdkit/bin/activate"
echo ""
