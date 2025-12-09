"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowValidator = void 0;
const zod_1 = require("zod");
const vscode = __importStar(require("vscode"));
const NodeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    typeVersion: zod_1.z.number(),
    position: zod_1.z.array(zod_1.z.number()).length(2),
    parameters: zod_1.z.record(zod_1.z.any()),
    credentials: zod_1.z.record(zod_1.z.any()).optional(),
    disabled: zod_1.z.boolean().optional(),
    continueOnFail: zod_1.z.boolean().optional()
});
const ConnectionSchema = zod_1.z.object({
    node: zod_1.z.string(),
    type: zod_1.z.enum(['main']),
    index: zod_1.z.number()
});
const WorkflowSchema = zod_1.z.object({
    name: zod_1.z.string(),
    nodes: zod_1.z.array(NodeSchema),
    connections: zod_1.z.record(zod_1.z.record(zod_1.z.array(zod_1.z.array(ConnectionSchema)))),
    active: zod_1.z.boolean().optional(),
    settings: zod_1.z.record(zod_1.z.any()).optional(),
    staticData: zod_1.z.record(zod_1.z.any()).optional()
});
class WorkflowValidator {
    knownNodeTypes;
    diagnosticCollection;
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
    async validate(workflow) {
        const results = [];
        // Syntactic validation
        try {
            WorkflowSchema.parse(workflow);
            results.push({
                valid: true,
                message: 'Workflow structure is valid',
                level: 'info'
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
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
            workflow.nodes.forEach((node) => {
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
    async validateInBackground(workflow, uri) {
        const results = await this.validate(workflow);
        const diagnostics = [];
        results.forEach(result => {
            if (!result.valid) {
                const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), result.message, result.level === 'error' ? vscode.DiagnosticSeverity.Error :
                    result.level === 'warning' ? vscode.DiagnosticSeverity.Warning :
                        vscode.DiagnosticSeverity.Information);
                diagnostics.push(diagnostic);
            }
        });
        this.diagnosticCollection.set(uri, diagnostics);
    }
    requiresCredentials(nodeType) {
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
    validateConnections(workflow, results) {
        const nodeIds = new Set(workflow.nodes.map((n) => n.id));
        Object.entries(workflow.connections).forEach(([fromNode, connections]) => {
            if (!nodeIds.has(fromNode)) {
                results.push({
                    valid: false,
                    message: `Connection from non-existent node: ${fromNode}`,
                    level: 'error'
                });
            }
            Object.values(connections).forEach((outputs) => {
                outputs.forEach((connections) => {
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
    detectLoops(workflow, results) {
        const graph = new Map();
        // Build adjacency list
        Object.entries(workflow.connections).forEach(([fromNode, connections]) => {
            const neighbors = [];
            Object.values(connections).forEach((outputs) => {
                outputs.forEach((connections) => {
                    connections.forEach(conn => {
                        neighbors.push(conn.node);
                    });
                });
            });
            graph.set(fromNode, neighbors);
        });
        // DFS to detect cycles
        const visited = new Set();
        const recursionStack = new Set();
        const hasCycle = (node) => {
            visited.add(node);
            recursionStack.add(node);
            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (hasCycle(neighbor))
                        return true;
                }
                else if (recursionStack.has(neighbor)) {
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
    validateMCP(workflow) {
        const results = [];
        // Check for MCP-specific patterns
        const mcpNodes = workflow.nodes.filter((n) => n.type.includes('mcp') || n.parameters?.protocol === 'mcp');
        mcpNodes.forEach((node) => {
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
    validateTelegram(workflow) {
        const results = [];
        const telegramNodes = workflow.nodes.filter((n) => n.type.includes('telegram'));
        telegramNodes.forEach((node) => {
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
exports.WorkflowValidator = WorkflowValidator;
//# sourceMappingURL=workflowValidator.js.map