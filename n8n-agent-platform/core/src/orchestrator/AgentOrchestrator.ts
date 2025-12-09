import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import Bull from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from '../database/DatabaseManager';
import { RedisManager } from '../database/RedisManager';
import { AIReviewEngine } from '../engine/AIReviewEngine';
import { BaseAgent } from '../agents/BaseAgent';
import { MCPAgent } from '../agents/MCPAgent';
import { TelegramAgent } from '../agents/TelegramAgent';
import { MultiAgentSystemAgent } from '../agents/MultiAgentSystemAgent';
import { logger } from '../utils/logger';
import { WebSocketManager } from '../api/WebSocketManager';

interface AgentRegistry {
    [key: string]: BaseAgent;
}

interface ScheduledTask {
    agentId: string;
    schedule: string;
    task: cron.ScheduledTask;
}

export class AgentOrchestrator extends EventEmitter {
    private agents: AgentRegistry = {};
    private scheduledTasks: ScheduledTask[] = [];
    private taskQueue: Bull.Queue;
    private aiEngine: AIReviewEngine;
    private isRunning: boolean = false;

    constructor(
        private database: DatabaseManager,
        private redis: RedisManager,
        private wsManager: WebSocketManager
    ) {
        super();
        
        this.aiEngine = new AIReviewEngine();
        
        // Initialize Bull queue
        this.taskQueue = new Bull('agent-tasks', {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD
            }
        });

