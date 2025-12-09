# n8n-mcp Skill - Node Documentation (czlonkowski)

Use this skill when you need comprehensive n8n node documentation.

## Description

**n8n-mcp** by czlonkowski is the BEST MCP server for n8n node documentation:
- 543 nodes documented (99% coverage)
- 2,709 workflow templates
- AI-optimized validation

## When to Use

Use this skill when the user asks about:
- n8n node parameters and configuration
- Available operations for a specific node
- How to configure credentials
- Node input/output schemas
- Validation of workflow JSON

## How to Use

### Via Platform API

```bash
# Get node information
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-mcp",
    "toolName": "get_node_info",
    "arguments": {"nodeName": "HttpRequest"}
  }'

# Search for nodes by functionality
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-mcp",
    "toolName": "search_nodes",
    "arguments": {"query": "send email"}
  }'

# Validate a workflow
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "n8n-mcp",
    "toolName": "validate_workflow",
    "arguments": {"workflow": {...}}
  }'
```

### Direct npx Usage

```bash
# Run the MCP server directly
npx n8n-mcp
```

## Available Tools

| Tool | Description | Arguments |
|------|-------------|-----------|
| `get_node_info` | Get complete node documentation | `nodeName: string` |
| `search_nodes` | Search nodes by functionality | `query: string` |
| `get_node_parameters` | Get parameter schema | `nodeName: string` |
| `validate_workflow` | Validate workflow JSON | `workflow: object` |
| `get_all_nodes` | List all available nodes | none |
| `get_node_credentials` | Get credential requirements | `nodeName: string` |

## Example Prompts

- "What parameters does the HttpRequest node have?"
- "How do I configure Gmail node credentials?"
- "Search for nodes that can send Telegram messages"
- "Validate this workflow JSON"
- "What operations are available for the PostgreSQL node?"

## Configuration

Configured in `n8n-agent-platform/core/config/mcp-servers.json`:

```json
{
  "n8n-mcp": {
    "command": "npx",
    "args": ["-y", "n8n-mcp"],
    "env": {
      "MCP_MODE": "stdio",
      "LOG_LEVEL": "error",
      "DISABLE_CONSOLE_OUTPUT": "true",
      "N8N_API_URL": "${N8N_API_URL}",
      "N8N_API_KEY": "${N8N_API_KEY}"
    },
    "description": "czlonkowski/n8n-mcp - 543 nodos n8n documentados, 99% cobertura",
    "enabled": true,
    "autoStart": true
  }
}
```

## Source

- GitHub: https://github.com/czlonkowski/n8n-mcp
- Hosted: https://dashboard.n8n-mcp.com (100 calls/day free)
