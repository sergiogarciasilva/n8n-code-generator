import { OpenAI } from 'openai';
import { WorkflowKnowledgeBase } from './WorkflowKnowledgeBase';
import { N8nWorkflow, N8nNode, NodeSuggestion } from '../types/workflows';
import { logger } from '../utils/logger';

export interface AutoCompleteContext {
    currentWorkflow: N8nWorkflow;
    currentNodeIndex: number;
    cursorPosition: {
        nodeId?: string;
        field?: string;
        value?: string;
    };
    recentActions: string[];
    userPreferences: UserPreferences;
}

export interface UserPreferences {
    preferredNodes: string[];
    commonPatterns: WorkflowPattern[];
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    industries: string[];
    frequentIntegrations: string[];
}

export interface WorkflowPattern {
    name: string;
    nodeSequence: string[];
    frequency: number;
    lastUsed: Date;
}

export interface AutoCompleteSuggestion {
    type: 'node' | 'parameter' | 'value' | 'connection' | 'pattern';
    suggestion: string;
    displayText: string;
    description: string;
    confidence: number;
    category?: string;
    icon?: string;
    metadata?: Record<string, any>;
    applyAction?: () => void;
}

export interface IntelliSenseResult {
    suggestions: AutoCompleteSuggestion[];
    contextualHelp: string;
    relatedDocumentation: string[];
    quickFixes: QuickFix[];
}

export interface QuickFix {
    title: string;
    description: string;
    action: string;
    severity: 'error' | 'warning' | 'info';
}

/**
 * Advanced AI-powered AutoComplete and IntelliSense System
 * 
 * Provides contextual suggestions while building workflows:
 * - Node suggestions based on current workflow context
 * - Parameter autocompletion with smart defaults
 * - Pattern recognition and suggestion
 * - Error detection and quick fixes
 * - Learning from user behavior
 */
export class WorkflowAutoComplete {
    private openai: OpenAI;
    private knowledgeBase: WorkflowKnowledgeBase;
    private userPatterns: Map<string, WorkflowPattern[]>;
    private suggestionCache: Map<string, AutoCompleteSuggestion[]>;
    private nodeCompatibilityMatrix: Map<string, string[]>;

    constructor(openaiApiKey: string, knowledgeBase: WorkflowKnowledgeBase) {
        this.openai = new OpenAI({ apiKey: openaiApiKey });
        this.knowledgeBase = knowledgeBase;
        this.userPatterns = new Map();
        this.suggestionCache = new Map();
        this.initializeCompatibilityMatrix();
    }

    private initializeCompatibilityMatrix(): void {
        // Define which nodes commonly follow each other
        this.nodeCompatibilityMatrix = new Map([
            ['n8n-nodes-base.webhook', [
                'n8n-nodes-base.if',
                'n8n-nodes-base.code',
                'n8n-nodes-base.httpRequest',
                'n8n-nodes-base.set'
            ]],
            ['n8n-nodes-base.httpRequest', [
                'n8n-nodes-base.if',
                'n8n-nodes-base.code',
                'n8n-nodes-base.itemLists',
                'n8n-nodes-base.set'
            ]],
            ['n8n-nodes-base.if', [
                'n8n-nodes-base.httpRequest',
                'n8n-nodes-base.code',
                'n8n-nodes-base.emailSend',
                'n8n-nodes-base.telegram'
            ]],
            ['n8n-nodes-base.code', [
                'n8n-nodes-base.if',
                'n8n-nodes-base.httpRequest',
                'n8n-nodes-base.set',
                'n8n-nodes-base.respondToWebhook'
            ]],
            ['n8n-nodes-base.openAi', [
                'n8n-nodes-base.code',
                'n8n-nodes-base.if',
                'n8n-nodes-base.set',
                'n8n-nodes-base.telegram'
            ]]
        ]);
    }

