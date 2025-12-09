import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { WorkflowAnalysis, OptimizationSuggestion, ReviewResult } from '@n8n-agent-platform/shared';

export interface AIProvider {
    analyze(workflow: any, context: any): Promise<WorkflowAnalysis>;
    suggest(analysis: WorkflowAnalysis): Promise<OptimizationSuggestion[]>;
    generateCode(suggestion: OptimizationSuggestion): Promise<string>;
}

export class AIReviewEngine {
    private openai: OpenAI | null = null;
    private anthropic: Anthropic | null = null;
    private currentProvider: 'openai' | 'anthropic' = 'openai';

    constructor() {
        this.initializeProviders();
    }

    private initializeProviders(): void {
        // Initialize OpenAI
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
            logger.info('OpenAI provider initialized');
        }

        // Initialize Anthropic Claude
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY
            });
            logger.info('Anthropic Claude provider initialized');
        }

        // Set default provider
        if (process.env.AI_PROVIDER === 'anthropic' && this.anthropic) {
            this.currentProvider = 'anthropic';
        }
    }

    async reviewWorkflow(workflow: any, options: {
        focus?: 'performance' | 'reliability' | 'security' | 'optimization';
        depth?: 'quick' | 'standard' | 'deep';
        context?: any;
    } = {}): Promise<ReviewResult> {
        const startTime = Date.now();
        
        try {
            // Analyze workflow structure and patterns
            const analysis = await this.analyzeWorkflow(workflow, options);
            
            // Generate optimization suggestions
            const suggestions = await this.generateSuggestions(analysis, options);
            
            // Prioritize suggestions
            const prioritizedSuggestions = this.prioritizeSuggestions(suggestions);
            
            // Generate implementation code for top suggestions
            const implementations = await this.generateImplementations(
                prioritizedSuggestions.slice(0, 3)
            );

            const executionTime = Date.now() - startTime;

            return {
                workflowId: workflow.id || 'unknown',
                timestamp: new Date().toISOString(),
                analysis,
                suggestions: prioritizedSuggestions,
                implementations,
                executionTime,
                provider: this.currentProvider,
                confidence: this.calculateConfidence(analysis, suggestions)
            };

        } catch (error) {
            logger.error('AI review failed:', error);
            throw error;
        }
    }

    private async analyzeWorkflow(workflow: any, options: any): Promise<WorkflowAnalysis> {
        const prompt = this.buildAnalysisPrompt(workflow, options);
        
        if (this.currentProvider === 'openai' && this.openai) {
            return this.analyzeWithOpenAI(prompt, workflow);
        } else if (this.currentProvider === 'anthropic' && this.anthropic) {
            return this.analyzeWithClaude(prompt, workflow);
        }
        
        throw new Error('No AI provider available');
    }

    private async analyzeWithOpenAI(prompt: string, workflow: any): Promise<WorkflowAnalysis> {
        const response = await this.openai!.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert n8n workflow analyst. Analyze workflows for performance, reliability, and optimization opportunities. Focus on MCPs, Telegram bots, and agent systems.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');
        
        return {
            complexity: result.complexity || 'medium',
            performance: result.performance || {},
            reliability: result.reliability || {},
            patterns: result.patterns || [],
            issues: result.issues || [],
            metrics: {
                nodeCount: workflow.nodes?.length || 0,
                connectionCount: Object.keys(workflow.connections || {}).length,
                estimatedExecutionTime: result.estimatedExecutionTime || 0,
                ...result.metrics
            }
        };
    }

    private async analyzeWithClaude(prompt: string, workflow: any): Promise<WorkflowAnalysis> {
        const response = await this.anthropic!.messages.create({
            model: 'claude-3-opus-20240229',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 4000,
            temperature: 0.3
        });

        const content = response.content[0].type === 'text' ? response.content[0].text : '';
        const result = JSON.parse(content);
        
        return {
            complexity: result.complexity || 'medium',
            performance: result.performance || {},
            reliability: result.reliability || {},
            patterns: result.patterns || [],
            issues: result.issues || [],
            metrics: {
                nodeCount: workflow.nodes?.length || 0,
                connectionCount: Object.keys(workflow.connections || {}).length,
                estimatedExecutionTime: result.estimatedExecutionTime || 0,
                ...result.metrics
            }
        };
    }

    private async generateSuggestions(
        analysis: WorkflowAnalysis, 
        options: any
    ): Promise<OptimizationSuggestion[]> {
        const prompt = this.buildSuggestionPrompt(analysis, options);
        
        if (this.currentProvider === 'openai' && this.openai) {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'Generate specific, actionable optimization suggestions for n8n workflows.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7
            });

            return this.parseSuggestions(response.choices[0].message.content || '');
        }
        
        return [];
    }

    private async generateImplementations(
        suggestions: OptimizationSuggestion[]
    ): Promise<Map<string, string>> {
        const implementations = new Map<string, string>();
        
        for (const suggestion of suggestions) {
            try {
                const code = await this.generateImplementation(suggestion);
                implementations.set(suggestion.id, code);
            } catch (error) {
                logger.error(`Failed to generate implementation for ${suggestion.id}:`, error);
            }
        }
        
        return implementations;
    }

    private async generateImplementation(suggestion: OptimizationSuggestion): Promise<string> {
        const prompt = `Generate n8n workflow JSON implementation for this optimization:
Type: ${suggestion.type}
Title: ${suggestion.title}
Description: ${suggestion.description}
Impact: ${suggestion.impact}

Generate only valid n8n workflow JSON or node configurations.`;

        if (this.currentProvider === 'openai' && this.openai) {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an n8n workflow implementation expert. Generate valid JSON only.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3
            });

            return response.choices[0].message.content || '';
        }
        
        return '';
    }

    private buildAnalysisPrompt(workflow: any, options: any): string {
        return `Analyze this n8n workflow and provide a detailed technical analysis:

${JSON.stringify(workflow, null, 2)}

Focus areas: ${options.focus || 'general optimization'}
Analysis depth: ${options.depth || 'standard'}

Provide analysis in JSON format with:
- complexity: low/medium/high
- performance: object with bottlenecks, execution time estimates
- reliability: object with failure points, error handling
- patterns: array of detected patterns (MCP, Telegram bot, agent system, etc.)
- issues: array of specific issues found
- metrics: quantitative metrics

Consider n8n Cloud v1.98 compatibility and best practices for MCPs, Telegram bots, and agent systems.`;
    }

    private buildSuggestionPrompt(analysis: WorkflowAnalysis, options: any): string {
        return `Based on this workflow analysis, generate optimization suggestions:

${JSON.stringify(analysis, null, 2)}

Generate 5-10 specific suggestions focusing on:
1. Performance improvements
2. Reliability enhancements
3. Error handling
4. Resource optimization
5. Pattern-specific improvements (MCPs, Telegram, agents)

Format each suggestion as:
- Type: performance/reliability/feature/refactor
- Title: Brief title
- Description: Detailed description
- Impact: high/medium/low
- Effort: high/medium/low
- Specific implementation steps`;
    }

    private parseSuggestions(content: string): OptimizationSuggestion[] {
        // Parse AI response into structured suggestions
        const suggestions: OptimizationSuggestion[] = [];
        
        // Simple parsing logic - would be more sophisticated in production
        const lines = content.split('\n');
        let currentSuggestion: Partial<OptimizationSuggestion> = {};
        
        lines.forEach(line => {
            if (line.includes('Type:')) {
                if (currentSuggestion.title) {
                    suggestions.push(currentSuggestion as OptimizationSuggestion);
                }
                currentSuggestion = {
                    id: `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: line.split(':')[1].trim() as any
                };
            } else if (line.includes('Title:')) {
                currentSuggestion.title = line.split(':')[1].trim();
            } else if (line.includes('Description:')) {
                currentSuggestion.description = line.split(':')[1].trim();
            } else if (line.includes('Impact:')) {
                currentSuggestion.impact = line.split(':')[1].trim() as any;
            } else if (line.includes('Effort:')) {
                currentSuggestion.effort = line.split(':')[1].trim() as any;
            }
        });
        
        if (currentSuggestion.title) {
            suggestions.push(currentSuggestion as OptimizationSuggestion);
        }
        
        return suggestions;
    }

    private prioritizeSuggestions(suggestions: OptimizationSuggestion[]): OptimizationSuggestion[] {
        return suggestions.sort((a, b) => {
            const scoreA = this.calculateSuggestionScore(a);
            const scoreB = this.calculateSuggestionScore(b);
            return scoreB - scoreA;
        });
    }

    private calculateSuggestionScore(suggestion: OptimizationSuggestion): number {
        const impactScore = { high: 3, medium: 2, low: 1 }[suggestion.impact] || 1;
        const effortScore = { low: 3, medium: 2, high: 1 }[suggestion.effort] || 1;
        const typeScore = {
            performance: 3,
            reliability: 3,
            security: 4,
            feature: 2,
            refactor: 1
        }[suggestion.type] || 1;
        
        return (impactScore * 2) + effortScore + typeScore;
    }

    private calculateConfidence(analysis: WorkflowAnalysis, suggestions: OptimizationSuggestion[]): number {
        // Calculate confidence score based on analysis completeness and suggestion quality
        let confidence = 0.5;
        
        if (analysis.metrics.nodeCount > 0) confidence += 0.1;
        if (analysis.patterns.length > 0) confidence += 0.1;
        if (analysis.issues.length > 0) confidence += 0.1;
        if (suggestions.length > 3) confidence += 0.1;
        if (suggestions.some(s => s.impact === 'high')) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }

    async switchProvider(provider: 'openai' | 'anthropic'): Promise<void> {
        if (provider === 'openai' && !this.openai) {
            throw new Error('OpenAI provider not configured');
        }
        if (provider === 'anthropic' && !this.anthropic) {
            throw new Error('Anthropic provider not configured');
        }
        
        this.currentProvider = provider;
        logger.info(`Switched to ${provider} AI provider`);
    }

    getAvailableProviders(): string[] {
        const providers = [];
        if (this.openai) providers.push('openai');
        if (this.anthropic) providers.push('anthropic');
        return providers;
    }

    async generateContent(prompt: string, options: {
        maxTokens?: number;
        temperature?: number;
        format?: 'text' | 'json' | 'markdown';
    } = {}): Promise<string> {
        const maxTokens = options.maxTokens || 2000;
        const temperature = options.temperature || 0.7;

        try {
            if (this.currentProvider === 'openai' && this.openai) {
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert in n8n workflow automation and optimization.'
                        },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: maxTokens,
                    temperature: temperature
                });
                return response.choices[0]?.message?.content || '';
            } else if (this.currentProvider === 'anthropic' && this.anthropic) {
                const response = await this.anthropic.messages.create({
                    model: 'claude-3-opus-20240229',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: maxTokens,
                    temperature: temperature
                });
                return response.content[0]?.type === 'text' ? response.content[0].text : '';
            }
            throw new Error('No AI provider available');
        } catch (error) {
            logger.error('Error generating content:', error);
            throw error;
        }
    }

    async assessAlertPriority(alert: {
        type: string;
        metric: string;
        value: number;
        threshold: number;
        context?: any;
    }): Promise<'low' | 'medium' | 'high' | 'critical'> {
        const prompt = `
Assess the priority of this alert based on the following information:
- Alert Type: ${alert.type}
- Metric: ${alert.metric}
- Current Value: ${alert.value}
- Threshold: ${alert.threshold}
- Context: ${JSON.stringify(alert.context || {})}

Consider:
1. The severity of the metric deviation
2. Potential impact on system performance
3. Risk of cascading failures
4. Business criticality

Respond with only one word: low, medium, high, or critical.
        `.trim();

        try {
            const response = await this.generateContent(prompt, {
                maxTokens: 10,
                temperature: 0.3
            });
            
            const priority = response.toLowerCase().trim();
            if (['low', 'medium', 'high', 'critical'].includes(priority)) {
                return priority as 'low' | 'medium' | 'high' | 'critical';
            }
            
            // Default based on percentage over threshold
            const percentageOver = ((alert.value - alert.threshold) / alert.threshold) * 100;
            if (percentageOver > 100) return 'critical';
            if (percentageOver > 50) return 'high';
            if (percentageOver > 20) return 'medium';
            return 'low';
        } catch (error) {
            logger.error('Error assessing alert priority:', error);
            // Fallback to rule-based assessment
            const percentageOver = ((alert.value - alert.threshold) / alert.threshold) * 100;
            if (percentageOver > 100) return 'critical';
            if (percentageOver > 50) return 'high';
            if (percentageOver > 20) return 'medium';
            return 'low';
        }
    }
}