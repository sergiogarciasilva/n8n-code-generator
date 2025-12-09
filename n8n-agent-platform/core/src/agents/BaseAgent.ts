import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { DatabaseManager } from '../database/DatabaseManager';
import { RedisManager } from '../database/RedisManager';
import { AIReviewEngine } from '../engine/AIReviewEngine';
import { WorkflowAnalysis, OptimizationSuggestion, AgentStatus, AgentType } from '@n8n-agent-platform/shared';

export interface AgentConfig {
    id: string;
    name: string;
    type: AgentType;
    description: string;
    schedule?: string; // Cron expression
    enabled: boolean;
    options?: any;
    organizationId?: string;
}

export interface AgentContext {
    database: DatabaseManager;
    redis: RedisManager;
    aiEngine: AIReviewEngine;
    workflowId?: string;
    metadata?: any;
}

export interface AgentResult {
    agentId: string;
    timestamp: Date;
    workflowId?: string;
    changes: any[];
    metrics: any;
    success: boolean;
    error?: string;
}

export abstract class BaseAgent extends EventEmitter {
    protected id: string;
    protected name: string;
    protected type: AgentType;
    protected description: string;
    protected status: AgentStatus = 'idle';
    protected lastRun?: Date;
    protected context: AgentContext;
    protected isRunning: boolean = false;
    protected config: AgentConfig;

    constructor(config: AgentConfig, context: AgentContext) {
        super();
        this.config = config;
        this.id = config.id || uuidv4();
        this.name = config.name;
        this.type = config.type;
        this.description = config.description;
        this.context = context;
    }

    // Abstract methods to be implemented by specific agents
    abstract analyze(workflow: any): Promise<WorkflowAnalysis>;
    abstract optimize(workflow: any, analysis: WorkflowAnalysis): Promise<OptimizationSuggestion[]>;
    abstract implement(workflow: any, suggestion: OptimizationSuggestion): Promise<any>;
    abstract test(workflow: any, changes: any): Promise<boolean>;

    async run(workflowId?: string): Promise<AgentResult> {
        if (this.isRunning) {
            throw new Error(`Agent ${this.name} is already running`);
        }

        this.isRunning = true;
        this.status = 'running';
        this.emit('status', { status: 'running', agentId: this.id });

        const startTime = Date.now();
        const result: AgentResult = {
            agentId: this.id,
            timestamp: new Date(),
            workflowId,
            changes: [],
            metrics: {},
            success: false
        };

        try {
            logger.info(`Agent ${this.name} starting run for workflow ${workflowId || 'all'}`);

            // Get workflows to process
            const workflows = workflowId 
                ? [await this.context.database.getWorkflow(workflowId)]
                : await this.context.database.getWorkflowsForOptimization();

            for (const workflow of workflows) {
                try {
                    // Store current state
                    await this.saveWorkflowState(workflow);

                    // Analyze workflow
                    const analysis = await this.analyze(workflow);
                    await this.saveAnalysis(workflow.id, analysis);

                    // Generate optimizations
                    const suggestions = await this.optimize(workflow, analysis);
                    
                    // Implement top suggestions
                    for (const suggestion of suggestions.slice(0, 3)) {
                        try {
                            const updatedWorkflow = await this.implement(workflow, suggestion);
                            
                            // Test changes
                            const testResult = await this.test(updatedWorkflow, suggestion);
                            
                            if (testResult) {
                                // Apply changes
                                await this.applyChanges(workflow.id, updatedWorkflow, suggestion);
                                result.changes.push({
                                    suggestionId: suggestion.id,
                                    type: suggestion.type,
                                    applied: true,
                                    impact: suggestion.impact
                                });
                                
                                // Emit change event
                                this.emit('change', {
                                    agentId: this.id,
                                    workflowId: workflow.id,
                                    suggestion,
                                    timestamp: new Date()
                                });
                            } else {
                                // Rollback if test failed
                                await this.rollbackChanges(workflow.id);
                                result.changes.push({
                                    suggestionId: suggestion.id,
                                    type: suggestion.type,
                                    applied: false,
                                    reason: 'Test failed'
                                });
                            }
                        } catch (error) {
                            logger.error(`Failed to implement suggestion ${suggestion.id}:`, error);
                        }
                    }
                } catch (error) {
                    logger.error(`Agent ${this.name} failed to process workflow ${workflow.id}:`, error);
                }
            }

            result.success = true;
            result.metrics = {
                executionTime: Date.now() - startTime,
                workflowsProcessed: workflows.length,
                changesApplied: result.changes.filter(c => c.applied).length
            };

            this.lastRun = new Date();
            await this.saveAgentMetrics(result);

        } catch (error: any) {
            logger.error(`Agent ${this.name} run failed:`, error);
            result.success = false;
            result.error = error.message;
        } finally {
            this.isRunning = false;
            this.status = 'idle';
            this.emit('status', { status: 'idle', agentId: this.id });
        }

        return result;
    }

