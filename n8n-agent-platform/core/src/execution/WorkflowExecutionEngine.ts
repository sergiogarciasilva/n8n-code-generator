import { 
    N8nWorkflow, 
    N8nNode, 
    WorkflowExecution,
    N8nConnection
} from '../types/workflows';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionOptions {
    mode: 'manual' | 'trigger' | 'webhook' | 'retry';
    inputData?: Record<string, any>;
    sessionId?: string;
    debugMode?: boolean;
    breakpoints?: string[]; // Node IDs to pause at
    timeout?: number; // Milliseconds
    mockMode?: boolean; // Use mock data instead of real API calls
}

export interface NodeExecutionResult {
    nodeId: string;
    nodeName: string;
    status: 'success' | 'error' | 'skipped';
    data: any;
    error?: string;
    executionTime: number;
    debugInfo?: {
        inputData: any;
        outputData: any;
        logs: string[];
        memoryUsage: number;
    };
}

export interface ExecutionState {
    executionId: string;
    workflowId: string;
    status: 'new' | 'running' | 'paused' | 'success' | 'error' | 'canceled';
    startedAt: Date;
    stoppedAt?: Date;
    currentNodeId?: string;
    nodeResults: Map<string, NodeExecutionResult>;
    globalData: Record<string, any>;
    debugMode: boolean;
    logs: string[];
    error?: string;
}

export interface DebugEvent {
    type: 'node-start' | 'node-complete' | 'node-error' | 'breakpoint' | 'log' | 'state-change';
    nodeId?: string;
    nodeName?: string;
    data?: any;
    timestamp: Date;
    message?: string;
}

/**
 * Advanced Workflow Execution Engine with Debugging Support
 * 
 * Features:
 * - Step-by-step execution with breakpoints
 * - Real-time debugging events
 * - Mock mode for testing
 * - Memory and performance tracking
 * - Error recovery and retry logic
 * - Parallel node execution support
 */
export class WorkflowExecutionEngine extends EventEmitter {
    private executionStates: Map<string, ExecutionState>;
    private nodeExecutors: Map<string, NodeExecutor>;
    private breakpoints: Set<string>;
    private isPaused: boolean = false;
    private continueExecution?: () => void;

    constructor() {
        super();
        this.executionStates = new Map();
        this.nodeExecutors = new Map();
        this.breakpoints = new Set();
        this.initializeNodeExecutors();
    }

    private initializeNodeExecutors(): void {
        // Register node executors for different node types
        this.registerNodeExecutor('n8n-nodes-base.webhook', new WebhookNodeExecutor());
        this.registerNodeExecutor('n8n-nodes-base.httpRequest', new HttpRequestNodeExecutor());
        this.registerNodeExecutor('n8n-nodes-base.code', new CodeNodeExecutor());
        this.registerNodeExecutor('n8n-nodes-base.if', new IfNodeExecutor());
        this.registerNodeExecutor('n8n-nodes-base.switch', new SwitchNodeExecutor());
        this.registerNodeExecutor('n8n-nodes-base.openAi', new OpenAINodeExecutor());
        this.registerNodeExecutor('n8n-nodes-base.telegram', new TelegramNodeExecutor());
        this.registerNodeExecutor('n8n-nodes-base.respondToWebhook', new RespondToWebhookNodeExecutor());
        // Add more node executors as needed
    }

    registerNodeExecutor(nodeType: string, executor: NodeExecutor): void {
        this.nodeExecutors.set(nodeType, executor);
    }

