/**
 * n8n Runtime Client - Real integration with n8n instance
 * Handles actual workflow execution, credential management, and monitoring
 */

const EventEmitter = require('events');
const { spawn, exec } = require('child_process');
const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');

class N8nRuntimeClient extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            n8nBaseUrl: config.n8nBaseUrl || process.env.N8N_BASE_URL || 'http://localhost:5678',
            n8nApiKey: config.n8nApiKey || process.env.N8N_API_KEY,
            n8nEmail: config.n8nEmail || process.env.N8N_EMAIL,
            n8nPassword: config.n8nPassword || process.env.N8N_PASSWORD,
            n8nExecutablePath: config.n8nExecutablePath || 'n8n',
            useDocker: config.useDocker || false,
            dockerImage: config.dockerImage || 'n8nio/n8n:latest',
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 5000,
            ...config
        };

        this.apiClient = null;
        this.wsClient = null;
        this.sessionToken = null;
        this.isConnected = false;
        this.n8nProcess = null;
        this.executionSubscriptions = new Map();
    }

    /**
     * Initialize connection to n8n
     */
    async initialize() {
        console.log('🔌 Initializing n8n Runtime Client...');
        
        try {
            // Check if n8n is running
            const isRunning = await this.checkN8nStatus();
            
            if (!isRunning) {
                console.log('🚀 Starting n8n instance...');
                await this.startN8nInstance();
            }

            // Setup API client
            await this.setupApiClient();
            
            // Authenticate
            await this.authenticate();
            
            // Setup WebSocket for real-time updates
            await this.setupWebSocket();
            
            this.isConnected = true;
            this.emit('connected');
            
            console.log('✅ n8n Runtime Client initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize n8n client:', error);
            throw error;
        }
    }

    /**
     * Check if n8n is running
     */
    async checkN8nStatus() {
        try {
            const response = await axios.get(`${this.config.n8nBaseUrl}/healthz`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * Start n8n instance
     */
    async startN8nInstance() {
        if (this.config.useDocker) {
            await this.startN8nDocker();
        } else {
            await this.startN8nNative();
        }

        // Wait for n8n to be ready
        await this.waitForN8nReady();
    }

    /**
     * Start n8n using Docker
     */
    async startN8nDocker() {
        return new Promise((resolve, reject) => {
            const dockerCmd = `docker run -d --rm --name n8n-agent-platform \
                -p 5678:5678 \
                -v ~/.n8n:/home/node/.n8n \
                -e N8N_BASIC_AUTH_ACTIVE=true \
                -e N8N_BASIC_AUTH_USER=${this.config.n8nEmail} \
                -e N8N_BASIC_AUTH_PASSWORD=${this.config.n8nPassword} \
                ${this.config.dockerImage}`;

            exec(dockerCmd, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                console.log('🐳 n8n Docker container started');
                resolve();
            });
        });
    }

    /**
     * Start n8n native process
     */
    async startN8nNative() {
        const env = {
            ...process.env,
            N8N_PORT: '5678',
            N8N_BASIC_AUTH_ACTIVE: 'true',
            N8N_BASIC_AUTH_USER: this.config.n8nEmail,
            N8N_BASIC_AUTH_PASSWORD: this.config.n8nPassword
        };

        this.n8nProcess = spawn(this.config.n8nExecutablePath, ['start'], {
            env,
            detached: true,
            stdio: 'pipe'
        });

        this.n8nProcess.stdout.on('data', (data) => {
            console.log(`n8n: ${data}`);
        });

        this.n8nProcess.stderr.on('data', (data) => {
            console.error(`n8n error: ${data}`);
        });

        this.n8nProcess.on('error', (error) => {
            console.error('Failed to start n8n:', error);
            this.emit('process-error', error);
        });

        this.n8nProcess.on('exit', (code) => {
            console.log(`n8n process exited with code ${code}`);
            this.emit('process-exit', code);
        });
    }

    /**
     * Wait for n8n to be ready
     */
    async waitForN8nReady() {
        const maxWaitTime = 60000; // 60 seconds
        const checkInterval = 2000; // 2 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            if (await this.checkN8nStatus()) {
                console.log('✅ n8n is ready');
                return;
            }
            await this.wait(checkInterval);
        }

        throw new Error('n8n failed to start within timeout');
    }

    /**
     * Setup API client
     */
    async setupApiClient() {
        this.apiClient = axios.create({
            baseURL: `${this.config.n8nBaseUrl}/api/v1`,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Add request interceptor for auth
        this.apiClient.interceptors.request.use((config) => {
            if (this.sessionToken) {
                config.headers['X-N8N-API-KEY'] = this.sessionToken;
            }
            return config;
        });

        // Add response interceptor for error handling
        this.apiClient.interceptors.response.use(
            response => response,
            error => {
                if (error.response?.status === 401) {
                    // Re-authenticate on 401
                    this.authenticate().catch(console.error);
                }
                return Promise.reject(error);
            }
        );
    }

    /**
     * Authenticate with n8n
     */
    async authenticate() {
        try {
            if (this.config.n8nApiKey) {
                // Use API key
                this.sessionToken = this.config.n8nApiKey;
                console.log('🔑 Authenticated with API key');
            } else {
                // Use email/password
                const response = await axios.post(
                    `${this.config.n8nBaseUrl}/api/v1/auth/login`,
                    {
                        email: this.config.n8nEmail,
                        password: this.config.n8nPassword
                    }
                );
                
                this.sessionToken = response.data.data.token;
                console.log('🔑 Authenticated with credentials');
            }
        } catch (error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Setup WebSocket connection for real-time updates
     */
    async setupWebSocket() {
        const wsUrl = this.config.n8nBaseUrl.replace('http', 'ws') + '/push';
        
        this.wsClient = new WebSocket(wsUrl, {
            headers: {
                'X-N8N-API-KEY': this.sessionToken
            }
        });

        this.wsClient.on('open', () => {
            console.log('🔌 WebSocket connected');
            this.emit('websocket-connected');
        });

        this.wsClient.on('message', (data) => {
            const message = JSON.parse(data);
            this.handleWebSocketMessage(message);
        });

        this.wsClient.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.emit('websocket-error', error);
        });

        this.wsClient.on('close', () => {
            console.log('WebSocket disconnected');
            this.emit('websocket-disconnected');
            
            // Reconnect after delay
            setTimeout(() => {
                this.setupWebSocket().catch(console.error);
            }, 5000);
        });
    }

    /**
     * Handle WebSocket messages
     */
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'executionStarted':
                this.emit('execution-started', message.data);
                break;
                
            case 'executionFinished':
                this.emit('execution-finished', message.data);
                this.resolveExecutionSubscription(message.data.executionId, message.data);
                break;
                
            case 'executionError':
                this.emit('execution-error', message.data);
                this.rejectExecutionSubscription(message.data.executionId, message.data.error);
                break;
                
            case 'nodeExecuteAfter':
                this.emit('node-executed', message.data);
                break;
                
            default:
                this.emit('message', message);
        }
    }

    /**
     * Create workflow
     */
    async createWorkflow(workflow) {
        try {
            const response = await this.apiClient.post('/workflows', workflow);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to create workflow: ${error.message}`);
        }
    }

    /**
     * Update workflow
     */
    async updateWorkflow(workflowId, updates) {
        try {
            const response = await this.apiClient.patch(`/workflows/${workflowId}`, updates);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to update workflow: ${error.message}`);
        }
    }

    /**
     * Get workflow
     */
    async getWorkflow(workflowId) {
        try {
            const response = await this.apiClient.get(`/workflows/${workflowId}`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get workflow: ${error.message}`);
        }
    }

    /**
     * Delete workflow
     */
    async deleteWorkflow(workflowId) {
        try {
            await this.apiClient.delete(`/workflows/${workflowId}`);
            return true;
        } catch (error) {
            throw new Error(`Failed to delete workflow: ${error.message}`);
        }
    }

    /**
     * List workflows
     */
    async listWorkflows(filters = {}) {
        try {
            const response = await this.apiClient.get('/workflows', { params: filters });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to list workflows: ${error.message}`);
        }
    }

    /**
     * Execute workflow
     */
    async executeWorkflow(workflowId, data = {}, options = {}) {
        console.log(`🚀 Executing workflow: ${workflowId}`);
        
        return new Promise(async (resolve, reject) => {
            try {
                // Subscribe to execution updates
                const subscription = { resolve, reject, timeout: null };
                
                // Execute workflow
                const response = await this.apiClient.post(`/workflows/${workflowId}/execute`, {
                    workflowData: data,
                    runData: options.runData || {},
                    startNodes: options.startNodes || [],
                    destinationNode: options.destinationNode
                });

                const executionId = response.data.data.executionId;
                this.executionSubscriptions.set(executionId, subscription);

                // Set timeout
                subscription.timeout = setTimeout(() => {
                    this.executionSubscriptions.delete(executionId);
                    reject(new Error('Execution timeout'));
                }, options.timeout || 300000); // 5 minutes default

                console.log(`   Execution ID: ${executionId}`);
                
            } catch (error) {
                reject(new Error(`Failed to execute workflow: ${error.message}`));
            }
        });
    }

    /**
     * Get execution data
     */
    async getExecution(executionId) {
        try {
            const response = await this.apiClient.get(`/executions/${executionId}`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get execution: ${error.message}`);
        }
    }

    /**
     * List executions
     */
    async listExecutions(filters = {}) {
        try {
            const response = await this.apiClient.get('/executions', { params: filters });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to list executions: ${error.message}`);
        }
    }

    /**
     * Stop execution
     */
    async stopExecution(executionId) {
        try {
            const response = await this.apiClient.post(`/executions/${executionId}/stop`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to stop execution: ${error.message}`);
        }
    }

    /**
     * Get credentials
     */
    async getCredentials(credentialId) {
        try {
            const response = await this.apiClient.get(`/credentials/${credentialId}`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get credentials: ${error.message}`);
        }
    }

    /**
     * Create credentials
     */
    async createCredentials(credentialData) {
        try {
            const response = await this.apiClient.post('/credentials', credentialData);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to create credentials: ${error.message}`);
        }
    }

    /**
     * Update credentials
     */
    async updateCredentials(credentialId, updates) {
        try {
            const response = await this.apiClient.patch(`/credentials/${credentialId}`, updates);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to update credentials: ${error.message}`);
        }
    }

    /**
     * Delete credentials
     */
    async deleteCredentials(credentialId) {
        try {
            await this.apiClient.delete(`/credentials/${credentialId}`);
            return true;
        } catch (error) {
            throw new Error(`Failed to delete credentials: ${error.message}`);
        }
    }

    /**
     * Test credentials
     */
    async testCredentials(credentialData) {
        try {
            const response = await this.apiClient.post('/credentials/test', credentialData);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to test credentials: ${error.message}`);
        }
    }

    /**
     * Get node types
     */
    async getNodeTypes() {
        try {
            const response = await this.apiClient.get('/node-types');
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get node types: ${error.message}`);
        }
    }

    /**
     * Get node type description
     */
    async getNodeTypeDescription(nodeType) {
        try {
            const response = await this.apiClient.get(`/node-types/${nodeType}`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get node type description: ${error.message}`);
        }
    }

    /**
     * Activate workflow
     */
    async activateWorkflow(workflowId) {
        try {
            const response = await this.apiClient.patch(`/workflows/${workflowId}`, {
                active: true
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to activate workflow: ${error.message}`);
        }
    }

    /**
     * Deactivate workflow
     */
    async deactivateWorkflow(workflowId) {
        try {
            const response = await this.apiClient.patch(`/workflows/${workflowId}`, {
                active: false
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to deactivate workflow: ${error.message}`);
        }
    }

    /**
     * Get workflow metrics
     */
    async getWorkflowMetrics(workflowId, options = {}) {
        try {
            const response = await this.apiClient.get(`/workflows/${workflowId}/metrics`, {
                params: {
                    startDate: options.startDate || new Date(Date.now() - 86400000).toISOString(),
                    endDate: options.endDate || new Date().toISOString()
                }
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get workflow metrics: ${error.message}`);
        }
    }

    /**
     * Export workflow
     */
    async exportWorkflow(workflowId) {
        try {
            const workflow = await this.getWorkflow(workflowId);
            
            // Clean up for export
            delete workflow.id;
            delete workflow.createdAt;
            delete workflow.updatedAt;
            
            return workflow;
        } catch (error) {
            throw new Error(`Failed to export workflow: ${error.message}`);
        }
    }

    /**
     * Import workflow
     */
    async importWorkflow(workflowData) {
        try {
            // Ensure workflow has required fields
            const workflow = {
                ...workflowData,
                name: workflowData.name || 'Imported Workflow',
                active: false
            };
            
            return await this.createWorkflow(workflow);
        } catch (error) {
            throw new Error(`Failed to import workflow: ${error.message}`);
        }
    }

    /**
     * Duplicate workflow
     */
    async duplicateWorkflow(workflowId, newName) {
        try {
            const original = await this.getWorkflow(workflowId);
            
            const duplicate = {
                ...original,
                name: newName || `${original.name} (Copy)`,
                active: false
            };
            
            delete duplicate.id;
            delete duplicate.createdAt;
            delete duplicate.updatedAt;
            
            return await this.createWorkflow(duplicate);
        } catch (error) {
            throw new Error(`Failed to duplicate workflow: ${error.message}`);
        }
    }

    /**
     * Get execution logs
     */
    async getExecutionLogs(executionId) {
        try {
            const response = await this.apiClient.get(`/executions/${executionId}/logs`);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get execution logs: ${error.message}`);
        }
    }

    /**
     * Retry execution
     */
    async retryExecution(executionId, options = {}) {
        try {
            const response = await this.apiClient.post(`/executions/${executionId}/retry`, {
                loadWorkflow: options.loadWorkflow !== false
            });
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to retry execution: ${error.message}`);
        }
    }

    /**
     * Get settings
     */
    async getSettings() {
        try {
            const response = await this.apiClient.get('/settings');
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to get settings: ${error.message}`);
        }
    }

    /**
     * Update settings
     */
    async updateSettings(settings) {
        try {
            const response = await this.apiClient.patch('/settings', settings);
            return response.data.data;
        } catch (error) {
            throw new Error(`Failed to update settings: ${error.message}`);
        }
    }

    /**
     * Resolve execution subscription
     */
    resolveExecutionSubscription(executionId, data) {
        const subscription = this.executionSubscriptions.get(executionId);
        if (subscription) {
            clearTimeout(subscription.timeout);
            this.executionSubscriptions.delete(executionId);
            subscription.resolve(data);
        }
    }

    /**
     * Reject execution subscription
     */
    rejectExecutionSubscription(executionId, error) {
        const subscription = this.executionSubscriptions.get(executionId);
        if (subscription) {
            clearTimeout(subscription.timeout);
            this.executionSubscriptions.delete(executionId);
            subscription.reject(new Error(error));
        }
    }

    /**
     * Wait utility
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Disconnect from n8n
     */
    async disconnect() {
        console.log('🔌 Disconnecting from n8n...');
        
        // Close WebSocket
        if (this.wsClient) {
            this.wsClient.close();
            this.wsClient = null;
        }

        // Clear subscriptions
        this.executionSubscriptions.clear();

        // Stop n8n process if we started it
        if (this.n8nProcess) {
            this.n8nProcess.kill();
            this.n8nProcess = null;
        }

        // Stop Docker container if we started it
        if (this.config.useDocker) {
            await new Promise((resolve) => {
                exec('docker stop n8n-agent-platform', (error) => {
                    if (error) console.error('Failed to stop Docker container:', error);
                    resolve();
                });
            });
        }

        this.isConnected = false;
        this.emit('disconnected');
        
        console.log('✅ Disconnected from n8n');
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            baseUrl: this.config.n8nBaseUrl,
            authenticated: !!this.sessionToken,
            websocketConnected: this.wsClient?.readyState === WebSocket.OPEN,
            processRunning: !!this.n8nProcess
        };
    }
}

module.exports = N8nRuntimeClient;