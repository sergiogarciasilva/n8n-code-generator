# CLAUDE.md - n8n Code Generator Project

This file provides guidance for Claude Code when working with this repository.

## Project Overview

This is the **n8n Agent Platform** - an AI-powered platform for generating and optimizing n8n workflows. It's a monorepo containing multiple interconnected applications.

## Repository Structure

```
n8n_code_generator_github/
├── n8n-agent-platform/          # Main platform (monorepo)
│   ├── core/                    # Backend API (TypeScript/Express)
│   ├── web-dashboard/           # React frontend (Vite)
│   ├── mobile-app/              # React Native app (Expo)
│   ├── vscode-extension/        # VS Code extension
│   ├── shared/                  # Shared types and utilities
│   └── docs-website/            # Docusaurus documentation site
├── n8n-copilot-extension/       # Standalone VS Code extension server
├── n8n-workflows-knowledge/     # Workflow templates and knowledge base
├── documentation/               # Consolidated docs
├── assets/                      # Project assets
└── scripts (*.sh)               # Launcher and setup scripts
```

## Tech Stack

### Backend (core/)
- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict mode)
- **Framework**: Express.js
- **Database**: PostgreSQL 15+ (port 5433 to avoid conflicts)
- **Cache**: Redis 7+ (port 6380)
- **Real-time**: Socket.IO for WebSockets
- **Queue**: Bull for job processing
- **ORM**: Raw SQL with pg driver

### Frontend (web-dashboard/)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Glassmorphism design
- **State**: React Context + custom hooks
- **Animations**: Framer Motion

### Mobile (mobile-app/)
- **Framework**: React Native with Expo
- **Navigation**: React Navigation

### Desktop Launcher
- **Framework**: Electron
- **Entry**: launcher.js

## Key Commands

```bash
# Development
npm run dev                    # Start all services concurrently
npm run dev:core               # Start backend only
npm run dev:dashboard          # Start frontend only

# Building
npm run build                  # Build all packages
npm run build:core             # Build backend
npm run build:dashboard        # Build frontend

# Docker
npm run docker:up              # Start PostgreSQL and Redis
npm run docker:down            # Stop Docker services
docker-compose up -d           # Alternative docker startup

# Database
npm run setup:db               # Run migrations and seed

# Testing
npm run test                   # Run all tests

# Desktop App
npm run launcher               # Start Electron app
npm run launcher:dev           # Start in dev mode
```

## API Endpoints (Port 3456)

Main endpoint groups:
- `/api/v1/generator/*` - Workflow generation with AI
- `/api/v1/agents/*` - Agent management
- `/api/v1/dashboard/*` - Dashboard metrics
- `/api/v1/chat/*` - AI chat interface
- `/api/v1/notifications/*` - Notifications
- `/api/v1/marketplace/*` - Template marketplace
- `/api/v1/auth/*` - Authentication (JWT)
- `/health` - Health check

## Environment Configuration

Primary config file: `n8n-agent-platform/.env`

Key variables:
```env
# Database (isolated ports)
DB_HOST=localhost
DB_PORT=5433
DB_NAME=n8n_agent_platform_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380

# API
API_PORT=3456
WEB_PORT=5173

# AI Providers
OPENAI_API_KEY=your_key
AI_PROVIDER=openai

# Security
JWT_SECRET=your_secret
ENCRYPTION_KEY=your_32_char_key
```

## Architecture Patterns

### Core Backend Architecture
- **AgentPlatform** (main entry): Initializes all managers and servers
- **AgentOrchestrator**: Coordinates AI agents
- **SecureAPIServer**: REST API with authentication
- **WebSocketManager**: Real-time communication
- **DatabaseManager**: PostgreSQL connection pooling
- **RedisManager**: Cache and session management
- **AuthManager**: JWT authentication with 2FA
- **PermissionManager**: RBAC authorization
- **MarketplaceManager**: Template marketplace
- **MCPServerManager**: Model Context Protocol support

### Agent Types
- **MCPAgent**: Optimizes MCP workflows
- **TelegramAgent**: Telegram bot optimization
- **MultiAgentSystemAgent**: Multi-agent coordination
- **CustomAgent**: Extensible base class

## Code Style Guidelines

