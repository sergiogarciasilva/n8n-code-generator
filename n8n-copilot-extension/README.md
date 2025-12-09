# n8n Copilot - VS Code Extension

GitHub Copilot for n8n workflows - AI-powered suggestions, validation, and execution for n8n workflow development.

## Features

### 🤖 AI-Powered Workflow Generation
- Generate complete workflows from natural language descriptions
- Intelligent node suggestions while you type
- Context-aware parameter completion
- Optimized for MCPs, Telegram bots, and agent systems

### ✅ Real-time Validation
- Syntax validation for workflow JSON
- Semantic validation for node connections
- Performance warnings for large workflows
- Credential validation

### 🚀 Workflow Execution
- Execute workflows directly from VS Code
- Local execution with mock data
- Integration with n8n Cloud v1.98
- Step-by-step debugging

### 📊 Visual Dashboard
- Workflow execution metrics
- Performance monitoring
- Template library with 50+ templates
- Visual workflow editor

### 🔧 Advanced Features
- MCP (Model Context Protocol) support
- Telegram bot workflow templates
- Multi-agent system orchestration
- PostgreSQL-backed template database

## Requirements

- VS Code 1.85.0 or higher
- n8n Cloud account (v1.98)
- PostgreSQL (for local template database)
- Node.js 16 or higher

## Installation

1. Install from VS Code Marketplace (search for "n8n Copilot")
2. Configure your n8n Cloud API key
3. (Optional) Set up local PostgreSQL database

## Quick Start

1. **Create a new workflow:**
   - Press `Cmd/Ctrl + Shift + P`
   - Run "n8n: Create Workflow from Description"
   - Describe your workflow in natural language

2. **Validate workflow:**
   - Open any `.n8n.json` file
   - Validation runs automatically
   - Check Problems panel for issues

3. **Execute workflow:**
   - Press `Cmd/Ctrl + Shift + P`
   - Run "n8n: Execute Workflow"
   - View results in the sidebar

## Configuration

Configure the extension in VS Code settings:

```json
{
  "n8n.cloudApiUrl": "https://app.n8n.cloud/api/v1/",
  "n8n.apiKey": "your-api-key",
  "n8n.openaiApiKey": "your-openai-key",
  "n8n.localServerPort": 3456
}
```

## Database Setup

For full functionality with template database:

```bash
# Install PostgreSQL
# Create database
createdb n8n_copilot

# Run migrations
npm run db:migrate

# Seed templates
npm run db:seed
```

## Commands

- `n8n: Create Workflow from Description` - Generate workflow from text
- `n8n: Validate Current Workflow` - Check workflow for errors
- `n8n: Execute Workflow` - Run the current workflow
- `n8n: Open Visual Editor` - Open graphical workflow editor
- `n8n: Generate Tests` - Create test suite for workflow

## Development

```bash
# Install dependencies
npm install

# Compile extension
npm run compile

# Run tests
npm test

# Package extension
vsce package
```

## Architecture

- **Extension Core**: TypeScript, VS Code API
- **AI Engine**: OpenAI GPT-4 with local fallback
- **Validation**: Zod schemas, custom validators
- **Database**: PostgreSQL for templates, MongoDB for backups
- **Server**: Express.js for local execution
- **UI**: React + TypeScript + Tailwind CSS

## Performance

- Workflow validation: <500ms for 30 nodes
- AI suggestions: <5s response time
- Local execution: Supports workflows up to 50 nodes
- Memory usage: <200MB steady state

## Support

- GitHub Issues: [Report bugs](https://github.com/n8n-copilot/issues)
- Documentation: [Full docs](https://n8n-copilot.dev)
- Discord: [Join community](https://discord.gg/n8n-copilot)

## License

MIT License - See LICENSE file for details