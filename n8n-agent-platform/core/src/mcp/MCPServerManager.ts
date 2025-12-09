/**
 * MCP Server Manager - Manages multiple MCP server connections
 * Provides unified interface for interacting with all configured MCP servers
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { MCPClient } from './MCPClient';
import {
    MCPServersConfig,
    MCPServerConfig,
    MCPSettings,
    MCPServerStatus,
    MCPToolCallRequest,
    MCPToolCallResult,
    MCPResourceReadRequest,
    MCPResourceReadResult,
    MCPPromptRequest,
    MCPPromptResult,
    MCPTool,
    MCPEvent
} from './types';

export class MCPServerManager extends EventEmitter {
    private clients: Map<string, MCPClient> = new Map();
    private config: MCPServersConfig | null = null;
    private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
    private isInitialized: boolean = false;

    constructor(private configPath?: string) {
        super();
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.warn('MCPServerManager already initialized');
            return;
        }

        logger.info('Initializing MCP Server Manager...');

        try {
            // Load configuration
            await this.loadConfiguration();

            if (!this.config) {
                logger.warn('No MCP configuration found');
                this.isInitialized = true;
                return;
            }

            // Start auto-start servers
            const autoStartServers = Object.entries(this.config.mcpServers)
                .filter(([_, cfg]) => cfg.enabled && cfg.autoStart !== false);

            for (const [serverId, serverConfig] of autoStartServers) {
                try {
                    await this.startServer(serverId);
                } catch (error) {
                    logger.error(`Failed to start MCP server ${serverId}:`, error);
                }
            }

            this.isInitialized = true;
            logger.info(`MCP Server Manager initialized with ${this.clients.size} active servers`);

        } catch (error) {
            logger.error('Failed to initialize MCP Server Manager:', error);
            throw error;
        }
    }

    async shutdown(): Promise<void> {
        logger.info('Shutting down MCP Server Manager...');

        // Clear health check intervals
        for (const interval of this.healthCheckIntervals.values()) {
            clearInterval(interval);
        }
        this.healthCheckIntervals.clear();

        // Disconnect all clients
        const disconnectPromises = Array.from(this.clients.values()).map(client =>
            client.disconnect().catch(e => logger.error('Error disconnecting client:', e))
        );

        await Promise.all(disconnectPromises);
        this.clients.clear();
        this.isInitialized = false;

        logger.info('MCP Server Manager shutdown complete');
    }

    async startServer(serverId: string): Promise<void> {
        if (!this.config) {
            throw new Error('MCP configuration not loaded');
        }

        const serverConfig = this.config.mcpServers[serverId];
        if (!serverConfig) {
            throw new Error(`Server ${serverId} not found in configuration`);
        }

        if (this.clients.has(serverId)) {
            logger.warn(`Server ${serverId} already running`);
            return;
        }

        logger.info(`Starting MCP server: ${serverId}`);

        const client = new MCPClient(serverId, serverConfig, this.config.settings);

        // Setup event forwarding
        this.setupClientEvents(serverId, client);

        // Connect
        await client.connect();

        this.clients.set(serverId, client);

        // Setup health check if enabled
        if (serverConfig.healthCheck?.enabled) {
            this.setupHealthCheck(serverId, serverConfig.healthCheck.intervalMs);
        }

        this.emitEvent('server:connected', serverId, {
            tools: client.getTools().length,
            resources: client.getResources().length,
            prompts: client.getPrompts().length
        });
    }

    async stopServer(serverId: string): Promise<void> {
        const client = this.clients.get(serverId);
        if (!client) {
            logger.warn(`Server ${serverId} not running`);
            return;
        }

        logger.info(`Stopping MCP server: ${serverId}`);

        // Clear health check
        const healthInterval = this.healthCheckIntervals.get(serverId);
        if (healthInterval) {
            clearInterval(healthInterval);
            this.healthCheckIntervals.delete(serverId);
        }

        await client.disconnect();
        this.clients.delete(serverId);

        this.emitEvent('server:disconnected', serverId);
    }

    async restartServer(serverId: string): Promise<void> {
        await this.stopServer(serverId);
        await this.startServer(serverId);
    }

    async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResult> {
        const client = this.clients.get(request.serverId);
        if (!client) {
            return {
                success: false,
                content: null,
                isError: true,
                errorMessage: `Server ${request.serverId} not connected`
            };
        }

        const result = await client.callTool(request.toolName, request.arguments);

        this.emitEvent('tool:called', request.serverId, {
            tool: request.toolName,
            success: result.success,
            executionTime: result.executionTime
        });

        return result;
    }

    async readResource(request: MCPResourceReadRequest): Promise<MCPResourceReadResult> {
        const client = this.clients.get(request.serverId);
        if (!client) {
            return {
                success: false,
                content: null,
                error: `Server ${request.serverId} not connected`
            };
        }

        const result = await client.readResource(request.uri);

        this.emitEvent('resource:read', request.serverId, {
            uri: request.uri,
            success: result.success
        });

        return result;
    }

    async executePrompt(request: MCPPromptRequest): Promise<MCPPromptResult> {
        const client = this.clients.get(request.serverId);
        if (!client) {
            return {
                success: false,
                messages: [],
                error: `Server ${request.serverId} not connected`
            };
        }

        const result = await client.executePrompt(request.promptName, request.arguments);

        this.emitEvent('prompt:executed', request.serverId, {
            prompt: request.promptName,
            success: result.success
        });

        return result;
    }

    getServerStatus(serverId: string): MCPServerStatus | null {
        const client = this.clients.get(serverId);
        const config = this.config?.mcpServers[serverId];

        if (!config) return null;

        if (!client) {
            return {
                serverId,
                name: config.description || serverId,
                status: 'disconnected',
                capabilities: {},
                tools: [],
                resources: [],
                prompts: []
            };
        }

        return {
            serverId,
            name: client.getServerInfo()?.name || config.description || serverId,
            status: client.isActive() ? 'connected' : 'disconnected',
            capabilities: client.getCapabilities(),
            tools: client.getTools(),
            resources: client.getResources(),
            prompts: client.getPrompts(),
            pid: client.getPid()
        };
    }

    getAllServerStatuses(): MCPServerStatus[] {
        if (!this.config) return [];

        return Object.keys(this.config.mcpServers).map(serverId =>
            this.getServerStatus(serverId)!
        );
    }

    getAllTools(): Array<MCPTool & { serverId: string }> {
        const allTools: Array<MCPTool & { serverId: string }> = [];

        for (const [serverId, client] of this.clients) {
            const tools = client.getTools();
            for (const tool of tools) {
                allTools.push({ ...tool, serverId });
            }
        }

        return allTools;
    }

    findTool(toolName: string): { serverId: string; tool: MCPTool } | null {
        for (const [serverId, client] of this.clients) {
            const tool = client.getTools().find(t => t.name === toolName);
            if (tool) {
                return { serverId, tool };
            }
        }
        return null;
    }

    async callToolByName(toolName: string, args: Record<string, any>): Promise<MCPToolCallResult> {
        const found = this.findTool(toolName);
        if (!found) {
            return {
                success: false,
                content: null,
                isError: true,
                errorMessage: `Tool ${toolName} not found in any connected server`
            };
        }

        return this.callTool({
            serverId: found.serverId,
            toolName,
            arguments: args
        });
    }

    getConnectedServers(): string[] {
        return Array.from(this.clients.keys());
    }

    isServerConnected(serverId: string): boolean {
        const client = this.clients.get(serverId);
        return client?.isActive() || false;
    }

    getConfiguration(): MCPServersConfig | null {
        return this.config;
    }

    async reloadConfiguration(): Promise<void> {
        logger.info('Reloading MCP configuration...');

        await this.loadConfiguration();

        // Restart servers that changed
        if (this.config) {
            for (const [serverId, serverConfig] of Object.entries(this.config.mcpServers)) {
                if (serverConfig.enabled && serverConfig.autoStart !== false) {
                    if (this.clients.has(serverId)) {
                        await this.restartServer(serverId);
                    } else {
                        await this.startServer(serverId);
                    }
                }
            }
        }
    }

    private async loadConfiguration(): Promise<void> {
        const configPaths = [
            this.configPath,
            path.join(process.cwd(), 'config', 'mcp-servers.json'),
            path.join(__dirname, '..', '..', 'config', 'mcp-servers.json'),
            process.env.MCP_CONFIG_PATH
        ].filter(Boolean) as string[];

        for (const configPath of configPaths) {
            try {
                if (fs.existsSync(configPath)) {
                    const content = fs.readFileSync(configPath, 'utf-8');
                    this.config = JSON.parse(content);
                    logger.info(`Loaded MCP configuration from: ${configPath}`);
                    return;
                }
            } catch (error) {
                logger.debug(`Failed to load config from ${configPath}:`, error);
            }
        }

        // Create default configuration if none exists
        this.config = this.createDefaultConfig();
        logger.info('Using default MCP configuration');
    }

    private createDefaultConfig(): MCPServersConfig {
        return {
            mcpServers: {},
            settings: {
                connectionTimeout: 30000,
                requestTimeout: 60000,
                maxRetries: 3,
                retryDelayMs: 1000,
                logLevel: 'info'
            }
        };
    }

    private setupClientEvents(serverId: string, client: MCPClient): void {
        client.on('connected', () => {
            logger.info(`MCP server ${serverId} connected`);
        });

        client.on('disconnected', () => {
            logger.info(`MCP server ${serverId} disconnected`);
            this.clients.delete(serverId);
            this.emitEvent('server:disconnected', serverId);
        });

        client.on('error', (data) => {
            logger.error(`MCP server ${serverId} error:`, data.error);
            this.emitEvent('server:error', serverId, { error: data.error.message });
        });

        client.on('exit', (data) => {
            logger.warn(`MCP server ${serverId} exited with code ${data.code}`);
            this.clients.delete(serverId);

            // Auto-restart if enabled
            const config = this.config?.mcpServers[serverId];
            if (config?.autoStart && data.code !== 0) {
                setTimeout(() => {
                    this.startServer(serverId).catch(e =>
                        logger.error(`Failed to restart server ${serverId}:`, e)
                    );
                }, 5000);
            }
        });

        client.on('notification', (data) => {
            this.emit('notification', data);
        });
    }

    private setupHealthCheck(serverId: string, intervalMs: number): void {
        const interval = setInterval(async () => {
            const client = this.clients.get(serverId);
            if (!client) {
                clearInterval(interval);
                this.healthCheckIntervals.delete(serverId);
                return;
            }

            if (!client.isActive()) {
                logger.warn(`Health check failed for ${serverId}: not active`);
                this.emitEvent('health:check', serverId, { healthy: false });

                // Attempt restart
                try {
                    await this.restartServer(serverId);
                } catch (error) {
                    logger.error(`Failed to restart unhealthy server ${serverId}:`, error);
                }
            } else {
                this.emitEvent('health:check', serverId, { healthy: true });
            }
        }, intervalMs);

        this.healthCheckIntervals.set(serverId, interval);
    }

    private emitEvent(type: MCPEvent['type'], serverId: string, data?: any): void {
        const event: MCPEvent = {
            type,
            serverId,
            timestamp: new Date(),
            data
        };
        this.emit(type, event);
        this.emit('event', event);
    }
}

// Singleton instance
let mcpServerManager: MCPServerManager | null = null;

export function getMCPServerManager(): MCPServerManager {
    if (!mcpServerManager) {
        mcpServerManager = new MCPServerManager();
    }
    return mcpServerManager;
}

export function createMCPServerManager(configPath?: string): MCPServerManager {
    mcpServerManager = new MCPServerManager(configPath);
    return mcpServerManager;
}