- TypeScript strict mode enabled
- ESLint + Prettier for formatting
- Conventional Commits for git messages
- Jest for testing (target: >80% coverage)
- Use async/await over callbacks
- Prefer functional components in React

## Common Development Tasks

### Adding a new API endpoint
1. Create route handler in `core/src/api/routes/`
2. Add business logic in `core/src/services/`
3. Register route in `SecureAPIServer.ts`
4. Add types in `shared/src/types/`

### Adding a new Agent
1. Extend `BaseAgent` class in `core/src/agents/`
2. Implement `analyze()` and `optimize()` methods
3. Register in `AgentOrchestrator`

### Frontend Components
- Use glassmorphism design patterns (see `GLASS_DESIGN_README.md`)
- Agent interactions use "Gloria Hallelujah" font
- Follow existing component patterns in `web-dashboard/src/components/`

## Default Credentials (Development Only)

```
Admin User: admin@localhost
Password: changeme123!
```

## Important Files

- `n8n-agent-platform/core/src/index.ts` - Main platform entry point
- `n8n-agent-platform/core/src/api/SecureAPIServer.ts` - API routes
- `n8n-agent-platform/core/src/orchestrator/AgentOrchestrator.ts` - Agent coordination
- `n8n-agent-platform/web-dashboard/src/App.tsx` - Frontend entry
- `n8n-agent-platform/docker-compose.yml` - Docker services config

## Troubleshooting

### Database connection issues
```bash
# Verify PostgreSQL is running
docker-compose ps
# Check port 5433 (not default 5432)
```

### Redis connection issues
```bash
# Verify Redis on port 6380
docker-compose logs redis
```

### Agent not running
```bash
# Check logs
docker-compose logs core
pm2 logs n8n-extension-server
```

## n8n Documentation & Knowledge Base

This project includes extensive n8n documentation for the Flow Builder functionality.

### Main Documentation File

**`documentation/docs_consolidados.md`** - 57,622 lines of consolidated n8n documentation:

| Content | Details |
|---------|---------|
| Node documentation | ~430 sections covering all n8n nodes |
| App nodes | Jenkins, Mailgun, HubSpot, Spotify, Twilio, Microsoft Teams, etc. |
| AI/LangChain nodes | AI Agent, Anthropic, OpenAI, Ollama, AWS Bedrock, PGVector, etc. |
| Database nodes | PostgreSQL, MongoDB, TimescaleDB, BigQuery, CrateDB, QuestDB, etc. |
| Triggers | Telegram, Jira, MQTT, Airtable, RabbitMQ, Notion, etc. |

Each node section includes:
- Available operations
- Credential configuration
- Templates and examples
- AI tool usage
- Common issues and troubleshooting

### Workflow Examples

Located in `n8n-workflows-knowledge/workflows/`:

| File | Description |
|------|-------------|
| `v1.x.x/ai-ml/chatbot-openai-basic.json` | OpenAI GPT chatbot with conversation memory |
| `v1.x.x/communication/telegram-advanced-bot.json` | Advanced Telegram bot |
| `v1.x.x/automation/email-automation-basic.json` | Email automation workflow |
| `v1.x.x/ai-ml/mcp-agent-orchestrator.json` | MCP agent orchestration |

Each workflow template includes:
- Complete metadata (version, category, difficulty, tags)
- Webhook configuration
- Full node definitions with real parameters
- Usage examples with sample payloads
- Test cases

### Metadata Files

Located in `n8n-workflows-knowledge/metadata/`:
- `categories.json` - Workflow categories (automation, integration, AI/ML, etc.)
- `compatibility.json` - n8n version compatibility info
- `workflows-index.json` - Index of all available workflows

### Usage

When generating workflows, reference:
1. `docs_consolidados.md` for node parameters and operations
2. `workflows/` for complete working examples
3. `metadata/` for categorization and compatibility

## MCP Servers (Model Context Protocol)

This platform integrates **4 superior MCP servers** for n8n workflow generation and management.

### Configured MCP Servers