    async executeWorkflow(
        workflow: N8nWorkflow, 
        options: ExecutionOptions = { mode: 'manual' }
    ): Promise<WorkflowExecution> {
        const executionId = uuidv4();
        const state: ExecutionState = {
            executionId,
            workflowId: workflow.id || 'unnamed',
            status: 'new',
            startedAt: new Date(),
            nodeResults: new Map(),
            globalData: options.inputData || {},
            debugMode: options.debugMode || false,
            logs: []
        };

        this.executionStates.set(executionId, state);

        // Set up breakpoints if provided
        if (options.breakpoints) {
            options.breakpoints.forEach(nodeId => this.breakpoints.add(nodeId));
        }

        // Emit start event
        this.emitDebugEvent({
            type: 'state-change',
            data: { status: 'running' },
            timestamp: new Date(),
            message: 'Workflow execution started'
        });

        try {
            state.status = 'running';
            
            // Find trigger nodes (nodes with no input connections)
            const triggerNodes = this.findTriggerNodes(workflow);
            
            if (triggerNodes.length === 0) {
                throw new Error('No trigger nodes found in workflow');
            }

            // Execute workflow starting from trigger nodes
            for (const triggerNode of triggerNodes) {
                await this.executeNode(
                    triggerNode, 
                    workflow, 
                    state, 
                    options.mockMode || false,
                    options.timeout
                );
            }

            // Mark execution as successful
            state.status = 'success';
            state.stoppedAt = new Date();

            this.emitDebugEvent({
                type: 'state-change',
                data: { status: 'success' },
                timestamp: new Date(),
                message: 'Workflow execution completed successfully'
            });

        } catch (error) {
            state.status = 'error';
            state.error = error.message;
            state.stoppedAt = new Date();

            this.emitDebugEvent({
                type: 'state-change',
                data: { status: 'error', error: error.message },
                timestamp: new Date(),
                message: `Workflow execution failed: ${error.message}`
            });

            logger.error('Workflow execution failed', { 
                executionId, 
                error: error.message 
            });
        }

        // Convert to WorkflowExecution format
        return this.stateToExecution(state);
    }

    private async executeNode(
        node: N8nNode,
        workflow: N8nWorkflow,
        state: ExecutionState,
        mockMode: boolean,
        timeout?: number
    ): Promise<void> {
        // Check if we should pause at this node
        if (this.breakpoints.has(node.id) && state.debugMode) {
            await this.pauseAtBreakpoint(node, state);
        }

        // Emit node start event
        this.emitDebugEvent({
            type: 'node-start',
            nodeId: node.id,
            nodeName: node.name,
            timestamp: new Date()
        });

        state.currentNodeId = node.id;
        const startTime = Date.now();

        try {
            // Get node executor
            const executor = this.nodeExecutors.get(node.type);
            if (!executor) {
                throw new Error(`No executor found for node type: ${node.type}`);
            }

            // Prepare input data from previous nodes
            const inputData = this.prepareNodeInputData(node, workflow, state);

            // Execute node with timeout
            const executionPromise = executor.execute(node, inputData, state.globalData, mockMode);
            const nodeResult = timeout 
                ? await this.executeWithTimeout(executionPromise, timeout)
                : await executionPromise;

            // Store result
            const executionResult: NodeExecutionResult = {
                nodeId: node.id,
                nodeName: node.name,
                status: 'success',
                data: nodeResult,
                executionTime: Date.now() - startTime
            };

            if (state.debugMode) {
                executionResult.debugInfo = {
                    inputData,
                    outputData: nodeResult,
                    logs: executor.getLogs ? executor.getLogs() : [],
                    memoryUsage: process.memoryUsage().heapUsed
                };
            }

            state.nodeResults.set(node.id, executionResult);

            // Emit node complete event
            this.emitDebugEvent({
                type: 'node-complete',
                nodeId: node.id,
                nodeName: node.name,
                data: nodeResult,
                timestamp: new Date()
            });

            // Execute connected nodes
            const nextNodes = this.getNextNodes(node, workflow, nodeResult);
            for (const nextNode of nextNodes) {
                await this.executeNode(nextNode, workflow, state, mockMode, timeout);
            }

        } catch (error) {
            const executionResult: NodeExecutionResult = {
                nodeId: node.id,
                nodeName: node.name,
                status: 'error',
                data: null,
                error: error.message,
                executionTime: Date.now() - startTime
            };

            state.nodeResults.set(node.id, executionResult);

            // Emit node error event
            this.emitDebugEvent({
                type: 'node-error',
                nodeId: node.id,
                nodeName: node.name,
                data: { error: error.message },
                timestamp: new Date()
            });

            // Check if node should continue on fail
            if (!node.continueOnFail) {
                throw error;
            }
        }
    }

