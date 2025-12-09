#!/bin/bash

# n8n Agent Platform - Local Database Setup Script
# This script sets up PostgreSQL for local development

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DB_NAME="n8n_agent_platform_local"
DB_USER="n8n_agent_local"
DB_PASSWORD="local_dev_password"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  n8n Agent Platform - Local DB Setup   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}✗ PostgreSQL is not installed${NC}"
    echo "Please install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "  macOS: brew install postgresql"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL is installed${NC}"

# Check if PostgreSQL is running
if ! pg_isready &> /dev/null; then
    echo -e "${YELLOW}⚠ PostgreSQL is not running${NC}"
    echo "Starting PostgreSQL..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo systemctl start postgresql
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql
    fi
    
    sleep 2
fi

echo -e "${GREEN}✓ PostgreSQL is running${NC}"

# Create database and user
echo -e "${BLUE}ℹ Creating database and user...${NC}"

# Create user
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
    echo -e "${YELLOW}⚠ User $DB_USER already exists${NC}"
}

# Create database
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || {
    echo -e "${YELLOW}⚠ Database $DB_NAME already exists${NC}"
}

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Create extensions
sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"

echo -e "${GREEN}✓ Database setup complete${NC}"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.local .env
    echo -e "${GREEN}✓ Created .env file from .env.local${NC}"
else
    echo -e "${YELLOW}⚠ .env file already exists${NC}"
fi

# Test connection
echo -e "${BLUE}ℹ Testing database connection...${NC}"

PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT version();" &> /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Local database setup complete!${NC}"
echo ""
echo "Database Details:"
echo "  Host:     localhost"
echo "  Port:     5432"
echo "  Database: $DB_NAME"
echo "  Username: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
echo "You can now run the application with:"
echo "  npm run dev"