#!/bin/bash

# n8n Code Generator Launcher
# Main launcher script for the n8n AI platform

set -e

# Base directory
BASE_DIR="/home/sergio/n8n_code_generator_github"
AGENT_PLATFORM_DIR="$BASE_DIR/n8n-agent-platform"
COPILOT_EXTENSION_DIR="$BASE_DIR/n8n-copilot-extension"

# Load conda environment
export PATH="/home/sergio/miniconda3/bin:$PATH"
eval "$(conda shell.bash hook)"
conda activate cuda121

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Function to check if a process is running
is_running() {
    pm2 list | grep -q "$1.*online" 2>/dev/null
}

# Function to start the agent platform
start_agent_platform() {
    print_info "Starting n8n Agent Platform..."
    
    cd "$AGENT_PLATFORM_DIR/core"
    
    if ! is_running "n8n-agent-platform"; then
        pm2 start npm --name "n8n-agent-platform" -- start
        print_status "Agent Platform started"
    else
        print_info "Agent Platform is already running"
    fi
}

# Function to start the web dashboard
start_dashboard() {
    print_info "Starting Web Dashboard..."
    
    cd "$AGENT_PLATFORM_DIR/web-dashboard"
    
    if ! is_running "n8n-dashboard"; then
        pm2 start npm --name "n8n-dashboard" -- run dev
        print_status "Web Dashboard started"
    else
        print_info "Web Dashboard is already running"
    fi
}

# Function to start the local server for VS Code extension
start_extension_server() {
    print_info "Starting VS Code Extension Server..."
    
    cd "$COPILOT_EXTENSION_DIR"
    
    if ! is_running "n8n-extension-server"; then
        pm2 start node --name "n8n-extension-server" -- out/server/localServer.js
        print_status "Extension Server started"
    else
        print_info "Extension Server is already running"
    fi
}

# Function to install VS Code extension
install_vscode_extension() {
    print_info "Installing VS Code Extension..."
    
    cd "$COPILOT_EXTENSION_DIR"
    
    # Package the extension
    print_info "Packaging extension..."
    vsce package --no-dependencies
    
    # Install the extension
    VSIX_FILE=$(ls -t *.vsix | head -1)
    if [ -n "$VSIX_FILE" ]; then
        code --install-extension "$VSIX_FILE"
        print_status "VS Code extension installed successfully"
    else
        print_error "Failed to find packaged extension"
    fi
}

# Function to stop all services
stop_all() {
    print_info "Stopping all services..."
    
    pm2 stop n8n-agent-platform 2>/dev/null || true
    pm2 stop n8n-dashboard 2>/dev/null || true
    pm2 stop n8n-extension-server 2>/dev/null || true
    
    print_status "All services stopped"
}

# Function to show status
show_status() {
    echo -e "\n${BLUE}=== n8n Code Generator Status ===${NC}\n"
    
    # Check services
    echo "Services:"
    if is_running "n8n-agent-platform"; then
        echo -e "  ${GREEN}●${NC} Agent Platform: Running"
    else
        echo -e "  ${RED}●${NC} Agent Platform: Stopped"
    fi
    
    if is_running "n8n-dashboard"; then
        echo -e "  ${GREEN}●${NC} Web Dashboard: Running"
    else
        echo -e "  ${RED}●${NC} Web Dashboard: Stopped"
    fi
    
    if is_running "n8n-extension-server"; then
        echo -e "  ${GREEN}●${NC} Extension Server: Running"
    else
        echo -e "  ${RED}●${NC} Extension Server: Stopped"
    fi
    
    echo -e "\nURLs:"
    echo -e "  Agent Platform API: ${BLUE}http://localhost:3000${NC}"
    echo -e "  Web Dashboard: ${BLUE}http://localhost:5173${NC}"
    echo -e "  Extension Server: ${BLUE}http://localhost:3456${NC}"
    
    echo -e "\nLogs:"
    echo -e "  View logs: ${YELLOW}pm2 logs${NC}"
    echo -e "  Monitor: ${YELLOW}pm2 monit${NC}"
    echo ""
}

# Function to open dashboard in browser
open_dashboard() {
    print_info "Opening dashboard in browser..."
    sleep 3  # Wait for services to start
    xdg-open "http://localhost:5173" 2>/dev/null || true
}

# Main menu
show_menu() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}     n8n Code Generator Platform        ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "1) Start All Services"
    echo "2) Start Agent Platform Only"
    echo "3) Start Dashboard Only"
    echo "4) Install VS Code Extension"
    echo "5) Show Status"
    echo "6) View Logs"
    echo "7) Stop All Services"
    echo "8) Exit"
    echo ""
    read -p "Select option: " choice
    
    case $choice in
        1)
            start_agent_platform
            start_dashboard
            start_extension_server
            show_status
            open_dashboard
            ;;
        2)
            start_agent_platform
            show_status
            ;;
        3)
            start_dashboard
            show_status
            open_dashboard
            ;;
        4)
            install_vscode_extension
            ;;
        5)
            show_status
            ;;
        6)
            pm2 logs
            ;;
        7)
            stop_all
            ;;
        8)
            exit 0
            ;;
        *)
            print_error "Invalid option"
            sleep 2
            show_menu
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

# Handle command line arguments
case "${1:-}" in
    --start)
        start_agent_platform
        start_dashboard
        start_extension_server
        show_status
        open_dashboard
        ;;
    --dashboard)
        start_dashboard
        open_dashboard
        ;;
    --install-extension)
        install_vscode_extension
        ;;
    --stop)
        stop_all
        ;;
    --status)
        show_status
        ;;
    *)
        # If no arguments, show menu
        show_menu
        ;;
esac