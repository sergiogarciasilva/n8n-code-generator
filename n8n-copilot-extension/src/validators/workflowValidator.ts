import { z } from 'zod';
import * as vscode from 'vscode';

export interface ValidationResult {
    valid: boolean;
    message: string;
    level: 'error' | 'warning' | 'info';
    nodeId?: string;
    line?: number;
}

const NodeSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    typeVersion: z.number(),
    position: z.array(z.number()).length(2),
    parameters: z.record(z.any()),
    credentials: z.record(z.any()).optional(),
    disabled: z.boolean().optional(),
    continueOnFail: z.boolean().optional()
});

const ConnectionSchema = z.object({
    node: z.string(),
    type: z.enum(['main']),
    index: z.number()
});

const WorkflowSchema = z.object({
    name: z.string(),
    nodes: z.array(NodeSchema),
    connections: z.record(z.record(z.array(z.array(ConnectionSchema)))),
    active: z.boolean().optional(),
    settings: z.record(z.any()).optional(),
    staticData: z.record(z.any()).optional()
});

export class WorkflowValidator {
    private knownNodeTypes: Set<string>;
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.knownNodeTypes = new Set([
            'n8n-nodes-base.start',
            'n8n-nodes-base.httpRequest',
            'n8n-nodes-base.webhook',
            'n8n-nodes-base.telegram',
            'n8n-nodes-base.telegramTrigger',
            'n8n-nodes-base.openAi',
            'n8n-nodes-base.code',
            'n8n-nodes-base.function',
            'n8n-nodes-base.if',
            'n8n-nodes-base.switch',
            'n8n-nodes-base.merge',
            'n8n-nodes-base.splitInBatches',
            'n8n-nodes-base.postgres',
            'n8n-nodes-base.mongodb',
            'n8n-nodes-base.redis',
            'n8n-nodes-base.set',
            'n8n-nodes-base.dateTime',
            'n8n-nodes-base.crypto',
            'n8n-nodes-base.emailSend',
            'n8n-nodes-base.slack'
        ]);
        
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('n8n-validator');
    }

    async validate(workflow: any): Promise<ValidationResult[]> {
        const results: ValidationResult[] = [];

        // Syntactic validation
        try {
            WorkflowSchema.parse(workflow);
            results.push({
                valid: true,
                message: 'Workflow structure is valid',
                level: 'info'
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                error.errors.forEach(err => {
                    results.push({
                        valid: false,
                        message: `${err.path.join('.')}: ${err.message}`,
                        level: 'error'
                    });
                });
            }
        }

        // Semantic validation
        if (workflow.nodes) {
            // Check for unknown node types
            workflow.nodes.forEach((node: any) => {
                if (!this.knownNodeTypes.has(node.type)) {
                    results.push({
                        valid: false,
                        message: `Unknown node type: ${node.type}`,
                        level: 'warning',
                        nodeId: node.id
                    });
                }

                // Validate required parameters
                if (node.type === 'n8n-nodes-base.httpRequest' && !node.parameters.url) {
                    results.push({
                        valid: false,
                        message: `HTTP Request node "${node.name}" is missing URL parameter`,
                        level: 'error',
                        nodeId: node.id
                    });
                }

                // Check for missing credentials
                if (this.requiresCredentials(node.type) && !node.credentials) {
                    results.push({
                        valid: false,
                        message: `Node "${node.name}" requires credentials`,
                        level: 'error',
                        nodeId: node.id
                    });
                }
            });

            // Validate connections
            this.validateConnections(workflow, results);

            // Check for loops
            this.detectLoops(workflow, results);

            // Performance validation
            if (workflow.nodes.length > 50) {
                results.push({
                    valid: false,
                    message: `Workflow has ${workflow.nodes.length} nodes, which may impact performance`,
                    level: 'warning'
                });
            }
        }

        return results;
    }

    async validateInBackground(workflow: any, uri: vscode.Uri): Promise<void> {
        const results = await this.validate(workflow);
        const diagnostics: vscode.Diagnostic[] = [];

        results.forEach(result => {
            if (!result.valid) {
                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 0),
                    result.message,
                    result.level === 'error' ? vscode.DiagnosticSeverity.Error :
                    result.level === 'warning' ? vscode.DiagnosticSeverity.Warning :
                    vscode.DiagnosticSeverity.Information
                );
                diagnostics.push(diagnostic);
            }
        });

        this.diagnosticCollection.set(uri, diagnostics);
    }

    private requiresCredentials(nodeType: string): boolean {
        const credentialNodes = [
            'n8n-nodes-base.telegram',
            'n8n-nodes-base.openAi',
            'n8n-nodes-base.postgres',
            'n8n-nodes-base.mongodb',
            'n8n-nodes-base.redis',
            'n8n-nodes-base.slack',
            'n8n-nodes-base.googleSheets',
            'n8n-nodes-base.github'
        ];
        return credentialNodes.includes(nodeType);
    }

    private validateConnections(workflow: any, results: ValidationResult[]): void {
        const nodeIds = new Set(workflow.nodes.map((n: any) => n.id));

        Object.entries(workflow.connections).forEach(([fromNode, connections]) => {
            if (!nodeIds.has(fromNode)) {
                results.push({
                    valid: false,
                    message: `Connection from non-existent node: ${fromNode}`,
                    level: 'error'
                });
            }

            Object.values(connections as any).forEach((outputs: any) => {
                outputs.forEach((connections: any[]) => {
                    connections.forEach(conn => {
                        if (!nodeIds.has(conn.node)) {
                            results.push({
                                valid: false,
                                message: `Connection to non-existent node: ${conn.node}`,
                                level: 'error'
                            });
                        }
                    });
                });
            });
        });
    }

    private detectLoops(workflow: any, results: ValidationResult[]): void {
        const graph = new Map<string, string[]>();
        
        // Build adjacency list
        Object.entries(workflow.connections).forEach(([fromNode, connections]) => {
            const neighbors: string[] = [];
            Object.values(connections as any).forEach((outputs: any) => {
                outputs.forEach((connections: any[]) => {
                    connections.forEach(conn => {
                        neighbors.push(conn.node);
                    });
                });
            });
            graph.set(fromNode, neighbors);
        });

        // DFS to detect cycles
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (node: string): boolean => {
            visited.add(node);
            recursionStack.add(node);

            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (hasCycle(neighbor)) return true;
                } else if (recursionStack.has(neighbor)) {
                    return true;
                }
            }

            recursionStack.delete(node);
            return false;
        };

        for (const node of graph.keys()) {
            if (!visited.has(node) && hasCycle(node)) {
                results.push({
                    valid: false,
                    message: 'Workflow contains a loop, which may cause infinite execution',
                    level: 'warning'
                });
                break;
            }
        }
    }

    // MCP-specific validation
    validateMCP(workflow: any): ValidationResult[] {
        const results: ValidationResult[] = [];
        
        // Check for MCP-specific patterns
        const mcpNodes = workflow.nodes.filter((n: any) => 
            n.type.includes('mcp') || n.parameters?.protocol === 'mcp'
        );

        mcpNodes.forEach((node: any) => {
            if (!node.parameters?.contextBoundary) {
                results.push({
                    valid: false,
                    message: `MCP node "${node.name}" missing context boundary definition`,
                    level: 'error',
                    nodeId: node.id
                });
            }
        });

        return results;
    }

    // Telegram-specific validation
    validateTelegram(workflow: any): ValidationResult[] {
        const results: ValidationResult[] = [];
        
        const telegramNodes = workflow.nodes.filter((n: any) => 
            n.type.includes('telegram')
        );

        telegramNodes.forEach((node: any) => {
            if (node.type === 'n8n-nodes-base.telegramTrigger' && !node.webhookId) {
                results.push({
                    valid: false,
                    message: `Telegram trigger "${node.name}" requires webhook configuration`,
                    level: 'error',
                    nodeId: node.id
                });
            }
        });

        return results;
    }
}