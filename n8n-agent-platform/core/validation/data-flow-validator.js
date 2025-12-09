/**
 * Data Flow Validator - Validates data compatibility between workflow nodes
 * Ensures data types, schemas, and transformations are correct
 */

const EventEmitter = require('events');

class DataFlowValidator extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            strictMode: config.strictMode !== false,
            validateSchemas: config.validateSchemas !== false,
            maxDepth: config.maxDepth || 10,
            typeCoercion: config.typeCoercion !== false,
            ...config
        };

        this.validationCache = new Map();
        this.schemaRegistry = new Map();
        this.typeHandlers = this.initializeTypeHandlers();
    }

    /**
     * Validate data flow compatibility between nodes
     */
    async validateDataFlow(workflow) {
        console.log('🔍 Validating workflow data flow...');
        
        const validationResult = {
            valid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            nodeValidations: new Map(),
            dataFlowMap: new Map()
        };

        try {
            // Build data flow graph
            const flowGraph = this.buildDataFlowGraph(workflow);
            
            // Validate each connection
            for (const [targetNodeId, sources] of flowGraph.entries()) {
                const targetNode = workflow.nodes.find(n => n.id === targetNodeId);
                if (!targetNode) continue;

                for (const source of sources) {
                    const sourceNode = workflow.nodes.find(n => n.id === source.nodeId);
                    if (!sourceNode) continue;

                    const validation = await this.validateConnection(
                        sourceNode,
                        targetNode,
                        source.outputIndex,
                        source.inputIndex,
                        workflow
                    );

                    if (!validation.valid) {
                        validationResult.valid = false;
                        validationResult.errors.push(...validation.errors);
                    }

                    validationResult.warnings.push(...validation.warnings);
                    validationResult.suggestions.push(...validation.suggestions);
                    
                    // Store node validation
                    validationResult.nodeValidations.set(
                        `${sourceNode.id}->${targetNode.id}`,
                        validation
                    );
                }
            }

            // Check for data type mismatches
            await this.checkDataTypeMismatches(workflow, validationResult);
            
            // Check for missing required data
            await this.checkRequiredData(workflow, validationResult);
            
            // Check for circular dependencies
            this.checkCircularDependencies(workflow, validationResult);
            
            // Generate data flow map
            validationResult.dataFlowMap = this.generateDataFlowMap(workflow, flowGraph);

        } catch (error) {
            validationResult.valid = false;
            validationResult.errors.push(`Validation error: ${error.message}`);
        }

        console.log(`✅ Data flow validation complete: ${validationResult.valid ? 'PASSED' : 'FAILED'}`);
        
        this.emit('validation-complete', validationResult);
        return validationResult;
    }

    /**
     * Validate connection between two nodes
     */
    async validateConnection(sourceNode, targetNode, outputIndex, inputIndex, workflow) {
        const validation = {
            valid: true,
            errors: [],
            warnings: [],
            suggestions: [],
            dataTransformation: null
        };

        try {
            // Get expected output from source node
            const sourceOutput = await this.getNodeOutputSchema(sourceNode, outputIndex, workflow);
            
            // Get expected input for target node
            const targetInput = await this.getNodeInputSchema(targetNode, inputIndex, workflow);
            
            // Validate schema compatibility
            const compatibility = this.validateSchemaCompatibility(sourceOutput, targetInput);
            
            if (!compatibility.compatible) {
                validation.valid = false;
                validation.errors.push(
                    `Data incompatibility: ${sourceNode.name} output doesn't match ${targetNode.name} input. ${compatibility.reason}`
                );
                
                // Try to suggest transformation
                const transformation = this.suggestTransformation(sourceOutput, targetInput);
                if (transformation) {
                    validation.suggestions.push(transformation);
                    validation.dataTransformation = transformation;
                }
            }

            // Check for potential data loss
            if (compatibility.dataLoss) {
                validation.warnings.push(
                    `Potential data loss: ${compatibility.dataLoss}`
                );
            }

            // Validate specific node type combinations
            await this.validateNodeTypeCombination(sourceNode, targetNode, validation);

        } catch (error) {
            validation.errors.push(`Connection validation error: ${error.message}`);
            validation.valid = false;
        }

        return validation;
    }

    /**
     * Build data flow graph from workflow
     */
    buildDataFlowGraph(workflow) {
        const graph = new Map();

        // Initialize nodes
        for (const node of workflow.nodes) {
            graph.set(node.id, []);
        }

        // Build connections
        for (const [sourceId, connections] of Object.entries(workflow.connections || {})) {
            for (const [outputName, outputs] of Object.entries(connections)) {
                const outputIndex = outputName === 'main' ? 0 : parseInt(outputName) || 0;
                
                for (let i = 0; i < outputs.length; i++) {
                    for (const connection of outputs[i]) {
                        const sources = graph.get(connection.node) || [];
                        sources.push({
                            nodeId: sourceId,
                            outputIndex,
                            inputIndex: connection.index || 0
                        });
                        graph.set(connection.node, sources);
                    }
                }
            }
        }

        return graph;
    }

    /**
     * Get node output schema
     */
    async getNodeOutputSchema(node, outputIndex = 0, workflow) {
        // Check cache
        const cacheKey = `${node.id}_output_${outputIndex}`;
        if (this.validationCache.has(cacheKey)) {
            return this.validationCache.get(cacheKey);
        }

        let schema;

        // Get schema based on node type
        switch (node.type) {
            case 'n8n-nodes-base.httpRequest':
                schema = this.getHttpNodeOutputSchema(node);
                break;
            
            case 'n8n-nodes-base.code':
            case 'n8n-nodes-base.function':
                schema = await this.getCodeNodeOutputSchema(node);
                break;
            
            case 'n8n-nodes-base.postgres':
            case 'n8n-nodes-base.mysql':
            case 'n8n-nodes-base.mongodb':
                schema = this.getDatabaseNodeOutputSchema(node);
                break;
            
            case 'n8n-nodes-base.if':
                schema = this.getIfNodeOutputSchema(node, outputIndex);
                break;
            
            case 'n8n-nodes-base.merge':
                schema = this.getMergeNodeOutputSchema(node, workflow);
                break;
            
            default:
                schema = this.getGenericNodeOutputSchema(node);
        }

        this.validationCache.set(cacheKey, schema);
        return schema;
    }

    /**
     * Get node input schema
     */
    async getNodeInputSchema(node, inputIndex = 0, workflow) {
        // Check cache
        const cacheKey = `${node.id}_input_${inputIndex}`;
        if (this.validationCache.has(cacheKey)) {
            return this.validationCache.get(cacheKey);
        }

        let schema;

        // Get schema based on node type
        switch (node.type) {
            case 'n8n-nodes-base.httpRequest':
                schema = this.getHttpNodeInputSchema(node);
                break;
            
            case 'n8n-nodes-base.code':
            case 'n8n-nodes-base.function':
                schema = this.getCodeNodeInputSchema(node);
                break;
            
            case 'n8n-nodes-base.postgres':
            case 'n8n-nodes-base.mysql':
            case 'n8n-nodes-base.mongodb':
                schema = this.getDatabaseNodeInputSchema(node);
                break;
            
            default:
                schema = this.getGenericNodeInputSchema(node);
        }

        this.validationCache.set(cacheKey, schema);
        return schema;
    }

    /**
     * Get HTTP node output schema
     */
    getHttpNodeOutputSchema(node) {
        const responseFormat = node.parameters?.responseFormat || 'json';
        
        return {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    json: {
                        type: responseFormat === 'json' ? 'object' : 'string',
                        description: 'Response data'
                    },
                    headers: {
                        type: 'object',
                        description: 'Response headers'
                    },
                    statusCode: {
                        type: 'number',
                        description: 'HTTP status code'
                    }
                }
            }
        };
    }

    /**
     * Get Code node output schema
     */
    async getCodeNodeOutputSchema(node) {
        const code = node.parameters?.jsCode || node.parameters?.functionCode || '';
        
        // Try to infer from code
        if (code.includes('return [{') && code.includes('json:')) {
            // Standard n8n format
            return {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        json: {
                            type: 'object',
                            additionalProperties: true
                        }
                    }
                }
            };
        }
        
        // Generic output
        return {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: true
            }
        };
    }

    /**
     * Get Database node output schema
     */
    getDatabaseNodeOutputSchema(node) {
        const operation = node.parameters?.operation || 'executeQuery';
        
        switch (operation) {
            case 'executeQuery':
                return {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            json: {
                                type: 'object',
                                additionalProperties: true,
                                description: 'Query result row'
                            }
                        }
                    }
                };
            
            case 'insert':
                return {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            json: {
                                type: 'object',
                                properties: {
                                    id: { type: ['string', 'number'] },
                                    success: { type: 'boolean' }
                                }
                            }
                        }
                    }
                };
            
            default:
                return this.getGenericNodeOutputSchema(node);
        }
    }

    /**
     * Get IF node output schema
     */
    getIfNodeOutputSchema(node, outputIndex) {
        // IF node has two outputs: true (0) and false (1)
        return {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: true
            },
            description: outputIndex === 0 ? 'True branch' : 'False branch'
        };
    }

    /**
     * Get Merge node output schema
     */
    getMergeNodeOutputSchema(node, workflow) {
        // Merge combines inputs
        return {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: true
            },
            description: 'Merged data from all inputs'
        };
    }

    /**
     * Get generic node output schema
     */
    getGenericNodeOutputSchema(node) {
        return {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    json: {
                        type: 'object',
                        additionalProperties: true
                    }
                }
            }
        };
    }

    /**
     * Get HTTP node input schema
     */
    getHttpNodeInputSchema(node) {
        return {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: true
            },
            optional: true // HTTP nodes can work without input
        };
    }

    /**
     * Get Code node input schema
     */
    getCodeNodeInputSchema(node) {
        return {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    json: {
                        type: 'object',
                        additionalProperties: true
                    }
                }
            }
        };
    }

    /**
     * Get Database node input schema
     */
    getDatabaseNodeInputSchema(node) {
        const operation = node.parameters?.operation || 'executeQuery';
        
        switch (operation) {
            case 'insert':
            case 'update':
                return {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            json: {
                                type: 'object',
                                additionalProperties: true,
                                required: true
                            }
                        }
                    },
                    minItems: 1
                };
            
            default:
                return this.getGenericNodeInputSchema(node);
        }
    }

    /**
     * Get generic node input schema
     */
    getGenericNodeInputSchema(node) {
        return {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: true
            }
        };
    }

    /**
     * Validate schema compatibility
     */
    validateSchemaCompatibility(sourceSchema, targetSchema) {
        const result = {
            compatible: true,
            reason: '',
            dataLoss: null
        };

        // Handle optional inputs
        if (targetSchema.optional && !sourceSchema) {
            return result;
        }

        // Check basic type compatibility
        if (sourceSchema.type !== targetSchema.type) {
            if (this.config.typeCoercion && this.canCoerceType(sourceSchema.type, targetSchema.type)) {
                result.dataLoss = `Type coercion from ${sourceSchema.type} to ${targetSchema.type}`;
            } else {
                result.compatible = false;
                result.reason = `Type mismatch: source outputs ${sourceSchema.type}, target expects ${targetSchema.type}`;
                return result;
            }
        }

        // For arrays, check item compatibility
        if (sourceSchema.type === 'array' && targetSchema.type === 'array') {
            if (sourceSchema.items && targetSchema.items) {
                const itemCompatibility = this.validateSchemaCompatibility(
                    sourceSchema.items,
                    targetSchema.items
                );
                
                if (!itemCompatibility.compatible) {
                    result.compatible = false;
                    result.reason = `Array item ${itemCompatibility.reason}`;
                    return result;
                }
            }
        }

        // For objects, check property compatibility
        if (sourceSchema.type === 'object' && targetSchema.type === 'object') {
            if (targetSchema.properties) {
                for (const [prop, propSchema] of Object.entries(targetSchema.properties)) {
                    if (propSchema.required && !sourceSchema.properties?.[prop]) {
                        result.compatible = false;
                        result.reason = `Missing required property: ${prop}`;
                        return result;
                    }
                }
            }
        }

        // Check minimum items for arrays
        if (targetSchema.minItems && sourceSchema.type === 'array') {
            if (!sourceSchema.minItems || sourceSchema.minItems < targetSchema.minItems) {
                result.compatible = false;
                result.reason = `Target requires at least ${targetSchema.minItems} items`;
                return result;
            }
        }

        return result;
    }

    /**
     * Check if type can be coerced
     */
    canCoerceType(sourceType, targetType) {
        const coercionRules = {
            'string': ['number', 'boolean'],
            'number': ['string', 'boolean'],
            'boolean': ['string', 'number'],
            'object': ['string'], // JSON stringify
            'array': ['string']   // JSON stringify
        };

        return coercionRules[sourceType]?.includes(targetType) || false;
    }

    /**
     * Suggest transformation to fix incompatibility
     */
    suggestTransformation(sourceSchema, targetSchema) {
        const suggestions = [];

        // Type mismatch transformations
        if (sourceSchema.type !== targetSchema.type) {
            if (sourceSchema.type === 'string' && targetSchema.type === 'number') {
                suggestions.push({
                    type: 'code_transformation',
                    description: 'Convert string to number',
                    code: 'parseInt(item.json.value) || 0'
                });
            } else if (sourceSchema.type === 'object' && targetSchema.type === 'string') {
                suggestions.push({
                    type: 'code_transformation',
                    description: 'Convert object to JSON string',
                    code: 'JSON.stringify(item.json)'
                });
            }
        }

        // Missing property transformations
        if (targetSchema.properties) {
            const missingProps = Object.entries(targetSchema.properties)
                .filter(([prop, schema]) => schema.required && !sourceSchema.properties?.[prop])
                .map(([prop]) => prop);

            if (missingProps.length > 0) {
                suggestions.push({
                    type: 'add_properties',
                    description: `Add missing properties: ${missingProps.join(', ')}`,
                    code: `item.json.${missingProps[0]} = ''; // Add default value`
                });
            }
        }

        // Create transformation node suggestion
        if (suggestions.length > 0) {
            return {
                type: 'add_transformation_node',
                description: 'Add a Code node to transform data',
                node: {
                    type: 'n8n-nodes-base.code',
                    name: 'Data Transformer',
                    parameters: {
                        jsCode: this.generateTransformationCode(sourceSchema, targetSchema, suggestions)
                    }
                }
            };
        }

        return null;
    }

    /**
     * Generate transformation code
     */
    generateTransformationCode(sourceSchema, targetSchema, suggestions) {
        return `
// Data transformation to match expected format
const items = $input.all();

return items.map(item => {
  const transformedData = { ...item.json };
  
  // Apply transformations
  ${suggestions.map(s => s.code).join('\n  ')}
  
  return { json: transformedData };
});`;
    }

    /**
     * Validate specific node type combinations
     */
    async validateNodeTypeCombination(sourceNode, targetNode, validation) {
        // Webhook -> HTTP Request warning
        if (sourceNode.type.includes('webhook') && targetNode.type.includes('http')) {
            validation.warnings.push(
                'Webhook to HTTP Request: Ensure webhook data format matches API requirements'
            );
        }

        // Database -> Email warning
        if (sourceNode.type.includes('database') && targetNode.type.includes('email')) {
            validation.warnings.push(
                'Database to Email: Consider limiting query results to avoid sending too many emails'
            );
        }

        // Code -> Database validation
        if (sourceNode.type.includes('code') && targetNode.type.includes('database')) {
            validation.warnings.push(
                'Code to Database: Ensure generated data matches database schema'
            );
        }
    }

    /**
     * Check for data type mismatches in workflow
     */
    async checkDataTypeMismatches(workflow, validationResult) {
        // Find all Code nodes that might have type issues
        const codeNodes = workflow.nodes.filter(n => 
            n.type === 'n8n-nodes-base.code' || 
            n.type === 'n8n-nodes-base.function'
        );

        for (const node of codeNodes) {
            const code = node.parameters?.jsCode || node.parameters?.functionCode || '';
            
            // Check for common type issues
            if (code.includes('JSON.parse') && !code.includes('try')) {
                validationResult.warnings.push({
                    nodeId: node.id,
                    nodeName: node.name,
                    issue: 'JSON.parse without error handling',
                    suggestion: 'Wrap JSON.parse in try-catch block'
                });
            }

            if (code.includes('.map(') && !code.includes('Array.isArray')) {
                validationResult.warnings.push({
                    nodeId: node.id,
                    nodeName: node.name,
                    issue: 'Using .map() without checking if data is array',
                    suggestion: 'Add Array.isArray() check before using .map()'
                });
            }
        }
    }

    /**
     * Check for missing required data
     */
    async checkRequiredData(workflow, validationResult) {
        // Check database nodes for required fields
        const dbNodes = workflow.nodes.filter(n => 
            n.type.includes('database') || 
            n.type.includes('postgres') ||
            n.type.includes('mysql')
        );

        for (const node of dbNodes) {
            if (node.parameters?.operation === 'insert') {
                const table = node.parameters?.table;
                if (!table) {
                    validationResult.errors.push({
                        nodeId: node.id,
                        nodeName: node.name,
                        issue: 'Database insert without table specified'
                    });
                }
            }
        }

        // Check HTTP nodes for required parameters
        const httpNodes = workflow.nodes.filter(n => n.type.includes('http'));
        for (const node of httpNodes) {
            if (!node.parameters?.url) {
                validationResult.errors.push({
                    nodeId: node.id,
                    nodeName: node.name,
                    issue: 'HTTP Request without URL'
                });
            }
        }
    }

    /**
     * Check for circular dependencies
     */
    checkCircularDependencies(workflow, validationResult) {
        const visited = new Set();
        const recursionStack = new Set();

        const hasCycle = (nodeId, connections) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);

            const nodeConnections = connections[nodeId];
            if (nodeConnections) {
                for (const outputs of Object.values(nodeConnections)) {
                    for (const output of outputs) {
                        for (const conn of output) {
                            if (!visited.has(conn.node)) {
                                if (hasCycle(conn.node, connections)) {
                                    return true;
                                }
                            } else if (recursionStack.has(conn.node)) {
                                return true;
                            }
                        }
                    }
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        // Check each node
        for (const node of workflow.nodes) {
            if (!visited.has(node.id)) {
                if (hasCycle(node.id, workflow.connections || {})) {
                    validationResult.errors.push({
                        type: 'circular_dependency',
                        message: 'Workflow contains circular dependencies',
                        severity: 'critical'
                    });
                    break;
                }
            }
        }
    }

    /**
     * Generate data flow map
     */
    generateDataFlowMap(workflow, flowGraph) {
        const dataFlowMap = new Map();

        for (const [nodeId, sources] of flowGraph.entries()) {
            const node = workflow.nodes.find(n => n.id === nodeId);
            if (!node) continue;

            const nodeFlow = {
                nodeId,
                nodeName: node.name,
                nodeType: node.type,
                inputs: sources.map(s => {
                    const sourceNode = workflow.nodes.find(n => n.id === s.nodeId);
                    return {
                        sourceNodeId: s.nodeId,
                        sourceNodeName: sourceNode?.name,
                        outputIndex: s.outputIndex,
                        inputIndex: s.inputIndex
                    };
                }),
                dataTransformations: []
            };

            // Identify transformations
            if (node.type === 'n8n-nodes-base.code') {
                nodeFlow.dataTransformations.push('custom_code');
            } else if (node.type === 'n8n-nodes-base.if') {
                nodeFlow.dataTransformations.push('conditional_split');
            } else if (node.type === 'n8n-nodes-base.merge') {
                nodeFlow.dataTransformations.push('data_merge');
            }

            dataFlowMap.set(nodeId, nodeFlow);
        }

        return dataFlowMap;
    }

    /**
     * Initialize type handlers
     */
    initializeTypeHandlers() {
        return new Map([
            ['string', {
                validate: (value) => typeof value === 'string',
                coerce: (value) => String(value)
            }],
            ['number', {
                validate: (value) => typeof value === 'number',
                coerce: (value) => Number(value)
            }],
            ['boolean', {
                validate: (value) => typeof value === 'boolean',
                coerce: (value) => Boolean(value)
            }],
            ['object', {
                validate: (value) => typeof value === 'object' && value !== null,
                coerce: (value) => typeof value === 'string' ? JSON.parse(value) : value
            }],
            ['array', {
                validate: (value) => Array.isArray(value),
                coerce: (value) => Array.isArray(value) ? value : [value]
            }]
        ]);
    }

    /**
     * Get validation report
     */
    getValidationReport(validationResult) {
        const report = {
            summary: {
                valid: validationResult.valid,
                errorCount: validationResult.errors.length,
                warningCount: validationResult.warnings.length,
                suggestionCount: validationResult.suggestions.length
            },
            criticalIssues: validationResult.errors.filter(e => 
                e.severity === 'critical' || e.type === 'circular_dependency'
            ),
            dataFlowIssues: Array.from(validationResult.nodeValidations.entries())
                .filter(([_, validation]) => !validation.valid)
                .map(([connection, validation]) => ({
                    connection,
                    errors: validation.errors,
                    suggestions: validation.suggestions
                })),
            recommendations: this.generateRecommendations(validationResult)
        };

        return report;
    }

    /**
     * Generate recommendations based on validation
     */
    generateRecommendations(validationResult) {
        const recommendations = [];

        // Data transformation recommendations
        const transformationNeeded = validationResult.suggestions.filter(s => 
            s.type === 'add_transformation_node'
        );
        
        if (transformationNeeded.length > 0) {
            recommendations.push({
                priority: 'high',
                type: 'add_nodes',
                description: `Add ${transformationNeeded.length} transformation node(s) to fix data compatibility`,
                details: transformationNeeded
            });
        }

        // Error handling recommendations
        const missingErrorHandling = validationResult.warnings.filter(w => 
            w.issue?.includes('without error handling')
        );

        if (missingErrorHandling.length > 0) {
            recommendations.push({
                priority: 'medium',
                type: 'improve_error_handling',
                description: 'Add error handling to prevent workflow failures',
                affectedNodes: missingErrorHandling.map(w => w.nodeName)
            });
        }

        // Performance recommendations
        const largeDataFlows = Array.from(validationResult.dataFlowMap.values())
            .filter(flow => flow.inputs.length > 3);

        if (largeDataFlows.length > 0) {
            recommendations.push({
                priority: 'low',
                type: 'optimize_performance',
                description: 'Consider batching or optimizing nodes with many inputs',
                affectedNodes: largeDataFlows.map(f => f.nodeName)
            });
        }

        return recommendations;
    }

    /**
     * Clear validation cache
     */
    clearCache() {
        this.validationCache.clear();
        console.log('🗑️ Validation cache cleared');
    }
}

module.exports = DataFlowValidator;