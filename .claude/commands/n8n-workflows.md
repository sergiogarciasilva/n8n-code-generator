# n8n-workflows Skill - Workflow Templates (Zie619)

Use this skill when you need workflow templates and examples.

## Description

**n8n-workflows** by Zie619 provides access to 2,700+ workflow templates:
- Ready-to-use workflow templates
- Categorized by use case
- Complete with all node configurations
- Via GitMCP remote access

## When to Use

Use this skill when the user asks about:
- Workflow examples and templates
- How to build specific automations
- Starting points for common use cases
- Best practices for workflow design

## How to Use

### Via Platform API

```bash
# Search for templates
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-workflows",
    "toolName": "search_templates",
    "arguments": {"query": "telegram bot"}
  }'

# Get template details
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-workflows",
    "toolName": "get_template",
    "arguments": {"templateId": "telegram-notify"}
  }'

# List all categories
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-workflows",
    "toolName": "list_categories",
    "arguments": {}
  }'
```

### Direct npx Usage

```bash
# Connect via mcp-remote
npx mcp-remote https://gitmcp.io/Zie619/n8n-workflows
```

## Available Tools

| Tool | Description | Arguments |
|------|-------------|-----------|
| `search_templates` | Search workflow templates | `query: string` |
| `get_template` | Get template by ID/name | `templateId: string` |
| `list_categories` | List template categories | none |
| `list_templates` | List templates in category | `category?: string` |
| `fetch_file` | Get raw workflow JSON | `path: string` |

## Template Categories

- **Automation** - General automation workflows
- **AI/ML** - AI and machine learning integrations
- **Communication** - Email, Slack, Telegram, etc.
- **Data** - Data processing and ETL
- **DevOps** - CI/CD and deployment
- **Social Media** - Social platform integrations
- **E-commerce** - Store and order management
- **Finance** - Payment and accounting
- **CRM** - Customer relationship management

## Example Prompts

- "Find me a Telegram bot workflow template"
- "Show me templates for email automation"
- "Get the Slack notification workflow template"
- "List all AI workflow templates"
- "I need a template for syncing Google Sheets to PostgreSQL"

## Configuration

Configured in `n8n-agent-platform/core/config/mcp-servers.json`:

```json
{
  "n8n-workflows": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://gitmcp.io/Zie619/n8n-workflows"],
    "env": {},
    "description": "2,700+ templates de workflows n8n via GitMCP",
    "enabled": true,
    "autoStart": true
  }
}
```

## Using Templates

1. Search for a template matching your use case
2. Get the template JSON
3. Customize nodes and credentials
4. Deploy to n8n using n8n-manager

```bash
# Example workflow: Search -> Get -> Deploy
# 1. Search
curl -X POST .../mcp/tools/call -d '{"serverId":"n8n-workflows","toolName":"search_templates","arguments":{"query":"slack"}}'

# 2. Get template
curl -X POST .../mcp/tools/call -d '{"serverId":"n8n-workflows","toolName":"get_template","arguments":{"templateId":"slack-notify"}}'

# 3. Deploy to n8n
curl -X POST .../mcp/tools/call -d '{"serverId":"n8n-manager","toolName":"create_workflow","arguments":{...template...}}'
```

## Source

- GitHub: https://github.com/Zie619/n8n-workflows
- Access via: https://gitmcp.io/Zie619/n8n-workflows
