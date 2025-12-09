/**
 * MCP Module - Model Context Protocol integration
 *
 * This module provides complete MCP server management for the n8n-agent-platform.
 * It allows connecting to multiple MCP servers and using their tools, resources, and prompts.
 */

export * from './types';
export * from './MCPClient';
export * from './MCPServerManager';

// Re-export commonly used functions
export { getMCPServerManager, createMCPServerManager } from './MCPServerManager';
