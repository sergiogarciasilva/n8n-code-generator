export interface N8nNode {
    id: string;
    name: string;
    type: string;
    typeVersion?: number;
    position: [number, number];
    parameters?: Record<string, any>;
    webhookId?: string;
    credentials?: Record<string, string>;
    disabled?: boolean;
    notes?: string;
    onError?: 'stopWorkflow' | 'continueRegularOutput' | 'continueErrorOutput';
    retryOnFail?: boolean;
    maxTries?: number;
    waitBetweenTries?: number;
    alwaysOutputData?: boolean;
    executeOnce?: boolean;
    continueOnFail?: boolean;
}

export interface N8nConnection {
    node: string;
    type: 'main' | 'ai';
    index: number;
}

export interface N8nWorkflow {
    id?: string;
    name: string;
    nodes: N8nNode[];
    connections: Record<string, {
        main?: N8nConnection[][];
        ai?: N8nConnection[][];
    }>;
    active?: boolean;
    settings?: {
        executionOrder?: 'v0' | 'v1';
        saveManualExecutions?: boolean;
        callerPolicy?: 'workflowsFromSameOwner' | 'workflowsFromAList' | 'any';
        errorWorkflow?: string;
        timezone?: string;
    };
    staticData?: Record<string, any>;
    tags?: string[];
    meta?: {
        instanceId?: string;
    };
    pinData?: Record<string, any[]>;
    versionId?: string;
}

export interface WorkflowGenerationRequest {
    description: string;
    category: 'automation' | 'integration' | 'ai-ml' | 'data-processing' | 'communication' | 'monitoring' | 'enterprise';
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    maxExecutionTime?: string;
    specificRequirements?: string[];
    integrations?: string[];
    targetNodeCount?: {
        min?: number;
        max?: number;
    };
    useCase?: 'mcp' | 'telegram' | 'agent-system' | 'data-pipeline' | 'api-integration' | 'general';
    securityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
    resourceRequirements?: 'low' | 'medium' | 'high' | 'gpu-required';
}

export interface GeneratedWorkflow {
    workflow: N8nWorkflow;
    metadata: {
        id: string;
        name: string;
        description: string;
        category: string;
        difficulty: string;
        estimated_execution_time: string;
        dependencies: string[];
        tags: string[];
        generated_at: string;
        generated_by: string;
        n8n_version: string;
        user_request: string;
        auto_generated: boolean;
    };
    usage_instructions: string;
    test_data: Record<string, any>;
    validation: {
        syntax_valid: boolean;
        errors: string[];
        warnings: string[];
        node_count: number;
        connection_count: number;
        estimated_complexity: string;
    };
    generation_stats: {
        tokens_used: number;
        generation_time: number;
        confidence_score: number;
    };
}

export interface WorkflowValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    performance: PerformanceAnalysis;
    security: SecurityAnalysis;
    compatibility: CompatibilityCheck;
}

export interface ValidationError {
    type: 'syntax' | 'semantic' | 'functional' | 'security';
    severity: 'error' | 'warning' | 'info';
    message: string;
    nodeId?: string;
    nodeName?: string;
    suggestion?: string;
    code?: string;
}

export interface ValidationWarning {
    type: 'performance' | 'best-practice' | 'compatibility' | 'security';
    message: string;
    nodeId?: string;
    nodeName?: string;
    suggestion: string;
}

export interface PerformanceAnalysis {
    estimatedExecutionTime: string;
    memoryUsage: 'low' | 'medium' | 'high' | 'very-high';
    cpuIntensity: 'low' | 'medium' | 'high' | 'very-high';
    bottlenecks: string[];
    optimizationSuggestions: string[];
    parallelizationOpportunities: string[];
}

export interface SecurityAnalysis {
    credentialsExposed: boolean;
    sensitiveDataInLogs: boolean;
    unsecureConnections: string[];
    securityLevel: 'low' | 'medium' | 'high' | 'enterprise';
    complianceIssues: string[];
    recommendations: string[];
}

export interface CompatibilityCheck {
    n8nVersion: string;
    supportedVersions: string[];
    deprecatedNodes: string[];
    missingCredentials: string[];
    requiredIntegrations: string[];
    migrationRequired: boolean;
    migrationSteps?: string[];
}

export interface WorkflowExecution {
    id: string;
    workflowId: string;
    status: 'new' | 'running' | 'success' | 'error' | 'canceled' | 'crashed' | 'unknown';
    mode: 'manual' | 'trigger' | 'webhook' | 'retry';
    startedAt: Date;
    stoppedAt?: Date;
    executionTime?: number;
    data?: Record<string, any>;
    error?: {
        message: string;
        stack?: string;
        nodeId?: string;
        nodeName?: string;
    };
    retryOf?: string;
    retrySuccessId?: string;
}

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    subcategory: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    workflow: N8nWorkflow;
    previewImage?: string;
    usageCount: number;
    rating: number;
    author: string;
    version: string;
    n8nVersion: string;
    createdAt: Date;
    updatedAt: Date;
    dependencies: string[];
    configurationSteps: string[];
    testingInstructions: string[];
}

export interface NodeSuggestion {
    nodeType: string;
    nodeName: string;
    description: string;
    confidence: number;
    reason: string;
    defaultParameters?: Record<string, any>;
    position?: [number, number];
    connectTo?: string[];
}

export interface WorkflowOptimization {
    type: 'performance' | 'security' | 'maintainability' | 'cost';
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    effort: 'low' | 'medium' | 'high';
    recommendation: string;
    automatable: boolean;
    nodeIds?: string[];
}

export interface WorkflowMetrics {
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    errorRate: number;
    mostCommonErrors: Array<{
        message: string;
        count: number;
        nodeType: string;
    }>;
    resourceUsage: {
        averageMemory: number;
        peakMemory: number;
        averageCpu: number;
        peakCpu: number;
    };
    trends: {
        period: string;
        executionCount: number[];
        successRate: number[];
        averageTime: number[];
    };
}

export interface MCPWorkflowConfig {
    modelContexts: Array<{
        name: string;
        type: 'openai' | 'anthropic' | 'custom';
        endpoint?: string;
        maxTokens: number;
        temperature: number;
        systemPrompt?: string;
    }>;
    contextBoundaries: {
        maxHistoryLength: number;
        contextSeparation: boolean;
        sharedMemory: boolean;
    };
    orchestrationRules: Array<{
        condition: string;
        action: string;
        priority: number;
    }>;
}

export interface TelegramBotConfig {
    botToken: string;
    webhookUrl?: string;
    allowedUsers?: number[];
    commands: Array<{
        command: string;
        description: string;
        handler: string;
    }>;
    inlineKeyboards?: Array<{
        name: string;
        buttons: Array<{
            text: string;
            callbackData: string;
        }>;
    }>;
    mediaHandling: {
        photos: boolean;
        documents: boolean;
        audio: boolean;
        video: boolean;
        maxFileSize: number;
    };
}

export interface AgentSystemConfig {
    agents: Array<{
        id: string;
        name: string;
        role: string;
        capabilities: string[];
        communicationProtocol: 'webhook' | 'websocket' | 'queue';
        stateManagement: 'stateless' | 'stateful' | 'persistent';
    }>;
    orchestrationPatterns: {
        sequential: boolean;
        parallel: boolean;
        conditional: boolean;
        loopback: boolean;
    };
    stateManagement: {
        persistence: 'memory' | 'database' | 'file';
        syncStrategy: 'immediate' | 'batched' | 'eventual';
        conflictResolution: 'latest-wins' | 'merge' | 'manual';
    };
}