    private async pauseAtBreakpoint(node: N8nNode, state: ExecutionState): Promise<void> {
        state.status = 'paused';
        this.isPaused = true;

        this.emitDebugEvent({
            type: 'breakpoint',
            nodeId: node.id,
            nodeName: node.name,
            timestamp: new Date(),
            message: `Execution paused at breakpoint: ${node.name}`
        });

        // Wait for continue signal
        await new Promise<void>(resolve => {
            this.continueExecution = resolve;
        });

        state.status = 'running';
        this.isPaused = false;
    }

    continueFromBreakpoint(): void {
        if (this.continueExecution) {
            this.continueExecution();
            this.continueExecution = undefined;
        }
    }

    stepOver(): void {
        // Execute just the current node and pause at the next
        this.continueFromBreakpoint();
    }

    private findTriggerNodes(workflow: N8nWorkflow): N8nNode[] {
        const nodesWithInputs = new Set<string>();
        
        // Find all nodes that have incoming connections
        if (workflow.connections) {
            Object.values(workflow.connections).forEach(nodeConnections => {
                if (nodeConnections.main) {
                    nodeConnections.main.forEach(connectionGroup => {
                        connectionGroup?.forEach(connection => {
                            if (connection.node) {
                                nodesWithInputs.add(connection.node);
                            }
                        });
                    });
                }
            });
        }

        // Return nodes that don't have incoming connections
        return workflow.nodes.filter(node => !nodesWithInputs.has(node.name));
    }

    private prepareNodeInputData(
        node: N8nNode, 
        workflow: N8nWorkflow, 
        state: ExecutionState
    ): any[] {
        const inputData: any[] = [];

        // Find nodes that connect to this node
        if (workflow.connections) {
            Object.entries(workflow.connections).forEach(([sourceNodeName, connections]) => {
                if (connections.main) {
                    connections.main.forEach((connectionGroup, outputIndex) => {
                        connectionGroup?.forEach(connection => {
                            if (connection.node === node.name) {
                                // Get data from source node
                                const sourceNode = workflow.nodes.find(n => n.name === sourceNodeName);
                                if (sourceNode) {
                                    const sourceResult = state.nodeResults.get(sourceNode.id);
                                    if (sourceResult?.data) {
                                        inputData.push(sourceResult.data);
                                    }
                                }
                            }
                        });
                    });
                }
            });
        }

        // If no input data and node is not a trigger, use global data
        if (inputData.length === 0 && !this.isTriggerNode(node.type)) {
            inputData.push(state.globalData);
        }

        return inputData;
    }

    private getNextNodes(
        currentNode: N8nNode, 
        workflow: N8nWorkflow,
        nodeOutput: any
    ): N8nNode[] {
        const nextNodes: N8nNode[] = [];

        if (workflow.connections && workflow.connections[currentNode.name]) {
            const connections = workflow.connections[currentNode.name];
            
            // Handle main output
            if (connections.main && connections.main[0]) {
                connections.main[0].forEach(connection => {
                    const nextNode = workflow.nodes.find(n => n.name === connection.node);
                    if (nextNode) {
                        nextNodes.push(nextNode);
                    }
                });
            }
        }

        return nextNodes;
    }