        this.setupQueueHandlers();
    }

    async initialize(): Promise<void> {
        try {
            logger.info('Initializing Agent Orchestrator...');

            // Register default agents
            await this.registerDefaultAgents();

            // Load agent configurations from database
            await this.loadAgentConfigurations();

            // Setup scheduled tasks
            await this.setupScheduledTasks();

            // Start queue processing
            this.startQueueProcessing();

            logger.info('Agent Orchestrator initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Agent Orchestrator:', error);
            throw error;
        }
    }

    private async registerDefaultAgents(): Promise<void> {
        const agentContext = {
            database: this.database,
            redis: this.redis,
            aiEngine: this.aiEngine
        };

        // Register MCP Agent
        const mcpAgent = new MCPAgent({
            id: 'mcp-agent-001',
            name: 'MCP Optimization Agent',
            type: 'mcp',
            description: 'Optimizes Model Context Protocol workflows',
            enabled: true
        }, agentContext);

        await this.registerAgent(mcpAgent);

        // Register Telegram Agent
        const telegramAgent = new TelegramAgent({
            id: 'telegram-agent-001',
            name: 'Telegram Bot Optimizer',
            type: 'telegram',
            description: 'Optimizes Telegram bot workflows',
            enabled: true
        }, agentContext);

        await this.registerAgent(telegramAgent);

        // Register Multi-Agent System Agent
        const masAgent = new MultiAgentSystemAgent({
            id: 'mas-agent-001',
            name: 'Multi-Agent System Optimizer',
            type: 'multi-agent',
            description: 'Optimizes multi-agent system workflows',
            enabled: true
        }, agentContext);

        await this.registerAgent(masAgent);
    }

    async registerAgent(agent: BaseAgent): Promise<void> {
        const agentId = agent.getId();
        
        if (this.agents[agentId]) {
            throw new Error(`Agent ${agentId} already registered`);
        }

        this.agents[agentId] = agent;

        // Register agent in database
        await this.database.registerAgent({
            id: agentId,
            name: agent.getName(),
            type: agent.getType(),
            description: agent.toJSON().description,
            status: agent.getStatus()
        });

        // Setup agent event listeners
        agent.on('status', (data) => {
            this.handleAgentStatusChange(agentId, data);
        });

        agent.on('change', (data) => {
            this.handleAgentChange(agentId, data);
        });

        logger.info(`Agent ${agentId} registered successfully`);
    }

    async createAgent(type: string, config: any): Promise<BaseAgent> {
        const agentContext = {
            database: this.database,
            redis: this.redis,
            aiEngine: this.aiEngine
        };

        let agent: BaseAgent;

        switch (type) {
            case 'mcp':
                agent = new MCPAgent(config, agentContext);
                break;
            case 'telegram':
                agent = new TelegramAgent(config, agentContext);
                break;
            case 'multi-agent':
                agent = new MultiAgentSystemAgent(config, agentContext);
                break;
            default:
                throw new Error(`Unknown agent type: ${type}`);
        }

        await this.registerAgent(agent);
        return agent;
    }

    async unregisterAgent(agentId: string): Promise<void> {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        // Stop agent
        await agent.stop();

        // Remove from registry
        delete this.agents[agentId];

        // Update database
        await this.database.updateAgentStatus(agentId, 'stopped');

        logger.info(`Agent ${agentId} unregistered`);
    }

    async startAllAgents(): Promise<void> {
        this.isRunning = true;
        
        const agentPromises = Object.values(this.agents).map(agent => 
            this.startAgent(agent.getId())
        );

        await Promise.all(agentPromises);
        
        logger.info('All agents started');
    }

    async stopAllAgents(): Promise<void> {
        this.isRunning = false;
        
        // Stop scheduled tasks
        this.scheduledTasks.forEach(task => task.task.stop());
        this.scheduledTasks = [];

        // Stop all agents
        const agentPromises = Object.values(this.agents).map(agent => 
            this.stopAgent(agent.getId())
        );

        await Promise.all(agentPromises);

        // Stop queue processing
        await this.taskQueue.close();

        logger.info('All agents stopped');
    }

    async startAgent(agentId: string): Promise<void> {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        await agent.start();
        await this.database.updateAgentStatus(agentId, 'active');
        
        this.wsManager.broadcast('agent:started', {
            agentId,
            timestamp: new Date()
        });
    }

    async stopAgent(agentId: string): Promise<void> {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        await agent.stop();
        await this.database.updateAgentStatus(agentId, 'stopped');
        
        this.wsManager.broadcast('agent:stopped', {
            agentId,
            timestamp: new Date()
        });
    }

    async pauseAgent(agentId: string): Promise<void> {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        await agent.pause();
        await this.database.updateAgentStatus(agentId, 'paused');
    }

    async resumeAgent(agentId: string): Promise<void> {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        await agent.resume();
        await this.database.updateAgentStatus(agentId, 'active');
    }

    async runAgent(agentId: string, workflowId?: string): Promise<any> {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        // Check if agent is already running
        const isLocked = await this.redis.lockAgent(agentId);
        if (!isLocked) {
            throw new Error(`Agent ${agentId} is already running`);
        }

        try {
            // Log execution start
            const executionId = await this.database.logAgentExecution({
                agentId,
                workflowId,
                status: 'started',
                startTime: new Date()
            });

            // Run agent
            const result = await agent.run(workflowId);

            // Update execution log
            await this.database.updateAgentExecution(executionId, {
                status: 'completed',
                endTime: new Date(),
                executionTime: result.metrics?.executionTime,
                workflowsProcessed: result.metrics?.workflowsProcessed,
                changesApplied: result.changes.filter(c => c.applied).length,
                metrics: result.metrics
            });

            // Update agent last run
            await this.database.updateAgentLastRun(agentId);

            // Broadcast result
            this.wsManager.broadcast('agent:execution:complete', {
                agentId,
                executionId,
                result,
                timestamp: new Date()
            });

            return result;
        } catch (error: any) {
            logger.error(`Agent ${agentId} execution failed:`, error);
            throw error;
        } finally {
            await this.redis.unlockAgent(agentId);
        }
    }

    async scheduleAgent(agentId: string, schedule: string): Promise<void> {
        const agent = this.agents[agentId];
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        // Validate cron expression
        if (!cron.validate(schedule)) {
            throw new Error(`Invalid cron expression: ${schedule}`);
        }

        // Remove existing schedule if any
        this.unscheduleAgent(agentId);

        // Create new scheduled task
        const task = cron.schedule(schedule, async () => {
            logger.info(`Running scheduled task for agent ${agentId}`);
            
            try {
                await this.runAgent(agentId);
            } catch (error) {
                logger.error(`Scheduled run failed for agent ${agentId}:`, error);
            }
        });

        this.scheduledTasks.push({ agentId, schedule, task });

        // Save schedule to database
        await this.database.saveAgentSchedule({
            agentId,
            type: 'cron',
            cronExpression: schedule,
            enabled: true
        });

        logger.info(`Agent ${agentId} scheduled with cron: ${schedule}`);
    }

    unscheduleAgent(agentId: string): void {
        const index = this.scheduledTasks.findIndex(t => t.agentId === agentId);
        if (index >= 0) {
            this.scheduledTasks[index].task.stop();
            this.scheduledTasks.splice(index, 1);
            logger.info(`Agent ${agentId} unscheduled`);
        }
    }

    async queueAgentTask(agentId: string, task: any): Promise<void> {
        const job = await this.taskQueue.add('agent-task', {
            id: uuidv4(),
            agentId,
            task,
            timestamp: new Date()
        });

        logger.info(`Task queued for agent ${agentId}, job ID: ${job.id}`);
    }

    private async loadAgentConfigurations(): Promise<void> {
        const activeAgents = await this.database.getActiveAgents();
        
        for (const agentConfig of activeAgents) {
            if (this.agents[agentConfig.agent_id]) {
                // Update existing agent configuration
                const agent = this.agents[agentConfig.agent_id];
                // Apply any stored configurations
            }
        }
    }

    private async setupScheduledTasks(): Promise<void> {
        const schedules = await this.database.getActiveSchedules();
        
        for (const schedule of schedules) {
            if (schedule.schedule_type === 'cron' && schedule.cron_expression) {
                try {
                    await this.scheduleAgent(schedule.agent_id, schedule.cron_expression);
                } catch (error) {
                    logger.error(`Failed to setup schedule for agent ${schedule.agent_id}:`, error);
                }
            }
        }
    }

    private setupQueueHandlers(): void {
        // Process agent tasks
        this.taskQueue.process('agent-task', async (job) => {
            const { agentId, task } = job.data;
            
            logger.info(`Processing queued task for agent ${agentId}`);
            
            try {
                const result = await this.runAgent(agentId, task.workflowId);
                return result;
            } catch (error) {
                logger.error(`Queue task failed for agent ${agentId}:`, error);
                throw error;
            }
        });

        // Queue event handlers
        this.taskQueue.on('completed', (job, result) => {
            logger.info(`Queue job ${job.id} completed`);
            this.wsManager.broadcast('queue:job:completed', {
                jobId: job.id,
                agentId: job.data.agentId,
                result
            });
        });

        this.taskQueue.on('failed', (job, error) => {
            logger.error(`Queue job ${job.id} failed:`, error);
            this.wsManager.broadcast('queue:job:failed', {
                jobId: job.id,
                agentId: job.data.agentId,
                error: error.message
            });
        });
    }

    private startQueueProcessing(): void {
        logger.info('Queue processing started');
    }

    private handleAgentStatusChange(agentId: string, data: any): void {
        this.database.updateAgentStatus(agentId, data.status).catch(error => {
            logger.error(`Failed to update agent status in database:`, error);
        });

        this.wsManager.broadcast('agent:status', {
            agentId,
            ...data
        });
    }

    private handleAgentChange(agentId: string, data: any): void {
        this.wsManager.broadcast('workflow:change', {
            agentId,
            ...data
        });

        // Log system event
        this.database.logSystemEvent({
            type: 'workflow_optimized',
            source: `agent:${agentId}`,
            severity: 'info',
            message: `Workflow ${data.workflowId} optimized by ${agentId}`,
            metadata: data
        }).catch(error => {
            logger.error(`Failed to log system event:`, error);
        });
    }

    // Public API methods
    getAgent(agentId: string): BaseAgent | undefined {
        return this.agents[agentId];
    }

    getAllAgents(): BaseAgent[] {
        return Object.values(this.agents);
    }

    getAgentStatus(agentId: string): string | null {
        const agent = this.agents[agentId];
        return agent ? agent.getStatus() : null;
    }

    async getAgentMetrics(agentId: string, hours: number = 24): Promise<any> {
        return await this.database.getAgentMetrics(agentId, hours);
    }

    async getQueueStatus(): Promise<any> {
        const waiting = await this.taskQueue.getWaitingCount();
        const active = await this.taskQueue.getActiveCount();
        const completed = await this.taskQueue.getCompletedCount();
        const failed = await this.taskQueue.getFailedCount();

        return {
            waiting,
            active,
            completed,
            failed,
            isPaused: await this.taskQueue.isPaused()
        };
    }

    async pauseQueue(): Promise<void> {
        await this.taskQueue.pause();
        logger.info('Queue processing paused');
    }

    async resumeQueue(): Promise<void> {
        await this.taskQueue.resume();
        logger.info('Queue processing resumed');
    }

    async clearQueue(): Promise<void> {
        await this.taskQueue.empty();
        logger.info('Queue cleared');
    }
}