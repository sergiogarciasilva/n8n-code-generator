import { 
    N8nWorkflow, 
    N8nNode, 
    WorkflowValidationResult, 
    ValidationError, 
    ValidationWarning,
    PerformanceAnalysis,
    SecurityAnalysis,
    CompatibilityCheck
} from '../types/workflows';
import { logger } from '../utils/logger';

/**
 * Advanced Workflow Validator
 * 
 * Provides multi-level validation for n8n workflows:
 * - Syntax validation (JSON structure, required fields)
 * - Semantic validation (logical connections, data flow)
 * - Performance analysis (bottlenecks, optimization opportunities)
 * - Security analysis (credential exposure, sensitive data)
 * - Compatibility checks (n8n version, node availability)
 */
export class WorkflowValidator {
    private supportedNodeTypes: Set<string>;
    private securityPatterns: RegExp[];
    private performanceThresholds: {
        maxNodes: number;
        maxConnections: number;
        maxExecutionTime: number;
        maxMemoryUsage: number;
    };

    constructor() {
        this.initializeSupportedNodes();
        this.initializeSecurityPatterns();
        this.performanceThresholds = {
            maxNodes: 50,
            maxConnections: 100,
            maxExecutionTime: 300, // 5 minutes
            maxMemoryUsage: 512 // MB
        };
    }

    private initializeSupportedNodes(): void {
        this.supportedNodeTypes = new Set([
            // Core trigger nodes
            'n8n-nodes-base.webhook',
            'n8n-nodes-base.cron',
            'n8n-nodes-base.manualTrigger',
            'n8n-nodes-base.emailTrigger',
            
            // Logic nodes
            'n8n-nodes-base.if',
            'n8n-nodes-base.switch',
            'n8n-nodes-base.merge',
            'n8n-nodes-base.set',
            'n8n-nodes-base.code',
            
            // Communication nodes
            'n8n-nodes-base.httpRequest',
            'n8n-nodes-base.emailSend',
            'n8n-nodes-base.telegram',
            'n8n-nodes-base.slack',
            'n8n-nodes-base.discord',
            
            // AI nodes
            'n8n-nodes-base.openAi',
            '@n8n/n8n-nodes-langchain.openAi',
            'n8n-nodes-base.anthropic',
            
            // Database nodes
            'n8n-nodes-base.postgres',
            'n8n-nodes-base.mysql',
            'n8n-nodes-base.mongodb',
            'n8n-nodes-base.redis',
            
            // Utility nodes
            'n8n-nodes-base.sort',
            'n8n-nodes-base.filter',
            'n8n-nodes-base.aggregate',
            'n8n-nodes-base.dateTime',
            'n8n-nodes-base.crypto',
            
            // Response nodes
            'n8n-nodes-base.respondToWebhook',
            'n8n-nodes-base.noOp'
        ]);
    }

