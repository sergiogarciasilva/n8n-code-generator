#!/bin/bash

# n8n Agent Platform Docker Manager
# This script helps manage the Docker environment for n8n Agent Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="n8n-agent-platform"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.docker"

# Functions
print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║    n8n Agent Platform Docker Manager   ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    print_success "Docker environment verified"
}

start_services() {
    print_info "Starting n8n Agent Platform services..."
    
    # Copy environment file if it doesn't exist
    if [ ! -f ".env" ]; then
        cp "$ENV_FILE" .env
        print_success "Environment file created"
    fi
    
    # Start services
    docker-compose -p "$PROJECT_NAME" up -d
    
    print_success "Services started successfully!"
    echo ""
    print_info "Service URLs:"
    echo "  • API Server:    http://localhost:3456"
    echo "  • Web Dashboard: http://localhost:5173"
    echo "  • n8n Instance:  http://localhost:5679"
    echo "  • pgAdmin:       http://localhost:5051"
    echo "  • PostgreSQL:    localhost:5433"
    echo "  • Redis:         localhost:6380"
}

stop_services() {
    print_info "Stopping n8n Agent Platform services..."
    docker-compose -p "$PROJECT_NAME" down
    print_success "Services stopped"
}

restart_services() {
    stop_services
    sleep 2
    start_services
}

status_services() {
    print_info "Service Status:"
    docker-compose -p "$PROJECT_NAME" ps
}

logs_services() {
    service=$1
    if [ -z "$service" ]; then
        docker-compose -p "$PROJECT_NAME" logs -f
    else
        docker-compose -p "$PROJECT_NAME" logs -f "$service"
    fi
}

reset_data() {
    print_warning "This will delete all data! Are you sure? (y/N)"
    read -r confirmation
    
    if [ "$confirmation" = "y" ] || [ "$confirmation" = "Y" ]; then
        print_info "Stopping services and removing volumes..."
        docker-compose -p "$PROJECT_NAME" down -v
        print_success "All data has been reset"
    else
        print_info "Reset cancelled"
    fi
}

backup_database() {
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_file="backup_${PROJECT_NAME}_${timestamp}.sql"
    
    print_info "Creating database backup..."
    
    docker exec n8n_agent_platform_postgres pg_dump \
        -U n8n_agent_user \
        -d n8n_agent_platform_db \
        > "$backup_file"
    
    print_success "Backup created: $backup_file"
}

restore_database() {
    backup_file=$1
    
    if [ -z "$backup_file" ]; then
        print_error "Please provide a backup file"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    print_warning "This will overwrite the current database! Are you sure? (y/N)"
    read -r confirmation
    
    if [ "$confirmation" = "y" ] || [ "$confirmation" = "Y" ]; then
        print_info "Restoring database from $backup_file..."
        
        docker exec -i n8n_agent_platform_postgres psql \
            -U n8n_agent_user \
            -d n8n_agent_platform_db \
            < "$backup_file"
        
        print_success "Database restored successfully"
    else
        print_info "Restore cancelled"
    fi
}

shell_service() {
    service=$1
    
    case "$service" in
        postgres|postgresql|db)
            print_info "Connecting to PostgreSQL..."
            docker exec -it n8n_agent_platform_postgres psql -U n8n_agent_user -d n8n_agent_platform_db
            ;;
        redis)
            print_info "Connecting to Redis..."
            docker exec -it n8n_agent_platform_redis redis-cli -a "${REDIS_PASSWORD:-changeme}"
            ;;
        n8n)
            print_info "Opening n8n container shell..."
            docker exec -it n8n_agent_platform_n8n /bin/sh
            ;;
        *)
            print_error "Unknown service: $service"
            echo "Available services: postgres, redis, n8n"
            exit 1
            ;;
    esac
}

health_check() {
    print_info "Checking service health..."
    echo ""
    
    # Check PostgreSQL
    if docker exec n8n_agent_platform_postgres pg_isready -U n8n_agent_user &> /dev/null; then
        print_success "PostgreSQL is healthy"
    else
        print_error "PostgreSQL is not responding"
    fi
    
    # Check Redis
    if docker exec n8n_agent_platform_redis redis-cli -a "${REDIS_PASSWORD:-changeme}" ping &> /dev/null; then
        print_success "Redis is healthy"
    else
        print_error "Redis is not responding"
    fi
    
    # Check n8n
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5679/healthz | grep -q "200"; then
        print_success "n8n is healthy"
    else
        print_error "n8n is not responding"
    fi
}

show_help() {
    print_header
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start          Start all services"
    echo "  stop           Stop all services"
    echo "  restart        Restart all services"
    echo "  status         Show service status"
    echo "  logs [service] Show logs (optionally for specific service)"
    echo "  reset          Reset all data (WARNING: destructive)"
    echo "  backup         Create database backup"
    echo "  restore <file> Restore database from backup"
    echo "  shell <service> Open shell in service container"
    echo "  health         Check service health"
    echo "  help           Show this help message"
    echo ""
    echo "Services: postgres, redis, n8n"
}

# Main script
print_header

# Check Docker installation
check_docker

# Parse command
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        status_services
        ;;
    logs)
        logs_services "$2"
        ;;
    reset)
        reset_data
        ;;
    backup)
        backup_database
        ;;
    restore)
        restore_database "$2"
        ;;
    shell)
        shell_service "$2"
        ;;
    health)
        health_check
        ;;
    help|"")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac