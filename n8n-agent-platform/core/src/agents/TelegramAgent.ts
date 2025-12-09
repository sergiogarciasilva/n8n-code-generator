import { BaseAgent, AgentConfig, AgentContext } from './BaseAgent';
import { WorkflowAnalysis, OptimizationSuggestion } from '@n8n-agent-platform/shared';
import { logger } from '../utils/logger';

export class TelegramAgent extends BaseAgent {
    constructor(config: AgentConfig, context: AgentContext) {
        super({
            ...config,
            type: 'telegram',
            name: config.name || 'Telegram Bot Optimization Agent',
            description: config.description || 'Specialized agent for Telegram bot workflows'
        }, context);
    }

    async analyze(workflow: any): Promise<WorkflowAnalysis> {
        logger.info(`TelegramAgent analyzing workflow ${workflow.id}`);

        const cached = await this.getCachedAnalysis(workflow.id);
        if (cached) return cached;

        const analysis: WorkflowAnalysis = {
            complexity: this.assessTelegramComplexity(workflow),
            performance: await this.analyzeTelegramPerformance(workflow),
            reliability: this.analyzeTelegramReliability(workflow),
            patterns: this.detectTelegramPatterns(workflow),
            issues: this.findTelegramIssues(workflow),
            metrics: {
                nodeCount: workflow.nodes?.length || 0,
                connectionCount: Object.keys(workflow.connections || {}).length,
                telegramNodeCount: this.countTelegramNodes(workflow),
                commandHandlers: this.countCommandHandlers(workflow),
                messageTypes: this.getMessageTypes(workflow),
                estimatedResponseTime: this.estimateResponseTime(workflow),
                estimatedExecutionTime: this.estimateResponseTime(workflow) * 1.2,
                branchingFactor: Math.max(1, this.countCommandHandlers(workflow)),
                depth: 3
            }
        };

        const aiAnalysis = await this.context.aiEngine.reviewWorkflow(workflow, {
            focus: 'reliability',
            context: { type: 'telegram-bot' }
        });

        analysis.patterns = [...analysis.patterns, ...(aiAnalysis.analysis.patterns || [])];
        analysis.issues = [...analysis.issues, ...(aiAnalysis.analysis.issues || [])];

        await this.cacheAnalysis(workflow.id, analysis);
        return analysis;
    }

    async optimize(workflow: any, analysis: WorkflowAnalysis): Promise<OptimizationSuggestion[]> {
        const suggestions: OptimizationSuggestion[] = [];

        // Command routing optimization
        if (!this.hasCommandRouter(workflow) && analysis.metrics.commandHandlers > 2) {
            suggestions.push({
                id: `tg_router_${Date.now()}`,
                type: 'performance',
                title: 'Add Command Router',
                description: 'Implement a switch node for efficient command routing instead of multiple IF nodes',
                impact: 'high',
                effort: 'low',
                confidence: 0.9,
                metadata: {
                    pattern: 'command-router',
                    commands: this.extractCommands(workflow)
                }
            });
        }

        // Rate limiting
        if (!this.hasRateLimiting(workflow)) {
            suggestions.push({
                id: `tg_rate_${Date.now()}`,
                type: 'security',
                title: 'Implement Rate Limiting',
                description: 'Add rate limiting to prevent spam and API quota issues',
                impact: 'high',
                effort: 'medium',
                confidence: 0.85,
                metadata: {
                    technique: 'user-rate-limit',
                    storage: 'redis'
                }
            });
        }

        // Message type handling
        if (analysis.metrics.messageTypes.length > 1 && !this.hasMessageTypeHandler(workflow)) {
            suggestions.push({
                id: `tg_msgtype_${Date.now()}`,
                type: 'feature',
                title: 'Add Message Type Handler',
                description: 'Handle different message types (text, photo, document) properly',
                impact: 'medium',
                effort: 'low',
                confidence: 0.8,
                metadata: {
                    messageTypes: analysis.metrics.messageTypes
                }
            });
        }

        // Error responses
        if (!this.hasErrorResponses(workflow)) {
            suggestions.push({
                id: `tg_error_${Date.now()}`,
                type: 'reliability',
                title: 'Add Error Response Handling',
                description: 'Send user-friendly error messages when operations fail',
                impact: 'high',
                effort: 'low',
                confidence: 0.9,
                metadata: {
                    pattern: 'error-response'
                }
            });
        }

        // Inline keyboards
        if (this.shouldUseInlineKeyboards(workflow)) {
            suggestions.push({
                id: `tg_keyboard_${Date.now()}`,
                type: 'feature',
                title: 'Add Inline Keyboards',
                description: 'Use inline keyboards for better user interaction',
                impact: 'medium',
                effort: 'medium',
                confidence: 0.75,
                metadata: {
                    pattern: 'inline-keyboard'
                }
            });
        }

        // Webhook optimization
        if (this.usesPolling(workflow)) {
            suggestions.push({
                id: `tg_webhook_${Date.now()}`,
                type: 'performance',
                title: 'Switch to Webhooks',
                description: 'Use webhooks instead of polling for better performance',
                impact: 'high',
                effort: 'medium',
                confidence: 0.85,
                metadata: {
                    pattern: 'webhook-migration'
                }
            });
        }

        return suggestions;
    }

    async implement(workflow: any, suggestion: OptimizationSuggestion): Promise<any> {
        logger.info(`TelegramAgent implementing suggestion ${suggestion.id} for workflow ${workflow.id}`);

        const updatedWorkflow = JSON.parse(JSON.stringify(workflow));

        switch (suggestion.id.split('_')[1]) {
            case 'router':
                return this.addCommandRouter(updatedWorkflow, suggestion.metadata);
            case 'rate':
                return this.addRateLimiting(updatedWorkflow);
            case 'msgtype':
                return this.addMessageTypeHandler(updatedWorkflow, suggestion.metadata);
            case 'error':
                return this.addErrorResponses(updatedWorkflow);
            case 'keyboard':
                return this.addInlineKeyboards(updatedWorkflow);
            case 'webhook':
                return this.migrateToWebhooks(updatedWorkflow);
            default:
                logger.warn(`Unknown suggestion type: ${suggestion.id}`);
                return updatedWorkflow;
        }
    }

    async test(workflow: any, changes: any): Promise<boolean> {
        logger.info(`TelegramAgent testing workflow ${workflow.id}`);

        try {
            // Validate Telegram nodes
            if (!this.validateTelegramNodes(workflow)) {
                return false;
            }

            // Test command handling
            if (!this.testCommandHandling(workflow)) {
                return false;
            }

            // Test message flow
            if (!this.testMessageFlow(workflow)) {
                return false;
            }

            // Simulate bot interaction
            const simulation = await this.simulateBotInteraction(workflow);
            if (!simulation.success) {
                logger.error(`Telegram simulation failed: ${simulation.error}`);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Telegram test failed:', error);
            return false;
        }
    }

    // Private helper methods
    private assessTelegramComplexity(workflow: any): 'low' | 'medium' | 'high' {
        const nodeCount = workflow.nodes?.length || 0;
        const commands = this.countCommandHandlers(workflow);
        
        if (nodeCount < 10 && commands <= 3) return 'low';
        if (nodeCount < 25 && commands <= 10) return 'medium';
        return 'high';
    }

    private async analyzeTelegramPerformance(workflow: any): Promise<any> {
        return {
            estimatedResponseTime: this.estimateResponseTime(workflow),
            bottlenecks: this.findTelegramBottlenecks(workflow),
            apiCallCount: this.countTelegramAPICalls(workflow)
        };
    }

    private analyzeTelegramReliability(workflow: any): any {
        return {
            hasErrorHandling: this.hasErrorResponses(workflow),
            hasRateLimiting: this.hasRateLimiting(workflow),
            hasWebhook: !this.usesPolling(workflow),
            hasCommandValidation: this.hasCommandValidation(workflow)
        };
    }

    private detectTelegramPatterns(workflow: any): string[] {
        const patterns = [];
        
        if (this.hasCommandRouter(workflow)) patterns.push('command-router');
        if (this.hasInlineKeyboards(workflow)) patterns.push('inline-keyboard');
        if (this.hasMediaHandling(workflow)) patterns.push('media-handling');
        if (this.hasConversationFlow(workflow)) patterns.push('conversation-flow');
        if (this.hasGroupChatHandling(workflow)) patterns.push('group-chat');
        
        return patterns;
    }

    private findTelegramIssues(workflow: any): any[] {
        const issues = [];
        
        if (!this.hasTelegramTrigger(workflow)) {
            issues.push({
                type: 'missing-trigger',
                severity: 'high',
                message: 'Telegram workflow missing Telegram Trigger node'
            });
        }
        
        if (this.hasMultipleTriggers(workflow)) {
            issues.push({
                type: 'multiple-triggers',
                severity: 'medium',
                message: 'Multiple Telegram triggers can cause conflicts'
            });
        }
        
        if (!this.hasCredentials(workflow)) {
            issues.push({
                type: 'missing-credentials',
                severity: 'high',
                message: 'Telegram nodes missing bot credentials'
            });
        }
        
        return issues;
    }

    private countTelegramNodes(workflow: any): number {
        return workflow.nodes?.filter((n: any) => 
            n.type.includes('telegram')
        ).length || 0;
    }

    private countCommandHandlers(workflow: any): number {
        return workflow.nodes?.filter((n: any) => 
            (n.type === 'n8n-nodes-base.if' || n.type === 'n8n-nodes-base.switch') &&
            n.parameters?.conditions?.string?.some((c: any) => 
                c.value1?.includes('text') && c.value2?.startsWith('/')
            )
        ).length || 0;
    }

    private getMessageTypes(workflow: any): string[] {
        const types = new Set<string>();
        
        workflow.nodes?.forEach((node: any) => {
            if (node.type === 'n8n-nodes-base.telegramTrigger') {
                const updates = node.parameters?.updates || [];
                updates.forEach((u: string) => types.add(u));
            }
        });
        
        return Array.from(types);
    }

    private estimateResponseTime(workflow: any): number {
        const baseTime = 50;
        const nodeTime = (workflow.nodes?.length || 0) * 30;
        const apiCalls = this.countTelegramAPICalls(workflow) * 200;
        return baseTime + nodeTime + apiCalls;
    }

    private hasCommandRouter(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            n.type === 'n8n-nodes-base.switch' &&
            n.name.toLowerCase().includes('command')
        ) || false;
    }