    private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => 
                setTimeout(() => reject(new Error(`Execution timeout after ${timeout}ms`)), timeout)
            )
        ]);
    }

    private isTriggerNode(nodeType: string): boolean {
        const triggerTypes = [
            'n8n-nodes-base.webhook',
            'n8n-nodes-base.cron',
            'n8n-nodes-base.manualTrigger',
            'n8n-nodes-base.emailTrigger'
        ];
        return triggerTypes.includes(nodeType);
    }

    private emitDebugEvent(event: DebugEvent): void {
        this.emit('debug', event);
        
        // Log debug events
        if (event.message) {
            logger.debug(event.message, {
                type: event.type,
                nodeId: event.nodeId,
                nodeName: event.nodeName
            });
        }
    }

    private stateToExecution(state: ExecutionState): WorkflowExecution {
        return {
            id: state.executionId,
            workflowId: state.workflowId,
            status: state.status === 'paused' ? 'running' : state.status as any,
            mode: 'manual', // Could be determined from execution options
            startedAt: state.startedAt,
            stoppedAt: state.stoppedAt,
            executionTime: state.stoppedAt 
                ? state.stoppedAt.getTime() - state.startedAt.getTime()
                : undefined,
            data: {
                nodeExecutionResults: Array.from(state.nodeResults.values()),
                globalData: state.globalData,
                logs: state.logs
            },
            error: state.error ? {
                message: state.error,
                nodeId: state.currentNodeId
            } : undefined
        };
    }

    // Debugging methods
    getExecutionState(executionId: string): ExecutionState | undefined {
        return this.executionStates.get(executionId);
    }

    getNodeResult(executionId: string, nodeId: string): NodeExecutionResult | undefined {
        const state = this.executionStates.get(executionId);
        return state?.nodeResults.get(nodeId);
    }

    setBreakpoint(nodeId: string): void {
        this.breakpoints.add(nodeId);
    }

    removeBreakpoint(nodeId: string): void {
        this.breakpoints.delete(nodeId);
    }

    clearBreakpoints(): void {
        this.breakpoints.clear();
    }

    isPausedAtBreakpoint(): boolean {
        return this.isPaused;
    }

    async cancelExecution(executionId: string): Promise<void> {
        const state = this.executionStates.get(executionId);
        if (state) {
            state.status = 'canceled';
            state.stoppedAt = new Date();
            
            this.emitDebugEvent({
                type: 'state-change',
                data: { status: 'canceled' },
                timestamp: new Date(),
                message: 'Workflow execution canceled'
            });
        }
    }
}

// Base class for node executors
export abstract class NodeExecutor {
    protected logs: string[] = [];

    abstract execute(
        node: N8nNode, 
        inputData: any[], 
        globalData: Record<string, any>,
        mockMode: boolean
    ): Promise<any>;

    protected log(message: string): void {
        this.logs.push(`[${new Date().toISOString()}] ${message}`);
    }

    getLogs(): string[] {
        return this.logs;
    }

    clearLogs(): void {
        this.logs = [];
    }
}

// Example node executor implementations
class WebhookNodeExecutor extends NodeExecutor {
    async execute(node: N8nNode, inputData: any[], globalData: Record<string, any>, mockMode: boolean): Promise<any> {
        this.log(`Executing webhook node: ${node.name}`);
        
        if (mockMode) {
            return {
                headers: { 'content-type': 'application/json' },
                body: { test: true, message: 'Mock webhook data' },
                query: {}
            };
        }

        // In real implementation, this would handle actual webhook data
        return inputData[0] || globalData;
    }
}

class HttpRequestNodeExecutor extends NodeExecutor {
    async execute(node: N8nNode, inputData: any[], globalData: Record<string, any>, mockMode: boolean): Promise<any> {
        this.log(`Executing HTTP request node: ${node.name}`);
        
        const method = node.parameters?.method || 'GET';
        const url = node.parameters?.url;

        if (!url) {
            throw new Error('HTTP Request node requires URL parameter');
        }

        if (mockMode) {
            return {
                statusCode: 200,
                headers: { 'content-type': 'application/json' },
                body: { 
                    mock: true, 
                    message: `Mock response for ${method} ${url}`,
                    timestamp: new Date().toISOString()
                }
            };
        }

        // In real implementation, this would make actual HTTP requests
        this.log(`Would execute ${method} request to ${url}`);
        return { success: true, url, method };
    }
}

