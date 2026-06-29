#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
echo "Installing dependencies..."
pip install -r requirements.txt
echo "Starting Warframe Nexus backend..."
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