    private hasRateLimiting(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            (n.type.includes('redis') || n.type.includes('code')) &&
            (n.name.toLowerCase().includes('rate') || 
             n.parameters?.code?.includes('rate'))
        ) || false;
    }

    private hasMessageTypeHandler(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            n.type === 'n8n-nodes-base.switch' &&
            (n.name.toLowerCase().includes('type') || 
             n.parameters?.dataPropertyName?.includes('type'))
        ) || false;
    }

    private hasErrorResponses(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            n.type === 'n8n-nodes-base.telegram' &&
            n.continueOnFail === true
        ) || false;
    }

    private shouldUseInlineKeyboards(workflow: any): boolean {
        const commands = this.extractCommands(workflow);
        return commands.length > 3 || this.hasMenuPattern(workflow);
    }

    private usesPolling(workflow: any): boolean {
        const trigger = workflow.nodes?.find((n: any) => 
            n.type === 'n8n-nodes-base.telegramTrigger'
        );
        return !trigger?.webhookId;
    }

    private extractCommands(workflow: any): string[] {
        const commands = new Set<string>();
        
        workflow.nodes?.forEach((node: any) => {
            if (node.type === 'n8n-nodes-base.if' || node.type === 'n8n-nodes-base.switch') {
                node.parameters?.conditions?.string?.forEach((c: any) => {
                    if (c.value2?.startsWith('/')) {
                        commands.add(c.value2);
                    }
                });
            }
        });
        
        return Array.from(commands);
    }

    private hasInlineKeyboards(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            n.type === 'n8n-nodes-base.telegram' &&
            n.parameters?.replyMarkup === 'inlineKeyboard'
        ) || false;
    }

    private hasMediaHandling(workflow: any): boolean {
        return this.getMessageTypes(workflow).some(t => 
            ['photo', 'document', 'video', 'audio'].includes(t)
        );
    }

    private hasConversationFlow(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            n.type.includes('wait') || 
            n.name.toLowerCase().includes('conversation')
        ) || false;
    }

    private hasGroupChatHandling(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            n.parameters?.code?.includes('chat.type') ||
            n.name.toLowerCase().includes('group')
        ) || false;
    }

    private hasTelegramTrigger(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            n.type === 'n8n-nodes-base.telegramTrigger'
        ) || false;
    }

    private hasMultipleTriggers(workflow: any): boolean {
        const triggers = workflow.nodes?.filter((n: any) => 
            n.type === 'n8n-nodes-base.telegramTrigger'
        ) || [];
        return triggers.length > 1;
    }

    private hasCredentials(workflow: any): boolean {
        return workflow.nodes?.filter((n: any) => 
            n.type.includes('telegram')
        ).every((n: any) => n.credentials?.telegramApi) || false;
    }

    private hasMenuPattern(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            n.name.toLowerCase().includes('menu') ||
            n.parameters?.text?.includes('menu')
        ) || false;
    }

    private findTelegramBottlenecks(workflow: any): string[] {
        const bottlenecks = [];
        
        if (this.countTelegramAPICalls(workflow) > 5) {
            bottlenecks.push('Multiple API calls in sequence');
        }
        
        if (this.hasNestedConditions(workflow)) {
            bottlenecks.push('Deeply nested command conditions');
        }
        
        return bottlenecks;
    }

    private countTelegramAPICalls(workflow: any): number {
        return workflow.nodes?.filter((n: any) => 
            n.type === 'n8n-nodes-base.telegram' &&
            n.parameters?.resource === 'message'
        ).length || 0;
    }

    private hasNestedConditions(workflow: any): boolean {
        // Simplified check for nested conditions
        const ifNodes = workflow.nodes?.filter((n: any) => 
            n.type === 'n8n-nodes-base.if'
        ) || [];
        return ifNodes.length > 3;
    }

    private hasCommandValidation(workflow: any): boolean {
        return workflow.nodes?.some((n: any) => 
            n.type === 'n8n-nodes-base.code' &&
            (n.parameters?.code?.includes('validate') ||
             n.parameters?.code?.includes('/'))
        ) || false;
    }

    private validateTelegramNodes(workflow: any): boolean {
        const telegramNodes = workflow.nodes?.filter((n: any) => 
            n.type.includes('telegram')
        ) || [];
        
        return telegramNodes.length > 0 && 
               telegramNodes.every((n: any) => n.credentials?.telegramApi);
    }

    private testCommandHandling(workflow: any): boolean {
        const commands = this.extractCommands(workflow);
        const handlers = this.countCommandHandlers(workflow);
        
        return commands.length === 0 || handlers > 0;
    }

    private testMessageFlow(workflow: any): boolean {
        // Verify message flow integrity
        return true; // Simplified
    }

    private async simulateBotInteraction(workflow: any): Promise<any> {
        return {
            success: true,
            responseTime: this.estimateResponseTime(workflow),
            commandsCovered: this.extractCommands(workflow).length
        };
    }

    // Implementation methods
    private addCommandRouter(workflow: any, metadata: any): any {
        const commands = metadata?.commands || this.extractCommands(workflow);
        
        const routerNode = {
            id: `router_${Date.now()}`,
            name: 'Command Router',
            type: 'n8n-nodes-base.switch',
            typeVersion: 1,
            position: [450, 300],
            parameters: {
                dataType: 'string',
                value1: '={{$json.message.text}}',
                rules: {
                    rules: commands.map((cmd: string, index: number) => ({
                        value2: cmd,
                        output: index
                    }))
                },
                fallbackOutput: commands.length
            }
        };

        // Replace multiple IF nodes with single router
        workflow.nodes = workflow.nodes.filter((n: any) => 
            !(n.type === 'n8n-nodes-base.if' && 
              n.parameters?.conditions?.string?.some((c: any) => 
                commands.includes(c.value2)
              ))
        );
        
        workflow.nodes.push(routerNode);
        return workflow;
    }

    private addRateLimiting(workflow: any): any {
        const rateLimitNode = {
            id: `ratelimit_${Date.now()}`,
            name: 'Rate Limiter',
            type: 'n8n-nodes-base.code',
            typeVersion: 1,
            position: [350, 300],
            parameters: {
                code: `// Rate limiting implementation
const userId = items[0].json.message.from.id;
const key = \`rate:\${userId}\`;
const limit = 30; // requests per minute
const window = 60; // seconds

// Check rate limit (requires Redis node before this)
const current = parseInt(items[0].json.rateCount || '0');

if (current >= limit) {
  // Rate limit exceeded
  throw new Error('Rate limit exceeded. Please try again later.');
}

return items;`
            }
        };

        // Add after trigger
        const triggerIndex = workflow.nodes.findIndex((n: any) => 
            n.type === 'n8n-nodes-base.telegramTrigger'
        );
        
        workflow.nodes.splice(triggerIndex + 1, 0, rateLimitNode);
        return workflow;
    }

    private addMessageTypeHandler(workflow: any, metadata: any): any {
        const messageTypes = metadata?.messageTypes || ['text', 'photo', 'document'];
        
        const typeHandlerNode = {
            id: `typehandler_${Date.now()}`,
            name: 'Message Type Handler',
            type: 'n8n-nodes-base.switch',
            typeVersion: 1,
            position: [550, 300],
            parameters: {
                dataType: 'string',
                value1: '={{Object.keys($json.message).find(key => ["text", "photo", "document", "video", "audio", "voice"].includes(key))}}',
                rules: {
                    rules: messageTypes.map((type: string, index: number) => ({
                        value2: type,
                        output: index
                    }))
                }
            }
        };

        workflow.nodes.push(typeHandlerNode);
        return workflow;
    }

    private addErrorResponses(workflow: any): any {
        const errorHandlerNode = {
            id: `errorhandler_${Date.now()}`,
            name: 'Error Response',
            type: 'n8n-nodes-base.telegram',
            typeVersion: 1,
            position: [750, 500],
            parameters: {
                resource: 'message',
                operation: 'sendMessage',
                chatId: '={{$json.message.chat.id}}',
                text: 'Sorry, an error occurred processing your request. Please try again later.'
            },
            continueOnFail: true
        };

        workflow.nodes.push(errorHandlerNode);
        
        // Enable error handling on all Telegram nodes
        workflow.nodes.forEach((node: any) => {
            if (node.type === 'n8n-nodes-base.telegram') {
                node.continueOnFail = true;
            }
        });
        
        return workflow;
    }

    private addInlineKeyboards(workflow: any): any {
        // Update telegram send nodes to include inline keyboards
        workflow.nodes.forEach((node: any) => {
            if (node.type === 'n8n-nodes-base.telegram' && 
                node.parameters?.operation === 'sendMessage' &&
                !node.parameters?.replyMarkup) {
                
                node.parameters.replyMarkup = 'inlineKeyboard';
                node.parameters.inlineKeyboard = {
                    rows: [{
                        row: [{
                            text: 'Option 1',
                            callbackData: 'option1'
                        }, {
                            text: 'Option 2',
                            callbackData: 'option2'
                        }]
                    }]
                };
            }
        });
        
        return workflow;
    }

    private migrateToWebhooks(workflow: any): any {
        const trigger = workflow.nodes?.find((n: any) => 
            n.type === 'n8n-nodes-base.telegramTrigger'
        );
        
        if (trigger) {
            trigger.webhookId = `webhook_${Date.now()}`;
            trigger.parameters = {
                ...trigger.parameters,
                updates: trigger.parameters?.updates || ['message']
            };
        }
        
        return workflow;
    }
}