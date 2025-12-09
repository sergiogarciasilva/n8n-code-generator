export interface Workflow {
    id: string;
    name: string;
    nodes: WorkflowNode[];
    connections: WorkflowConnections;
    settings?: WorkflowSettings;
    staticData?: Record<string, any>;
    active: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface WorkflowNode {
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, any>;
    credentials?: Record<string, any>;
    disabled?: boolean;
    notes?: string;
    notesInFlow?: boolean;
    continueOnFail?: boolean;
    executeOnce?: boolean;
    alwaysOutputData?: boolean;
}

export interface WorkflowConnections {
    [nodeId: string]: {
        [connectionType: string]: Array<Array<{
            node: string;
            type: string;
            index: number;
        }>>;
    };
}

export interface WorkflowSettings {
    executionOrder?: 'v0' | 'v1';
    saveDataErrorExecution?: 'all' | 'none';
    saveDataSuccessExecution?: 'all' | 'none';
    saveExecutionProgress?: boolean;
    saveManualExecutions?: boolean;
    callerPolicy?: 'any' | 'none' | 'workflowsFromAList' | 'workflowsFromSameOwner';
    timezone?: string;
    errorWorkflow?: string;
    callerIds?: string[];
}

export interface WorkflowExecution {
    id: string;
    workflowId: string;
    finished: boolean;
    mode: 'manual' | 'trigger' | 'webhook' | 'retry' | 'integrated' | 'cli';
    retryOf?: string;
    retrySuccessId?: string;
    startedAt: Date;
    stoppedAt?: Date;
    waitTill?: Date;
    data?: ExecutionData;
}

export interface ExecutionData {
    startData?: any;
    resultData: {
        runData: Record<string, any>;
        pinData?: Record<string, any>;
        lastNodeExecuted?: string;
    };
    executionData?: {
        contextData: Record<string, any>;
        nodeExecutionStack: any[];
        waitingExecution: Record<string, any>;
        waitingExecutionSource: Record<string, any>;
    };
}

export interface WorkflowCredentials {
    id: string;
    name: string;
    type: string;
    nodesAccess: Array<{
        nodeType: string;
        date?: Date;
    }>;
    data?: string; // Encrypted
}