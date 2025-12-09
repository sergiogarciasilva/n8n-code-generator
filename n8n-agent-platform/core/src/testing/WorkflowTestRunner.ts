import { 
    N8nWorkflow, 
    N8nNode,
    WorkflowExecution 
} from '../types/workflows';
import { WorkflowExecutionEngine, ExecutionOptions } from '../execution/WorkflowExecutionEngine';
import { WorkflowValidator } from '../validation/WorkflowValidator';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface TestCase {
    id: string;
    name: string;
    description: string;
    inputData: Record<string, any>;
    expectedOutput?: {
        data?: any;
        status?: string;
        nodeOutputs?: Record<string, any>;
    };
    assertions: TestAssertion[];
    timeout?: number;
    tags?: string[];
}

export interface TestAssertion {
    type: 'equals' | 'contains' | 'exists' | 'regex' | 'jsonPath' | 'custom';
    target: 'output' | 'node' | 'execution' | 'error';
    nodeId?: string;
    path?: string;
    expected?: any;
    operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'notIn';
    customValidator?: (actual: any) => boolean;
    message?: string;
}

export interface TestSuite {
    id: string;
    name: string;
    description: string;
    workflowId: string;
    testCases: TestCase[];
    setup?: () => Promise<void>;
    teardown?: () => Promise<void>;
    config?: TestConfig;
}

export interface TestConfig {
    timeout: number;
    retries: number;
    parallel: boolean;
    mockExternalServices: boolean;
    captureDebugInfo: boolean;
    stopOnFirstFailure: boolean;
}

export interface TestResult {
    testCaseId: string;
    testCaseName: string;
    status: 'passed' | 'failed' | 'skipped' | 'error';
    duration: number;
    assertions: AssertionResult[];
    error?: string;
    debugInfo?: {
        execution: WorkflowExecution;
        logs: string[];
        screenshots?: string[];
    };
}

export interface AssertionResult {
    assertion: TestAssertion;
    passed: boolean;
    actual?: any;
    expected?: any;
    error?: string;
}

export interface TestSuiteResult {
    suiteId: string;
    suiteName: string;
    status: 'passed' | 'failed' | 'partial';
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    duration: number;
    testResults: TestResult[];
    coverage?: TestCoverage;
}

export interface TestCoverage {
    nodes: {
        total: number;
        tested: number;
        percentage: number;
    };
    connections: {
        total: number;
        tested: number;
        percentage: number;
    };
    branches: {
        total: number;
        tested: number;
        percentage: number;
    };
}

/**
 * Advanced Workflow Testing Framework
 * 
 * Features:
 * - Unit testing for individual nodes
 * - Integration testing for complete workflows
 * - Assertion framework with multiple assertion types
 * - Mock data generation
 * - Performance testing
 * - Coverage reporting
 * - Parallel test execution
 */
export class WorkflowTestRunner extends EventEmitter {
    private executionEngine: WorkflowExecutionEngine;
    private validator: WorkflowValidator;
    private mockDataGenerators: Map<string, MockDataGenerator>;
    private testResults: Map<string, TestResult[]>;
    private coverageData: Map<string, Set<string>>;

    constructor(executionEngine: WorkflowExecutionEngine, validator: WorkflowValidator) {
        super();
        this.executionEngine = executionEngine;
        this.validator = validator;
        this.mockDataGenerators = new Map();
        this.testResults = new Map();
        this.coverageData = new Map();
        this.initializeMockGenerators();
    }

    private initializeMockGenerators(): void {
        // Register mock data generators for common data types
        this.registerMockGenerator('webhook', new WebhookMockGenerator());
        this.registerMockGenerator('httpResponse', new HttpResponseMockGenerator());
        this.registerMockGenerator('databaseRecord', new DatabaseRecordMockGenerator());
        this.registerMockGenerator('aiResponse', new AIMockGenerator());
        this.registerMockGenerator('telegramMessage', new TelegramMockGenerator());
    }

    registerMockGenerator(type: string, generator: MockDataGenerator): void {
        this.mockDataGenerators.set(type, generator);
    }

