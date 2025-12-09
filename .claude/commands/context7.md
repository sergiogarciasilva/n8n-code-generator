# context7 Skill - Library Documentation (Upstash)

Use this skill when you need up-to-date library documentation.

## Description

**context7** by Upstash provides access to current documentation for any npm/library:
- Real-time, up-to-date documentation
- Works with any npm package
- Semantic search within docs
- No outdated training data issues

## When to Use

Use this skill when the user asks about:
- Current library API documentation
- Latest version features
- Package usage examples
- Function signatures and parameters
- Library-specific best practices

## How to Use

### Via Platform API

```bash
# Step 1: Resolve library ID
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "context7",
    "toolName": "resolve_library_id",
    "arguments": {"libraryName": "n8n-workflow"}
  }'

# Step 2: Get documentation
curl -X POST http://localhost:3456/api/v1/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "context7",
    "toolName": "get_library_docs",
    "arguments": {
      "context7CompatibleLibraryID": "/npm/n8n-workflow",
      "topic": "workflow execution"
    }
  }'
```

### Direct npx Usage

```bash
# Run the MCP server directly
npx @upstash/context7-mcp@latest
```

## Available Tools

| Tool | Description | Arguments |
|------|-------------|-----------|
| `resolve_library_id` | Convert library name to Context7 ID | `libraryName: string` |
| `get_library_docs` | Get documentation for topic | `context7CompatibleLibraryID, topic` |

## Two-Step Process

Context7 requires a two-step process:

1. **Resolve Library ID**: Convert human-readable name to Context7 format
   - Input: `"express"` or `"react"`
   - Output: `"/npm/express"` or `"/npm/react"`

2. **Get Documentation**: Query specific topics within the library docs
   - Input: Library ID + topic query
   - Output: Relevant documentation sections

## Example Prompts

- "What's the current API for the n8n-workflow package?"
- "Get me the latest Express.js middleware documentation"
- "How do I use the axios interceptors?"
- "Show me React hooks documentation"
- "What are the TypeScript compiler options?"

## Configuration

Configured in `n8n-agent-platform/core/config/mcp-servers.json`:

```json
{
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp@latest"],
    "env": {},
    "description": "Documentacion actualizada de librerias (Upstash Context7)",
    "enabled": true,
    "autoStart": true
  }
}
```

## Why Use Context7?

| Problem | Context7 Solution |
|---------|-------------------|
| AI training data is outdated | Fetches current docs in real-time |
| Hallucinated API methods | Returns actual documented APIs |
| Missing new features | Always has latest version info |
| Incorrect code examples | Examples from official docs |

## Supported Libraries

Context7 supports documentation for:
- All npm packages
- Major frameworks (React, Vue, Angular, etc.)
- Backend libraries (Express, Fastify, etc.)
- Database clients (Prisma, TypeORM, etc.)
- n8n packages and nodes
- And many more...

## Integration with Other Skills

Use context7 together with other skills:

```bash
# 1. Get n8n-workflow documentation
context7 -> get_library_docs("/npm/n8n-workflow", "INode interface")

# 2. Find relevant nodes
n8n-mcp -> search_nodes("HTTP Request")

# 3. Get template example
n8n-workflows -> search_templates("HTTP automation")

# 4. Deploy to n8n
n8n-manager -> create_workflow({...})
```

## Source

- GitHub: https://github.com/upstash/context7
- npm: @upstash/context7-mcp
