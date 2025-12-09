import * as vscode from 'vscode';
import { N8nApiClient, WorkflowExecution } from '../extension/n8nApiClient';

export interface ExecutionResult {
    success: boolean;
    executionId?: string;
    executionTime?: number;
    error?: string;
    data?: any;
    nodeExecutions?: Map<string, NodeExecutionData>;
}

interface NodeExecutionData {
    nodeId: string;
    nodeName: string;
    startTime: number;
    endTime?: number;
    status: 'pending' | 'running' | 'success' | 'error';
    output?: any;
    error?: string;
}

export class WorkflowExecutor {
    private executionHistory: ExecutionResult[] = [];
    private currentExecution: WorkflowExecution | null = null;

    constructor(private apiClient: N8nApiClient) {}

    async execute(
        workflow: any,
        cancellationToken?: vscode.CancellationToken
    ): Promise<ExecutionResult> {
        const startTime = Date.now();
        const result: ExecutionResult = {
            success: false,
            nodeExecutions: new Map()
        };

        try {
            // Create or update workflow in n8n
            let workflowId: string;
            if (workflow.id) {
                await this.apiClient.updateWorkflow(workflow.id, workflow);
                workflowId = workflow.id;
            } else {
                const created = await this.apiClient.createWorkflow(workflow);
                workflowId = created.id;
            }

            // Execute the workflow
            const execution = await this.apiClient.executeWorkflow(workflowId, workflow);
            this.currentExecution = execution;
            result.executionId = execution.id;

            // Monitor execution with cancellation support
            const executionResult = await this.monitorExecution(
                execution.id,
                cancellationToken
            );

            if (executionResult.status === 'success') {
                result.success = true;
                result.data = executionResult.data;
            } else {
                result.error = executionResult.data?.lastNodeExecutionError || 'Execution failed';
            }

            result.executionTime = Date.now() - startTime;
            
            // Add to history
            this.executionHistory.push(result);
            if (this.executionHistory.length > 50) {
                this.executionHistory.shift();
            }

            return result;
        } catch (error: any) {
            result.error = error.message || 'Unknown error occurred';
            result.executionTime = Date.now() - startTime;
            this.executionHistory.push(result);
            return result;
        }
    }

    async executeNode(
        workflow: any,
        nodeId: string,
        inputData?: any
    ): Promise<ExecutionResult> {
        const startTime = Date.now();
        const result: ExecutionResult = {
            success: false,
            nodeExecutions: new Map()
        };

        try {
            // Find the node
            const node = workflow.nodes.find((n: any) => n.id === nodeId);
            if (!node) {
                throw new Error(`Node ${nodeId} not found`);
            }

            // Create a minimal workflow with just this node
            const testWorkflow = {
                name: `Test - ${node.name}`,
                nodes: [
                    {
                        id: 'manual',
                        name: 'Manual Trigger',
                        type: 'n8n-nodes-base.manualTrigger',
                        typeVersion: 1,
                        position: [250, 300]
                    },
                    node
                ],
                connections: {
                    'manual': {
                        'main': [[{ node: nodeId, type: 'main', index: 0 }]]
                    }
                }
            };

            // Execute the test workflow
            const execution = await this.apiClient.executeWorkflow(
                'test',
                testWorkflow,
                'manual'
            );

            const executionResult = await this.monitorExecution(execution.id);
            
            if (executionResult.status === 'success') {
                result.success = true;
                result.data = executionResult.data;
            } else {
                result.error = executionResult.data?.lastNodeExecutionError || 'Node execution failed';
            }

            result.executionTime = Date.now() - startTime;
            return result;
        } catch (error: any) {
            result.error = error.message || 'Unknown error occurred';
            result.executionTime = Date.now() - startTime;
            return result;
        }
    }

    async executeWithMockData(
        workflow: any,
        mockData: any
    ): Promise<ExecutionResult> {
        // Execute workflow with provided mock data
        const modifiedWorkflow = {
            ...workflow,
            nodes: [
                {
                    id: 'mock-data',
                    name: 'Mock Data',
                    type: 'n8n-nodes-base.set',
                    typeVersion: 1,
                    position: [100, 300],
                    parameters: {
                        values: mockData
                    }
                },
                ...workflow.nodes
            ],
            connections: {
                'mock-data': {
                    'main': [[{ 
                        node: workflow.nodes[0]?.id || 'start', 
                        type: 'main', 
                        index: 0 
                    }]]
                },
                ...workflow.connections
            }
        };

        return this.execute(modifiedWorkflow);
    }

    async stopExecution(): Promise<void> {
        if (this.currentExecution && !this.currentExecution.finished) {
            await this.apiClient.stopExecution(this.currentExecution.id);
            this.currentExecution = null;
        }
    }

    getExecutionHistory(): ExecutionResult[] {
        return [...this.executionHistory];
    }

    getLastExecution(): ExecutionResult | null {
        return this.executionHistory[this.executionHistory.length - 1] || null;
    }

    async getExecutionDetails(executionId: string): Promise<WorkflowExecution> {
        return this.apiClient.getExecution(executionId);
    }

    private async monitorExecution(
        executionId: string,
        cancellationToken?: vscode.CancellationToken
    ): Promise<WorkflowExecution> {
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes
        const pollInterval = 1000; // 1 second
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            if (cancellationToken?.isCancellationRequested) {
                await this.apiClient.stopExecution(executionId);
                throw new Error('Execution cancelled by user');
            }

            const execution = await this.apiClient.getExecution(executionId);
            
            if (execution.finished) {
                return execution;
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        // Timeout reached
        await this.apiClient.stopExecution(executionId);
        throw new Error('Execution timeout reached');
    }

    // Local execution methods for development
    async executeLocally(workflow: any): Promise<ExecutionResult> {
        const startTime = Date.now();
        const result: ExecutionResult = {
            success: false,
            nodeExecutions: new Map()
        };

        try {
            // Simulate local execution
            for (const node of workflow.nodes) {
                const nodeExecution: NodeExecutionData = {
                    nodeId: node.id,
                    nodeName: node.name,
                    startTime: Date.now(),
                    status: 'running'
                };

                result.nodeExecutions!.set(node.id, nodeExecution);

                // Simulate node execution
                await this.simulateNodeExecution(node);

                nodeExecution.endTime = Date.now();
                nodeExecution.status = 'success';
                nodeExecution.output = { simulated: true };
            }

            result.success = true;
            result.executionTime = Date.now() - startTime;
            return result;
        } catch (error: any) {
            result.error = error.message;
            result.executionTime = Date.now() - startTime;
            return result;
        }
    }

    private async simulateNodeExecution(node: any): Promise<void> {
        // Simulate execution time based on node type
        const executionTimes: Record<string, number> = {
            'n8n-nodes-base.httpRequest': 500,
            'n8n-nodes-base.code': 100,
            'n8n-nodes-base.postgres': 300,
            'n8n-nodes-base.telegram': 400,
            'default': 50
        };

        const delay = executionTimes[node.type] || executionTimes.default;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}