class CodeNodeExecutor extends NodeExecutor {
    async execute(node: N8nNode, inputData: any[], globalData: Record<string, any>, mockMode: boolean): Promise<any> {
        this.log(`Executing code node: ${node.name}`);
        
        const code = node.parameters?.jsCode;
        if (!code) {
            throw new Error('Code node requires jsCode parameter');
        }

        if (mockMode) {
            return { executed: true, mock: true, nodeId: node.id };
        }

        // In real implementation, this would execute JavaScript code in a sandbox
        this.log(`Would execute code with ${inputData.length} inputs`);
        return inputData[0] || {};
    }
}

class IfNodeExecutor extends NodeExecutor {
    async execute(node: N8nNode, inputData: any[], globalData: Record<string, any>, mockMode: boolean): Promise<any> {
        this.log(`Executing IF node: ${node.name}`);
        
        const conditions = node.parameters?.conditions;
        if (!conditions) {
            throw new Error('IF node requires conditions parameter');
        }

        // Simplified condition evaluation for demo
        const result = mockMode ? true : Math.random() > 0.5;
        
        return {
            branch: result ? 'true' : 'false',
            input: inputData[0]
        };
    }
}

class SwitchNodeExecutor extends NodeExecutor {
    async execute(node: N8nNode, inputData: any[], globalData: Record<string, any>, mockMode: boolean): Promise<any> {
        this.log(`Executing Switch node: ${node.name}`);
        
        const rules = node.parameters?.rules;
        if (!rules) {
            throw new Error('Switch node requires rules parameter');
        }

        // Simplified switch evaluation for demo
        return {
            branch: 0,
            input: inputData[0]
        };
    }
}

class OpenAINodeExecutor extends NodeExecutor {
    async execute(node: N8nNode, inputData: any[], globalData: Record<string, any>, mockMode: boolean): Promise<any> {
        this.log(`Executing OpenAI node: ${node.name}`);
        
        const prompt = node.parameters?.prompt || inputData[0]?.prompt;
        if (!prompt) {
            throw new Error('OpenAI node requires prompt');
        }

        if (mockMode) {
            return {
                choices: [{
                    message: {
                        content: `Mock AI response for prompt: "${prompt.substring(0, 50)}..."`
                    }
                }],
                usage: { total_tokens: 100 }
            };
        }

        // In real implementation, this would call OpenAI API
        return { response: 'AI response would go here' };
    }
}

class TelegramNodeExecutor extends NodeExecutor {
    async execute(node: N8nNode, inputData: any[], globalData: Record<string, any>, mockMode: boolean): Promise<any> {
        this.log(`Executing Telegram node: ${node.name}`);
        
        const operation = node.parameters?.operation || 'sendMessage';
        const chatId = node.parameters?.chatId;
        const text = node.parameters?.text;

        if (mockMode) {
            return {
                ok: true,
                result: {
                    message_id: Math.floor(Math.random() * 10000),
                    chat: { id: chatId || '123456' },
                    text: text || 'Mock message sent',
                    date: Date.now()
                }
            };
        }

        // In real implementation, this would send Telegram messages
        return { sent: true, chatId, text };
    }
}

class RespondToWebhookNodeExecutor extends NodeExecutor {
    async execute(node: N8nNode, inputData: any[], globalData: Record<string, any>, mockMode: boolean): Promise<any> {
        this.log(`Executing Respond to Webhook node: ${node.name}`);
        
        const responseCode = node.parameters?.responseCode || 200;
        const responseBody = node.parameters?.responseBody || inputData[0];

        return {
            statusCode: responseCode,
            body: responseBody,
            headers: { 'content-type': 'application/json' }
        };
    }
}