    protected async saveWorkflowState(workflow: any): Promise<void> {
        const key = `workflow:${workflow.id}:state`;
        await this.context.redis.set(key, JSON.stringify(workflow), 86400); // 24h TTL
    }

    protected async saveAnalysis(workflowId: string, analysis: WorkflowAnalysis): Promise<void> {
        await this.context.database.saveAnalysis({
            workflowId,
            agentId: this.id,
            analysis,
            timestamp: new Date()
        });
    }

    protected async applyChanges(
        workflowId: string, 
        updatedWorkflow: any, 
        suggestion: OptimizationSuggestion
    ): Promise<void> {
        // Save to database
        await this.context.database.updateWorkflow(workflowId, updatedWorkflow);
        
        // Log change
        await this.context.database.logChange({
            workflowId,
            agentId: this.id,
            suggestion,
            beforeState: await this.context.redis.get(`workflow:${workflowId}:state`),
            afterState: JSON.stringify(updatedWorkflow),
            timestamp: new Date()
        });
        
        // Update cache
        await this.context.redis.set(
            `workflow:${workflowId}:optimized`, 
            JSON.stringify(updatedWorkflow),
            3600
        );
    }

    protected async rollbackChanges(workflowId: string): Promise<void> {
        const stateKey = `workflow:${workflowId}:state`;
        const originalState = await this.context.redis.get(stateKey);
        
        if (originalState) {
            const workflow = JSON.parse(originalState);
            await this.context.database.updateWorkflow(workflowId, workflow);
            logger.info(`Rolled back changes for workflow ${workflowId}`);
        }
    }

    protected async saveAgentMetrics(result: AgentResult): Promise<void> {
        await this.context.database.saveAgentMetrics({
            agentId: this.id,
            agentType: this.type,
            timestamp: result.timestamp,
            metrics: result.metrics,
            success: result.success
        });
    }

    // Helper methods for common operations
    protected async getCachedAnalysis(workflowId: string): Promise<WorkflowAnalysis | null> {
        const key = `analysis:${workflowId}:${this.type}`;
        const cached = await this.context.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }

    protected async cacheAnalysis(workflowId: string, analysis: WorkflowAnalysis): Promise<void> {
        const key = `analysis:${workflowId}:${this.type}`;
        await this.context.redis.set(key, JSON.stringify(analysis), 3600); // 1h cache
    }

    // Lifecycle methods
    async start(): Promise<void> {
        this.status = 'active';
        logger.info(`Agent ${this.name} started`);
    }

    async stop(): Promise<void> {
        this.status = 'stopped';
        logger.info(`Agent ${this.name} stopped`);
    }

    async pause(): Promise<void> {
        this.status = 'paused';
        logger.info(`Agent ${this.name} paused`);
    }

    async resume(): Promise<void> {
        this.status = 'active';
        logger.info(`Agent ${this.name} resumed`);
    }

    // Getters
    getId(): string { return this.id; }
    getName(): string { return this.name; }
    getType(): AgentType { return this.type; }
    getStatus(): AgentStatus { return this.status; }
    getLastRun(): Date | undefined { return this.lastRun; }
    getConfig(): AgentConfig { return this.config; }
    
    toJSON(): any {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            description: this.description,
            status: this.status,
            lastRun: this.lastRun,
            isRunning: this.isRunning
        };
    }
}