    async getSuggestions(context: AutoCompleteContext): Promise<IntelliSenseResult> {
        try {
            const cacheKey = this.generateCacheKey(context);
            
            // Check cache first
            if (this.suggestionCache.has(cacheKey)) {
                const cachedSuggestions = this.suggestionCache.get(cacheKey)!;
                return {
                    suggestions: cachedSuggestions,
                    contextualHelp: this.generateContextualHelp(context),
                    relatedDocumentation: await this.findRelatedDocs(context),
                    quickFixes: await this.detectQuickFixes(context)
                };
            }

            // Generate new suggestions
            const suggestions: AutoCompleteSuggestion[] = [];

            // Get different types of suggestions in parallel
            const [
                nodeSuggestions,
                parameterSuggestions,
                patternSuggestions,
                aiSuggestions
            ] = await Promise.all([
                this.getNodeSuggestions(context),
                this.getParameterSuggestions(context),
                this.getPatternSuggestions(context),
                this.getAISuggestions(context)
            ]);

            suggestions.push(...nodeSuggestions);
            suggestions.push(...parameterSuggestions);
            suggestions.push(...patternSuggestions);
            suggestions.push(...aiSuggestions);

            // Sort by confidence
            suggestions.sort((a, b) => b.confidence - a.confidence);

            // Cache results
            this.suggestionCache.set(cacheKey, suggestions);

            return {
                suggestions: suggestions.slice(0, 10), // Top 10 suggestions
                contextualHelp: this.generateContextualHelp(context),
                relatedDocumentation: await this.findRelatedDocs(context),
                quickFixes: await this.detectQuickFixes(context)
            };

        } catch (error) {
            logger.error('AutoComplete suggestion generation failed', { error: error.message });
            return {
                suggestions: [],
                contextualHelp: 'Unable to generate suggestions at this time',
                relatedDocumentation: [],
                quickFixes: []
            };
        }
    }

    private async getNodeSuggestions(context: AutoCompleteContext): Promise<AutoCompleteSuggestion[]> {
        const suggestions: AutoCompleteSuggestion[] = [];
        const currentNodes = context.currentWorkflow.nodes || [];
        
        if (currentNodes.length === 0) {
            // Suggest trigger nodes for empty workflow
            const triggerNodes = [
                { type: 'n8n-nodes-base.webhook', name: 'Webhook', icon: '🌐' },
                { type: 'n8n-nodes-base.cron', name: 'Cron', icon: '⏰' },
                { type: 'n8n-nodes-base.manualTrigger', name: 'Manual Trigger', icon: '▶️' }
            ];

            triggerNodes.forEach(node => {
                suggestions.push({
                    type: 'node',
                    suggestion: node.type,
                    displayText: node.name,
                    description: `Start workflow with ${node.name}`,
                    confidence: 0.9,
                    icon: node.icon,
                    category: 'trigger'
                });
            });
        } else {
            // Get the last added node
            const lastNode = currentNodes[currentNodes.length - 1];
            const compatibleNodes = this.nodeCompatibilityMatrix.get(lastNode.type) || [];

            // Suggest compatible nodes
            compatibleNodes.forEach((nodeType, index) => {
                const nodeInfo = this.getNodeInfo(nodeType);
                suggestions.push({
                    type: 'node',
                    suggestion: nodeType,
                    displayText: nodeInfo.name,
                    description: nodeInfo.description,
                    confidence: 0.8 - (index * 0.1),
                    icon: nodeInfo.icon,
                    category: nodeInfo.category
                });
            });

            // Add user's preferred nodes
            context.userPreferences.preferredNodes.forEach(nodeType => {
                if (!compatibleNodes.includes(nodeType)) {
                    const nodeInfo = this.getNodeInfo(nodeType);
                    suggestions.push({
                        type: 'node',
                        suggestion: nodeType,
                        displayText: nodeInfo.name,
                        description: `Frequently used: ${nodeInfo.description}`,
                        confidence: 0.7,
                        icon: nodeInfo.icon,
                        category: 'preferred'
                    });
                }
            });
        }

        return suggestions;
    }

