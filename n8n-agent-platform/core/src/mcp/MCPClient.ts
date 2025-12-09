/**
 * MCP Client - Handles communication with individual MCP servers
 * Implements JSON-RPC 2.0 protocol over stdio
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import {
    MCPServerConfig,
    MCPSettings,
    MCPMessage,
    MCPTool,
    MCPResource,
    MCPPrompt,
    MCPServerCapabilities,
    MCPInitializeResult,
    MCPToolCallResult,
    MCPResourceReadResult,
    MCPPromptResult
} from './types';

export class MCPClient extends EventEmitter {
    private process: ChildProcess | null = null;
    private messageId: number = 0;
    private pendingRequests: Map<number, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }> = new Map();
    private buffer: string = '';
    private isConnected: boolean = false;
    private capabilities: MCPServerCapabilities = {};
    private tools: MCPTool[] = [];
    private resources: MCPResource[] = [];
    private prompts: MCPPrompt[] = [];
    private serverInfo: { name: string; version: string } | null = null;

    constructor(
        private serverId: string,
        private config: MCPServerConfig,
        private settings: MCPSettings
    ) {
        super();
    }

    async connect(): Promise<void> {
        if (this.isConnected) {
            logger.warn(`MCPClient[${this.serverId}] already connected`);
            return;
        }

        logger.info(`MCPClient[${this.serverId}] connecting...`);

        try {
            // Resolve environment variables
            const env = this.resolveEnvVariables(this.config.env);

            // Spawn the MCP server process
            this.process = spawn(this.config.command, this.config.args, {
                env: { ...process.env, ...env },
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: process.platform === 'win32'
            });

            // Setup event handlers
            this.setupProcessHandlers();

            // Wait for process to be ready
            await this.waitForReady();

            // Initialize MCP protocol
            await this.initialize();

            // Discover capabilities
            await this.discoverCapabilities();

            this.isConnected = true;
            this.emit('connected', { serverId: this.serverId });
            logger.info(`MCPClient[${this.serverId}] connected successfully`);

        } catch (error: any) {
            logger.error(`MCPClient[${this.serverId}] connection failed:`, error);
            await this.disconnect();
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (!this.process) return;

        logger.info(`MCPClient[${this.serverId}] disconnecting...`);

        // Clear pending requests
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Client disconnecting'));
        }
        this.pendingRequests.clear();

        // Kill process
        if (this.process && !this.process.killed) {
            this.process.kill('SIGTERM');

            // Force kill after timeout
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 5000);
        }

        this.process = null;
        this.isConnected = false;
        this.buffer = '';
        this.emit('disconnected', { serverId: this.serverId });
    }

    async callTool(toolName: string, args: Record<string, any>): Promise<MCPToolCallResult> {
        if (!this.isConnected) {
            throw new Error(`MCPClient[${this.serverId}] not connected`);
        }

        const startTime = Date.now();

        try {
            const result = await this.sendRequest('tools/call', {
                name: toolName,
                arguments: args
            });

            return {
                success: true,
                content: result.content,
                isError: result.isError || false,
                executionTime: Date.now() - startTime
            };
        } catch (error: any) {
            return {
                success: false,
                content: null,
                isError: true,
                errorMessage: error.message,
                executionTime: Date.now() - startTime
            };
        }
    }

    async readResource(uri: string): Promise<MCPResourceReadResult> {
        if (!this.isConnected) {
            throw new Error(`MCPClient[${this.serverId}] not connected`);
        }

        try {
            const result = await this.sendRequest('resources/read', { uri });

            return {
                success: true,
                content: result.contents?.[0]?.text || result.contents?.[0]?.blob,
                mimeType: result.contents?.[0]?.mimeType
            };
        } catch (error: any) {
            return {
                success: false,
                content: null,
                error: error.message
            };
        }
    }

    async executePrompt(promptName: string, args?: Record<string, any>): Promise<MCPPromptResult> {
        if (!this.isConnected) {
            throw new Error(`MCPClient[${this.serverId}] not connected`);
        }

        try {
            const result = await this.sendRequest('prompts/get', {
                name: promptName,
                arguments: args
            });

            return {
                success: true,
                messages: result.messages || []
            };
        } catch (error: any) {
            return {
                success: false,
                messages: [],
                error: error.message
            };
        }
    }

    getTools(): MCPTool[] {
        return this.tools;
    }

    getResources(): MCPResource[] {
        return this.resources;
    }

    getPrompts(): MCPPrompt[] {
        return this.prompts;
    }

    getCapabilities(): MCPServerCapabilities {
        return this.capabilities;
    }

    getServerInfo(): { name: string; version: string } | null {
        return this.serverInfo;
    }

    isActive(): boolean {
        return this.isConnected && this.process !== null && !this.process.killed;
    }

    getPid(): number | undefined {
        return this.process?.pid;
    }

    private setupProcessHandlers(): void {
        if (!this.process) return;

        // Handle stdout (JSON-RPC messages)
        this.process.stdout?.on('data', (data: Buffer) => {
            this.handleData(data.toString());
        });

        // Handle stderr (logs/errors)
        this.process.stderr?.on('data', (data: Buffer) => {
            const message = data.toString().trim();
            if (message) {
                logger.debug(`MCPClient[${this.serverId}] stderr: ${message}`);
            }
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
            logger.info(`MCPClient[${this.serverId}] process exited with code ${code}, signal ${signal}`);
            this.isConnected = false;
            this.emit('exit', { serverId: this.serverId, code, signal });
        });

        // Handle process error
        this.process.on('error', (error) => {
            logger.error(`MCPClient[${this.serverId}] process error:`, error);
            this.emit('error', { serverId: this.serverId, error });
        });
    }

    private handleData(data: string): void {
        this.buffer += data;

        // Process complete messages (newline delimited JSON)
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line) as MCPMessage;
                    this.handleMessage(message);
                } catch (error) {
                    logger.debug(`MCPClient[${this.serverId}] failed to parse message: ${line}`);
                }
            }
        }
    }

    private handleMessage(message: MCPMessage): void {
        // Handle response to a request
        if (message.id !== undefined) {
            const pending = this.pendingRequests.get(message.id as number);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(message.id as number);

                if (message.error) {
                    pending.reject(new Error(message.error.message));
                } else {
                    pending.resolve(message.result);
                }
            }
        }

        // Handle notifications (no id)
        if (message.method && message.id === undefined) {
            this.handleNotification(message.method, message.params);
        }
    }

    private handleNotification(method: string, params: any): void {
        switch (method) {
            case 'notifications/tools/list_changed':
                this.refreshTools().catch(e =>
                    logger.error(`MCPClient[${this.serverId}] failed to refresh tools:`, e)
                );
                break;
            case 'notifications/resources/list_changed':
                this.refreshResources().catch(e =>
                    logger.error(`MCPClient[${this.serverId}] failed to refresh resources:`, e)
                );
                break;
            case 'notifications/prompts/list_changed':
                this.refreshPrompts().catch(e =>
                    logger.error(`MCPClient[${this.serverId}] failed to refresh prompts:`, e)
                );
                break;
            default:
                logger.debug(`MCPClient[${this.serverId}] received notification: ${method}`);
        }

        this.emit('notification', { serverId: this.serverId, method, params });
    }

    private async sendRequest(method: string, params?: any): Promise<any> {
        if (!this.process?.stdin) {
            throw new Error('Process stdin not available');
        }

        const id = ++this.messageId;
        const message: MCPMessage = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, this.settings.requestTimeout);

            this.pendingRequests.set(id, { resolve, reject, timeout });

            const data = JSON.stringify(message) + '\n';
            this.process!.stdin!.write(data);
        });
    }

    private async initialize(): Promise<void> {
        const result: MCPInitializeResult = await this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {
                roots: { listChanged: true },
                sampling: {}
            },
            clientInfo: {
                name: 'n8n-agent-platform',
                version: '1.0.0'
            }
        });

        this.capabilities = result.capabilities || {};
        this.serverInfo = result.serverInfo;

        // Send initialized notification
        this.sendNotification('notifications/initialized');
    }

    private sendNotification(method: string, params?: any): void {
        if (!this.process?.stdin) return;

        const message: MCPMessage = {
            jsonrpc: '2.0',
            method,
            params
        };

        const data = JSON.stringify(message) + '\n';
        this.process.stdin.write(data);
    }

    private async discoverCapabilities(): Promise<void> {
        const promises: Promise<void>[] = [];

        if (this.capabilities.tools !== false) {
            promises.push(this.refreshTools());
        }
        if (this.capabilities.resources !== false) {
            promises.push(this.refreshResources());
        }
        if (this.capabilities.prompts !== false) {
            promises.push(this.refreshPrompts());
        }

        await Promise.allSettled(promises);
    }

    private async refreshTools(): Promise<void> {
        try {
            const result = await this.sendRequest('tools/list');
            this.tools = result.tools || [];
            logger.debug(`MCPClient[${this.serverId}] discovered ${this.tools.length} tools`);
        } catch (error) {
            this.tools = [];
        }
    }

    private async refreshResources(): Promise<void> {
        try {
            const result = await this.sendRequest('resources/list');
            this.resources = result.resources || [];
            logger.debug(`MCPClient[${this.serverId}] discovered ${this.resources.length} resources`);
        } catch (error) {
            this.resources = [];
        }
    }

    private async refreshPrompts(): Promise<void> {
        try {
            const result = await this.sendRequest('prompts/list');
            this.prompts = result.prompts || [];
            logger.debug(`MCPClient[${this.serverId}] discovered ${this.prompts.length} prompts`);
        } catch (error) {
            this.prompts = [];
        }
    }

    private waitForReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Process startup timeout'));
            }, this.settings.connectionTimeout);

            // Wait a short time for process to start
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    clearTimeout(timeout);
                    resolve();
                } else {
                    clearTimeout(timeout);
                    reject(new Error('Process failed to start'));
                }
            }, 500);
        });
    }

    private resolveEnvVariables(env: Record<string, string>): Record<string, string> {
        const resolved: Record<string, string> = {};

        for (const [key, value] of Object.entries(env)) {
            // Replace ${VAR} patterns with actual environment variable values
            resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => {
                return process.env[varName] || '';
            });
        }

        return resolved;
    }
}
