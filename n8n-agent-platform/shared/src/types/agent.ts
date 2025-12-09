export type AgentType = 'mcp' | 'telegram' | 'multi-agent' | 'general';

export type AgentStatus = 'idle' | 'running' | 'active' | 'paused' | 'stopped' | 'error';

export interface Agent {
    id: string;
    name: string;
    type: AgentType;
    description: string;
    status: AgentStatus;
    config?: AgentConfig;
    lastRun?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface AgentConfig {
    schedule?: string;
    enabled: boolean;
    options?: Record<string, any>;
    maxConcurrentWorkflows?: number;
    timeout?: number;
    retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
    maxDelay: number;
}

export interface AgentExecution {
    id: string;
    agentId: string;
    workflowId?: string;
    status: 'started' | 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    executionTime?: number;
    workflowsProcessed: number;
    changesApplied: number;
    error?: string;
    metrics?: AgentExecutionMetrics;
}

export interface AgentExecutionMetrics {
    totalNodes: number;
    optimizedNodes: number;
    executionTimeReduction?: number;
    performanceImprovement?: number;
    custom?: Record<string, any>;
}

export interface AgentTask {
    id: string;
    agentId: string;
    type: 'analyze' | 'optimize' | 'execute' | 'test';
    priority: 'high' | 'medium' | 'low';
    workflowId?: string;
    payload?: any;
    createdAt: Date;
    scheduledFor?: Date;
}

export interface AgentSchedule {
    id: string;
    agentId: string;
    scheduleType: 'cron' | 'interval' | 'manual' | 'triggered';
    cronExpression?: string;
    intervalSeconds?: number;
    enabled: boolean;
    lastTriggered?: Date;
    nextTrigger?: Date;
}