    private async getParameterSuggestions(context: AutoCompleteContext): Promise<AutoCompleteSuggestion[]> {
        const suggestions: AutoCompleteSuggestion[] = [];

        if (!context.cursorPosition.nodeId || !context.cursorPosition.field) {
            return suggestions;
        }

        const currentNode = context.currentWorkflow.nodes.find(n => n.id === context.cursorPosition.nodeId);
        if (!currentNode) {
            return suggestions;
        }

        // Get parameter suggestions based on node type and field
        const parameterSuggestions = await this.getNodeParameterSuggestions(
            currentNode.type,
            context.cursorPosition.field,
            context
        );

        parameterSuggestions.forEach((param, index) => {
            suggestions.push({
                type: 'parameter',
                suggestion: param.value,
                displayText: param.display,
                description: param.description,
                confidence: 0.9 - (index * 0.05),
                metadata: param.metadata
            });
        });

        return suggestions;
    }

    private async getPatternSuggestions(context: AutoCompleteContext): Promise<AutoCompleteSuggestion[]> {
        const suggestions: AutoCompleteSuggestion[] = [];

        // Get user's common patterns
        const userPatterns = this.userPatterns.get(context.userPreferences.skillLevel) || [];
        
        // Find patterns that match current workflow state
        const currentNodeTypes = context.currentWorkflow.nodes.map(n => n.type);
        
        userPatterns.forEach(pattern => {
            // Check if current workflow matches the beginning of this pattern
            const matchLength = this.findPatternMatch(currentNodeTypes, pattern.nodeSequence);
            
            if (matchLength > 0 && matchLength < pattern.nodeSequence.length) {
                // Suggest the next nodes in the pattern
                const nextNodes = pattern.nodeSequence.slice(matchLength, matchLength + 3);
                
                suggestions.push({
                    type: 'pattern',
                    suggestion: pattern.name,
                    displayText: `Continue with ${pattern.name}`,
                    description: `Complete pattern: ${nextNodes.map(n => this.getNodeInfo(n).name).join(' → ')}`,
                    confidence: 0.85,
                    metadata: {
                        pattern: pattern,
                        nextNodes: nextNodes
                    }
                });
            }
        });

        // Get popular patterns from knowledge base
        const popularPatterns = await this.knowledgeBase.getPopularTemplates(5);
        popularPatterns.forEach((template, index) => {
            suggestions.push({
                type: 'pattern',
                suggestion: template.id,
                displayText: template.name,
                description: template.description,
                confidence: 0.7 - (index * 0.1),
                category: template.category,
                metadata: {
                    templateId: template.id,
                    nodeCount: template.workflow.nodes?.length || 0
                }
            });
        });

        return suggestions;
    }

    private async getAISuggestions(context: AutoCompleteContext): Promise<AutoCompleteSuggestion[]> {
        try {
            const prompt = this.buildAIPrompt(context);

            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an n8n workflow expert. Suggest the next best actions for the workflow being built. Respond with a JSON array of suggestions.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 500,
                response_format: { type: 'json_object' }
            });

            const aiResponse = JSON.parse(response.choices[0]?.message?.content || '{"suggestions": []}');
            