    private initializeSecurityPatterns(): void {
        this.securityPatterns = [
            // API keys and tokens
            /(?:api[_-]?key|token|secret|password|passwd|pwd)\s*[:=]\s*['"]?[\w\-\.]+['"]?/gi,
            
            // Email addresses
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            
            // URLs with credentials
            /https?:\/\/[\w\-\.]+:[\w\-\.]+@[\w\-\.]+/g,
            
            // Credit card numbers (basic pattern)
            /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,
            
            // AWS keys
            /AKIA[0-9A-Z]{16}/g,
            
            // JWT tokens
            /eyJ[A-Za-z0-9_\/+-]*\./g
        ];
    }

    async validateWorkflow(workflow: N8nWorkflow): Promise<WorkflowValidationResult> {
        try {
            const errors: ValidationError[] = [];
            const warnings: ValidationWarning[] = [];

            logger.info('Starting workflow validation', { 
                workflowName: workflow.name,
                nodeCount: workflow.nodes?.length || 0 
            });

            // Syntax validation
            const syntaxErrors = await this.validateSyntax(workflow);
            errors.push(...syntaxErrors);

            // Semantic validation
            const semanticErrors = await this.validateSemantics(workflow);
            errors.push(...semanticErrors);

            // Performance analysis
            const performanceAnalysis = await this.analyzePerformance(workflow);
            warnings.push(...(performanceAnalysis as any).warnings || []);

            // Security analysis
            const securityAnalysis = await this.analyzeWorkflowSecurity(workflow);
            if (securityAnalysis.credentialsExposed) {
                errors.push({
                    type: 'security',
                    severity: 'error',
                    message: 'Potential credential exposure detected',
                    suggestion: 'Use environment variables for sensitive data'
                });
            }

            // Compatibility check
            const compatibilityCheck = await this.checkCompatibility(workflow);
            if (compatibilityCheck.migrationRequired) {
                warnings.push({
                    type: 'compatibility',
                    message: 'Workflow may require migration for n8n v1.x.x',
                    nodeId: undefined,
                    nodeName: undefined,
                    suggestion: 'Review deprecated nodes and update configurations'
                });
            }

            const isValid = errors.filter(e => e.severity === 'error').length === 0;

            logger.info('Workflow validation completed', {
                workflowName: workflow.name,
                isValid,
                errorCount: errors.length,
                warningCount: warnings.length
            });

            return {
                isValid,
                errors,
                warnings,
                performance: performanceAnalysis,
                security: securityAnalysis,
                compatibility: compatibilityCheck
            };

        } catch (error) {
            logger.error('Workflow validation failed', { 
                error: error.message,
                workflowName: workflow.name 
            });
            
            return {
                isValid: false,
                errors: [{
                    type: 'syntax',
                    severity: 'error',
                    message: `Validation failed: ${error.message}`,
                    suggestion: 'Check workflow structure and try again'
                }],
                warnings: [],
                performance: this.getDefaultPerformanceAnalysis(),
                security: this.getDefaultSecurityAnalysis(),
                compatibility: this.getDefaultCompatibilityCheck()
            };
        }
    }

    private async validateSyntax(workflow: N8nWorkflow): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        // Check required workflow fields
        if (!workflow.name || workflow.name.trim().length === 0) {
            errors.push({
                type: 'syntax',
                severity: 'error',
                message: 'Workflow name is required',
                suggestion: 'Add a descriptive name for the workflow'
            });
        }

        if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
            errors.push({
                type: 'syntax',
                severity: 'error',
                message: 'Workflow must have a nodes array',
                suggestion: 'Add at least one node to the workflow'
            });
            return errors;
        }

        if (workflow.nodes.length === 0) {
            errors.push({
                type: 'syntax',
                severity: 'error',
                message: 'Workflow must have at least one node',
                suggestion: 'Add nodes to create a functional workflow'
            });
        }

        // Validate each node
        const nodeIds = new Set<string>();
        workflow.nodes.forEach((node, index) => {
            const nodeErrors = this.validateNode(node, index);
            errors.push(...nodeErrors);

            // Check for duplicate node IDs
            if (node.id) {
                if (nodeIds.has(node.id)) {
                    errors.push({
                        type: 'syntax',
                        severity: 'error',
                        message: `Duplicate node ID: ${node.id}`,
                        nodeId: node.id,
                        nodeName: node.name,
                        suggestion: 'Use unique IDs for all nodes'
                    });
                }
                nodeIds.add(node.id);
            }
        });

        // Validate connections
        if (workflow.connections) {
            const connectionErrors = this.validateConnections(workflow.connections, nodeIds);
            errors.push(...connectionErrors);
        }

