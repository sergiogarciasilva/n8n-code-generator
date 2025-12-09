export interface DashboardMetrics {
    activeWorkflows: number;
    activeAgents: number;
    recentSuggestions: number;
    recentChanges: number;
    avgImprovement: number;
    timestamp: Date;
}

export interface AgentMetrics {
    agentId: string;
    agentType: string;
    totalRuns: number;
    successRate: number;
    avgExecutionTime: number;
    workflowsOptimized: number;
    changesApplied: number;
    errorRate: number;
    lastRun?: Date;
}

export interface WorkflowMetrics {
    workflowId: string;
    executionCount: number;
    avgExecutionTime: number;
    successRate: number;
    errorRate: number;
    lastOptimized?: Date;
    optimizationCount: number;
    performanceGain?: number;
}

export interface SystemMetrics {
    uptime: number;
    memoryUsage: MemoryUsage;
    cpuUsage: number;
    activeConnections: number;
    queueStatus: QueueMetrics;
    databaseStatus: DatabaseMetrics;
}

export interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
}

export interface QueueMetrics {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
}

export interface DatabaseMetrics {
    connectionCount: number;
    queryCount: number;
    avgQueryTime: number;
    slowQueries: number;
    errorCount: number;
}

export interface PerformanceBenchmark {
    workflowId: string;
    benchmarkType: string;
    baselineTime: number;
    optimizedTime: number;
    improvementPercentage: number;
    nodeMetrics?: NodePerformanceMetrics;
    timestamp: Date;
}

export interface NodePerformanceMetrics {
    [nodeId: string]: {
        executionTime: number;
        memoryUsage?: number;
        errorCount?: number;
    };
}

export interface TimeSeriesMetric {
    timestamp: number;
    value: number;
    label?: string;
}

export interface MetricAggregation {
    metric: string;
    period: 'hour' | 'day' | 'week' | 'month';
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
    values: TimeSeriesMetric[];
}