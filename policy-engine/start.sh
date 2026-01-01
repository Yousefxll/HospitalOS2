#!/bin/bash

# Script to start policy-engine
cd "$(dirname "$0")"

# Try to use Python 3.11 or 3.12 (better compatibility with chromadb)
PYTHON_CMD="python3"
if [ -f "/opt/homebrew/opt/python@3.12/bin/python3.12" ]; then
    PYTHON_CMD="/opt/homebrew/opt/python@3.12/bin/python3.12"
    echo "Using Python 3.12 (better compatibility)"
elif command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
    echo "Using Python 3.12 (better compatibility)"
elif command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
    echo "Using Python 3.11 (better compatibility)"
else
    echo "Warning: Using default Python (may be 3.14) which may have compatibility issues with chromadb"
    echo "Consider installing Python 3.12: brew install python@3.12"
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment with $PYTHON_CMD..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install core packages if not installed
echo "Checking if packages are installed..."
python3 -c "import fastapi, uvicorn" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "Installing core packages (this may take a few minutes)..."
    pip install --upgrade pip setuptools wheel
    pip install 'uvicorn[standard]' fastapi python-multipart pydantic pydantic-settings
fi

# Check if additional packages are installed
python3 -c "import PyPDF2, chromadb" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing additional packages..."
    pip install PyPDF2 chromadb sentence-transformers pdf2image pytesseract easyocr Pillow numpy python-dotenv || echo "Some optional packages failed to install"
fi

echo ""
echo "Starting policy-engine on http://0.0.0.0:8001..."
echo "Press CTRL+C to stop"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