    async runTestSuite(workflow: N8nWorkflow, suite: TestSuite): Promise<TestSuiteResult> {
        const startTime = Date.now();
        const testResults: TestResult[] = [];
        
        logger.info('Starting test suite', { 
            suiteId: suite.id, 
            suiteName: suite.name,
            testCount: suite.testCases.length 
        });

        // Initialize coverage tracking
        this.initializeCoverage(workflow);

        // Run setup if provided
        if (suite.setup) {
            try {
                await suite.setup();
            } catch (error) {
                logger.error('Test suite setup failed', { error: error.message });
                throw error;
            }
        }

        // Determine test execution strategy
        const config = suite.config || this.getDefaultConfig();
        
        if (config.parallel && suite.testCases.length > 1) {
            // Run tests in parallel
            const testPromises = suite.testCases.map(testCase => 
                this.runTestCase(workflow, testCase, config)
            );
            const results = await Promise.allSettled(testPromises);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    testResults.push(result.value);
                } else {
                    testResults.push({
                        testCaseId: suite.testCases[index].id,
                        testCaseName: suite.testCases[index].name,
                        status: 'error',
                        duration: 0,
                        assertions: [],
                        error: result.reason.message
                    });
                }
            });
        } else {
            // Run tests sequentially
            for (const testCase of suite.testCases) {
                const result = await this.runTestCase(workflow, testCase, config);
                testResults.push(result);
                
                if (config.stopOnFirstFailure && result.status === 'failed') {
                    logger.info('Stopping test suite due to failure', { 
                        failedTest: testCase.name 
                    });
                    break;
                }
            }
        }

        // Run teardown if provided
        if (suite.teardown) {
            try {
                await suite.teardown();
            } catch (error) {
                logger.error('Test suite teardown failed', { error: error.message });
            }
        }

        // Calculate suite results
        const passedTests = testResults.filter(r => r.status === 'passed').length;
        const failedTests = testResults.filter(r => r.status === 'failed').length;
        const skippedTests = testResults.filter(r => r.status === 'skipped').length;

        const suiteResult: TestSuiteResult = {
            suiteId: suite.id,
            suiteName: suite.name,
            status: failedTests === 0 ? 'passed' : (passedTests > 0 ? 'partial' : 'failed'),
            totalTests: suite.testCases.length,
            passedTests,
            failedTests,
            skippedTests,
            duration: Date.now() - startTime,
            testResults,
            coverage: this.calculateCoverage(workflow)
        };

        // Store results
        this.testResults.set(suite.id, testResults);

        // Emit completion event
        this.emit('suite-complete', suiteResult);

        logger.info('Test suite completed', {
            suiteId: suite.id,
            status: suiteResult.status,
            passed: passedTests,
            failed: failedTests,
            duration: suiteResult.duration
        });

        return suiteResult;
    }

    async runTestCase(
        workflow: N8nWorkflow, 
        testCase: TestCase, 
        config: TestConfig
    ): Promise<TestResult> {
        const startTime = Date.now();
        
        logger.info('Running test case', { 
            testId: testCase.id, 
            testName: testCase.name 
        });

        this.emit('test-start', { testCase });

        try {
            // Validate workflow first
            const validation = await this.validator.validateWorkflow(workflow);
            if (!validation.isValid) {
                return {
                    testCaseId: testCase.id,
                    testCaseName: testCase.name,
                    status: 'error',
                    duration: Date.now() - startTime,
                    assertions: [],
                    error: 'Workflow validation failed: ' + validation.errors.map(e => e.message).join(', ')
                };
            }

            // Prepare execution options
            const executionOptions: ExecutionOptions = {
                mode: 'manual',
                inputData: testCase.inputData,
                debugMode: config.captureDebugInfo,
                mockMode: config.mockExternalServices,
                timeout: testCase.timeout || config.timeout
            };

            // Execute workflow
            const execution = await this.executionEngine.executeWorkflow(workflow, executionOptions);

            // Track coverage
            this.updateCoverage(workflow, execution);

            // Run assertions
            const assertionResults = await this.runAssertions(testCase.assertions, execution, workflow);

            // Determine test status
            const failedAssertions = assertionResults.filter(a => !a.passed);
            const status = failedAssertions.length === 0 ? 'passed' : 'failed';

            const result: TestResult = {
                testCaseId: testCase.id,
                testCaseName: testCase.name,
                status,
                duration: Date.now() - startTime,
                assertions: assertionResults,
                error: failedAssertions.length > 0 
                    ? `${failedAssertions.length} assertion(s) failed`
                    : undefined
            };

            if (config.captureDebugInfo) {
                result.debugInfo = {
                    execution,
                    logs: this.executionEngine.getExecutionState(execution.id)?.logs || []
                };
            }

            this.emit('test-complete', { testCase, result });

            return result;

        } catch (error) {
            logger.error('Test case execution failed', { 
                testId: testCase.id,
                error: error.message 
            });

            const result: TestResult = {
                testCaseId: testCase.id,
                testCaseName: testCase.name,
                status: 'error',
                duration: Date.now() - startTime,
                assertions: [],
                error: error.message
            };

            this.emit('test-error', { testCase, error });

            return result;
        }
    }

    private async runAssertions(
        assertions: TestAssertion[], 
        execution: WorkflowExecution,
        workflow: N8nWorkflow
    ): Promise<AssertionResult[]> {
        const results: AssertionResult[] = [];

        for (const assertion of assertions) {
            try {
                const result = await this.runAssertion(assertion, execution, workflow);
                results.push(result);
            } catch (error) {
                results.push({
                    assertion,
                    passed: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    private async runAssertion(
        assertion: TestAssertion,
        execution: WorkflowExecution,
        workflow: N8nWorkflow
    ): Promise<AssertionResult> {
        let actual: any;
        
        // Get the actual value based on target
        switch (assertion.target) {
            case 'output':
                actual = execution.data;
                break;
            case 'node':
                if (!assertion.nodeId) {
                    throw new Error('nodeId required for node assertions');
                }
                const nodeResult = execution.data?.nodeExecutionResults?.find(
                    r => r.nodeId === assertion.nodeId
                );
                actual = nodeResult?.data;
                break;
            case 'execution':
                actual = execution;
                break;
            case 'error':
                actual = execution.error;
                break;
            default:
                throw new Error(`Unknown assertion target: ${assertion.target}`);
        }

        // Apply path if specified
        if (assertion.path) {
            actual = this.getValueByPath(actual, assertion.path);
        }

        // Run assertion based on type
        let passed = false;
        switch (assertion.type) {
            case 'equals':
                passed = this.assertEquals(actual, assertion.expected);
                break;
            case 'contains':
                passed = this.assertContains(actual, assertion.expected);
                break;
            case 'exists':
                passed = actual !== undefined && actual !== null;
                break;
            case 'regex':
                passed = new RegExp(assertion.expected).test(String(actual));
                break;
            case 'jsonPath':
                // Would use a JSON path library here
                passed = this.assertJsonPath(actual, assertion.path!, assertion.expected);
                break;
            case 'custom':
                if (!assertion.customValidator) {
                    throw new Error('customValidator required for custom assertions');
                }
                passed = assertion.customValidator(actual);
                break;
        }

        return {
            assertion,
            passed,
            actual,
            expected: assertion.expected,
            error: passed ? undefined : assertion.message || 'Assertion failed'
        };
    }

    private assertEquals(actual: any, expected: any): boolean {
        if (typeof actual === 'object' && typeof expected === 'object') {
            return JSON.stringify(actual) === JSON.stringify(expected);
        }
        return actual === expected;
    }

    private assertContains(actual: any, expected: any): boolean {
        if (typeof actual === 'string') {
            return actual.includes(String(expected));
        }
        if (Array.isArray(actual)) {
            return actual.some(item => this.assertEquals(item, expected));
        }
        if (typeof actual === 'object' && actual !== null) {
            return Object.values(actual).some(value => this.assertContains(value, expected));
        }
        return false;
    }

    private assertJsonPath(data: any, path: string, expected: any): boolean {
        // Simplified JSON path implementation
        const value = this.getValueByPath(data, path);
        return this.assertEquals(value, expected);
    }

    private getValueByPath(obj: any, path: string): any {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result === null || result === undefined) {
                return undefined;
            }
            
            // Handle array indices
            const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
            if (arrayMatch) {
                result = result[arrayMatch[1]];
                if (Array.isArray(result)) {
                    result = result[parseInt(arrayMatch[2])];
                } else {
                    return undefined;
                }
            } else {
                result = result[key];
            }
        }
        
        return result;
    }

    // Coverage tracking
    private initializeCoverage(workflow: N8nWorkflow): void {
        this.coverageData.set('nodes', new Set());
        this.coverageData.set('connections', new Set());
        this.coverageData.set('branches', new Set());
    }

    private updateCoverage(workflow: N8nWorkflow, execution: WorkflowExecution): void {
        const testedNodes = this.coverageData.get('nodes')!;
        const testedConnections = this.coverageData.get('connections')!;

        // Track tested nodes
        execution.data?.nodeExecutionResults?.forEach(result => {
            testedNodes.add(result.nodeId);
        });

        // Track tested connections
        // This would analyze which connections were used during execution
    }

    private calculateCoverage(workflow: N8nWorkflow): TestCoverage {
        const testedNodes = this.coverageData.get('nodes')!;
        const totalNodes = workflow.nodes.length;
        const nodesCovered = testedNodes.size;

        // Calculate connection coverage
        let totalConnections = 0;
        if (workflow.connections) {
            Object.values(workflow.connections).forEach(nodeConnections => {
                if (nodeConnections.main) {
                    nodeConnections.main.forEach(group => {
                        totalConnections += group?.length || 0;
                    });
                }
            });
        }

        return {
            nodes: {
                total: totalNodes,
                tested: nodesCovered,
                percentage: totalNodes > 0 ? (nodesCovered / totalNodes) * 100 : 0
            },
            connections: {
                total: totalConnections,
                tested: 0, // Would be calculated from execution data
                percentage: 0
            },
            branches: {
                total: 0, // Would count IF/Switch branches
                tested: 0,
                percentage: 0
            }
        };
    }

    private getDefaultConfig(): TestConfig {
        return {
            timeout: 30000, // 30 seconds
            retries: 0,
            parallel: false,
            mockExternalServices: true,
            captureDebugInfo: true,
            stopOnFirstFailure: false
        };
    }

    // Utility methods for creating test suites
    async generateTestSuite(workflow: N8nWorkflow): Promise<TestSuite> {
        const testCases: TestCase[] = [];

        // Generate basic happy path test
        testCases.push({
            id: 'happy-path',
            name: 'Happy Path Test',
            description: 'Test workflow with valid input data',
            inputData: await this.generateMockInput(workflow),
            assertions: [
                {
                    type: 'equals',
                    target: 'execution',
                    path: 'status',
                    expected: 'success'
                }
            ]
        });

        // Generate edge case tests
        testCases.push({
            id: 'empty-input',
            name: 'Empty Input Test',
            description: 'Test workflow with empty input',
            inputData: {},
            assertions: [
                {
                    type: 'exists',
                    target: 'output'
                }
            ]
        });

        // Generate error handling tests
        const errorNodes = workflow.nodes.filter(n => n.onError);
        errorNodes.forEach((node, index) => {
            testCases.push({
                id: `error-handling-${index}`,
                name: `Error Handling - ${node.name}`,
                description: `Test error handling for ${node.name}`,
                inputData: this.generateErrorInput(node),
                assertions: [
                    {
                        type: 'exists',
                        target: 'error'
                    }
                ]
            });
        });

        return {
            id: `auto-generated-${Date.now()}`,
            name: `Test Suite for ${workflow.name || 'Unnamed Workflow'}`,
            description: 'Automatically generated test suite',
            workflowId: workflow.id || 'unknown',
            testCases
        };
    }

    private async generateMockInput(workflow: N8nWorkflow): Promise<Record<string, any>> {
        // Find trigger node
        const triggerNode = workflow.nodes.find(n => 
            n.type.includes('webhook') || n.type.includes('trigger')
        );

        if (!triggerNode) {
            return {};
        }

        // Generate appropriate mock data based on trigger type
        if (triggerNode.type === 'n8n-nodes-base.webhook') {
            const generator = this.mockDataGenerators.get('webhook');
            return generator ? generator.generate() : {};
        }

        return {};
    }

    private generateErrorInput(node: N8nNode): Record<string, any> {
        // Generate input that would cause an error in the specified node
        return {
            _forceError: true,
            _errorNode: node.id
        };
    }

    // Performance testing
    async runPerformanceTest(
        workflow: N8nWorkflow,
        config: {
            iterations: number;
            concurrency: number;
            warmup: number;
        }
    ): Promise<{
        avgExecutionTime: number;
        minExecutionTime: number;
        maxExecutionTime: number;
        throughput: number;
        errors: number;
    }> {
        const results: number[] = [];
        let errors = 0;

        // Warmup
        for (let i = 0; i < config.warmup; i++) {
            try {
                await this.executionEngine.executeWorkflow(workflow, { mode: 'manual' });
            } catch (error) {
                // Ignore warmup errors
            }
        }

        // Run performance tests
        const startTime = Date.now();
        
        for (let batch = 0; batch < Math.ceil(config.iterations / config.concurrency); batch++) {
            const batchPromises: Promise<void>[] = [];
            
            for (let i = 0; i < config.concurrency && batch * config.concurrency + i < config.iterations; i++) {
                batchPromises.push(
                    this.executionEngine.executeWorkflow(workflow, { mode: 'manual' })
                        .then(execution => {
                            if (execution.executionTime) {
                                results.push(execution.executionTime);
                            }
                        })
                        .catch(() => {
                            errors++;
                        })
                );
            }
            
            await Promise.all(batchPromises);
        }

        const totalTime = Date.now() - startTime;

        return {
            avgExecutionTime: results.reduce((a, b) => a + b, 0) / results.length,
            minExecutionTime: Math.min(...results),
            maxExecutionTime: Math.max(...results),
            throughput: (config.iterations / totalTime) * 1000, // per second
            errors
        };
    }
}

// Mock data generator interfaces
abstract class MockDataGenerator {
    abstract generate(options?: any): Record<string, any>;
}

class WebhookMockGenerator extends MockDataGenerator {
    generate(options?: any): Record<string, any> {
        return {
            headers: {
                'content-type': 'application/json',
                'user-agent': 'MockWebhook/1.0',
                'x-request-id': `mock-${Date.now()}`
            },
            body: {
                id: Math.floor(Math.random() * 10000),
                timestamp: new Date().toISOString(),
                data: options?.data || { test: true }
            },
            query: options?.query || {}
        };
    }
}

class HttpResponseMockGenerator extends MockDataGenerator {
    generate(options?: any): Record<string, any> {
        return {
            statusCode: options?.statusCode || 200,
            headers: {
                'content-type': 'application/json'
            },
            body: {
                success: true,
                data: options?.data || { id: 1, name: 'Test' }
            }
        };
    }
}

class DatabaseRecordMockGenerator extends MockDataGenerator {
    generate(options?: any): Record<string, any> {
        return {
            id: Math.floor(Math.random() * 10000),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...options
        };
    }
}

class AIMockGenerator extends MockDataGenerator {
    generate(options?: any): Record<string, any> {
        return {
            choices: [{
                message: {
                    content: options?.content || 'This is a mock AI response for testing purposes.'
                },
                finish_reason: 'stop'
            }],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30
            }
        };
    }
}

class TelegramMockGenerator extends MockDataGenerator {
    generate(options?: any): Record<string, any> {
        return {
            update_id: Math.floor(Math.random() * 1000000),
            message: {
                message_id: Math.floor(Math.random() * 10000),
                from: {
                    id: 123456789,
                    is_bot: false,
                    first_name: 'Test',
                    username: 'testuser'
                },
                chat: {
                    id: 123456789,
                    first_name: 'Test',
                    username: 'testuser',
                    type: 'private'
                },
                date: Math.floor(Date.now() / 1000),
                text: options?.text || '/start'
            }
        };
    }
}