/**
 * AI Workflow Designer - Generates optimal n8n workflows from natural language
 * Uses GPT-4 to understand requirements and create workflow structures
 */

const EventEmitter = require('events');

class WorkflowDesigner extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
            model: config.model || 'gpt-4',
            maxTokens: config.maxTokens || 4000,
            temperature: config.temperature || 0.7,
            nodeLibrary: config.nodeLibrary || this.getDefaultNodeLibrary(),
            templates: config.templates || new Map(),
            ...config
        };

        this.designCache = new Map();
        this.nodeRegistry = this.buildNodeRegistry();
    }

    /**
     * Generate workflow from natural language description
     */
    async generateWorkflow(description, requirements = {}) {
        console.log('🤖 Generating workflow from description...');
        console.log(`📝 Description: ${description}`);
        
        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(description, requirements);
            if (this.designCache.has(cacheKey)) {
                console.log('📋 Using cached workflow design');
                return this.designCache.get(cacheKey);
            }

            // Step 1: Analyze requirements
            const analysis = await this.analyzeRequirements(description, requirements);
            
            // Step 2: Design workflow structure
            const workflowDesign = await this.designWorkflowStructure(analysis);
            
            // Step 3: Generate n8n workflow JSON
            const workflow = await this.generateWorkflowJSON(workflowDesign, analysis);
            
            // Step 4: Optimize workflow
            const optimizedWorkflow = await this.optimizeWorkflow(workflow, requirements);
            
            // Step 5: Validate workflow
            const validation = await this.validateWorkflow(optimizedWorkflow);
            if (!validation.valid) {
                throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
            }

            // Cache the result
            this.designCache.set(cacheKey, optimizedWorkflow);
            
            console.log('✅ Workflow generated successfully');
            this.emit('workflow-generated', {
                description,
                requirements,
                workflow: optimizedWorkflow
            });

            return optimizedWorkflow;

        } catch (error) {
            console.error('❌ Failed to generate workflow:', error);
            this.emit('generation-failed', { description, error });
            throw error;
        }
    }

    /**
     * Analyze requirements from natural language
     */
    async analyzeRequirements(description, requirements) {
        const prompt = `
You are an expert n8n workflow designer. Analyze this workflow request and extract key requirements.

USER REQUEST: ${description}

ADDITIONAL REQUIREMENTS:
${JSON.stringify(requirements, null, 2)}

Please analyze and provide a structured response in JSON format:
{
  "workflowType": "data_processing|automation|integration|notification|etc",
  "primaryGoal": "Main objective of the workflow",
  "dataSources": ["List of data sources needed"],
  "dataDestinations": ["Where data should go"],
  "processingSteps": ["Key processing or transformation steps"],
  "triggers": ["How the workflow should be triggered"],
  "errorHandling": "Required error handling approach",
  "performance": {
    "expectedVolume": "Number of items to process",
    "frequency": "How often it runs",
    "timeConstraints": "Any time limits"
  },
  "security": ["Security requirements"],
  "integrations": ["External services to connect"],
  "outputFormat": "Expected output format",
  "specialRequirements": ["Any unique needs"]
}`;

        try {
            const response = await this.callOpenAI(prompt, 'analysis');
            return this.parseJSONResponse(response);
        } catch (error) {
            console.error('Failed to analyze requirements:', error);
            // Fallback analysis
            return this.createFallbackAnalysis(description);
        }
    }

    /**
     * Design workflow structure based on analysis
     */
    async designWorkflowStructure(analysis) {
        const prompt = `
You are an expert n8n workflow designer. Design the optimal workflow structure.

REQUIREMENTS ANALYSIS:
${JSON.stringify(analysis, null, 2)}

AVAILABLE NODE TYPES:
${this.getAvailableNodeTypes()}

Design a workflow structure in JSON format:
{
  "name": "Workflow name",
  "description": "What this workflow does",
  "nodes": [
    {
      "id": "unique_id",
      "name": "Node name",
      "type": "n8n-nodes-base.nodeType",
      "purpose": "What this node does",
      "configuration": {
        "key": "Configuration hints"
      },
      "position": [x, y]
    }
  ],
  "connections": {
    "sourceNodeId": {
      "main": [[{ "node": "targetNodeId", "type": "main", "index": 0 }]]
    }
  },
  "flow": ["Step by step flow description"],
  "errorStrategy": "How to handle errors",
  "optimizations": ["Suggested optimizations"]
}`;

        try {
            const response = await this.callOpenAI(prompt, 'design');
            return this.parseJSONResponse(response);
        } catch (error) {
            console.error('Failed to design workflow:', error);
            return this.createFallbackDesign(analysis);
        }
    }

    /**
     * Generate n8n workflow JSON
     */
    async generateWorkflowJSON(design, analysis) {
        const workflow = {
            id: this.generateWorkflowId(),
            name: design.name || 'AI Generated Workflow',
            active: false,
            nodes: [],
            connections: {},
            settings: {
                executionOrder: 'v1'
            },
            meta: {
                generatedBy: 'AI Workflow Designer',
                generatedAt: new Date().toISOString(),
                description: design.description,
                analysis: analysis
            }
        };

        // Generate nodes with proper n8n format
        for (const designNode of design.nodes) {
            const n8nNode = await this.generateNode(designNode, analysis);
            workflow.nodes.push(n8nNode);
        }

        // Convert connections to n8n format
        workflow.connections = this.convertConnections(design.connections);

        // Add error handling nodes if needed
        if (analysis.errorHandling && analysis.errorHandling !== 'none') {
            await this.addErrorHandling(workflow, analysis.errorHandling);
        }

        return workflow;
    }

    /**
     * Generate individual node configuration
     */
    async generateNode(designNode, analysis) {
        const nodeTemplate = this.nodeRegistry.get(designNode.type);
        
        if (!nodeTemplate) {
            throw new Error(`Unknown node type: ${designNode.type}`);
        }

        const node = {
            id: designNode.id || this.generateNodeId(),
            name: designNode.name,
            type: designNode.type,
            typeVersion: nodeTemplate.version || 1,
            position: designNode.position || [250, 250],
            parameters: {}
        };

        // Generate parameters based on node type
        switch (designNode.type) {
            case 'n8n-nodes-base.httpRequest':
                node.parameters = await this.generateHttpNodeParams(designNode, analysis);
                break;
            
            case 'n8n-nodes-base.code':
                node.parameters = await this.generateCodeNodeParams(designNode, analysis);
                break;
            
            case 'n8n-nodes-base.postgres':
            case 'n8n-nodes-base.mysql':
            case 'n8n-nodes-base.mongodb':
                node.parameters = await this.generateDatabaseNodeParams(designNode, analysis);
                break;
            
            case 'n8n-nodes-base.webhook':
                node.parameters = await this.generateWebhookNodeParams(designNode, analysis);
                break;
            
            case 'n8n-nodes-base.cron':
                node.parameters = await this.generateCronNodeParams(designNode, analysis);
                break;
            
            default:
                // Use AI to generate parameters for unknown types
                node.parameters = await this.generateGenericNodeParams(designNode, analysis);
        }

        return node;
    }

    /**
     * Generate HTTP node parameters
     */
    async generateHttpNodeParams(designNode, analysis) {
        const params = {
            method: 'GET',
            url: '',
            authentication: 'none',
            responseFormat: 'json',
            options: {}
        };

        // Infer from configuration hints
        if (designNode.configuration) {
            if (designNode.configuration.method) {
                params.method = designNode.configuration.method.toUpperCase();
            }
            if (designNode.configuration.url) {
                params.url = designNode.configuration.url;
            } else if (designNode.configuration.endpoint) {
                params.url = '={{$parameter["endpoint"]}}'; // Make it parameterized
            }
        }

        // Add authentication if needed
        if (analysis.security?.includes('api_key')) {
            params.authentication = 'headerAuth';
            params.headerAuth = {
                name: 'Authorization',
                value: '={{$credentials.apiKey}}'
            };
        }

        return params;
    }

    /**
     * Generate Code node parameters
     */
    async generateCodeNodeParams(designNode, analysis) {
        const purpose = designNode.purpose || 'Process data';
        
        // Generate appropriate code based on purpose
        const codePrompt = `
Generate n8n JavaScript code for this purpose: ${purpose}

Context: ${JSON.stringify(analysis, null, 2)}

Requirements:
1. Use $input.all() to get input data
2. Return data in n8n format: [{json: {...}}]
3. Include error handling
4. Add comments explaining the logic

Generate only the JavaScript code:`;

        try {
            const code = await this.callOpenAI(codePrompt, 'code');
            return { jsCode: code.trim() };
        } catch (error) {
            // Fallback code
            return {
                jsCode: `
// ${purpose}
try {
  const items = $input.all();
  
  // Process each item
  const results = items.map(item => {
    const data = item.json;
    
    // TODO: Add processing logic here
    const processed = {
      ...data,
      processed: true,
      timestamp: new Date().toISOString()
    };
    
    return { json: processed };
  });
  
  return results;
} catch (error) {
  console.error('Processing error:', error);
  return [{ json: { error: error.message } }];
}`
            };
        }
    }

    /**
     * Generate Database node parameters
     */
    async generateDatabaseNodeParams(designNode, analysis) {
        const params = {
            operation: 'executeQuery',
            query: '',
            options: {}
        };

        // Determine operation type
        if (designNode.purpose) {
            if (designNode.purpose.toLowerCase().includes('insert')) {
                params.operation = 'insert';
            } else if (designNode.purpose.toLowerCase().includes('update')) {
                params.operation = 'update';
            } else if (designNode.purpose.toLowerCase().includes('delete')) {
                params.operation = 'delete';
            }
        }

        // Generate query if needed
        if (params.operation === 'executeQuery' && designNode.configuration?.query) {
            params.query = designNode.configuration.query;
        }

        return params;
    }

    /**
     * Generate Webhook node parameters
     */
    async generateWebhookNodeParams(designNode, analysis) {
        return {
            httpMethod: 'POST',
            path: designNode.configuration?.path || `webhook-${Date.now()}`,
            responseMode: 'onReceived',
            responseData: 'allEntries',
            options: {}
        };
    }

    /**
     * Generate Cron node parameters
     */
    async generateCronNodeParams(designNode, analysis) {
        const params = {
            mode: 'everyX',
            value: 1,
            unit: 'hours'
        };

        // Parse frequency from analysis
        if (analysis.performance?.frequency) {
            const freq = analysis.performance.frequency.toLowerCase();
            
            if (freq.includes('minute')) {
                params.unit = 'minutes';
                params.value = parseInt(freq.match(/\d+/)?.[0]) || 1;
            } else if (freq.includes('hour')) {
                params.unit = 'hours';
                params.value = parseInt(freq.match(/\d+/)?.[0]) || 1;
            } else if (freq.includes('day')) {
                params.mode = 'everyDay';
                params.hour = 9;
                params.minute = 0;
            } else if (freq.includes('week')) {
                params.mode = 'everyWeek';
                params.weekday = 1;
                params.hour = 9;
                params.minute = 0;
            }
        }

        return params;
    }

    /**
     * Generate generic node parameters using AI
     */
    async generateGenericNodeParams(designNode, analysis) {
        const prompt = `
Generate n8n node parameters for:
Node Type: ${designNode.type}
Purpose: ${designNode.purpose}
Configuration Hints: ${JSON.stringify(designNode.configuration)}

Generate parameters in JSON format:`;

        try {
            const response = await this.callOpenAI(prompt, 'parameters');
            return this.parseJSONResponse(response);
        } catch (error) {
            return {}; // Empty parameters as fallback
        }
    }

    /**
     * Convert connections to n8n format
     */
    convertConnections(designConnections) {
        const n8nConnections = {};

        for (const [sourceId, connections] of Object.entries(designConnections)) {
            n8nConnections[sourceId] = connections;
        }

        return n8nConnections;
    }

    /**
     * Add error handling to workflow
     */
    async addErrorHandling(workflow, errorStrategy) {
        const errorHandlerId = this.generateNodeId();
        
        // Add error handler node
        const errorHandler = {
            id: errorHandlerId,
            name: 'Error Handler',
            type: 'n8n-nodes-base.errorTrigger',
            typeVersion: 1,
            position: [650, 400],
            parameters: {}
        };

        // Add notification node
        const notificationId = this.generateNodeId();
        const notification = {
            id: notificationId,
            name: 'Error Notification',
            type: 'n8n-nodes-base.emailSend',
            typeVersion: 1,
            position: [850, 400],
            parameters: {
                toEmail: '={{$parameter["errorEmail"]}}',
                subject: 'Workflow Error: {{$workflow.name}}',
                text: 'Error Details:\n\n{{$json["error"]}}'
            }
        };

        workflow.nodes.push(errorHandler, notification);
        
        // Connect error handler to notification
        workflow.connections[errorHandlerId] = {
            main: [[{ node: notificationId, type: 'main', index: 0 }]]
        };
    }

    /**
     * Optimize workflow for performance
     */
    async optimizeWorkflow(workflow, requirements) {
        const optimizations = [];

        // Check for parallelization opportunities
        const parallelizable = this.findParallelizableNodes(workflow);
        if (parallelizable.length > 0) {
            optimizations.push({
                type: 'parallelization',
                nodes: parallelizable,
                description: 'These nodes can run in parallel'
            });
        }

        // Check for batch processing opportunities
        if (requirements.performance?.expectedVolume > 1000) {
            optimizations.push({
                type: 'batching',
                description: 'Consider batch processing for large volumes'
            });
            await this.addBatchProcessing(workflow);
        }

        // Add rate limiting if needed
        if (workflow.nodes.some(n => n.type.includes('http'))) {
            optimizations.push({
                type: 'rate_limiting',
                description: 'Added rate limiting for API calls'
            });
            await this.addRateLimiting(workflow);
        }

        // Store optimizations in meta
        workflow.meta.optimizations = optimizations;

        return workflow;
    }

    /**
     * Find nodes that can run in parallel
     */
    findParallelizableNodes(workflow) {
        const parallelizable = [];
        const dependencies = this.buildDependencyGraph(workflow);

        // Find nodes with same dependencies that don't depend on each other
        for (const node1 of workflow.nodes) {
            for (const node2 of workflow.nodes) {
                if (node1.id !== node2.id && 
                    !this.dependsOn(node1.id, node2.id, dependencies) &&
                    !this.dependsOn(node2.id, node1.id, dependencies)) {
                    
                    parallelizable.push([node1.id, node2.id]);
                }
            }
        }

        return parallelizable;
    }

    /**
     * Build dependency graph
     */
    buildDependencyGraph(workflow) {
        const graph = new Map();

        for (const node of workflow.nodes) {
            graph.set(node.id, new Set());
        }

        for (const [sourceId, connections] of Object.entries(workflow.connections)) {
            for (const outputs of Object.values(connections)) {
                for (const output of outputs) {
                    for (const conn of output) {
                        graph.get(conn.node)?.add(sourceId);
                    }
                }
            }
        }

        return graph;
    }

    /**
     * Check if node1 depends on node2
     */
    dependsOn(node1, node2, dependencies) {
        const visited = new Set();
        const queue = [node1];

        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current)) continue;
            
            visited.add(current);
            
            if (current === node2) return true;
            
            const deps = dependencies.get(current) || new Set();
            for (const dep of deps) {
                queue.push(dep);
            }
        }

        return false;
    }

    /**
     * Add batch processing to workflow
     */
    async addBatchProcessing(workflow) {
        // Find nodes that process items
        const processingNodes = workflow.nodes.filter(n => 
            n.type === 'n8n-nodes-base.code' || 
            n.type.includes('database')
        );

        for (const node of processingNodes) {
            // Add batching parameters
            if (!node.parameters.options) {
                node.parameters.options = {};
            }
            node.parameters.options.batchSize = 100;
            node.parameters.options.batchInterval = 1000;
        }
    }

    /**
     * Add rate limiting to workflow
     */
    async addRateLimiting(workflow) {
        // Find HTTP nodes
        const httpNodes = workflow.nodes.filter(n => n.type.includes('http'));

        for (const node of httpNodes) {
            if (!node.parameters.options) {
                node.parameters.options = {};
            }
            node.parameters.options.timeout = 30000;
            node.parameters.options.retry = {
                maxTries: 3,
                waitBetweenTries: 1000
            };
        }
    }

    /**
     * Validate generated workflow
     */
    async validateWorkflow(workflow) {
        const errors = [];

        // Basic structure validation
        if (!workflow.nodes || workflow.nodes.length === 0) {
            errors.push('Workflow has no nodes');
        }

        // Check node IDs are unique
        const nodeIds = new Set();
        for (const node of workflow.nodes) {
            if (nodeIds.has(node.id)) {
                errors.push(`Duplicate node ID: ${node.id}`);
            }
            nodeIds.add(node.id);
        }

        // Validate connections
        for (const [sourceId, connections] of Object.entries(workflow.connections)) {
            if (!nodeIds.has(sourceId)) {
                errors.push(`Connection source not found: ${sourceId}`);
            }
            
            for (const outputs of Object.values(connections)) {
                for (const output of outputs) {
                    for (const conn of output) {
                        if (!nodeIds.has(conn.node)) {
                            errors.push(`Connection target not found: ${conn.node}`);
                        }
                    }
                }
            }
        }

        // Check for orphaned nodes
        const connectedNodes = new Set();
        for (const [sourceId, connections] of Object.entries(workflow.connections)) {
            connectedNodes.add(sourceId);
            for (const outputs of Object.values(connections)) {
                for (const output of outputs) {
                    for (const conn of output) {
                        connectedNodes.add(conn.node);
                    }
                }
            }
        }

        // Allow trigger nodes to be unconnected
        const triggerNodes = workflow.nodes.filter(n => 
            n.type.includes('trigger') || 
            n.type.includes('webhook') || 
            n.type.includes('cron')
        );

        for (const node of workflow.nodes) {
            if (!connectedNodes.has(node.id) && !triggerNodes.includes(node)) {
                errors.push(`Orphaned node: ${node.name} (${node.id})`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Build node registry
     */
    buildNodeRegistry() {
        const registry = new Map();

        // Core nodes
        const coreNodes = [
            { type: 'n8n-nodes-base.start', name: 'Start', category: 'trigger' },
            { type: 'n8n-nodes-base.webhook', name: 'Webhook', category: 'trigger' },
            { type: 'n8n-nodes-base.cron', name: 'Cron', category: 'trigger' },
            { type: 'n8n-nodes-base.httpRequest', name: 'HTTP Request', category: 'action' },
            { type: 'n8n-nodes-base.code', name: 'Code', category: 'transform' },
            { type: 'n8n-nodes-base.function', name: 'Function', category: 'transform' },
            { type: 'n8n-nodes-base.if', name: 'IF', category: 'flow' },
            { type: 'n8n-nodes-base.switch', name: 'Switch', category: 'flow' },
            { type: 'n8n-nodes-base.merge', name: 'Merge', category: 'flow' },
            { type: 'n8n-nodes-base.splitInBatches', name: 'Split In Batches', category: 'flow' },
            { type: 'n8n-nodes-base.postgres', name: 'Postgres', category: 'database' },
            { type: 'n8n-nodes-base.mysql', name: 'MySQL', category: 'database' },
            { type: 'n8n-nodes-base.mongodb', name: 'MongoDB', category: 'database' },
            { type: 'n8n-nodes-base.redis', name: 'Redis', category: 'database' },
            { type: 'n8n-nodes-base.emailSend', name: 'Send Email', category: 'communication' },
            { type: 'n8n-nodes-base.slack', name: 'Slack', category: 'communication' },
            { type: 'n8n-nodes-base.telegram', name: 'Telegram', category: 'communication' },
            { type: 'n8n-nodes-base.googleSheets', name: 'Google Sheets', category: 'productivity' },
            { type: 'n8n-nodes-base.airtable', name: 'Airtable', category: 'productivity' },
            { type: 'n8n-nodes-base.notion', name: 'Notion', category: 'productivity' }
        ];

        for (const node of coreNodes) {
            registry.set(node.type, node);
        }

        return registry;
    }

    /**
     * Get default node library
     */
    getDefaultNodeLibrary() {
        return Array.from(this.buildNodeRegistry().values());
    }

    /**
     * Get available node types for prompt
     */
    getAvailableNodeTypes() {
        const categories = {};
        
        for (const node of this.nodeRegistry.values()) {
            if (!categories[node.category]) {
                categories[node.category] = [];
            }
            categories[node.category].push(`${node.type} - ${node.name}`);
        }

        return Object.entries(categories)
            .map(([category, nodes]) => `${category.toUpperCase()}:\n${nodes.join('\n')}`)
            .join('\n\n');
    }

    /**
     * Call OpenAI API
     */
    async callOpenAI(prompt, purpose = 'general') {
        if (!this.config.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert n8n workflow designer. Generate valid JSON responses.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: purpose === 'code' ? 0.3 : this.config.temperature,
                max_tokens: this.config.maxTokens
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    /**
     * Parse JSON response from AI
     */
    parseJSONResponse(response) {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/```json\n?(.*?)\n?```/s) || [null, response];
            const jsonStr = jsonMatch[1] || response;
            
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('Failed to parse JSON response:', error);
            throw new Error('Invalid JSON response from AI');
        }
    }

    /**
     * Create fallback analysis
     */
    createFallbackAnalysis(description) {
        return {
            workflowType: 'general',
            primaryGoal: description,
            dataSources: [],
            dataDestinations: [],
            processingSteps: ['Process data'],
            triggers: ['manual'],
            errorHandling: 'basic',
            performance: {
                expectedVolume: 'unknown',
                frequency: 'on-demand',
                timeConstraints: 'none'
            },
            security: [],
            integrations: [],
            outputFormat: 'json',
            specialRequirements: []
        };
    }

    /**
     * Create fallback design
     */
    createFallbackDesign(analysis) {
        return {
            name: 'Basic Workflow',
            description: analysis.primaryGoal,
            nodes: [
                {
                    id: 'trigger',
                    name: 'Start',
                    type: 'n8n-nodes-base.start',
                    position: [250, 300]
                },
                {
                    id: 'process',
                    name: 'Process Data',
                    type: 'n8n-nodes-base.code',
                    purpose: 'Process incoming data',
                    position: [450, 300]
                }
            ],
            connections: {
                'trigger': {
                    'main': [[{ 'node': 'process', 'type': 'main', 'index': 0 }]]
                }
            },
            flow: ['Trigger workflow', 'Process data'],
            errorStrategy: 'log_and_continue',
            optimizations: []
        };
    }

    /**
     * Generate cache key
     */
    generateCacheKey(description, requirements) {
        return `${description}_${JSON.stringify(requirements)}`.replace(/\s+/g, '_');
    }

    /**
     * Generate workflow ID
     */
    generateWorkflowId() {
        return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate node ID
     */
    generateNodeId() {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get design statistics
     */
    getStats() {
        return {
            cacheSize: this.designCache.size,
            availableNodes: this.nodeRegistry.size,
            nodeCategories: [...new Set(Array.from(this.nodeRegistry.values()).map(n => n.category))].length
        };
    }

    /**
     * Clear design cache
     */
    clearCache() {
        this.designCache.clear();
        console.log('🗑️ Design cache cleared');
    }
}

module.exports = WorkflowDesigner;