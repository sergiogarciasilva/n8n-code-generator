import OpenAI from 'openai';
import * as vscode from 'vscode';

interface WorkflowTemplate {
    name: string;
    description: string;
    nodes: any[];
    connections: any;
}

export class AIEngine {
    private openai: OpenAI | null = null;
    private templates: Map<string, WorkflowTemplate>;
    private userPatterns: Map<string, any>;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
        
        this.templates = new Map();
        this.userPatterns = new Map();
        this.loadTemplates();
    }

    async generateWorkflow(description: string): Promise<any> {
        // Check for matching templates first
        const template = this.findMatchingTemplate(description);
        if (template) {
            return this.customizeTemplate(template, description);
        }

        // Use AI to generate workflow
        if (this.openai) {
            try {
                const prompt = this.buildWorkflowPrompt(description);
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-4-turbo-preview',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an n8n workflow expert. Generate valid n8n workflow JSON based on the description. Focus on MCPs, Telegram bots, and agent systems.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 4000
                });

                const content = response.choices[0].message.content;
                if (content) {
                    const workflow = JSON.parse(content);
                    this.learnFromGeneration(description, workflow);
                    return workflow;
                }
            } catch (error) {
                console.error('OpenAI generation failed:', error);
                // Fall back to local generation
            }
        }

        // Fallback to template-based generation
        return this.generateFromPatterns(description);
    }

    async suggestNextNode(currentWorkflow: any, cursorPosition: any): Promise<any[]> {
        const suggestions: any[] = [];
        
        // Analyze workflow context
        const context = this.analyzeWorkflowContext(currentWorkflow, cursorPosition);
        
        // Get pattern-based suggestions
        const patternSuggestions = this.getPatternSuggestions(context);
        suggestions.push(...patternSuggestions);

        // Get AI suggestions if available
        if (this.openai && suggestions.length < 5) {
            const aiSuggestions = await this.getAISuggestions(context);
            suggestions.push(...aiSuggestions);
        }

        // Score and sort suggestions
        return this.scoreSuggestions(suggestions, context);
    }

    async generateTests(workflow: any): Promise<string> {
        const tests: string[] = [];
        
        // Generate test structure
        tests.push(`import { WorkflowTester } from '@n8n/testing';`);
        tests.push(`import workflow from './${workflow.name}.n8n.json';`);
        tests.push('');
        tests.push(`describe('${workflow.name}', () => {`);
        
        // Generate tests for each node
        workflow.nodes.forEach((node: any) => {
            tests.push(`  describe('${node.name}', () => {`);
            tests.push(`    test('should execute successfully', async () => {`);
            tests.push(`      const tester = new WorkflowTester(workflow);`);
            tests.push(`      const result = await tester.runNode('${node.id}', {`);
            tests.push(`        // Add mock data here`);
            tests.push(`      });`);
            tests.push(`      expect(result).toBeDefined();`);
            tests.push(`      expect(result.error).toBeUndefined();`);
            tests.push(`    });`);
            
            if (node.type === 'n8n-nodes-base.if') {
                tests.push('');
                tests.push(`    test('should handle true condition', async () => {`);
                tests.push(`      // Test true branch`);
                tests.push(`    });`);
                tests.push('');
                tests.push(`    test('should handle false condition', async () => {`);
                tests.push(`      // Test false branch`);
                tests.push(`    });`);
            }
            
            tests.push(`  });`);
            tests.push('');
        });
        
        // Add integration tests
        tests.push(`  describe('Integration Tests', () => {`);
        tests.push(`    test('should complete full workflow', async () => {`);
        tests.push(`      const tester = new WorkflowTester(workflow);`);
        tests.push(`      const result = await tester.run({`);
        tests.push(`        // Add test data`);
        tests.push(`      });`);
        tests.push(`      expect(result.success).toBe(true);`);
        tests.push(`    });`);
        tests.push(`  });`);
        tests.push(`});`);
        
        return tests.join('\n');
    }

    async optimizeSuggestion(workflow: any): Promise<any[]> {
        const optimizations: any[] = [];
        
        // Check for redundant nodes
        const nodeUsage = this.analyzeNodeUsage(workflow);
        nodeUsage.forEach((usage, nodeId) => {
            if (usage.redundant) {
                optimizations.push({
                    type: 'remove-redundant',
                    nodeId,
                    message: `Node "${usage.nodeName}" appears to be redundant`,
                    severity: 'warning'
                });
            }
        });

        // Check for performance issues
        if (workflow.nodes.length > 30) {
            const bottlenecks = this.findBottlenecks(workflow);
            bottlenecks.forEach(bottleneck => {
                optimizations.push({
                    type: 'performance',
                    nodeId: bottleneck.nodeId,
                    message: bottleneck.message,
                    severity: 'info'
                });
            });
        }

        // Suggest parallel execution where possible
        const parallelizable = this.findParallelizableNodes(workflow);
        if (parallelizable.length > 0) {
            optimizations.push({
                type: 'parallelize',
                nodes: parallelizable,
                message: 'These nodes can be executed in parallel',
                severity: 'info'
            });
        }

        return optimizations;
    }

    private loadTemplates(): void {
        // MCP Template
        this.templates.set('mcp-basic', {
            name: 'Basic MCP Workflow',
            description: 'Model Context Protocol workflow template',
            nodes: [
                {
                    id: 'start',
                    name: 'Start',
                    type: 'n8n-nodes-base.start',
                    typeVersion: 1,
                    position: [250, 300]
                },
                {
                    id: 'mcp-context',
                    name: 'MCP Context',
                    type: 'n8n-nodes-base.code',
                    typeVersion: 1,
                    position: [450, 300],
                    parameters: {
                        code: `// Initialize MCP context
const context = {
  protocol: 'mcp',
  boundary: items[0].json.contextBoundary || 'default',
  state: {}
};
return [{json: context}];`
                    }
                },
                {
                    id: 'mcp-process',
                    name: 'Process MCP',
                    type: 'n8n-nodes-base.function',
                    typeVersion: 1,
                    position: [650, 300],
                    parameters: {
                        functionCode: `// MCP processing logic
return items;`
                    }
                }
            ],
            connections: {
                'start': {
                    'main': [[{ node: 'mcp-context', type: 'main', index: 0 }]]
                },
                'mcp-context': {
                    'main': [[{ node: 'mcp-process', type: 'main', index: 0 }]]
                }
            }
        });

        // Telegram Bot Template
        this.templates.set('telegram-bot', {
            name: 'Telegram Bot',
            description: 'Basic Telegram bot with command handling',
            nodes: [
                {
                    id: 'telegram-trigger',
                    name: 'Telegram Trigger',
                    type: 'n8n-nodes-base.telegramTrigger',
                    typeVersion: 1,
                    position: [250, 300],
                    webhookId: '{{WEBHOOK_ID}}',
                    parameters: {
                        updates: ['message']
                    }
                },
                {
                    id: 'command-switch',
                    name: 'Command Switch',
                    type: 'n8n-nodes-base.switch',
                    typeVersion: 1,
                    position: [450, 300],
                    parameters: {
                        dataType: 'string',
                        value1: '={{$json["message"]["text"]}}',
                        rules: {
                            rules: [
                                {
                                    value2: '/start',
                                    output: 0
                                },
                                {
                                    value2: '/help',
                                    output: 1
                                }
                            ]
                        }
                    }
                },
                {
                    id: 'telegram-send',
                    name: 'Send Reply',
                    type: 'n8n-nodes-base.telegram',
                    typeVersion: 1,
                    position: [650, 300],
                    parameters: {
                        resource: 'message',
                        operation: 'sendMessage',
                        chatId: '={{$json["message"]["chat"]["id"]}}',
                        text: 'Hello! How can I help you?'
                    }
                }
            ],
            connections: {
                'telegram-trigger': {
                    'main': [[{ node: 'command-switch', type: 'main', index: 0 }]]
                },
                'command-switch': {
                    'main': [
                        [{ node: 'telegram-send', type: 'main', index: 0 }],
                        [{ node: 'telegram-send', type: 'main', index: 0 }]
                    ]
                }
            }
        });

        // Agent System Template
        this.templates.set('agent-system', {
            name: 'Multi-Agent System',
            description: 'Orchestrated agent system with state management',
            nodes: [
                {
                    id: 'webhook',
                    name: 'Webhook',
                    type: 'n8n-nodes-base.webhook',
                    typeVersion: 1,
                    position: [250, 300],
                    parameters: {
                        path: 'agent-system',
                        responseMode: 'onReceived',
                        responseData: 'allEntries'
                    }
                },
                {
                    id: 'state-init',
                    name: 'Initialize State',
                    type: 'n8n-nodes-base.code',
                    typeVersion: 1,
                    position: [450, 300],
                    parameters: {
                        code: `// Initialize agent state
const state = {
  agents: ['analyzer', 'processor', 'responder'],
  context: items[0].json,
  results: {}
};
return [{json: state}];`
                    }
                },
                {
                    id: 'agent-orchestrator',
                    name: 'Orchestrator',
                    type: 'n8n-nodes-base.code',
                    typeVersion: 1,
                    position: [650, 300],
                    parameters: {
                        code: `// Agent orchestration logic
// Route to appropriate agent based on context
return items;`
                    }
                }
            ],
            connections: {
                'webhook': {
                    'main': [[{ node: 'state-init', type: 'main', index: 0 }]]
                },
                'state-init': {
                    'main': [[{ node: 'agent-orchestrator', type: 'main', index: 0 }]]
                }
            }
        });
    }

    private findMatchingTemplate(description: string): WorkflowTemplate | null {
        const lowerDesc = description.toLowerCase();
        
        if (lowerDesc.includes('mcp') || lowerDesc.includes('model context')) {
            return this.templates.get('mcp-basic')!;
        }
        if (lowerDesc.includes('telegram') || lowerDesc.includes('bot')) {
            return this.templates.get('telegram-bot')!;
        }
        if (lowerDesc.includes('agent') || lowerDesc.includes('multi-agent')) {
            return this.templates.get('agent-system')!;
        }
        
        return null;
    }

    private customizeTemplate(template: WorkflowTemplate, description: string): any {
        // Clone template
        const workflow = JSON.parse(JSON.stringify(template));
        
        // Customize based on description
        workflow.name = this.generateWorkflowName(description);
        
        // Add timestamp
        const timestamp = new Date().toISOString();
        workflow.createdAt = timestamp;
        workflow.updatedAt = timestamp;
        
        return workflow;
    }

    private generateWorkflowName(description: string): string {
        const words = description.split(' ').slice(0, 5);
        return words.join(' ').replace(/[^a-zA-Z0-9\s]/g, '');
    }

    private buildWorkflowPrompt(description: string): string {
        return `Generate a complete n8n workflow JSON for the following requirement:

${description}

Requirements:
- Use n8n Cloud v1.98 compatible node types
- Include proper error handling
- Add appropriate credentials placeholders
- Focus on MCP, Telegram, or agent systems if mentioned
- Workflow should have 10-30 nodes for optimal performance

Return only valid JSON, no explanations.`;
    }

    private learnFromGeneration(description: string, workflow: any): void {
        // Store successful patterns for future use
        const pattern = {
            description,
            nodeTypes: workflow.nodes.map((n: any) => n.type),
            nodeCount: workflow.nodes.length,
            timestamp: Date.now()
        };
        
        this.userPatterns.set(description, pattern);
    }

    private generateFromPatterns(description: string): any {
        // Basic fallback generation
        return {
            name: this.generateWorkflowName(description),
            nodes: [
                {
                    id: 'start',
                    name: 'Start',
                    type: 'n8n-nodes-base.start',
                    typeVersion: 1,
                    position: [250, 300]
                }
            ],
            connections: {},
            active: false,
            settings: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    private analyzeWorkflowContext(workflow: any, position: any): any {
        return {
            workflow,
            position,
            nodeCount: workflow.nodes?.length || 0,
            lastNode: workflow.nodes?.[workflow.nodes.length - 1],
            nodeTypes: workflow.nodes?.map((n: any) => n.type) || []
        };
    }

    private getPatternSuggestions(context: any): any[] {
        const suggestions: any[] = [];
        
        // Suggest based on last node type
        if (context.lastNode) {
            switch (context.lastNode.type) {
                case 'n8n-nodes-base.telegramTrigger':
                    suggestions.push({
                        type: 'n8n-nodes-base.switch',
                        name: 'Command Router',
                        score: 0.9
                    });
                    break;
                case 'n8n-nodes-base.httpRequest':
                    suggestions.push({
                        type: 'n8n-nodes-base.code',
                        name: 'Process Response',
                        score: 0.8
                    });
                    break;
            }
        }
        
        return suggestions;
    }

    private async getAISuggestions(context: any): Promise<any[]> {
        if (!this.openai) return [];
        
        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'Suggest the next best n8n node type based on the workflow context.'
                    },
                    {
                        role: 'user',
                        content: JSON.stringify(context)
                    }
                ],
                temperature: 0.5,
                max_tokens: 200
            });
            
            // Parse and return suggestions
            return [];
        } catch (error) {
            console.error('AI suggestion failed:', error);
            return [];
        }
    }

    private scoreSuggestions(suggestions: any[], context: any): any[] {
        // Sort by score
        return suggestions.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    private analyzeNodeUsage(workflow: any): Map<string, any> {
        const usage = new Map();
        
        workflow.nodes?.forEach((node: any) => {
            usage.set(node.id, {
                nodeName: node.name,
                redundant: false // Simplified for now
            });
        });
        
        return usage;
    }

    private findBottlenecks(workflow: any): any[] {
        const bottlenecks: any[] = [];
        
        // Check for nodes with many connections
        Object.entries(workflow.connections || {}).forEach(([nodeId, connections]) => {
            const outputCount = Object.values(connections as any).flat().length;
            if (outputCount > 5) {
                bottlenecks.push({
                    nodeId,
                    message: `Node has ${outputCount} outputs, consider splitting`
                });
            }
        });
        
        return bottlenecks;
    }

    private findParallelizableNodes(workflow: any): string[] {
        // Simplified parallel detection
        return [];
    }
}