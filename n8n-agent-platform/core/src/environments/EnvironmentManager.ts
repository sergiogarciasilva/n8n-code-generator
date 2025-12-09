import { EventEmitter } from 'events';
import { DatabaseManager } from '../database/DatabaseManager';
import { RedisManager } from '../database/RedisManager';
import { AgentOrchestrator } from '../orchestrator/AgentOrchestrator';
import { WorkflowVersionManager } from '../versioning/WorkflowVersionManager';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import Docker from 'dockerode';
import fs from 'fs/promises';
import path from 'path';

export interface Environment {
    id: string;
    name: string;
    type: 'development' | 'staging' | 'production';
    status: 'active' | 'inactive' | 'provisioning' | 'error';
    config: {
        resources: {
            cpu: string;
            memory: string;
            storage: string;
        };
        networking: {
            isolation: boolean;
            allowedHosts: string[];
        };
        database: {
            isolated: boolean;
            connectionString?: string;
        };
        variables: Record<string, string>;
    };
    metadata: {
        workflowCount: number;
        lastDeployment?: Date;
        uptime: number;
        resourceUsage: {
            cpu: number;
            memory: number;
            storage: number;
        };
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface EnvironmentProvisioning {
    environmentId: string;
    status: 'pending' | 'provisioning' | 'ready' | 'failed';
    logs: string[];
    progress: number;
    estimatedTime: number;
    containerId?: string;
    networkId?: string;
}

export interface TestExecution {
    id: string;
    environmentId: string;
    workflowId: string;
    version: string;
    testSuite: {
        name: string;
        tests: TestCase[];
    };
    status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
    results: {
        passed: number;
        failed: number;
        skipped: number;
        duration: number;
        coverage?: number;
    };
    logs: string[];
    startedAt?: Date;
    completedAt?: Date;
}

export interface TestCase {
    id: string;
    name: string;
    description: string;
    type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
    input: any;
    expectedOutput: any;
    assertions: TestAssertion[];
    timeout: number;
}

export interface TestAssertion {
    type: 'equals' | 'contains' | 'regex' | 'response_time' | 'status_code';
    field: string;
    value: any;
    operator?: 'lt' | 'gt' | 'lte' | 'gte' | 'eq' | 'ne';
}

export interface PromotionPipeline {
    id: string;
    name: string;
    stages: PromotionStage[];
    autoPromotion: boolean;
    approvalRequired: boolean;
    rollbackOnFailure: boolean;
    notifications: {
        slack?: string;
        email?: string[];
    };
}

export interface PromotionStage {
    id: string;
    name: string;
    environment: string;
    gates: PromotionGate[];
    actions: PromotionAction[];
    order: number;
}

export interface PromotionGate {
    type: 'manual_approval' | 'test_results' | 'security_scan' | 'performance_check';
    config: any;
    required: boolean;
}

export interface PromotionAction {
    type: 'deploy' | 'test' | 'notify' | 'backup' | 'rollback';
    config: any;
}

export class EnvironmentManager extends EventEmitter {
    private docker: Docker;
    private environments: Map<string, Environment> = new Map();
    private provisioningStatus: Map<string, EnvironmentProvisioning> = new Map();

    constructor(
        private database: DatabaseManager,
        private redis: RedisManager,
        private orchestrator: AgentOrchestrator,
        private versionManager: WorkflowVersionManager
    ) {
        super();
        this.docker = new Docker();
    }

    async initialize(): Promise<void> {
        logger.info('Initializing Environment Manager...');
        await this.createEnvironmentSchema();
        await this.loadExistingEnvironments();
        await this.validateDockerSetup();
    }

    private async createEnvironmentSchema(): Promise<void> {
        const schemaExists = await this.database.query(
            "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'environments')"
        );

        if (!schemaExists.rows[0].exists) {
            await this.database.query(`
                CREATE TABLE environments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL UNIQUE,
                    type VARCHAR(20) NOT NULL,
                    status VARCHAR(20) DEFAULT 'inactive',
                    config JSONB NOT NULL,
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT valid_env_type CHECK (type IN ('development', 'staging', 'production')),
                    CONSTRAINT valid_env_status CHECK (status IN ('active', 'inactive', 'provisioning', 'error'))
                );

                CREATE TABLE environment_deployments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
                    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                    version VARCHAR(50) NOT NULL,
                    deployed_by UUID NOT NULL REFERENCES users(id),
                    deployment_config JSONB DEFAULT '{}',
                    status VARCHAR(20) DEFAULT 'pending',
                    logs JSONB DEFAULT '[]',
                    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT valid_deployment_status CHECK (status IN ('pending', 'deploying', 'deployed', 'failed', 'rolled_back'))
                );

                CREATE TABLE test_executions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
                    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                    version VARCHAR(50) NOT NULL,
                    test_suite JSONB NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    results JSONB DEFAULT '{}',
                    logs JSONB DEFAULT '[]',
                    started_by UUID NOT NULL REFERENCES users(id),
                    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT valid_test_status CHECK (status IN ('pending', 'running', 'passed', 'failed', 'cancelled'))
                );

                CREATE TABLE promotion_pipelines (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    stages JSONB NOT NULL,
                    auto_promotion BOOLEAN DEFAULT FALSE,
                    approval_required BOOLEAN DEFAULT TRUE,
                    rollback_on_failure BOOLEAN DEFAULT TRUE,
                    notifications JSONB DEFAULT '{}',
                    created_by UUID NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE promotion_executions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    pipeline_id UUID NOT NULL REFERENCES promotion_pipelines(id) ON DELETE CASCADE,
                    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                    version VARCHAR(50) NOT NULL,
                    current_stage INTEGER DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'pending',
                    logs JSONB DEFAULT '[]',
                    started_by UUID NOT NULL REFERENCES users(id),
                    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT valid_promotion_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
                );

                CREATE INDEX idx_environments_type ON environments(type);
                CREATE INDEX idx_environments_status ON environments(status);
                CREATE INDEX idx_deployments_env ON environment_deployments(environment_id);
                CREATE INDEX idx_deployments_workflow ON environment_deployments(workflow_id);
                CREATE INDEX idx_tests_env ON test_executions(environment_id);
                CREATE INDEX idx_tests_workflow ON test_executions(workflow_id);
            `);
        }
    }

    // Environment provisioning
    async createEnvironment(
        name: string,
        type: 'development' | 'staging' | 'production',
        config: any
    ): Promise<Environment> {
        const environmentId = crypto.randomUUID();

        // Store environment
        const result = await this.database.query(
            `INSERT INTO environments (id, name, type, status, config)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [environmentId, name, type, 'provisioning', JSON.stringify(config)]
        );

        const environment = this.mapEnvironment(result.rows[0]);

        // Start provisioning
        this.provisionEnvironment(environment);

        return environment;
    }

    private async provisionEnvironment(environment: Environment): Promise<void> {
        const provisioning: EnvironmentProvisioning = {
            environmentId: environment.id,
            status: 'provisioning',
            logs: [],
            progress: 0,
            estimatedTime: 300000 // 5 minutes
        };

        this.provisioningStatus.set(environment.id, provisioning);

        try {
            // Create network
            const network = await this.docker.createNetwork({
                Name: `n8n-env-${environment.name}`,
                Driver: 'bridge',
                Options: {
                    'com.docker.network.bridge.enable_ip_masquerade': 'true'
                }
            });
            provisioning.networkId = network.id;
            provisioning.progress = 25;
            provisioning.logs.push(`Network created: ${network.id}`);

            // Create volume for data persistence
            const volume = await this.docker.createVolume({
                Name: `n8n-data-${environment.name}`,
                Driver: 'local'
            });
            provisioning.progress = 50;
            provisioning.logs.push(`Volume created: ${volume.Name}`);

            // Create n8n container
            const container = await this.docker.createContainer({
                Image: 'n8nio/n8n:latest',
                name: `n8n-${environment.name}`,
                Env: [
                    `N8N_BASIC_AUTH_ACTIVE=true`,
                    `N8N_BASIC_AUTH_USER=admin`,
                    `N8N_BASIC_AUTH_PASSWORD=${crypto.randomBytes(16).toString('hex')}`,
                    `DB_TYPE=postgresdb`,
                    `DB_POSTGRESDB_HOST=${process.env.DB_HOST}`,
                    `DB_POSTGRESDB_PORT=5432`,
                    `DB_POSTGRESDB_DATABASE=${environment.name}_db`,
                    `DB_POSTGRESDB_USER=${process.env.DB_USER}`,
                    `DB_POSTGRESDB_PASSWORD=${process.env.DB_PASSWORD}`,
                    ...Object.entries(environment.config.variables).map(([k, v]) => `${k}=${v}`)
                ],
                HostConfig: {
                    Memory: this.parseMemory(environment.config.resources.memory),
                    CpuShares: this.parseCpu(environment.config.resources.cpu),
                    Mounts: [{
                        Target: '/home/node/.n8n',
                        Source: volume.Name,
                        Type: 'volume'
                    }],
                    NetworkMode: network.id,
                    RestartPolicy: {
                        Name: 'unless-stopped'
                    }
                },
                NetworkingConfig: {
                    EndpointsConfig: {
                        [network.id]: {}
                    }
                }
            });

            provisioning.containerId = container.id;
            provisioning.progress = 75;
            provisioning.logs.push(`Container created: ${container.id}`);

            // Start container
            await container.start();
            provisioning.progress = 90;
            provisioning.logs.push('Container started');

            // Wait for n8n to be ready
            await this.waitForEnvironmentReady(container);
            provisioning.progress = 100;
            provisioning.status = 'ready';
            provisioning.logs.push('Environment ready');

            // Update environment status
            await this.database.query(
                'UPDATE environments SET status = $1, metadata = $2 WHERE id = $3',
                ['active', JSON.stringify({ containerId: container.id, networkId: network.id }), environment.id]
            );

            environment.status = 'active';
            this.environments.set(environment.id, environment);

            this.emit('environment:provisioned', environment);

        } catch (error: any) {
            provisioning.status = 'failed';
            provisioning.logs.push(`Error: ${error.message}`);

            await this.database.query(
                'UPDATE environments SET status = $1 WHERE id = $2',
                ['error', environment.id]
            );

            this.emit('environment:error', { environment, error });
        }
    }

    // Test execution
    async runTests(
        environmentId: string,
        workflowId: string,
        version: string,
        testSuite: any,
        userId: string
    ): Promise<string> {
        const testId = crypto.randomUUID();

        // Store test execution
        await this.database.query(
            `INSERT INTO test_executions 
             (id, environment_id, workflow_id, version, test_suite, started_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [testId, environmentId, workflowId, version, JSON.stringify(testSuite), userId]
        );

        // Start test execution
        this.executeTests(testId, environmentId, workflowId, version, testSuite);

        return testId;
    }

    private async executeTests(
        testId: string,
        environmentId: string,
        workflowId: string,
        version: string,
        testSuite: any
    ): Promise<void> {
        try {
            await this.database.query(
                'UPDATE test_executions SET status = $1, started_at = NOW() WHERE id = $2',
                ['running', testId]
            );

            const environment = await this.getEnvironment(environmentId);
            if (!environment) {
                throw new Error('Environment not found');
            }

            const results = {
                passed: 0,
                failed: 0,
                skipped: 0,
                duration: 0,
                coverage: 0
            };

            const logs: string[] = [];
            const startTime = Date.now();

            // Execute each test case
            for (const testCase of testSuite.tests) {
                try {
                    logs.push(`Running test: ${testCase.name}`);
                    
                    const testResult = await this.executeTestCase(
                        environment,
                        workflowId,
                        version,
                        testCase
                    );

                    if (testResult.passed) {
                        results.passed++;
                        logs.push(`✅ ${testCase.name} passed`);
                    } else {
                        results.failed++;
                        logs.push(`❌ ${testCase.name} failed: ${testResult.error}`);
                    }
                } catch (error: any) {
                    results.failed++;
                    logs.push(`❌ ${testCase.name} failed with error: ${error.message}`);
                }
            }

            results.duration = Date.now() - startTime;
            const status = results.failed === 0 ? 'passed' : 'failed';

            // Update test results
            await this.database.query(
                `UPDATE test_executions 
                 SET status = $1, results = $2, logs = $3, completed_at = NOW()
                 WHERE id = $4`,
                [status, JSON.stringify(results), JSON.stringify(logs), testId]
            );

            this.emit('test:completed', {
                testId,
                environmentId,
                workflowId,
                version,
                status,
                results
            });

        } catch (error: any) {
            await this.database.query(
                `UPDATE test_executions 
                 SET status = $1, logs = $2, completed_at = NOW()
                 WHERE id = $3`,
                ['failed', JSON.stringify([`Test execution failed: ${error.message}`]), testId]
            );
        }
    }

    private async executeTestCase(
        environment: Environment,
        workflowId: string,
        version: string,
        testCase: TestCase
    ): Promise<{ passed: boolean; error?: string }> {
        try {
            // Get workflow definition for the specific version
            const workflowVersion = await this.versionManager.getVersion(workflowId, version);
            if (!workflowVersion) {
                throw new Error(`Version ${version} not found`);
            }

            // Execute workflow with test input
            const startTime = Date.now();
            const result = await this.executeWorkflowInEnvironment(
                environment,
                workflowVersion.definition,
                testCase.input
            );
            const executionTime = Date.now() - startTime;

            // Validate assertions
            for (const assertion of testCase.assertions) {
                const passed = this.validateAssertion(assertion, result, executionTime);
                if (!passed) {
                    return { 
                        passed: false, 
                        error: `Assertion failed: ${assertion.type} ${assertion.field} ${assertion.operator || 'eq'} ${assertion.value}` 
                    };
                }
            }

            return { passed: true };

        } catch (error: any) {
            return { passed: false, error: error.message };
        }
    }

    private validateAssertion(assertion: TestAssertion, result: any, executionTime: number): boolean {
        let value: any;

        if (assertion.field === 'execution_time') {
            value = executionTime;
        } else if (assertion.field === 'status_code') {
            value = result.statusCode;
        } else {
            value = this.getNestedValue(result, assertion.field);
        }

        switch (assertion.type) {
            case 'equals':
                return value === assertion.value;
            case 'contains':
                return String(value).includes(assertion.value);
            case 'regex':
                return new RegExp(assertion.value).test(String(value));
            case 'response_time':
                const operator = assertion.operator || 'lt';
                return this.compareValues(executionTime, assertion.value, operator);
            case 'status_code':
                return value === assertion.value;
            default:
                return false;
        }
    }

    private compareValues(a: any, b: any, operator: string): boolean {
        switch (operator) {
            case 'lt': return a < b;
            case 'gt': return a > b;
            case 'lte': return a <= b;
            case 'gte': return a >= b;
            case 'eq': return a === b;
            case 'ne': return a !== b;
            default: return false;
        }
    }

    // Promotion pipeline
    async createPromotionPipeline(pipeline: Omit<PromotionPipeline, 'id'>, userId: string): Promise<PromotionPipeline> {
        const pipelineId = crypto.randomUUID();

        await this.database.query(
            `INSERT INTO promotion_pipelines 
             (id, name, stages, auto_promotion, approval_required, rollback_on_failure, notifications, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                pipelineId,
                pipeline.name,
                JSON.stringify(pipeline.stages),
                pipeline.autoPromotion,
                pipeline.approvalRequired,
                pipeline.rollbackOnFailure,
                JSON.stringify(pipeline.notifications),
                userId
            ]
        );

        return { ...pipeline, id: pipelineId };
    }

    async executePromotionPipeline(
        pipelineId: string,
        workflowId: string,
        version: string,
        userId: string
    ): Promise<string> {
        const executionId = crypto.randomUUID();

        await this.database.query(
            `INSERT INTO promotion_executions 
             (id, pipeline_id, workflow_id, version, started_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [executionId, pipelineId, workflowId, version, userId]
        );

        // Start pipeline execution
        this.runPromotionPipeline(executionId, pipelineId, workflowId, version);

        return executionId;
    }

    private async runPromotionPipeline(
        executionId: string,
        pipelineId: string,
        workflowId: string,
        version: string
    ): Promise<void> {
        try {
            const pipeline = await this.getPromotionPipeline(pipelineId);
            if (!pipeline) {
                throw new Error('Pipeline not found');
            }

            await this.database.query(
                'UPDATE promotion_executions SET status = $1 WHERE id = $2',
                ['running', executionId]
            );

            // Execute each stage
            for (let i = 0; i < pipeline.stages.length; i++) {
                const stage = pipeline.stages[i];
                
                await this.database.query(
                    'UPDATE promotion_executions SET current_stage = $1 WHERE id = $2',
                    [i, executionId]
                );

                // Check gates
                for (const gate of stage.gates) {
                    const passed = await this.checkPromotionGate(gate, workflowId, version, stage.environment);
                    if (!passed && gate.required) {
                        throw new Error(`Gate failed: ${gate.type}`);
                    }
                }

                // Execute actions
                for (const action of stage.actions) {
                    await this.executePromotionAction(action, workflowId, version, stage.environment);
                }
            }

            await this.database.query(
                'UPDATE promotion_executions SET status = $1, completed_at = NOW() WHERE id = $2',
                ['completed', executionId]
            );

            this.emit('promotion:completed', { executionId, workflowId, version });

        } catch (error: any) {
            await this.database.query(
                'UPDATE promotion_executions SET status = $1, completed_at = NOW() WHERE id = $2',
                ['failed', executionId]
            );

            this.emit('promotion:failed', { executionId, workflowId, version, error });
        }
    }

    // Helper methods
    private async validateDockerSetup(): Promise<void> {
        try {
            await this.docker.ping();
            logger.info('✅ Docker connection validated');
        } catch (error) {
            logger.error('❌ Docker not available:', error);
            throw new Error('Docker is required for environment management');
        }
    }

    private async loadExistingEnvironments(): Promise<void> {
        const result = await this.database.query('SELECT * FROM environments WHERE status = $1', ['active']);
        
        for (const row of result.rows) {
            const environment = this.mapEnvironment(row);
            this.environments.set(environment.id, environment);
        }

        logger.info(`Loaded ${result.rows.length} existing environments`);
    }

    private parseMemory(memory: string): number {
        const match = memory.match(/^(\d+)(MB|GB)$/);
        if (!match) return 512 * 1024 * 1024; // 512MB default
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        return unit === 'GB' ? value * 1024 * 1024 * 1024 : value * 1024 * 1024;
    }

    private parseCpu(cpu: string): number {
        const match = cpu.match(/^(\d+(?:\.\d+)?)$/);
        return match ? Math.floor(parseFloat(match[1]) * 1024) : 1024; // 1 CPU default
    }

    private async waitForEnvironmentReady(container: any): Promise<void> {
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes

        while (attempts < maxAttempts) {
            try {
                const inspect = await container.inspect();
                if (inspect.State.Running) {
                    // Additional health check could be added here
                    return;
                }
            } catch (error) {
                // Continue waiting
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }

        throw new Error('Environment failed to become ready within timeout');
    }

    private async executeWorkflowInEnvironment(
        environment: Environment,
        definition: any,
        input: any
    ): Promise<any> {
        // This would integrate with the n8n instance running in the environment
        // For now, simulate execution
        return {
            statusCode: 200,
            data: { message: 'Test execution completed', input },
            executionTime: Math.random() * 1000
        };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    private async getEnvironment(environmentId: string): Promise<Environment | null> {
        if (this.environments.has(environmentId)) {
            return this.environments.get(environmentId)!;
        }

        const result = await this.database.query('SELECT * FROM environments WHERE id = $1', [environmentId]);
        return result.rows.length > 0 ? this.mapEnvironment(result.rows[0]) : null;
    }

    private async getPromotionPipeline(pipelineId: string): Promise<PromotionPipeline | null> {
        const result = await this.database.query('SELECT * FROM promotion_pipelines WHERE id = $1', [pipelineId]);
        return result.rows.length > 0 ? {
            id: result.rows[0].id,
            name: result.rows[0].name,
            stages: result.rows[0].stages,
            autoPromotion: result.rows[0].auto_promotion,
            approvalRequired: result.rows[0].approval_required,
            rollbackOnFailure: result.rows[0].rollback_on_failure,
            notifications: result.rows[0].notifications
        } : null;
    }

    private async checkPromotionGate(
        gate: PromotionGate,
        workflowId: string,
        version: string,
        environment: string
    ): Promise<boolean> {
        switch (gate.type) {
            case 'manual_approval':
                // Check if approval has been given
                return true; // Simplified for demo
            case 'test_results':
                // Check if tests have passed
                return true; // Simplified for demo
            case 'security_scan':
                // Run security scan
                return true; // Simplified for demo
            case 'performance_check':
                // Check performance metrics
                return true; // Simplified for demo
            default:
                return false;
        }
    }

    private async executePromotionAction(
        action: PromotionAction,
        workflowId: string,
        version: string,
        environment: string
    ): Promise<void> {
        switch (action.type) {
            case 'deploy':
                await this.deployToEnvironment(workflowId, version, environment);
                break;
            case 'test':
                // Run tests
                break;
            case 'notify':
                // Send notifications
                break;
            case 'backup':
                // Create backup
                break;
            case 'rollback':
                // Rollback deployment
                break;
        }
    }

    private async deployToEnvironment(workflowId: string, version: string, environment: string): Promise<void> {
        // Deploy workflow to specific environment
        logger.info(`Deploying workflow ${workflowId} version ${version} to ${environment}`);
    }

    private mapEnvironment(row: any): Environment {
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            status: row.status,
            config: row.config,
            metadata: row.metadata || {},
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}