            return aiResponse.suggestions.map((suggestion: any, index: number) => ({
                type: suggestion.type || 'node',
                suggestion: suggestion.value,
                displayText: suggestion.display,
                description: suggestion.description,
                confidence: 0.6 - (index * 0.1),
                category: 'ai-suggested',
                icon: '🤖'
            }));

        } catch (error) {
            logger.error('AI suggestion generation failed', { error: error.message });
            return [];
        }
    }

    private buildAIPrompt(context: AutoCompleteContext): string {
        const currentNodes = context.currentWorkflow.nodes.map(n => `${n.name} (${n.type})`).join(' → ');
        const recentActions = context.recentActions.slice(-5).join(', ');

        return `Current workflow nodes: ${currentNodes || 'Empty workflow'}
Recent actions: ${recentActions || 'None'}
User skill level: ${context.userPreferences.skillLevel}
Common integrations: ${context.userPreferences.frequentIntegrations.join(', ')}

Suggest the next 3-5 most logical actions for this workflow. Consider the user's skill level and preferences.`;
    }

    private async detectQuickFixes(context: AutoCompleteContext): Promise<QuickFix[]> {
        const quickFixes: QuickFix[] = [];

        // Check for common issues
        const workflow = context.currentWorkflow;

        // Check for unconnected nodes
        const unconnectedNodes = this.findUnconnectedNodes(workflow);
        unconnectedNodes.forEach(node => {
            quickFixes.push({
                title: `Connect ${node.name}`,
                description: `Node "${node.name}" is not connected to the workflow`,
                action: `connect_node_${node.id}`,
                severity: 'warning'
            });
        });

        // Check for missing required parameters
        workflow.nodes.forEach(node => {
            const missingParams = this.checkMissingParameters(node);
            missingParams.forEach(param => {
                quickFixes.push({
                    title: `Set ${param} for ${node.name}`,
                    description: `Required parameter "${param}" is missing`,
                    action: `set_parameter_${node.id}_${param}`,
                    severity: 'error'
                });
            });
        });

        // Check for deprecated nodes
        workflow.nodes.forEach(node => {
            if (this.isDeprecatedNode(node.type)) {
                quickFixes.push({
                    title: `Update ${node.name}`,
                    description: `Node type "${node.type}" is deprecated`,
                    action: `update_node_${node.id}`,
                    severity: 'warning'
                });
            }
        });

        return quickFixes;
    }

    private generateContextualHelp(context: AutoCompleteContext): string {
        const nodeCount = context.currentWorkflow.nodes?.length || 0;
        
        if (nodeCount === 0) {
            return "Start your workflow by adding a trigger node. Webhooks and Cron are popular choices.";
        }

        const lastNode = context.currentWorkflow.nodes[nodeCount - 1];
        const nodeInfo = this.getNodeInfo(lastNode.type);

        return `After ${nodeInfo.name}, you typically want to ${this.getSuggestedNextAction(lastNode.type)}. Press Tab to see suggestions.`;
    }

    private getSuggestedNextAction(nodeType: string): string {
        const suggestions: Record<string, string> = {
            'n8n-nodes-base.webhook': 'validate the incoming data or process it',
            'n8n-nodes-base.httpRequest': 'handle the response or check for errors',
            'n8n-nodes-base.if': 'define actions for both true and false branches',
            'n8n-nodes-base.code': 'use the processed data or pass it to another service',
            'n8n-nodes-base.openAi': 'format the AI response or take action based on it'
        };

        return suggestions[nodeType] || 'continue building your workflow';
    }

    private async findRelatedDocs(context: AutoCompleteContext): Promise<string[]> {
        const docs: string[] = [];

        if (context.cursorPosition.nodeId) {
            const node = context.currentWorkflow.nodes.find(n => n.id === context.cursorPosition.nodeId);
            if (node) {
                docs.push(`https://docs.n8n.io/nodes/${node.type.replace('n8n-nodes-base.', '')}`);
            }
        }

        // Add general helpful docs
        if (context.currentWorkflow.nodes.length === 0) {
            docs.push('https://docs.n8n.io/workflows/building');
        }

        return docs;
    }

    private getNodeInfo(nodeType: string): { name: string; description: string; icon: string; category: string } {
        const nodeInfoMap: Record<string, any> = {
            'n8n-nodes-base.webhook': {
                name: 'Webhook',
                description: 'Trigger workflow via HTTP request',
                icon: '🌐',
                category: 'trigger'
            },
            'n8n-nodes-base.httpRequest': {
                name: 'HTTP Request',
                description: 'Make HTTP/API calls',
                icon: '🌍',
                category: 'action'
            },
            'n8n-nodes-base.if': {
                name: 'IF',
                description: 'Conditional branching',
                icon: '🔀',
                category: 'logic'
            },
            'n8n-nodes-base.code': {
                name: 'Code',
                description: 'Execute JavaScript code',
                icon: '💻',
                category: 'transform'
            },
            'n8n-nodes-base.openAi': {
                name: 'OpenAI',
                description: 'Use AI models',
                icon: '🧠',
                category: 'ai'
            },
            'n8n-nodes-base.telegram': {
                name: 'Telegram',
                description: 'Send Telegram messages',
                icon: '💬',
                category: 'communication'
            }
        };

        return nodeInfoMap[nodeType] || {
            name: nodeType.split('.').pop() || 'Unknown',
            description: 'Node description',
            icon: '⚙️',
            category: 'other'
        };
    }

    private async getNodeParameterSuggestions(
        nodeType: string, 
        field: string, 
        context: AutoCompleteContext
    ): Promise<Array<{ value: string; display: string; description: string; metadata?: any }>> {
        // This would have specific suggestions for each node type and field
        const suggestions: Array<{ value: string; display: string; description: string; metadata?: any }> = [];

        // Example for HTTP Request node
        if (nodeType === 'n8n-nodes-base.httpRequest') {
            if (field === 'url') {
                suggestions.push(
                    { value: 'https://api.example.com/v1/', display: 'API Base URL', description: 'Common API endpoint' },
                    { value: '{{ $json.webhook_url }}', display: 'From Previous Node', description: 'Use URL from webhook data' }
                );
            } else if (field === 'method') {
                suggestions.push(
                    { value: 'GET', display: 'GET', description: 'Retrieve data' },
                    { value: 'POST', display: 'POST', description: 'Send data' },
                    { value: 'PUT', display: 'PUT', description: 'Update data' },
                    { value: 'DELETE', display: 'DELETE', description: 'Delete data' }
                );
            }
        }

        return suggestions;
    }

    private findPatternMatch(current: string[], pattern: string[]): number {
        let matchLength = 0;
        for (let i = 0; i < Math.min(current.length, pattern.length); i++) {
            if (current[i] === pattern[i]) {
                matchLength++;
            } else {
                break;
            }
        }
        return matchLength;
    }

    private findUnconnectedNodes(workflow: N8nWorkflow): N8nNode[] {
        const connectedNodes = new Set<string>();
        
        // Find all connected nodes
        if (workflow.connections) {
            Object.entries(workflow.connections).forEach(([source, connections]) => {
                connectedNodes.add(source);
                if (connections.main) {
                    connections.main.forEach(group => {
                        group?.forEach(conn => {
                            if (conn.node) connectedNodes.add(conn.node);
                        });
                    });
                }
            });
        }

        // Return nodes that aren't triggers and aren't connected
        return workflow.nodes.filter(node => 
            !this.isTriggerNode(node.type) && !connectedNodes.has(node.name)
        );
    }

    private isTriggerNode(nodeType: string): boolean {
        const triggers = ['webhook', 'cron', 'manualTrigger', 'emailTrigger'];
        return triggers.some(t => nodeType.includes(t));
    }

    private checkMissingParameters(node: N8nNode): string[] {
        const missing: string[] = [];
        
        // This would check against a schema of required parameters per node type
        // Simplified example:
        if (node.type === 'n8n-nodes-base.httpRequest' && !node.parameters?.url) {
            missing.push('url');
        }
        
        return missing;
    }

    private isDeprecatedNode(nodeType: string): boolean {
        const deprecated = ['n8n-nodes-base.function', 'n8n-nodes-base.httpRequestV1'];
        return deprecated.includes(nodeType);
    }

    private generateCacheKey(context: AutoCompleteContext): string {
        const nodeTypes = context.currentWorkflow.nodes.map(n => n.type).join(',');
        const position = `${context.cursorPosition.nodeId}:${context.cursorPosition.field}`;
        return `${nodeTypes}:${position}:${context.userPreferences.skillLevel}`;
    }

    // Learning methods
    recordUserChoice(suggestion: AutoCompleteSuggestion, context: AutoCompleteContext): void {
        // Record what the user chose to improve future suggestions
        const pattern = this.extractPattern(context.currentWorkflow);
        const userPatterns = this.userPatterns.get(context.userPreferences.skillLevel) || [];
        
        const existingPattern = userPatterns.find(p => p.name === pattern.name);
        if (existingPattern) {
            existingPattern.frequency++;
            existingPattern.lastUsed = new Date();
        } else {
            userPatterns.push(pattern);
        }
        
        this.userPatterns.set(context.userPreferences.skillLevel, userPatterns);
    }

    private extractPattern(workflow: N8nWorkflow): WorkflowPattern {
        const nodeSequence = workflow.nodes.map(n => n.type);
        const name = nodeSequence.slice(0, 3).map(t => t.split('.').pop()).join('-');
        
        return {
            name,
            nodeSequence,
            frequency: 1,
            lastUsed: new Date()
        };
    }
}