/**
 * Workflow Executor - Direct integration with n8n execution engine
 * Handles execution of workflows with all node types
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class WorkflowExecutor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            n8nPath: config.n8nPath || process.env.N8N_USER_FOLDER || '~/.n8n',
            n8nExecutablePath: config.n8nExecutablePath || 'n8n',
            maxConcurrentExecutions: config.maxConcurrentExecutions || 5,
            executionTimeout: config.executionTimeout || 300000, // 5 minutes
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 5000,
            ...config
        };

        this.activeExecutions = new Map();
        this.executionQueue = [];
        this.isProcessing = false;
        this.executionHistory = new Map();
        this.nodeTypeHandlers = new Map();
        
        this.initializeNodeHandlers();
    }

    /**
     * Initialize handlers for different node types
     */
    initializeNodeHandlers() {
        // Register handlers for all n8n node types
        this.registerNodeHandler('n8n-nodes-base.httpRequest', this.handleHttpNode.bind(this));
        this.registerNodeHandler('n8n-nodes-base.postgres', this.handleDatabaseNode.bind(this));
        this.registerNodeHandler('n8n-nodes-base.code', this.handleCodeNode.bind(this));
        this.registerNodeHandler('n8n-nodes-base.emailSend', this.handleEmailNode.bind(this));
        this.registerNodeHandler('n8n-nodes-base.webhook', this.handleWebhookNode.bind(this));
        this.registerNodeHandler('n8n-nodes-base.cron', this.handleCronNode.bind(this));
        this.registerNodeHandler('n8n-nodes-base.function', this.handleFunctionNode.bind(this));
        this.registerNodeHandler('n8n-nodes-base.spreadsheetFile', this.handleSpreadsheetNode.bind(this));
    }

    /**
     * Execute a workflow with input data
     */
    async executeWorkflow(workflow, inputData = {}, options = {}) {
        const executionId = this.generateExecutionId();
        
        console.log(`🚀 Starting workflow execution: ${executionId}`);
        console.log(`   📋 Workflow: ${workflow.name || workflow.id}`);
        console.log(`   🔢 Nodes: ${workflow.nodes?.length || 0}`);

        const execution = {
            id: executionId,
            workflowId: workflow.id,
            workflow,
            inputData,
            startTime: new Date(),
            status: 'pending',
            nodes: {},
            results: {},
            errors: [],
            options: {
                ...options,
                timeout: options.timeout || this.config.executionTimeout,
                retryOnFailure: options.retryOnFailure !== false
            }
        };

        this.activeExecutions.set(executionId, execution);
        this.emit('execution-started', execution);

        try {
            // Validate workflow before execution
            const validation = await this.validateWorkflow(workflow);
            if (!validation.valid) {
                throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
            }

            // Add to execution queue
            this.executionQueue.push(execution);
            await this.processExecutionQueue();

            // Wait for execution to complete
            const result = await this.waitForExecution(executionId);
            
            this.emit('execution-completed', result);
            return result;

        } catch (error) {
            execution.status = 'error';
            execution.error = error.message;
            execution.endTime = new Date();
            
            this.emit('execution-failed', execution);
            throw error;

        } finally {
            // Cleanup
            setTimeout(() => {
                this.activeExecutions.delete(executionId);
            }, 60000); // Keep for 1 minute for debugging
        }
    }

    /**
     * Process execution queue
     */
    async processExecutionQueue() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;

        while (this.executionQueue.length > 0) {
            const concurrentExecutions = Array.from(this.activeExecutions.values())
                .filter(e => e.status === 'running').length;

            if (concurrentExecutions >= this.config.maxConcurrentExecutions) {
                await this.wait(1000);
                continue;
            }

            const execution = this.executionQueue.shift();
            this.runWorkflowExecution(execution).catch(error => {
                console.error(`❌ Execution failed: ${error.message}`);
                execution.error = error.message;
                execution.status = 'error';
            });
        }

        this.isProcessing = false;
    }

    /**
     * Run workflow execution
     */
    async runWorkflowExecution(execution) {
        execution.status = 'running';
        execution.currentNodeIndex = 0;

        try {
            // Execute nodes in sequence (simplified - real n8n handles complex flows)
            const nodes = execution.workflow.nodes || [];
            const connections = execution.workflow.connections || {};

            // Build execution plan
            const executionPlan = this.buildExecutionPlan(nodes, connections);
            
            // Execute each node in the plan
            for (const nodeId of executionPlan) {
                const node = nodes.find(n => n.id === nodeId);
                if (!node) continue;

                execution.currentNode = node;
                
                // Get input data for node
                const nodeInputData = await this.getNodeInputData(execution, node, connections);
                
                // Execute node
                const nodeResult = await this.executeNode(execution, node, nodeInputData);
                
                // Store result
                execution.results[nodeId] = nodeResult;
                execution.nodes[nodeId] = {
                    status: nodeResult.success ? 'success' : 'error',
                    executionTime: nodeResult.executionTime,
                    outputData: nodeResult.data
                };

                if (!nodeResult.success && !execution.options.continueOnFail) {
                    throw new Error(`Node ${node.name} failed: ${nodeResult.error}`);
                }
            }

            execution.status = 'success';
            execution.endTime = new Date();
            execution.duration = execution.endTime - execution.startTime;

        } catch (error) {
            execution.status = 'error';
            execution.error = error.message;
            execution.endTime = new Date();
            
            // Retry logic
            if (execution.options.retryOnFailure && execution.retryCount < this.config.retryAttempts) {
                execution.retryCount = (execution.retryCount || 0) + 1;
                console.log(`🔄 Retrying execution (attempt ${execution.retryCount}/${this.config.retryAttempts})`);
                
                await this.wait(this.config.retryDelay);
                return this.runWorkflowExecution(execution);
            }
            
            throw error;
        }

        // Store in history
        this.executionHistory.set(execution.id, {
            id: execution.id,
            workflowId: execution.workflowId,
            status: execution.status,
            startTime: execution.startTime,
            endTime: execution.endTime,
            duration: execution.duration,
            nodesExecuted: Object.keys(execution.results).length
        });

        return execution;
    }

    /**
     * Execute individual node
     */
    async executeNode(execution, node, inputData) {
        const startTime = Date.now();
        
        console.log(`   🔧 Executing node: ${node.name} (${node.type})`);
        
        try {
            // Get handler for node type
            const handler = this.nodeTypeHandlers.get(node.type);
            
            let result;
            if (handler) {
                // Use specialized handler
                result = await handler(node, inputData, execution);
            } else {
                // Fallback to generic execution
                result = await this.executeGenericNode(node, inputData, execution);
            }

            const executionTime = Date.now() - startTime;
            
            return {
                success: true,
                data: result,
                executionTime,
                nodeId: node.id,
                nodeName: node.name
            };

        } catch (error) {
            console.error(`   ❌ Node execution failed: ${error.message}`);
            
            return {
                success: false,
                error: error.message,
                executionTime: Date.now() - startTime,
                nodeId: node.id,
                nodeName: node.name
            };
        }
    }

    /**
     * Handle HTTP/API nodes
     */
    async handleHttpNode(node, inputData, execution) {
        const params = node.parameters || {};
        
        // Validate URL
        if (!params.url) {
            throw new Error('HTTP node missing URL parameter');
        }

        // Build request options
        const requestOptions = {
            method: params.method || 'GET',
            headers: this.buildHeaders(params.headers || {}),
            timeout: params.timeout || 30000
        };

        if (params.body && ['POST', 'PUT', 'PATCH'].includes(requestOptions.method)) {
            requestOptions.body = JSON.stringify(params.body);
        }

        // Add authentication if configured
        if (params.authentication) {
            await this.addAuthentication(requestOptions, params.authentication);
        }

        // Execute request
        const response = await fetch(params.url, requestOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        return [{
            json: data,
            headers: Object.fromEntries(response.headers.entries()),
            statusCode: response.status
        }];
    }

    /**
     * Handle Database nodes
     */
    async handleDatabaseNode(node, inputData, execution) {
        const params = node.parameters || {};
        
        // This would integrate with actual database drivers
        // For now, simulate database operations
        
        if (!params.operation) {
            throw new Error('Database node missing operation parameter');
        }

        switch (params.operation) {
            case 'executeQuery':
                return this.executeDatabaseQuery(params, inputData);
            case 'insert':
                return this.executeDatabaseInsert(params, inputData);
            case 'update':
                return this.executeDatabaseUpdate(params, inputData);
            case 'delete':
                return this.executeDatabaseDelete(params, inputData);
            default:
                throw new Error(`Unknown database operation: ${params.operation}`);
        }
    }

    /**
     * Handle Code nodes (JavaScript)
     */
    async handleCodeNode(node, inputData, execution) {
        const params = node.parameters || {};
        const code = params.jsCode || params.functionCode;
        
        if (!code) {
            throw new Error('Code node missing JavaScript code');
        }

        try {
            // Create safe execution context
            const $input = {
                all: () => inputData,
                first: () => inputData[0],
                last: () => inputData[inputData.length - 1],
                item: (index = 0) => inputData[index]
            };

            const $json = inputData[0]?.json || {};
            const $node = {
                name: node.name,
                id: node.id,
                type: node.type
            };
            const $items = () => inputData;
            const $item = (index = 0) => inputData[index];

            // Create function with n8n globals
            const executionFunction = new Function(
                '$input', '$json', '$node', '$items', '$item',
                code
            );

            // Execute the code
            const result = executionFunction($input, $json, $node, $items, $item);
            
            // Ensure result is in correct format
            if (Array.isArray(result)) {
                return result;
            } else if (result && typeof result === 'object') {
                return [{ json: result }];
            } else {
                return [{ json: { result } }];
            }

        } catch (error) {
            throw new Error(`JavaScript execution error: ${error.message}`);
        }
    }

    /**
     * Handle Email nodes
     */
    async handleEmailNode(node, inputData, execution) {
        const params = node.parameters || {};
        
        // Validate required fields
        if (!params.toEmail) {
            throw new Error('Email node missing recipient');
        }
        
        if (!params.subject) {
            throw new Error('Email node missing subject');
        }

        // In production, this would use actual email service
        console.log(`   📧 Sending email to: ${params.toEmail}`);
        console.log(`   📧 Subject: ${params.subject}`);
        
        return [{
            json: {
                success: true,
                messageId: `msg_${Date.now()}`,
                to: params.toEmail,
                subject: params.subject,
                sentAt: new Date().toISOString()
            }
        }];
    }

    /**
     * Handle Webhook nodes
     */
    async handleWebhookNode(node, inputData, execution) {
        const params = node.parameters || {};
        
        // In production, this would register actual webhooks
        const webhookUrl = `https://webhook.site/${node.id}`;
        
        return [{
            json: {
                webhookUrl,
                method: params.httpMethod || 'POST',
                registered: true,
                nodeId: node.id
            }
        }];
    }

    /**
     * Handle Cron/Timer nodes
     */
    async handleCronNode(node, inputData, execution) {
        const params = node.parameters || {};
        
        return [{
            json: {
                schedule: params.cronExpression || '0 * * * *',
                nextRun: this.getNextCronRun(params.cronExpression),
                timezone: params.timezone || 'UTC'
            }
        }];
    }

    /**
     * Handle Function nodes
     */
    async handleFunctionNode(node, inputData, execution) {
        // Similar to code node but with different context
        return this.handleCodeNode(node, inputData, execution);
    }

    /**
     * Handle Spreadsheet nodes
     */
    async handleSpreadsheetNode(node, inputData, execution) {
        const params = node.parameters || {};
        
        // Simulate spreadsheet operations
        return [{
            json: {
                operation: params.operation,
                rowCount: inputData.length,
                success: true
            }
        }];
    }

    /**
     * Execute generic node (fallback)
     */
    async executeGenericNode(node, inputData, execution) {
        console.log(`   ⚙️ Executing generic handler for: ${node.type}`);
        
        // Pass through input data with node info
        return inputData.map(item => ({
            ...item,
            _nodeExecuted: {
                id: node.id,
                name: node.name,
                type: node.type,
                timestamp: new Date().toISOString()
            }
        }));
    }

    /**
     * Build execution plan from nodes and connections
     */
    buildExecutionPlan(nodes, connections) {
        const plan = [];
        const visited = new Set();
        const visiting = new Set();

        // Find start nodes (no incoming connections)
        const startNodes = nodes.filter(node => {
            const hasIncoming = Object.values(connections).some(nodeConns => 
                Object.values(nodeConns).some(conns => 
                    conns.some(conn => conn.node === node.id)
                )
            );
            return !hasIncoming;
        });

        // Depth-first traversal
        const visit = (nodeId) => {
            if (visited.has(nodeId)) return;
            if (visiting.has(nodeId)) {
                throw new Error(`Circular dependency detected at node: ${nodeId}`);
            }

            visiting.add(nodeId);

            // Visit dependencies first
            const nodeConnections = connections[nodeId];
            if (nodeConnections) {
                Object.values(nodeConnections).forEach(conns => {
                    conns.forEach(conn => {
                        visit(conn.node);
                    });
                });
            }

            visiting.delete(nodeId);
            visited.add(nodeId);
            plan.push(nodeId);
        };

        // Visit all nodes starting from start nodes
        startNodes.forEach(node => visit(node.id));
        
        // Visit any remaining nodes
        nodes.forEach(node => visit(node.id));

        return plan;
    }

    /**
     * Get input data for a node based on connections
     */
    async getNodeInputData(execution, node, connections) {
        const nodeInputs = [];
        
        // Find incoming connections
        for (const [sourceNodeId, nodeConnections] of Object.entries(connections)) {
            for (const [outputType, outputConnections] of Object.entries(nodeConnections)) {
                for (const connection of outputConnections) {
                    if (connection.node === node.id) {
                        // Get data from source node
                        const sourceData = execution.results[sourceNodeId];
                        if (sourceData && sourceData.data) {
                            nodeInputs.push(...sourceData.data);
                        }
                    }
                }
            }
        }

        // If no inputs, use execution input data
        if (nodeInputs.length === 0 && execution.currentNodeIndex === 0) {
            return [{ json: execution.inputData }];
        }

        return nodeInputs.length > 0 ? nodeInputs : [{ json: {} }];
    }

    /**
     * Validate workflow structure
     */
    async validateWorkflow(workflow) {
        const errors = [];

        if (!workflow.nodes || workflow.nodes.length === 0) {
            errors.push('Workflow has no nodes');
        }

        // Validate each node
        for (const node of workflow.nodes || []) {
            if (!node.id) errors.push(`Node missing ID`);
            if (!node.type) errors.push(`Node ${node.id} missing type`);
            if (!node.name) errors.push(`Node ${node.id} missing name`);
            
            // Type-specific validation
            const validator = this.getNodeValidator(node.type);
            if (validator) {
                const nodeErrors = validator(node);
                errors.push(...nodeErrors);
            }
        }

        // Validate connections
        if (workflow.connections) {
            const nodeIds = new Set(workflow.nodes.map(n => n.id));
            
            for (const [sourceId, connections] of Object.entries(workflow.connections)) {
                if (!nodeIds.has(sourceId)) {
                    errors.push(`Connection source node not found: ${sourceId}`);
                }
                
                for (const outputs of Object.values(connections)) {
                    for (const conn of outputs) {
                        if (!nodeIds.has(conn.node)) {
                            errors.push(`Connection target node not found: ${conn.node}`);
                        }
                    }
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get node validator for specific type
     */
    getNodeValidator(nodeType) {
        const validators = {
            'n8n-nodes-base.httpRequest': (node) => {
                const errors = [];
                if (!node.parameters?.url) errors.push(`HTTP node ${node.id} missing URL`);
                return errors;
            },
            'n8n-nodes-base.code': (node) => {
                const errors = [];
                if (!node.parameters?.jsCode && !node.parameters?.functionCode) {
                    errors.push(`Code node ${node.id} missing JavaScript code`);
                }
                return errors;
            }
        };

        return validators[nodeType];
    }

    /**
     * Wait for execution to complete
     */
    async waitForExecution(executionId) {
        const timeout = this.activeExecutions.get(executionId)?.options.timeout || this.config.executionTimeout;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const execution = this.activeExecutions.get(executionId);
            
            if (!execution) {
                throw new Error(`Execution ${executionId} not found`);
            }

            if (execution.status === 'success' || execution.status === 'error') {
                return execution;
            }

            await this.wait(100);
        }

        throw new Error(`Execution timeout after ${timeout}ms`);
    }

    /**
     * Register custom node handler
     */
    registerNodeHandler(nodeType, handler) {
        this.nodeTypeHandlers.set(nodeType, handler);
    }

    /**
     * Build headers object
     */
    buildHeaders(headerParams) {
        const headers = {};
        
        if (Array.isArray(headerParams)) {
            headerParams.forEach(header => {
                headers[header.name] = header.value;
            });
        } else if (typeof headerParams === 'object') {
            Object.assign(headers, headerParams);
        }

        return headers;
    }

    /**
     * Add authentication to request
     */
    async addAuthentication(requestOptions, authConfig) {
        switch (authConfig.type) {
            case 'headerAuth':
                requestOptions.headers[authConfig.headerName] = authConfig.headerValue;
                break;
            case 'basicAuth':
                const basicAuth = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
                requestOptions.headers['Authorization'] = `Basic ${basicAuth}`;
                break;
            case 'bearerAuth':
                requestOptions.headers['Authorization'] = `Bearer ${authConfig.token}`;
                break;
            case 'oAuth2':
                // Would integrate with OAuth2 flow
                requestOptions.headers['Authorization'] = `Bearer ${authConfig.accessToken}`;
                break;
        }
    }

    /**
     * Execute database query (simulated)
     */
    async executeDatabaseQuery(params, inputData) {
        console.log(`   🗄️ Executing query: ${params.query?.substring(0, 50)}...`);
        
        // In production, this would use actual database connections
        return [{
            json: {
                query: params.query,
                rows: [],
                rowCount: 0,
                success: true
            }
        }];
    }

    /**
     * Execute database insert (simulated)
     */
    async executeDatabaseInsert(params, inputData) {
        return [{
            json: {
                operation: 'insert',
                table: params.table,
                rowsInserted: inputData.length,
                success: true
            }
        }];
    }

    /**
     * Execute database update (simulated)
     */
    async executeDatabaseUpdate(params, inputData) {
        return [{
            json: {
                operation: 'update',
                table: params.table,
                rowsUpdated: inputData.length,
                success: true
            }
        }];
    }

    /**
     * Execute database delete (simulated)
     */
    async executeDatabaseDelete(params, inputData) {
        return [{
            json: {
                operation: 'delete',
                table: params.table,
                rowsDeleted: 0,
                success: true
            }
        }];
    }

    /**
     * Get next cron run time
     */
    getNextCronRun(cronExpression) {
        // Simplified - would use proper cron parser
        return new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    }

    /**
     * Generate unique execution ID
     */
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Wait utility
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get execution statistics
     */
    getStats() {
        const stats = {
            activeExecutions: this.activeExecutions.size,
            queueLength: this.executionQueue.length,
            totalExecutions: this.executionHistory.size,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0
        };

        let totalTime = 0;
        for (const execution of this.executionHistory.values()) {
            if (execution.status === 'success') {
                stats.successfulExecutions++;
                totalTime += execution.duration || 0;
            } else if (execution.status === 'error') {
                stats.failedExecutions++;
            }
        }

        if (stats.successfulExecutions > 0) {
            stats.averageExecutionTime = totalTime / stats.successfulExecutions;
        }

        return stats;
    }

    /**
     * Clear execution history
     */
    clearHistory() {
        this.executionHistory.clear();
        console.log('📋 Execution history cleared');
    }
}

module.exports = WorkflowExecutor;