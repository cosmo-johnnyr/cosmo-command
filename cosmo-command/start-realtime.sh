#!/bin/bash
#
# Cosmo Command Real-Time Connection Startup Script
# Starts the session API server and Cloudflare Tunnel
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_SERVER="$SCRIPT_DIR/session-api.js"
PIDFILE="$SCRIPT_DIR/.realtime.pid"
TUNNEL_LOG="$SCRIPT_DIR/.tunnel.log"
API_LOG="$SCRIPT_DIR/.api.log"

# Colors for output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║         🌌 COSMO COMMAND REAL-TIME CONNECTOR              ║"
    echo "║                                                            ║"
    echo "║   Exposing live OpenClaw session data to the cloud        ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if already running
check_running() {
    if [ -f "$PIDFILE" ]; then
        local pid=$(cat "$PIDFILE" 2>/dev/null)
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}⚠️  Real-time connection already running (PID: $pid)${NC}"
            echo "Run ./stop-realtime.sh to stop it first, or:"
            echo "  ./start-realtime.sh restart"
            return 1
        else
            rm -f "$PIDFILE"
        fi
    fi
    return 0
}

# Start the API server
start_api() {
    echo -e "${CYAN}🔌 Starting Session API Server...${NC}"
    
    if [ ! -f "$API_SERVER" ]; then
        echo -e "${RED}❌ API server not found at $API_SERVER${NC}"
        exit 1
    fi
    
    # Start API server in background
    nohup node "$API_SERVER" > "$API_LOG" 2>&1 &
    local api_pid=$!
    
    # Wait for server to start
    sleep 2
    
    if kill -0 $api_pid 2>/dev/null; then
        echo -e "${GREEN}✅ API Server running (PID: $api_pid)${NC}"
        echo "   → Local URL: http://localhost:3458"
        echo "   → Health check: http://localhost:3458/health"
    else
        echo -e "${RED}❌ API Server failed to start${NC}"
        echo "Check logs at: $API_LOG"
        exit 1
    fi
    
    echo $api_pid > "$PIDFILE"
}

# Start Cloudflare Tunnel
start_tunnel() {
    echo -e "${CYAN}🌐 Starting Cloudflare Tunnel...${NC}"
    
    # Check if cloudflared is installed
    if ! command -v cloudflared &> /dev/null; then
        echo -e "${YELLOW}⚠️  cloudflared not found. Installing...${NC}"
        if command -v brew &> /dev/null; then
            brew install cloudflared
        else
            echo -e "${RED}❌ Please install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/${NC}"
            exit 1
        fi
    fi
    
    # Start tunnel - save output to get the URL
    nohup cloudflared tunnel --url http://localhost:3458 > "$TUNNEL_LOG" 2>&1 &
    local tunnel_pid=$!
    
    # Wait for tunnel to establish
    echo -n "   Waiting for tunnel to connect"
    local attempts=0
    local tunnel_url=""
    
    while [ $attempts -lt 30 ]; do
        sleep 1
        echo -n "."
        tunnel_url=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)
        if [ -n "$tunnel_url" ]; then
            break
        fi
        attempts=$((attempts + 1))
    done
    echo ""
    
    if [ -n "$tunnel_url" ]; then
        echo -e "${GREEN}✅ Cloudflare Tunnel running (PID: $tunnel_pid)${NC}"
        echo ""
        echo -e "${GREEN}═════════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  🎉 SUCCESS! Your real-time endpoint is ready:${NC}"
        echo ""
        echo -e "${CYAN}  $tunnel_url${NC}"
        echo ""
        echo -e "${GREEN}═════════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "📱 Update your web app to use this URL:"
        echo "   REACT_APP_API_URL=$tunnel_url"
        echo ""
        echo "🔒 This URL is random and secure. Save it somewhere safe!"
        echo ""
        echo "📊 Logs:"
        echo "   API Server:  tail -f $API_LOG"
        echo "   Tunnel:      tail -f $TUNNEL_LOG"
        echo ""
        
        # Save tunnel URL for reference
        echo "$tunnel_url" > "$SCRIPT_DIR/.tunnel-url"
        
        # Append tunnel PID to pidfile
        echo $tunnel_pid >> "$PIDFILE"
        
        return 0
    else
        echo -e "${RED}❌ Tunnel failed to start${NC}"
        echo "Check logs at: $TUNNEL_LOG"
        kill $tunnel_pid 2>/dev/null || true
        return 1
    fi
}

# Stop running processes
stop() {
    if [ -f "$PIDFILE" ]; then
        echo -e "${CYAN}🛑 Stopping real-time connection...${NC}"
        while read pid; do
            kill "$pid" 2>/dev/null || true
        done < "$PIDFILE"
        rm -f "$PIDFILE"
        echo -e "${GREEN}✅ Stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  Not running${NC}"
    fi
}

# Main
print_banner

case "${1:-start}" in
    start)
        if check_running; then
            start_api
            start_tunnel
            echo -e "${GREEN}🌌 Cosmo Command is now live!${NC}"
            echo ""
            echo "To stop, run: ./start-realtime.sh stop"
        fi
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        sleep 2
        start_api
        start_tunnel
        echo -e "${GREEN}🌌 Cosmo Command is now live!${NC}"
        ;;
    status)
        if [ -f "$PIDFILE" ]; then
            echo -e "${GREEN}✅ Running${NC}"
            echo "PIDs: $(cat "$PIDFILE")"
            if [ -f "$SCRIPT_DIR/.tunnel-url" ]; then
                echo "Tunnel URL: $(cat "$SCRIPT_DIR/.tunnel-url")"
            fi
        else
            echo -e "${YELLOW}⚠️  Not running${NC}"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
