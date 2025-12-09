import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';

export interface WorkflowExecution {
    id: string;
    workflowId: string;
    finished: boolean;
    mode: string;
    startedAt: Date;
    stoppedAt?: Date;
    data: any;
    status: 'success' | 'error' | 'running';
}

export interface Workflow {
    id: string;
    name: string;
    active: boolean;
    nodes: any[];
    connections: any;
    settings?: any;
    staticData?: any;
    createdAt: string;
    updatedAt: string;
}

export interface Credentials {
    id: string;
    name: string;
    type: string;
    data: any;
}

export class N8nApiClient {
    private axiosInstance: AxiosInstance;
    private connected: boolean = false;

    constructor(
        private baseUrl: string,
        private apiKey?: string
    ) {
        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'X-N8N-API-KEY': apiKey } : {})
            },
            timeout: 30000
        });

        // Add request interceptor for auth
        this.axiosInstance.interceptors.request.use(
            (config) => {
                // Add any additional headers if needed
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // Add response interceptor for error handling
        this.axiosInstance.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    vscode.window.showErrorMessage('n8n authentication failed. Please check your API key.');
                }
                return Promise.reject(error);
            }
        );
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await this.axiosInstance.get('/workflows?limit=1');
            this.connected = response.status === 200;
            return this.connected;
        } catch (error) {
            this.connected = false;
            console.error('n8n connection test failed:', error);
            return false;
        }
    }

    async getWorkflows(limit: number = 100): Promise<Workflow[]> {
        try {
            const response = await this.axiosInstance.get(`/workflows?limit=${limit}`);
            return response.data.data;
        } catch (error) {
            console.error('Failed to fetch workflows:', error);
            throw error;
        }
    }

    async getWorkflow(id: string): Promise<Workflow> {
        try {
            const response = await this.axiosInstance.get(`/workflows/${id}`);
            return response.data.data;
        } catch (error) {
            console.error('Failed to fetch workflow:', error);
            throw error;
        }
    }

    async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
        try {
            const response = await this.axiosInstance.post('/workflows', workflow);
            return response.data.data;
        } catch (error) {
            console.error('Failed to create workflow:', error);
            throw error;
        }
    }

    async updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<Workflow> {
        try {
            const response = await this.axiosInstance.patch(`/workflows/${id}`, workflow);
            return response.data.data;
        } catch (error) {
            console.error('Failed to update workflow:', error);
            throw error;
        }
    }

    async deleteWorkflow(id: string): Promise<void> {
        try {
            await this.axiosInstance.delete(`/workflows/${id}`);
        } catch (error) {
            console.error('Failed to delete workflow:', error);
            throw error;
        }
    }

    async executeWorkflow(
        workflowId: string, 
        data?: any,
        startNode?: string
    ): Promise<WorkflowExecution> {
        try {
            const payload: any = {};
            if (data) payload.workflowData = data;
            if (startNode) payload.startNode = startNode;

            const response = await this.axiosInstance.post(
                `/workflows/${workflowId}/execute`,
                payload
            );
            return response.data.data;
        } catch (error) {
            console.error('Failed to execute workflow:', error);
            throw error;
        }
    }

    async getExecution(executionId: string): Promise<WorkflowExecution> {
        try {
            const response = await this.axiosInstance.get(`/executions/${executionId}`);
            return response.data.data;
        } catch (error) {
            console.error('Failed to fetch execution:', error);
            throw error;
        }
    }

    async getExecutions(
        workflowId?: string,
        limit: number = 10
    ): Promise<WorkflowExecution[]> {
        try {
            const params: any = { limit };
            if (workflowId) params.workflowId = workflowId;

            const response = await this.axiosInstance.get('/executions', { params });
            return response.data.data;
        } catch (error) {
            console.error('Failed to fetch executions:', error);
            throw error;
        }
    }

    async stopExecution(executionId: string): Promise<void> {
        try {
            await this.axiosInstance.post(`/executions/${executionId}/stop`);
        } catch (error) {
            console.error('Failed to stop execution:', error);
            throw error;
        }
    }

    async getCredentials(): Promise<Credentials[]> {
        try {
            const response = await this.axiosInstance.get('/credentials');
            return response.data.data;
        } catch (error) {
            console.error('Failed to fetch credentials:', error);
            throw error;
        }
    }

    async createCredentials(credentials: Partial<Credentials>): Promise<Credentials> {
        try {
            const response = await this.axiosInstance.post('/credentials', credentials);
            return response.data.data;
        } catch (error) {
            console.error('Failed to create credentials:', error);
            throw error;
        }
    }

    async testCredentials(credentialsId: string): Promise<boolean> {
        try {
            const response = await this.axiosInstance.post(`/credentials/${credentialsId}/test`);
            return response.data.data.success;
        } catch (error) {
            console.error('Failed to test credentials:', error);
            return false;
        }
    }

    async getNodeTypes(): Promise<any[]> {
        try {
            const response = await this.axiosInstance.get('/node-types');
            return response.data.data;
        } catch (error) {
            console.error('Failed to fetch node types:', error);
            throw error;
        }
    }

    async activateWorkflow(workflowId: string): Promise<void> {
        try {
            await this.axiosInstance.patch(`/workflows/${workflowId}`, { active: true });
        } catch (error) {
            console.error('Failed to activate workflow:', error);
            throw error;
        }
    }

    async deactivateWorkflow(workflowId: string): Promise<void> {
        try {
            await this.axiosInstance.patch(`/workflows/${workflowId}`, { active: false });
        } catch (error) {
            console.error('Failed to deactivate workflow:', error);
            throw error;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    setApiKey(apiKey: string): void {
        this.apiKey = apiKey;
        this.axiosInstance.defaults.headers['X-N8N-API-KEY'] = apiKey;
    }

    setBaseUrl(baseUrl: string): void {
        this.baseUrl = baseUrl;
        this.axiosInstance.defaults.baseURL = baseUrl;
    }
}