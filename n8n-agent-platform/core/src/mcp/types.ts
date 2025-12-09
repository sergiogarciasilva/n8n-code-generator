/**
 * MCP Server Types and Interfaces
 * Model Context Protocol integration for n8n-agent-platform
 */

export interface MCPServerConfig {
    command: string;
    args: string[];
    env: Record<string, string>;
    description?: string;
    url?: string;
    enabled: boolean;
    autoStart?: boolean;
    healthCheck?: {
        enabled: boolean;
        intervalMs: number;
    };
}

export interface MCPServersConfig {
    mcpServers: Record<string, MCPServerConfig>;
    settings: MCPSettings;
}

export interface MCPSettings {
    connectionTimeout: number;
    requestTimeout: number;
    maxRetries: number;
    retryDelayMs: number;
    logLevel: string;
}

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
}

export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

export interface MCPPrompt {
    name: string;
    description?: string;
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}

export interface MCPServerCapabilities {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    logging?: boolean;
}

export interface MCPServerStatus {
    serverId: string;
    name: string;
    status: 'connected' | 'disconnected' | 'error' | 'starting' | 'stopping';
    capabilities: MCPServerCapabilities;
    tools: MCPTool[];
    resources: MCPResource[];
    prompts: MCPPrompt[];
    lastHealthCheck?: Date;
    error?: string;
    pid?: number;
    uptime?: number;
}

export interface MCPToolCallRequest {
    serverId: string;
    toolName: string;
    arguments: Record<string, any>;
}

export interface MCPToolCallResult {
    success: boolean;
    content: any;
    isError?: boolean;
    errorMessage?: string;
    executionTime?: number;
}

export interface MCPResourceReadRequest {
    serverId: string;
    uri: string;
}

export interface MCPResourceReadResult {
    success: boolean;
    content: any;
    mimeType?: string;
    error?: string;
}

export interface MCPPromptRequest {
    serverId: string;
    promptName: string;
    arguments?: Record<string, any>;
}

export interface MCPPromptResult {
    success: boolean;
    messages: Array<{
        role: string;
        content: any;
    }>;
    error?: string;
}

export interface MCPMessage {
    jsonrpc: '2.0';
    id?: number | string;
    method?: string;
    params?: any;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

export interface MCPInitializeParams {
    protocolVersion: string;
    capabilities: {
        roots?: { listChanged?: boolean };
        sampling?: {};
    };
    clientInfo: {
        name: string;
        version: string;
    };
}

export interface MCPInitializeResult {
    protocolVersion: string;
    capabilities: MCPServerCapabilities;
    serverInfo: {
        name: string;
        version: string;
    };
}

export type MCPEventType =
    | 'server:connected'
    | 'server:disconnected'
    | 'server:error'
    | 'tool:called'
    | 'tool:result'
    | 'resource:read'
    | 'prompt:executed'
    | 'health:check';

export interface MCPEvent {
    type: MCPEventType;
    serverId: string;
    timestamp: Date;
    data?: any;
}
