# MCP Skills Index - n8n Agent Platform

This directory contains skills for using the 4 superior MCP servers integrated into the n8n Agent Platform.

## Available Skills

| Skill | MCP Server | Purpose | Command |
|-------|------------|---------|---------|
| [n8n-mcp-docs](./n8n-mcp-docs.md) | czlonkowski/n8n-mcp | Node documentation (543 nodes, 99% coverage) | `/n8n-mcp-docs` |
| [n8n-manager](./n8n-manager.md) | leonardsellem/n8n-mcp-server | CRUD workflows + execution | `/n8n-manager` |
| [n8n-workflows](./n8n-workflows.md) | Zie619/n8n-workflows | 2,700+ workflow templates | `/n8n-workflows` |
| [context7](./context7.md) | Upstash/context7 | Up-to-date library documentation | `/context7` |

## Quick Reference

### Need node documentation?
Use **n8n-mcp-docs** to get:
- Complete node parameters and configuration
- Available operations for each node
- Credential requirements
- Workflow validation

### Need to manage workflows?
Use **n8n-manager** to:
- List, create, update, delete workflows
- Execute workflows programmatically
- View execution history
- Activate/deactivate workflows

### Need workflow examples?
Use **n8n-workflows** to:
- Search 2,700+ templates
- Get ready-to-use workflow JSON
- Browse by category
- Find best practices

### Need library docs?
Use **context7** to:
- Get current npm package documentation
- Avoid outdated API information
- Find up-to-date code examples

## Typical Workflow

```
1. User asks: "Create a Telegram bot that sends notifications"

2. Search templates:
   n8n-workflows -> search_templates("telegram bot notification")

3. Get node details:
   n8n-mcp-docs -> get_node_info("Telegram")

4. Check library docs if needed:
   context7 -> get_library_docs("/npm/node-telegram-bot-api", "sendMessage")

5. Create workflow:
   n8n-manager -> create_workflow({...})

6. Execute and test:
   n8n-manager -> execute_workflow(workflowId)
```

## Configuration

All MCP servers are configured in:
`n8n-agent-platform/core/config/mcp-servers.json`

Required environment variables:
```env
N8N_API_URL=https://your-n8n-instance.com
N8N_API_KEY=your_api_key
MCP_ENABLED=true
```

## API Endpoint

All MCP tools are accessible via:
```
POST /api/v1/mcp/tools/call
{
  "serverId": "n8n-mcp|n8n-manager|n8n-workflows|context7",
  "toolName": "tool_name",
  "arguments": {...}
}
```

## External Resources

- [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp) - Best node documentation
- [leonardsellem/n8n-mcp-server](https://github.com/leonardsellem/n8n-mcp-server) - Workflow CRUD
- [Zie619/n8n-workflows](https://github.com/Zie619/n8n-workflows) - Templates collection
- [Upstash/context7](https://github.com/upstash/context7) - Live library docs
- [n8n-mcp Dashboard](https://dashboard.n8n-mcp.com) - Hosted option (100 free calls/day)