| MCP Server | Package | Purpose |
|------------|---------|---------|
| **n8n-mcp** | `npx n8n-mcp` | 543 nodos documentados, 99% cobertura |
| **n8n-manager** | `npx @leonardsellem/n8n-mcp-server` | CRUD workflows + ejecución + webhooks |
| **n8n-workflows** | `mcp-remote` via GitMCP | 2,700+ templates de workflows |
| **context7** | `npx @upstash/context7-mcp@latest` | Documentación actualizada de librerías |

### MCP Configuration

**Config file**: `n8n-agent-platform/core/config/mcp-servers.json`

**Environment variables required**:
```env
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your_api_key
MCP_ENABLED=true
MCP_CONFIG_PATH=./config/mcp-servers.json
```

### MCP API Endpoints

```
GET  /api/v1/mcp/servers           - List all MCP servers and status
GET  /api/v1/mcp/servers/:id       - Get specific server status
POST /api/v1/mcp/servers/:id/start - Start a server
POST /api/v1/mcp/servers/:id/stop  - Stop a server
GET  /api/v1/mcp/tools             - List all available tools
GET  /api/v1/mcp/tools/:serverId   - List tools from specific server
POST /api/v1/mcp/tools/call        - Execute a tool
GET  /api/v1/mcp/resources         - List available resources
```

### Using MCP Tools

#### 1. n8n-mcp (czlonkowski) - Node Documentation
```bash
# Query node information
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-mcp",
    "toolName": "get_node_info",
    "arguments": {"nodeName": "HttpRequest"}
  }'
```

**Key tools**:
- `get_node_info` - Get detailed node documentation
- `search_nodes` - Search nodes by functionality
- `get_node_parameters` - Get node parameter schema
- `validate_workflow` - Validate workflow JSON

#### 2. n8n-manager (leonardsellem) - Workflow CRUD
```bash
# List workflows
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-manager",
    "toolName": "list_workflows",
    "arguments": {}
  }'
```

**Key tools**:
- `list_workflows` - List all workflows
- `get_workflow` - Get workflow by ID
- `create_workflow` - Create new workflow
- `update_workflow` - Update existing workflow
- `delete_workflow` - Delete workflow
- `execute_workflow` - Trigger workflow execution
- `get_executions` - Get execution history

#### 3. n8n-workflows (Zie619) - Templates
```bash
# Search workflow templates
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-workflows",
    "toolName": "search_templates",
    "arguments": {"query": "telegram bot"}
  }'
```

**Key tools**:
- `search_templates` - Search workflow templates
- `get_template` - Get template details
- `list_categories` - List template categories

#### 4. context7 (Upstash) - Library Documentation
```bash
# Get library documentation
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "context7",
    "toolName": "resolve_library_id",
    "arguments": {"libraryName": "n8n-workflow"}
  }'
```

**Key tools**:
- `resolve_library_id` - Get library ID for documentation
- `get_library_docs` - Get up-to-date library documentation

### Setup Script

```bash
# Install and configure all MCP servers
./n8n-agent-platform/scripts/setup-mcp-servers.sh
```

### MCP Source Files

| File | Description |
|------|-------------|
| `core/config/mcp-servers.json` | Server configuration |
| `core/src/mcp/types.ts` | TypeScript interfaces |
| `core/src/mcp/MCPClient.ts` | MCP protocol client |
| `core/src/mcp/MCPServerManager.ts` | Multi-server manager |
| `core/src/api/MCPRouter.ts` | REST API endpoints |

### External Resources

- **czlonkowski/n8n-mcp**: https://github.com/czlonkowski/n8n-mcp
- **leonardsellem/n8n-mcp-server**: https://github.com/leonardsellem/n8n-mcp-server
- **Zie619/n8n-workflows**: https://github.com/Zie619/n8n-workflows
- **Upstash Context7**: https://github.com/upstash/context7
- **Hosted Option**: https://dashboard.n8n-mcp.com (100 calls/day free)

---

## Notes for Claude

- This project uses isolated ports (5433 for PostgreSQL, 6380 for Redis) to avoid conflicts with other local services
- The platform supports multiple AI providers (OpenAI, Anthropic)
- WebSocket connections are used for real-time updates
- The marketplace uses end-to-end encryption for templates
- Authentication uses JWT with refresh tokens and optional 2FA
- **Use `documentation/docs_consolidados.md` as the primary reference for n8n node capabilities**
- **Use MCP servers for real-time n8n documentation and workflow management**