        return errors;
    }

    private validateNode(node: N8nNode, index: number): ValidationError[] {
        const errors: ValidationError[] = [];

        // Required fields
        if (!node.id) {
            errors.push({
                type: 'syntax',
                severity: 'error',
                message: `Node at index ${index} missing required 'id' field`,
                suggestion: 'Add a unique ID for the node'
            });
        }

        if (!node.name) {
            errors.push({
                type: 'syntax',
                severity: 'error',
                message: `Node ${node.id || index} missing required 'name' field`,
                nodeId: node.id,
                suggestion: 'Add a descriptive name for the node'
            });
        }

        if (!node.type) {
            errors.push({
                type: 'syntax',
                severity: 'error',
                message: `Node ${node.name || node.id || index} missing required 'type' field`,
                nodeId: node.id,
                nodeName: node.name,
                suggestion: 'Specify the node type (e.g., n8n-nodes-base.httpRequest)'
            });
        } else if (!this.supportedNodeTypes.has(node.type)) {
            errors.push({
                type: 'syntax',
                severity: 'warning',
                message: `Node type '${node.type}' may not be supported in n8n v1.x.x`,
                nodeId: node.id,
                nodeName: node.name,
                suggestion: 'Verify node type compatibility'
            } as ValidationError);
        }

        // Position validation
        if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
            errors.push({
                type: 'syntax',
                severity: 'warning',
                message: `Node ${node.name || node.id} missing or invalid position`,
                nodeId: node.id,
                nodeName: node.name,
                suggestion: 'Add position [x, y] coordinates for visual layout'
            } as ValidationError);
        }

        return errors;
    }

    private validateConnections(connections: any, validNodeIds: Set<string>): ValidationError[] {
        const errors: ValidationError[] = [];

        for (const [sourceNodeName, nodeConnections] of Object.entries(connections)) {
            if (typeof nodeConnections !== 'object' || nodeConnections === null) {
                continue;
            }

            // Validate main connections
            const typedConnections = nodeConnections as { main?: any[][] };
            if (typedConnections.main && Array.isArray(typedConnections.main)) {
                typedConnections.main.forEach((connectionGroup: any[], groupIndex: number) => {
                    if (Array.isArray(connectionGroup)) {
                        connectionGroup.forEach((connection: any, connIndex: number) => {
                            if (!connection.node) {
                                errors.push({
                                    type: 'syntax',
                                    severity: 'error',
                                    message: `Invalid connection from ${sourceNodeName}`,
                                    suggestion: 'Specify target node for connection'
                                });
                            }
                        });
                    }
                });
            }
        }

        return errors;
    }

    private async validateSemantics(workflow: N8nWorkflow): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        // Check for isolated nodes (nodes with no inputs or outputs)
        const connectedNodes = this.getConnectedNodes(workflow.connections || {});
        const allNodeNames = new Set(workflow.nodes.map(node => node.name));
        
        workflow.nodes.forEach(node => {
            if (!this.isTriggerNode(node.type) && !connectedNodes.inputs.has(node.name)) {
                errors.push({
                    type: 'semantic',
                    severity: 'warning',
                    message: `Node '${node.name}' has no input connections`,
                    nodeId: node.id,
                    nodeName: node.name,
                    suggestion: 'Connect this node to receive data from previous nodes'
                } as ValidationError);
            }

            if (!this.isTerminalNode(node.type) && !connectedNodes.outputs.has(node.name)) {
                errors.push({
                    type: 'semantic',
                    severity: 'warning',
                    message: `Node '${node.name}' has no output connections`,
                    nodeId: node.id,
                    nodeName: node.name,
                    suggestion: 'Connect this node to pass data to subsequent nodes'
                } as ValidationError);
            }
        });

        // Check for circular dependencies
        const circularDeps = this.detectCircularDependencies(workflow.connections || {});
        circularDeps.forEach(cycle => {
            errors.push({
                type: 'semantic',
                severity: 'error',
                message: `Circular dependency detected: ${cycle.join(' → ')}`,
                suggestion: 'Remove circular connections to prevent infinite loops'
            });
        });

        return errors;
    }

    private async analyzePerformance(workflow: N8nWorkflow): Promise<PerformanceAnalysis> {
        const nodeCount = workflow.nodes?.length || 0;
        const connectionCount = this.countConnections(workflow.connections || {});
        
        const analysis: PerformanceAnalysis = {
            estimatedExecutionTime: this.estimateExecutionTime(workflow),
            memoryUsage: this.estimateMemoryUsage(nodeCount),
            cpuIntensity: this.estimateCpuIntensity(workflow),
            bottlenecks: [],
            optimizationSuggestions: [],
            parallelizationOpportunities: []
        };

        // Identify bottlenecks
        if (nodeCount > this.performanceThresholds.maxNodes) {
            analysis.bottlenecks.push(`High node count (${nodeCount})`);
            analysis.optimizationSuggestions.push('Consider breaking into smaller workflows');
        }

        if (connectionCount > this.performanceThresholds.maxConnections) {
            analysis.bottlenecks.push(`High connection count (${connectionCount})`);
            analysis.optimizationSuggestions.push('Simplify workflow structure');
        }

        // Check for sequential API calls that could be parallelized
        const apiNodes = workflow.nodes.filter(node => 
            node.type === 'n8n-nodes-base.httpRequest' || 
            node.type === 'n8n-nodes-base.openAi'
        );
        
        if (apiNodes.length > 2) {
            analysis.parallelizationOpportunities.push('Multiple API calls could be parallelized');
        }

        // Check for expensive operations
        const codeNodes = workflow.nodes.filter(node => node.type === 'n8n-nodes-base.code');
        if (codeNodes.length > 3) {
            analysis.bottlenecks.push('Multiple code nodes may impact performance');
            analysis.optimizationSuggestions.push('Combine related code operations');
        }

        return analysis;
    }

    private async analyzeWorkflowSecurity(workflow: N8nWorkflow): Promise<SecurityAnalysis> {
        const analysis: SecurityAnalysis = {
            credentialsExposed: false,
            sensitiveDataInLogs: false,
            unsecureConnections: [],
            securityLevel: 'medium',
            complianceIssues: [],
            recommendations: []
        };

        // Check for hardcoded credentials
        const workflowJson = JSON.stringify(workflow);
        for (const pattern of this.securityPatterns) {
            if (pattern.test(workflowJson)) {
                analysis.credentialsExposed = true;
                analysis.recommendations.push('Use credential management instead of hardcoded values');
                break;
            }
        }

        // Check for insecure HTTP connections
        workflow.nodes.forEach(node => {
            if (node.type === 'n8n-nodes-base.httpRequest') {
                const url = node.parameters?.url;
                if (typeof url === 'string' && url.startsWith('http://')) {
                    analysis.unsecureConnections.push(node.name);
                    analysis.recommendations.push(`Use HTTPS for ${node.name}`);
                }
            }
        });

        // Check webhook security
        const webhookNodes = workflow.nodes.filter(node => node.type === 'n8n-nodes-base.webhook');
        webhookNodes.forEach(node => {
            const auth = node.parameters?.options?.authentication;
            if (!auth || auth === 'none') {
                analysis.complianceIssues.push(`Webhook ${node.name} has no authentication`);
                analysis.recommendations.push('Add authentication to webhook endpoints');
            }
        });

        // Determine security level
        if (analysis.credentialsExposed || analysis.unsecureConnections.length > 0) {
            analysis.securityLevel = 'low';
        } else if (analysis.complianceIssues.length > 0) {
            analysis.securityLevel = 'medium';
        } else {
            analysis.securityLevel = 'high';
        }

        return analysis;
    }

    private async checkCompatibility(workflow: N8nWorkflow): Promise<CompatibilityCheck> {
        const check: CompatibilityCheck = {
            n8nVersion: 'v1.x.x',
            supportedVersions: ['v1.0.0', 'v1.1.0', 'v1.2.0'],
            deprecatedNodes: [],
            missingCredentials: [],
            requiredIntegrations: [],
            migrationRequired: false
        };

        // Check for deprecated node types
        const deprecatedTypes = [
            'n8n-nodes-base.httpRequestV1', // Replaced by httpRequest
            'n8n-nodes-base.function', // Replaced by code
        ];

        workflow.nodes.forEach(node => {
            if (deprecatedTypes.includes(node.type)) {
                check.deprecatedNodes.push(node.name);
                check.migrationRequired = true;
            }

            // Check for required integrations
            if (node.type === 'n8n-nodes-base.openAi') {
                check.requiredIntegrations.push('OpenAI API');
            }
            if (node.type === 'n8n-nodes-base.telegram') {
                check.requiredIntegrations.push('Telegram Bot API');
            }
        });

        return check;
    }

    // Helper methods
    private isTriggerNode(nodeType: string): boolean {
        const triggerTypes = [
            'n8n-nodes-base.webhook',
            'n8n-nodes-base.cron',
            'n8n-nodes-base.manualTrigger',
            'n8n-nodes-base.emailTrigger'
        ];
        return triggerTypes.includes(nodeType);
    }

    private isTerminalNode(nodeType: string): boolean {
        const terminalTypes = [
            'n8n-nodes-base.respondToWebhook',
            'n8n-nodes-base.emailSend',
            'n8n-nodes-base.noOp'
        ];
        return terminalTypes.includes(nodeType);
    }

    private getConnectedNodes(connections: any): { inputs: Set<string>; outputs: Set<string> } {
        const inputs = new Set<string>();
        const outputs = new Set<string>();

        for (const [sourceNode, nodeConnections] of Object.entries(connections)) {
            outputs.add(sourceNode);
            
            if (nodeConnections && typeof nodeConnections === 'object') {
                const typedConnections = nodeConnections as { main?: any[][] };
                if (typedConnections.main && Array.isArray(typedConnections.main)) {
                    typedConnections.main.forEach((connectionGroup: any[]) => {
                        if (Array.isArray(connectionGroup)) {
                            connectionGroup.forEach((connection: any) => {
                                if (connection.node) {
                                    inputs.add(connection.node);
                                }
                            });
                        }
                    });
                }
            }
        }

        return { inputs, outputs };
    }

    private detectCircularDependencies(connections: any): string[][] {
        // Simplified circular dependency detection
        // In a full implementation, this would use graph algorithms
        return [];
    }

    private countConnections(connections: any): number {
        let count = 0;
        for (const nodeConnections of Object.values(connections)) {
            if (nodeConnections && typeof nodeConnections === 'object') {
                const typedConnections = nodeConnections as { main?: any[][] };
                if (typedConnections.main && Array.isArray(typedConnections.main)) {
                    typedConnections.main.forEach((connectionGroup: any[]) => {
                        if (Array.isArray(connectionGroup)) {
                            count += connectionGroup.length;
                        }
                    });
                }
            }
        }
        return count;
    }

    private estimateExecutionTime(workflow: N8nWorkflow): string {
        const nodeCount = workflow.nodes?.length || 0;
        const apiNodes = workflow.nodes?.filter(node => 
            node.type === 'n8n-nodes-base.httpRequest' || 
            node.type === 'n8n-nodes-base.openAi'
        ).length || 0;

        // Base time + API call time + processing time
        const baseTime = 0.5; // seconds
        const apiTime = apiNodes * 1.5; // 1.5s per API call
        const processingTime = nodeCount * 0.1; // 0.1s per node

        const totalSeconds = baseTime + apiTime + processingTime;

        if (totalSeconds < 60) {
            return `${Math.round(totalSeconds)}s`;
        } else {
            return `${Math.round(totalSeconds / 60)}m ${Math.round(totalSeconds % 60)}s`;
        }
    }

    private estimateMemoryUsage(nodeCount: number): 'low' | 'medium' | 'high' | 'very-high' {
        if (nodeCount < 10) return 'low';
        if (nodeCount < 25) return 'medium';
        if (nodeCount < 50) return 'high';
        return 'very-high';
    }

    private estimateCpuIntensity(workflow: N8nWorkflow): 'low' | 'medium' | 'high' | 'very-high' {
        const codeNodes = workflow.nodes?.filter(node => node.type === 'n8n-nodes-base.code').length || 0;
        const aiNodes = workflow.nodes?.filter(node => 
            node.type === 'n8n-nodes-base.openAi' || 
            node.type === '@n8n/n8n-nodes-langchain.openAi'
        ).length || 0;

        const intensity = codeNodes + (aiNodes * 2); // AI nodes are more intensive

        if (intensity < 2) return 'low';
        if (intensity < 5) return 'medium';
        if (intensity < 10) return 'high';
        return 'very-high';
    }

    private getDefaultPerformanceAnalysis(): PerformanceAnalysis {
        return {
            estimatedExecutionTime: 'Unknown',
            memoryUsage: 'medium',
            cpuIntensity: 'medium',
            bottlenecks: [],
            optimizationSuggestions: [],
            parallelizationOpportunities: []
        };
    }

    private getDefaultSecurityAnalysis(): SecurityAnalysis {
        return {
            credentialsExposed: false,
            sensitiveDataInLogs: false,
            unsecureConnections: [],
            securityLevel: 'medium',
            complianceIssues: [],
            recommendations: []
        };
    }

    private getDefaultCompatibilityCheck(): CompatibilityCheck {
        return {
            n8nVersion: 'v1.x.x',
            supportedVersions: ['v1.0.0'],
            deprecatedNodes: [],
            missingCredentials: [],
            requiredIntegrations: [],
            migrationRequired: false
        };
    }
}