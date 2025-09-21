#!/bin/bash

# Auto-start script for Impact-Lens API
echo "🚀 Starting Impact-Lens API server..."

# Navigate to backend directory
cd /home/cindycrijns/impact-lens-project/backend

# Install requirements if needed
echo "📦 Installing requirements..."
pip install -r requirements.txt

# Load environment variables and start server
echo "🔑 Loading API key and starting server..."
source ~/.bashrc
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

echo "✅ API server started at http://localhost:8000"