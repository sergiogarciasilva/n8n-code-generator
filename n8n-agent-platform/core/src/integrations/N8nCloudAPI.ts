import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { N8nWorkflow, WorkflowExecution } from '../types/workflows';
import { logger } from '../utils/logger';

export interface N8nCredential {
    id: string;
    name: string;
    type: string;
    data: Record<string, any>;
}

export interface N8nExecutionResponse {
    id: string;
    finished: boolean;
    mode: string;
    retryOf?: string;
    retrySuccessId?: string;
    startedAt: string;
    stoppedAt?: string;
    workflowId: string;
    workflowData: any;
    data: any;
}

export interface N8nWorkflowResponse {
    id: string;
    name: string;
    active: boolean;
    nodes: any[];
    connections: any;
    settings: any;
    staticData: any;
    tags: string[];
    versionId: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * N8n Cloud v1.98 API Integration
 * 
 * This class provides integration with n8n Cloud v1.98 API for:
 * - Workflow management (CRUD operations)
 * - Workflow execution
 * - Credential management
 * - Execution monitoring
 */
export class N8nCloudAPI {
    private client: AxiosInstance;
    private baseUrl: string;
    private apiKey: string;

    constructor(apiKey: string, baseUrl: string = 'https://app.n8n.cloud/api/v1') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'n8n-agent-platform/1.0.0'
            },
            timeout: 30000, // 30 second timeout
            validateStatus: (status) => status < 500 // Don't throw on 4xx errors
        });

        // Add response interceptor for logging
        this.client.interceptors.response.use(
            (response) => {
                logger.debug('n8n API response', {
                    method: response.config.method,
                    url: response.config.url,
                    status: response.status
                });
                return response;
            },
            (error) => {
                logger.error('n8n API error', {
                    method: error.config?.method,
                    url: error.config?.url,
                    status: error.response?.status,
                    message: error.message,
                    data: error.response?.data
                });
                return Promise.reject(error);
            }
        );

        logger.info('N8nCloudAPI initialized', { baseUrl: this.baseUrl });
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.client.get('/workflows', {
                params: { limit: 1 }
            });
            return response.status === 200;
        } catch (error) {
            logger.error('n8n health check failed', { error: error.message });
            return false;
        }
    }

    // Workflow Management
    async createWorkflow(workflow: N8nWorkflow): Promise<N8nWorkflowResponse> {
        try {
            const response = await this.client.post('/workflows', {
                name: workflow.name,
                nodes: workflow.nodes,
                connections: workflow.connections,
                active: workflow.active || false,
                settings: workflow.settings || {},
                staticData: workflow.staticData || {},
                tags: workflow.tags || []
            });

            if (response.status !== 201) {
                throw new Error(`Failed to create workflow: ${response.status} ${response.statusText}`);
            }

            logger.info('Workflow created successfully', { 
                workflowId: response.data.id,
                name: workflow.name 
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to create workflow', { 
                error: error.message,
                workflowName: workflow.name 
            });
            throw new Error(`Failed to create workflow: ${error.message}`);
        }
    }

    async updateWorkflow(workflowId: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflowResponse> {
        try {
            const response = await this.client.patch(`/workflows/${workflowId}`, workflow);

            if (response.status !== 200) {
                throw new Error(`Failed to update workflow: ${response.status} ${response.statusText}`);
            }

            logger.info('Workflow updated successfully', { workflowId });
            return response.data;
        } catch (error) {
            logger.error('Failed to update workflow', { 
                error: error.message,
                workflowId 
            });
            throw new Error(`Failed to update workflow: ${error.message}`);
        }
    }

    async getWorkflow(workflowId: string): Promise<N8nWorkflowResponse> {
        try {
            const response = await this.client.get(`/workflows/${workflowId}`);

            if (response.status !== 200) {
                throw new Error(`Failed to get workflow: ${response.status} ${response.statusText}`);
            }

            return response.data;
        } catch (error) {
            logger.error('Failed to get workflow', { 
                error: error.message,
                workflowId 
            });
            throw new Error(`Failed to get workflow: ${error.message}`);
        }
    }

    async listWorkflows(params: {
        limit?: number;
        offset?: number;
        active?: boolean;
        tags?: string[];
    } = {}): Promise<{ workflows: N8nWorkflowResponse[]; count: number }> {
        try {
            const response = await this.client.get('/workflows', { params });

            if (response.status !== 200) {
                throw new Error(`Failed to list workflows: ${response.status} ${response.statusText}`);
            }

            return {
                workflows: response.data.data || response.data,
                count: response.data.count || response.data.length
            };
        } catch (error) {
            logger.error('Failed to list workflows', { error: error.message });
            throw new Error(`Failed to list workflows: ${error.message}`);
        }
    }

    async deleteWorkflow(workflowId: string): Promise<void> {
        try {
            const response = await this.client.delete(`/workflows/${workflowId}`);

            if (response.status !== 200 && response.status !== 204) {
                throw new Error(`Failed to delete workflow: ${response.status} ${response.statusText}`);
            }

            logger.info('Workflow deleted successfully', { workflowId });
        } catch (error) {
            logger.error('Failed to delete workflow', { 
                error: error.message,
                workflowId 
            });
            throw new Error(`Failed to delete workflow: ${error.message}`);
        }
    }

    async activateWorkflow(workflowId: string): Promise<N8nWorkflowResponse> {
        try {
            const response = await this.client.patch(`/workflows/${workflowId}`, { active: true });

            if (response.status !== 200) {
                throw new Error(`Failed to activate workflow: ${response.status} ${response.statusText}`);
            }

            logger.info('Workflow activated successfully', { workflowId });
            return response.data;
        } catch (error) {
            logger.error('Failed to activate workflow', { 
                error: error.message,
                workflowId 
            });
            throw new Error(`Failed to activate workflow: ${error.message}`);
        }
    }

    async deactivateWorkflow(workflowId: string): Promise<N8nWorkflowResponse> {
        try {
            const response = await this.client.patch(`/workflows/${workflowId}`, { active: false });

            if (response.status !== 200) {
                throw new Error(`Failed to deactivate workflow: ${response.status} ${response.statusText}`);
            }

            logger.info('Workflow deactivated successfully', { workflowId });
            return response.data;
        } catch (error) {
            logger.error('Failed to deactivate workflow', { 
                error: error.message,
                workflowId 
            });
            throw new Error(`Failed to deactivate workflow: ${error.message}`);
        }
    }

    // Workflow Execution
    async executeWorkflow(
        workflow: N8nWorkflow | string,
        inputData?: Record<string, any>
    ): Promise<N8nExecutionResponse> {
        try {
            let workflowId: string;

            if (typeof workflow === 'string') {
                workflowId = workflow;
            } else {
                // Create temporary workflow for execution
                const created = await this.createWorkflow(workflow);
                workflowId = created.id;
            }

            const response = await this.client.post(`/workflows/${workflowId}/execute`, {
                loadedFromDatabase: false,
                data: inputData || {}
            });

            if (response.status !== 200 && response.status !== 201) {
                throw new Error(`Failed to execute workflow: ${response.status} ${response.statusText}`);
            }

            logger.info('Workflow execution started', { 
                workflowId,
                executionId: response.data.id 
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to execute workflow', { 
                error: error.message,
                workflowId: typeof workflow === 'string' ? workflow : workflow.name
            });
            throw new Error(`Failed to execute workflow: ${error.message}`);
        }
    }

    async getExecution(executionId: string): Promise<N8nExecutionResponse> {
        try {
            const response = await this.client.get(`/executions/${executionId}`);

            if (response.status !== 200) {
                throw new Error(`Failed to get execution: ${response.status} ${response.statusText}`);
            }

            return response.data;
        } catch (error) {
            logger.error('Failed to get execution', { 
                error: error.message,
                executionId 
            });
            throw new Error(`Failed to get execution: ${error.message}`);
        }
    }

    async listExecutions(params: {
        workflowId?: string;
        limit?: number;
        offset?: number;
        status?: string;
    } = {}): Promise<{ executions: N8nExecutionResponse[]; count: number }> {
        try {
            const response = await this.client.get('/executions', { params });

            if (response.status !== 200) {
                throw new Error(`Failed to list executions: ${response.status} ${response.statusText}`);
            }

            return {
                executions: response.data.data || response.data,
                count: response.data.count || response.data.length
            };
        } catch (error) {
            logger.error('Failed to list executions', { error: error.message });
            throw new Error(`Failed to list executions: ${error.message}`);
        }
    }

    async stopExecution(executionId: string): Promise<void> {
        try {
            const response = await this.client.post(`/executions/${executionId}/stop`);

            if (response.status !== 200) {
                throw new Error(`Failed to stop execution: ${response.status} ${response.statusText}`);
            }

            logger.info('Execution stopped successfully', { executionId });
        } catch (error) {
            logger.error('Failed to stop execution', { 
                error: error.message,
                executionId 
            });
            throw new Error(`Failed to stop execution: ${error.message}`);
        }
    }

    async retryExecution(executionId: string): Promise<N8nExecutionResponse> {
        try {
            const response = await this.client.post(`/executions/${executionId}/retry`);

            if (response.status !== 200 && response.status !== 201) {
                throw new Error(`Failed to retry execution: ${response.status} ${response.statusText}`);
            }

            logger.info('Execution retry started', { 
                originalExecutionId: executionId,
                retryExecutionId: response.data.id 
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to retry execution', { 
                error: error.message,
                executionId 
            });
            throw new Error(`Failed to retry execution: ${error.message}`);
        }
    }

    // Credential Management
    async createCredential(credential: {
        name: string;
        type: string;
        data: Record<string, any>;
    }): Promise<N8nCredential> {
        try {
            const response = await this.client.post('/credentials', credential);

            if (response.status !== 201) {
                throw new Error(`Failed to create credential: ${response.status} ${response.statusText}`);
            }

            logger.info('Credential created successfully', { 
                credentialId: response.data.id,
                name: credential.name,
                type: credential.type 
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to create credential', { 
                error: error.message,
                credentialName: credential.name 
            });
            throw new Error(`Failed to create credential: ${error.message}`);
        }
    }

    async listCredentials(): Promise<N8nCredential[]> {
        try {
            const response = await this.client.get('/credentials');

            if (response.status !== 200) {
                throw new Error(`Failed to list credentials: ${response.status} ${response.statusText}`);
            }

            return response.data.data || response.data;
        } catch (error) {
            logger.error('Failed to list credentials', { error: error.message });
            throw new Error(`Failed to list credentials: ${error.message}`);
        }
    }

    async deleteCredential(credentialId: string): Promise<void> {
        try {
            const response = await this.client.delete(`/credentials/${credentialId}`);

            if (response.status !== 200 && response.status !== 204) {
                throw new Error(`Failed to delete credential: ${response.status} ${response.statusText}`);
            }

            logger.info('Credential deleted successfully', { credentialId });
        } catch (error) {
            logger.error('Failed to delete credential', { 
                error: error.message,
                credentialId 
            });
            throw new Error(`Failed to delete credential: ${error.message}`);
        }
    }

    // Testing and Validation
    async testWorkflow(workflow: N8nWorkflow, testData?: Record<string, any>): Promise<{
        success: boolean;
        execution: N8nExecutionResponse;
        results: any;
        errors: any[];
    }> {
        try {
            const execution = await this.executeWorkflow(workflow, testData);
            
            // Wait for execution to complete (with timeout)
            const result = await this.waitForExecution(execution.id, 60000); // 60 second timeout

            const success = result.finished && !result.data?.resultData?.error;
            
            return {
                success,
                execution: result,
                results: result.data?.resultData || null,
                errors: result.data?.resultData?.error ? [result.data.resultData.error] : []
            };
        } catch (error) {
            logger.error('Workflow test failed', { 
                error: error.message,
                workflowName: workflow.name 
            });
            
            return {
                success: false,
                execution: null as any,
                results: null,
                errors: [{ message: error.message, type: 'execution_error' }]
            };
        }
    }

    private async waitForExecution(executionId: string, timeout: number = 30000): Promise<N8nExecutionResponse> {
        const startTime = Date.now();
        const pollInterval = 1000; // Poll every second

        while (Date.now() - startTime < timeout) {
            try {
                const execution = await this.getExecution(executionId);
                
                if (execution.finished) {
                    return execution;
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error) {
                logger.error('Error polling execution status', { 
                    error: error.message,
                    executionId 
                });
                throw error;
            }
        }

        throw new Error(`Execution timeout after ${timeout}ms`);
    }

    // Utility methods
    async validateConnection(): Promise<{ valid: boolean; error?: string }> {
        try {
            const isHealthy = await this.healthCheck();
            return { valid: isHealthy };
        } catch (error) {
            return { 
                valid: false, 
                error: error.message 
            };
        }
    }

    getApiInfo(): { baseUrl: string; hasApiKey: boolean } {
        return {
            baseUrl: this.baseUrl,
            hasApiKey: !!this.apiKey
        };
    }
}