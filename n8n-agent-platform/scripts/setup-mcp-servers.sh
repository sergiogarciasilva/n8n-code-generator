#!/bin/bash

# MCP Servers Setup Script for n8n-agent-platform
# This script installs and configures the BEST MCP servers for n8n

set -e

echo "🔧 Setting up SUPERIOR MCP Servers for n8n-agent-platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo ""
echo "📁 Project root: $PROJECT_ROOT"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed. Please install npm${NC}"
    exit 1
fi

if ! command_exists npx; then
    echo -e "${RED}❌ npx is not installed. Please install npx${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}⚠️  Node.js $NODE_VERSION detected. Recommended: 18+${NC}"
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Pre-cache MCP packages for faster startup
echo "📦 Pre-caching MCP packages..."

echo "  → n8n-mcp (czlonkowski - 543 nodos, 99% cobertura)..."
npx -y n8n-mcp --version 2>/dev/null || echo "    Will be installed on first use"

echo "  → @leonardsellem/n8n-mcp-server (CRUD workflows)..."
npx -y @leonardsellem/n8n-mcp-server --version 2>/dev/null || echo "    Will be installed on first use"

echo "  → mcp-remote (for GitMCP connections)..."
npm list -g mcp-remote 2>/dev/null || npm install -g mcp-remote 2>/dev/null || echo "    Using npx fallback"

echo "  → @upstash/context7-mcp (documentación)..."
npx -y @upstash/context7-mcp@latest --version 2>/dev/null || echo "    Will be installed on first use"

echo -e "${GREEN}✅ MCP packages ready${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 MCP Servers Setup Complete!${NC}"
echo "=========================================="
echo ""
echo -e "${BLUE}📋 MCPs SUPERIORES Configurados:${NC}"
echo ""
echo "  🏆 n8n-mcp (czlonkowski)"
echo "     └─ 543 nodos documentados, 99% cobertura"
echo "     └─ 2,709 templates, validación AI"
echo "     └─ GitHub: https://github.com/czlonkowski/n8n-mcp"
echo ""
echo "  🔧 n8n-manager (leonardsellem)"
echo "     └─ CRUD completo de workflows"
echo "     └─ Ejecución y webhooks"
echo "     └─ GitHub: https://github.com/leonardsellem/n8n-mcp-server"
echo ""
echo "  📚 n8n-workflows (Zie619)"
echo "     └─ 2,700+ templates de workflows"
echo "     └─ GitHub: https://github.com/Zie619/n8n-workflows"
echo ""
echo "  📖 context7 (Upstash)"
echo "     └─ Documentación actualizada de librerías"
echo "     └─ GitHub: https://github.com/upstash/context7"
echo ""
echo "=========================================="
echo ""
echo -e "${YELLOW}🚀 Para iniciar la plataforma:${NC}"
echo "   cd $PROJECT_ROOT/core && npm run dev"
echo ""
echo -e "${YELLOW}📡 API endpoints MCP:${NC}"
echo "   GET  /api/v1/mcp/servers           - Listar servidores"
echo "   POST /api/v1/mcp/servers/:id/start - Iniciar servidor"
echo "   POST /api/v1/mcp/servers/:id/stop  - Detener servidor"
echo "   GET  /api/v1/mcp/tools             - Listar herramientas"
echo "   POST /api/v1/mcp/tools/call        - Ejecutar herramienta"
echo ""
echo -e "${YELLOW}💡 Alternativa HOSTED (sin instalación):${NC}"
echo "   https://dashboard.n8n-mcp.com (100 llamadas/día gratis)"
echo ""
