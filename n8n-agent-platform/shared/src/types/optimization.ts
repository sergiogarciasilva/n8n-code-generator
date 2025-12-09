export interface WorkflowAnalysis {
    complexity: 'low' | 'medium' | 'high';
    performance: PerformanceAnalysis;
    reliability: ReliabilityAnalysis;
    patterns: string[];
    issues: AnalysisIssue[];
    metrics: AnalysisMetrics;
}

export interface PerformanceAnalysis {
    estimatedExecutionTime?: number;
    bottlenecks?: string[];
    resourceUsage?: ResourceUsage;
    parallelizationOpportunities?: string[];
}

export interface ReliabilityAnalysis {
    errorHandling?: boolean;
    retryMechanisms?: boolean;
    dataValidation?: boolean;
    failurePoints?: string[];
}

export interface ResourceUsage {
    memory?: number;
    cpu?: number;
    apiCalls?: number;
    dataTransfer?: number;
}

export interface AnalysisIssue {
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    nodeId?: string;
    suggestion?: string;
}

export interface AnalysisMetrics {
    nodeCount: number;
    connectionCount: number;
    branchingFactor?: number;
    depth?: number;
    estimatedExecutionTime: number;
    [key: string]: any;
}

export interface OptimizationSuggestion {
    id: string;
    type: 'performance' | 'reliability' | 'security' | 'feature' | 'refactor';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    confidence?: number;
    priority?: number;
    metadata?: SuggestionMetadata;
    autoApplicable?: boolean;
    estimatedImprovement?: string | number;
}

export interface SuggestionMetadata {
    nodeIds?: string[];
    pattern?: string;
    technique?: string;
    estimatedImprovement?: number;
    [key: string]: any;
}

export interface ReviewResult {
    workflowId: string;
    timestamp: string;
    analysis: WorkflowAnalysis;
    suggestions: OptimizationSuggestion[];
    implementations?: Map<string, string>;
    executionTime: number;
    provider: string;
    confidence: number;
}

export interface OptimizationResult {
    suggestionId: string;
    applied: boolean;
    beforeState?: any;
    afterState?: any;
    improvement?: OptimizationImprovement;
    error?: string;
}

export interface OptimizationImprovement {
    executionTime?: {
        before: number;
        after: number;
        reduction: number;
    };
    reliability?: {
        errorRate: {
            before: number;
            after: number;
        };
    };
    resourceUsage?: {
        before: ResourceUsage;
        after: ResourceUsage;
    };
}