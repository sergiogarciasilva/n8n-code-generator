#!/bin/bash

# n8n Code Generator - Installation Script
# This script installs and configures both n8n-agent-platform and n8n-copilot-extension

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   print_error "Please do not run this script as root"
   exit 1
fi

print_status "Starting n8n Code Generator installation..."

# Check prerequisites
print_status "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16+ first."
    exit 1
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version must be 16 or higher. Current version: $(node -v)"
        exit 1
    fi
    print_status "Node.js $(node -v) found"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
else
    print_status "npm $(npm -v) found"
fi

# Check PostgreSQL client
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL client not found. Installing..."
    sudo apt-get update && sudo apt-get install -y postgresql-client
fi

# Check if PostgreSQL is accessible
export PGPASSWORD="analytics"
if ! psql -h localhost -p 15432 -U analytics -d analyticsdb -c '\q' 2>/dev/null; then
    print_error "Cannot connect to PostgreSQL on localhost:15432"
    print_warning "Please ensure PostgreSQL is running and accessible"
    exit 1
else
    print_status "PostgreSQL connection verified"
fi

# Create databases
print_status "Creating databases..."

# Create n8n_agent_platform database
if ! psql -h localhost -p 15432 -U analytics -d analyticsdb -tc "SELECT 1 FROM pg_database WHERE datname = 'n8n_agent_platform'" | grep -q 1; then
    createdb -h localhost -p 15432 -U analytics n8n_agent_platform
    print_status "Created database: n8n_agent_platform"
else
    print_status "Database n8n_agent_platform already exists"
fi

# Create n8n_copilot database
if ! psql -h localhost -p 15432 -U analytics -d analyticsdb -tc "SELECT 1 FROM pg_database WHERE datname = 'n8n_copilot'" | grep -q 1; then
    createdb -h localhost -p 15432 -U analytics n8n_copilot
    print_status "Created database: n8n_copilot"
else
    print_status "Database n8n_copilot already exists"
fi

# Install n8n-agent-platform
print_status "Installing n8n-agent-platform..."
cd /home/sergio/n8n_code_generator_github/n8n-agent-platform

# Install dependencies
print_status "Installing dependencies for n8n-agent-platform..."
npm install --legacy-peer-deps

# Build shared module first
print_status "Building shared module..."
npm run build:shared

# Run database migrations
print_status "Running database migrations for agent platform..."
cd core
npm run db:migrate || print_warning "Migration failed - database might already be set up"

# Build the project
print_status "Building n8n-agent-platform..."
cd ..
npm run build

# Install n8n-copilot-extension
print_status "Installing n8n-copilot-extension..."
cd /home/sergio/n8n_code_generator_github/n8n-copilot-extension

# Install dependencies
print_status "Installing dependencies for n8n-copilot-extension..."
npm install --legacy-peer-deps

# Run database migrations
print_status "Running database migrations for copilot extension..."
npm run db:migrate || print_warning "Migration failed - database might already be set up"

# Compile the extension
print_status "Compiling n8n-copilot-extension..."
npm run compile

# Install global tools
print_status "Installing global tools..."

# Install vsce for VS Code extension packaging
if ! command -v vsce &> /dev/null; then
    print_status "Installing vsce..."
    npm install -g vsce
fi

# Install PM2 for process management
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    npm install -g pm2
fi

# Create logs directory
mkdir -p /home/sergio/n8n_code_generator_github/logs

# Create uploads directory
mkdir -p /home/sergio/n8n_code_generator_github/n8n-agent-platform/core/uploads

print_status "Installation completed successfully!"
print_warning "Please update the .env files with your API keys before running the applications:"
echo "  - /home/sergio/n8n_code_generator_github/n8n-agent-platform/core/.env"
echo "  - /home/sergio/n8n_code_generator_github/n8n-copilot-extension/.env"
echo ""
print_status "To start the applications, run the launcher script or use the desktop application."