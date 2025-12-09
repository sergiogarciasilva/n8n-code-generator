# n8n-manager Skill - Workflow CRUD Operations (leonardsellem)

Use this skill when you need to manage n8n workflows directly.

## Description

**n8n-manager** by leonardsellem provides complete CRUD operations for n8n workflows:
- List, create, update, delete workflows
- Execute workflows programmatically
- Manage webhooks
- View execution history

## When to Use

Use this skill when the user asks about:
- Creating new workflows in n8n
- Updating existing workflows
- Executing workflows
- Viewing workflow execution history
- Managing workflow state (active/inactive)

## How to Use

### Via Platform API

```bash
# List all workflows
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-manager",
    "toolName": "list_workflows",
    "arguments": {}
  }'

# Get specific workflow
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-manager",
    "toolName": "get_workflow",
    "arguments": {"workflowId": "123"}
  }'

# Create new workflow
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-manager",
    "toolName": "create_workflow",
    "arguments": {
      "name": "My Workflow",
      "nodes": [...],
      "connections": {...}
    }
  }'

# Execute workflow
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-manager",
    "toolName": "execute_workflow",
    "arguments": {
      "workflowId": "123",
      "inputData": {"key": "value"}
    }
  }'
```

### Direct npx Usage

```bash
# Run the MCP server directly
N8N_API_URL=https://your-n8n.com N8N_API_KEY=your_key npx @leonardsellem/n8n-mcp-server
```

## Available Tools

| Tool | Description | Arguments |
|------|-------------|-----------|
| `list_workflows` | List all workflows | `active?: boolean` |
| `get_workflow` | Get workflow by ID | `workflowId: string` |
| `create_workflow` | Create new workflow | `name, nodes, connections` |
| `update_workflow` | Update existing workflow | `workflowId, ...updates` |
| `delete_workflow` | Delete workflow | `workflowId: string` |
| `activate_workflow` | Set workflow active | `workflowId: string` |
| `deactivate_workflow` | Set workflow inactive | `workflowId: string` |
| `execute_workflow` | Trigger execution | `workflowId, inputData?` |
| `get_executions` | Get execution history | `workflowId?, limit?` |
| `get_execution` | Get specific execution | `executionId: string` |

## Example Prompts

- "List all my n8n workflows"
- "Create a new workflow called 'Email Automation'"
- "Execute workflow 123 with this input data"
- "Show me the last 10 executions of workflow 456"
- "Delete workflow 789"
- "Activate workflow 123"

## Configuration

Configured in `n8n-agent-platform/core/config/mcp-servers.json`:

```json
{
  "n8n-manager": {
    "command": "npx",
    "args": ["-y", "@leonardsellem/n8n-mcp-server"],
    "env": {
      "N8N_API_URL": "${N8N_API_URL}",
      "N8N_API_KEY": "${N8N_API_KEY}"
    },
    "description": "CRUD completo de workflows n8n + ejecucion + webhooks",
    "enabled": true,
    "autoStart": true
  }
}
```

## Required Environment Variables

```env
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your_n8n_api_key
```

## Source

- GitHub: https://github.com/leonardsellem/n8n-mcp-server
