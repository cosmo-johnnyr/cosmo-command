#!/bin/bash
# Deploy script for Cosmo Command Mobile

cd /Users/cosmo/.openclaw/workspace/cosmo-command

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "Installing ngrok..."
    brew install ngrok/ngrok/ngrok 2>/dev/null || npm install -g ngrok 2>/dev/null
fi

# Start Python HTTP server in background
echo "Starting HTTP server..."
python3 -m http.server 8765 --directory build &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Start ngrok
echo "Starting ngrok tunnel..."
ngrok http 8765 --host-header="localhost:8765" &
NGROK_PID=$!

echo "Server running on http://localhost:8765"
echo "Ngrok tunnel starting..."
echo "Check https://dashboard.ngrok.com/status/tunnels for the public URL"
echo ""
echo "Press Ctrl+C to stop"

# Wait for interrupt
trap "kill $SERVER_PID $NGROK_PID 2>/dev/null; exit" INT
wait
