#!/usr/bin/env bash
# PostStager – One-command start (macOS / Linux)
set -e
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "First-time setup: creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    echo ""
    echo "Setup complete!"
else
    source venv/bin/activate
fi

echo "Starting PostStager..."
python app.py
