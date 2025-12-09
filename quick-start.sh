#!/bin/bash

# n8n Code Generator - Quick Start Script
# Script simplificado para iniciar los servicios básicos

set -e

# Base directory
BASE_DIR="/home/sergio/n8n_code_generator_github"
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

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Función para verificar dependencias básicas
check_dependencies() {
    print_info "Verificando dependencias básicas..."
    
    # Verificar si las dependencias de n8n-copilot están instaladas
    if [ ! -d "$COPILOT_EXTENSION_DIR/node_modules" ]; then
        print_info "Instalando dependencias de n8n-copilot-extension..."
        cd "$COPILOT_EXTENSION_DIR"
        npm install --legacy-peer-deps || {
            print_error "Error instalando dependencias"
            exit 1
        }
    fi
    
    # Compilar la extensión si es necesario
    if [ ! -d "$COPILOT_EXTENSION_DIR/out" ]; then
        print_info "Compilando n8n-copilot-extension..."
        cd "$COPILOT_EXTENSION_DIR"
        npm run compile || print_error "Error compilando, continuando de todas formas..."
    fi
}

# Función para iniciar el servidor local de la extensión
start_extension_server() {
    print_info "Iniciando servidor local de la extensión VS Code..."
    
    cd "$COPILOT_EXTENSION_DIR"
    
    # Verificar si el servidor ya está corriendo
    if pm2 list | grep -q "n8n-extension-server.*online" 2>/dev/null; then
        print_info "El servidor ya está en ejecución"
    else
        # Iniciar con PM2
        pm2 start node --name "n8n-extension-server" -- out/server/localServer.js || {
            # Si falla con PM2, intentar directamente
            print_info "Iniciando servidor directamente..."
            node out/server/localServer.js &
            print_status "Servidor iniciado en puerto 3456"
        }
    fi
}

# Función para instalar la extensión en VS Code
install_vscode_extension() {
    print_info "Preparando extensión de VS Code..."
    
    cd "$COPILOT_EXTENSION_DIR"
    
    # Verificar si vsce está instalado
    if ! command -v vsce &> /dev/null; then
        print_info "Instalando vsce..."
        npm install -g vsce
    fi
    
    # Empaquetar la extensión
    print_info "Empaquetando extensión..."
    vsce package --no-dependencies || {
        print_error "Error empaquetando la extensión"
        return 1
    }
    
    # Instalar la extensión
    VSIX_FILE=$(ls -t *.vsix | head -1)
    if [ -n "$VSIX_FILE" ]; then
        code --install-extension "$VSIX_FILE"
        print_status "Extensión de VS Code instalada"
    else
        print_error "No se encontró el archivo de extensión"
    fi
}

# Función para mostrar el estado
show_status() {
    echo -e "\n${BLUE}=== Estado de n8n Code Generator ===${NC}\n"
    
    # Verificar servidor local
    if pm2 list | grep -q "n8n-extension-server.*online" 2>/dev/null; then
        echo -e "  ${GREEN}●${NC} Servidor de Extensión: Activo"
        echo -e "     URL: ${BLUE}http://localhost:3456${NC}"
    else
        # Verificar si está corriendo sin PM2
        if lsof -i :3456 &>/dev/null; then
            echo -e "  ${GREEN}●${NC} Servidor de Extensión: Activo (sin PM2)"
            echo -e "     URL: ${BLUE}http://localhost:3456${NC}"
        else
            echo -e "  ${RED}●${NC} Servidor de Extensión: Detenido"
        fi
    fi
    
    echo -e "\n${YELLOW}Comandos disponibles:${NC}"
    echo "  - Abrir VS Code: code"
    echo "  - Ver logs PM2: pm2 logs"
    echo "  - Detener servidor: pm2 stop n8n-extension-server"
    echo ""
}

# Menú principal
case "${1:-}" in
    --server)
        check_dependencies
        start_extension_server
        show_status
        ;;
    --extension)
        check_dependencies
        install_vscode_extension
        ;;
    --status)
        show_status
        ;;
    --stop)
        pm2 stop n8n-extension-server 2>/dev/null || true
        print_status "Servidor detenido"
        ;;
    *)
        clear
        echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║${NC}   n8n Code Generator - Quick Start     ${BLUE}║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
        echo ""
        echo "Opciones:"
        echo "  ./quick-start.sh --server     # Iniciar servidor local"
        echo "  ./quick-start.sh --extension  # Instalar extensión VS Code"
        echo "  ./quick-start.sh --status     # Ver estado"
        echo "  ./quick-start.sh --stop       # Detener servidor"
        echo ""
        echo "Para comenzar rápidamente:"
        echo "  1. ./quick-start.sh --server"
        echo "  2. ./quick-start.sh --extension"
        echo ""
        ;;
esac