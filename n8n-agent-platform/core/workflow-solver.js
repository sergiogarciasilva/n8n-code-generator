/**
 * End-to-End Workflow Solver - Complete autonomous workflow solution
 * Orchestrates design, execution, debugging, and optimization
 */

const EventEmitter = require('events');
const path = require('path');

// Import all components
const WorkflowExecutor = require('./execution/workflow-executor');
const ExecutionMonitor = require('./execution/execution-monitor');
const WorkflowDesigner = require('./ai/workflow-designer');
const DataFlowValidator = require('./validation/data-flow-validator');
const DebugAgent = require('./agents/debug-agent');

class WorkflowSolver extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
            n8nPath: config.n8nPath || process.env.N8N_USER_FOLDER || '~/.n8n',
            maxIterations: config.maxIterations || 10,
            autoDebug: config.autoDebug !== false,
            autoOptimize: config.autoOptimize !== false,
            performanceTesting: config.performanceTesting !== false,
            ...config
        };

        // Initialize components
        this.executor = null;
        this.monitor = null;
        this.designer = null;
        this.validator = null;
        this.debugAgent = null;
        
        this.activeSolutions = new Map();
        this.solutionHistory = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize all components
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('🚀 Initializing End-to-End Workflow Solver...');

        try {
            // Initialize workflow executor
            this.executor = new WorkflowExecutor({
                n8nPath: this.config.n8nPath,
                maxConcurrentExecutions: this.config.maxConcurrentExecutions || 5
            });

            // Initialize execution monitor
            this.monitor = new ExecutionMonitor({
                alertThresholds: this.config.alertThresholds
            });

            // Initialize AI workflow designer
            this.designer = new WorkflowDesigner({
                openaiApiKey: this.config.openaiApiKey
            });

            // Initialize data flow validator
            this.validator = new DataFlowValidator({
                strictMode: this.config.strictValidation
            });

            // Initialize debug agent if auto-debug is enabled
            if (this.config.autoDebug) {
                this.debugAgent = new DebugAgent({
                    openaiApiKey: this.config.openaiApiKey,
                    n8nPath: this.config.n8nPath,
                    autoStart: false
                });
                await this.debugAgent.initialize();
            }

            // Setup component connections
            await this.setupComponentConnections();

            // Start monitoring
            await this.monitor.startMonitoring(this.executor);

            this.isInitialized = true;
            this.emit('initialized');

            console.log('✅ Workflow Solver initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize Workflow Solver:', error);
            throw error;
        }
    }

    /**
     * Setup connections between components
     */
    async setupComponentConnections() {
        // Connect executor events to monitor
        this.executor.on('execution-started', (execution) => {
            this.emit('execution-started', execution);
        });

        this.executor.on('execution-completed', (execution) => {
            this.emit('execution-completed', execution);
        });

        this.executor.on('execution-failed', (execution) => {
            this.emit('execution-failed', execution);
            
            // Trigger auto-debug if enabled
            if (this.config.autoDebug && this.debugAgent) {
                this.triggerAutoDebug(execution);
            }
        });

        // Monitor alerts
        this.monitor.on('alert', (alert) => {
            this.emit('alert', alert);
            this.handleMonitorAlert(alert);
        });

        // Debug agent events
        if (this.debugAgent) {
            this.debugAgent.on('fix-successful', (fix) => {
                this.emit('auto-fix-successful', fix);
            });

            this.debugAgent.on('fix-failed', (fix) => {
                this.emit('auto-fix-failed', fix);
            });
        }
    }

    /**
     * Solve workflow from description - Main entry point
     */
    async solve(description, requirements = {}) {
        console.log('🎯 Starting end-to-end workflow solution...');
        console.log(`📝 Description: ${description}`);
        
        const solutionId = this.generateSolutionId();
        const solution = {
            id: solutionId,
            description,
            requirements,
            startTime: new Date(),
            status: 'designing',
            workflow: null,
            validationResult: null,
            executionResult: null,
            optimizations: [],
            errors: [],
            iterations: 0
        };

        this.activeSolutions.set(solutionId, solution);
        this.emit('solution-started', solution);

        try {
            // Phase 1: Design workflow from description
            console.log('\n📐 Phase 1: Designing workflow...');
            solution.workflow = await this.designer.generateWorkflow(description, requirements);
            solution.status = 'validating';
            
            // Phase 2: Validate data flow
            console.log('\n🔍 Phase 2: Validating data flow...');
            solution.validationResult = await this.validator.validateDataFlow(solution.workflow);
            
            if (!solution.validationResult.valid) {
                // Try to fix validation issues
                solution.workflow = await this.fixValidationIssues(
                    solution.workflow, 
                    solution.validationResult
                );
                
                // Re-validate
                solution.validationResult = await this.validator.validateDataFlow(solution.workflow);
                
                if (!solution.validationResult.valid) {
                    throw new Error('Workflow validation failed after attempted fixes');
                }
            }
            
            solution.status = 'testing';

            // Phase 3: Test workflow execution
            console.log('\n🧪 Phase 3: Testing workflow...');
            const testResult = await this.testWorkflow(solution.workflow, requirements);
            
            if (!testResult.success) {
                solution.status = 'debugging';
                
                // Phase 4: Auto-debug if enabled
                if (this.config.autoDebug) {
                    console.log('\n🔧 Phase 4: Auto-debugging workflow...');
                    solution.workflow = await this.autoDebugWorkflow(
                        solution.workflow, 
                        testResult.errors
                    );
                    
                    // Re-test
                    const retryResult = await this.testWorkflow(solution.workflow, requirements);
                    if (!retryResult.success) {
                        throw new Error('Workflow still failing after auto-debug');
                    }
                }
            }

            solution.status = 'optimizing';

            // Phase 5: Optimize workflow
            if (this.config.autoOptimize) {
                console.log('\n⚡ Phase 5: Optimizing workflow...');
                const optimizationResult = await this.optimizeWorkflow(
                    solution.workflow, 
                    requirements
                );
                solution.workflow = optimizationResult.workflow;
                solution.optimizations = optimizationResult.optimizations;
            }

            // Phase 6: Deploy workflow
            console.log('\n🚀 Phase 6: Deploying workflow...');
            solution.deploymentResult = await this.deployWorkflow(solution.workflow);
            
            solution.status = 'completed';
            solution.endTime = new Date();
            solution.duration = solution.endTime - solution.startTime;

            // Save to history
            this.solutionHistory.set(solutionId, solution);
            this.activeSolutions.delete(solutionId);

            console.log(`\n✅ Workflow solution completed in ${solution.duration}ms`);
            this.emit('solution-completed', solution);

            return {
                success: true,
                solutionId,
                workflow: solution.workflow,
                summary: this.generateSolutionSummary(solution)
            };

        } catch (error) {
            console.error('❌ Workflow solution failed:', error);
            
            solution.status = 'failed';
            solution.error = error.message;
            solution.endTime = new Date();
            
            this.solutionHistory.set(solutionId, solution);
            this.activeSolutions.delete(solutionId);
            
            this.emit('solution-failed', solution);
            
            return {
                success: false,
                solutionId,
                error: error.message,
                solution
            };
        }
    }

    /**
     * Fix validation issues automatically
     */
    async fixValidationIssues(workflow, validationResult) {
        console.log('🔧 Attempting to fix validation issues...');
        
        const fixedWorkflow = JSON.parse(JSON.stringify(workflow)); // Deep clone
        
        // Apply suggested transformations
        for (const suggestion of validationResult.suggestions) {
            if (suggestion.type === 'add_transformation_node' && suggestion.node) {
                // Find where to insert the transformation node
                const connectionKey = Object.keys(validationResult.nodeValidations).find(key => {
                    const validation = validationResult.nodeValidations.get(key);
                    return validation?.dataTransformation?.node;
                });

                if (connectionKey) {
                    const [sourceId, targetId] = connectionKey.split('->');
                    
                    // Insert transformation node
                    const transformNode = {
                        ...suggestion.node,
                        id: this.generateNodeId(),
                        position: [450, 300] // Position between nodes
                    };
                    
                    fixedWorkflow.nodes.push(transformNode);
                    
                    // Update connections
                    const sourceConnections = fixedWorkflow.connections[sourceId];
                    if (sourceConnections) {
                        // Redirect source to transformation node
                        for (const outputs of Object.values(sourceConnections)) {
                            for (const output of outputs) {
                                for (const conn of output) {
                                    if (conn.node === targetId) {
                                        conn.node = transformNode.id;
                                    }
                                }
                            }
                        }
                        
                        // Connect transformation node to target
                        fixedWorkflow.connections[transformNode.id] = {
                            main: [[{ node: targetId, type: 'main', index: 0 }]]
                        };
                    }
                }
            }
        }

        // Fix missing required properties
        for (const error of validationResult.errors) {
            if (error.issue === 'HTTP Request without URL') {
                const node = fixedWorkflow.nodes.find(n => n.id === error.nodeId);
                if (node) {
                    node.parameters.url = 'https://api.example.com/endpoint'; // Placeholder
                }
            }
        }

        return fixedWorkflow;
    }

    /**
     * Test workflow execution
     */
    async testWorkflow(workflow, requirements) {
        console.log('🧪 Testing workflow execution...');
        
        const testData = this.generateTestData(workflow, requirements);
        const testResults = {
            success: true,
            errors: [],
            warnings: [],
            executionTime: 0,
            testCases: []
        };

        try {
            // Run test execution
            const startTime = Date.now();
            const executionResult = await this.executor.executeWorkflow(
                workflow,
                testData,
                { timeout: 30000 }
            );
            
            testResults.executionTime = Date.now() - startTime;
            
            // Validate execution result
            if (executionResult.status !== 'success') {
                testResults.success = false;
                testResults.errors.push({
                    type: 'execution_failed',
                    message: executionResult.error,
                    node: executionResult.currentNode?.name
                });
            }

            // Check output format
            const outputValidation = this.validateOutput(
                executionResult.results,
                requirements.outputFormat
            );
            
            if (!outputValidation.valid) {
                testResults.warnings.push(...outputValidation.warnings);
            }

            // Performance testing
            if (this.config.performanceTesting && requirements.performance) {
                const perfTest = await this.runPerformanceTest(
                    workflow,
                    requirements.performance
                );
                testResults.performanceTest = perfTest;
                
                if (!perfTest.passed) {
                    testResults.warnings.push({
                        type: 'performance',
                        message: perfTest.message
                    });
                }
            }

        } catch (error) {
            testResults.success = false;
            testResults.errors.push({
                type: 'test_error',
                message: error.message
            });
        }

        return testResults;
    }

    /**
     * Generate test data based on workflow
     */
    generateTestData(workflow, requirements) {
        // Find input nodes
        const inputNodes = workflow.nodes.filter(n => 
            n.type === 'n8n-nodes-base.webhook' ||
            n.type === 'n8n-nodes-base.start' ||
            !workflow.connections[n.id]
        );

        // Generate appropriate test data
        if (requirements.sampleData) {
            return requirements.sampleData;
        }

        // Default test data
        return {
            test: true,
            timestamp: new Date().toISOString(),
            data: {
                id: 1,
                name: 'Test Item',
                value: 100,
                active: true
            }
        };
    }

    /**
     * Validate output format
     */
    validateOutput(results, expectedFormat) {
        const validation = {
            valid: true,
            warnings: []
        };

        if (!results || Object.keys(results).length === 0) {
            validation.warnings.push('No output data generated');
            return validation;
        }

        // Check output format
        const lastNodeResults = Object.values(results).pop();
        if (expectedFormat === 'json' && lastNodeResults?.data) {
            const outputData = lastNodeResults.data;
            if (!Array.isArray(outputData) || outputData.length === 0) {
                validation.warnings.push('Output is not in expected array format');
            }
        }

        return validation;
    }

    /**
     * Run performance test
     */
    async runPerformanceTest(workflow, performanceRequirements) {
        const test = {
            passed: true,
            message: '',
            metrics: {}
        };

        // Simulate load test
        const iterations = Math.min(performanceRequirements.expectedVolume || 10, 100);
        const executionTimes = [];

        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now();
            
            try {
                await this.executor.executeWorkflow(workflow, { index: i }, { timeout: 10000 });
                executionTimes.push(Date.now() - startTime);
            } catch (error) {
                // Ignore errors in performance test
            }
        }

        // Calculate metrics
        test.metrics.averageTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
        test.metrics.minTime = Math.min(...executionTimes);
        test.metrics.maxTime = Math.max(...executionTimes);

        // Check against requirements
        if (performanceRequirements.maxExecutionTime && 
            test.metrics.averageTime > performanceRequirements.maxExecutionTime) {
            test.passed = false;
            test.message = `Average execution time ${test.metrics.averageTime}ms exceeds limit ${performanceRequirements.maxExecutionTime}ms`;
        }

        return test;
    }

    /**
     * Auto-debug workflow using Debug Agent
     */
    async autoDebugWorkflow(workflow, errors) {
        console.log('🔧 Auto-debugging workflow...');
        
        if (!this.debugAgent) {
            throw new Error('Debug agent not initialized');
        }

        // Convert errors to debug agent format
        for (const error of errors) {
            const errorInfo = {
                type: error.type || 'execution_error',
                message: error.message,
                workflowId: workflow.id,
                nodeId: error.node?.id,
                workflow: workflow,
                severity: 'high'
            };

            // Let debug agent handle it
            const analysis = await this.debugAgent.analyzeError(errorInfo);
            const fixResult = await this.debugAgent.applyFix(errorInfo, analysis);
            
            if (fixResult.success) {
                // Update workflow with fix
                workflow = fixResult.result.updatedWorkflow;
            }
        }

        return workflow;
    }

    /**
     * Optimize workflow
     */
    async optimizeWorkflow(workflow, requirements) {
        console.log('⚡ Optimizing workflow...');
        
        const optimizations = [];
        let optimizedWorkflow = JSON.parse(JSON.stringify(workflow));

        // Performance optimizations
        if (requirements.performance?.expectedVolume > 1000) {
            // Add batch processing
            const batchOptimization = this.addBatchProcessing(optimizedWorkflow);
            if (batchOptimization.applied) {
                optimizations.push(batchOptimization);
            }
        }

        // Parallel execution optimization
        const parallelOptimization = this.optimizeParallelExecution(optimizedWorkflow);
        if (parallelOptimization.applied) {
            optimizations.push(parallelOptimization);
        }

        // Resource optimization
        const resourceOptimization = this.optimizeResourceUsage(optimizedWorkflow);
        if (resourceOptimization.applied) {
            optimizations.push(resourceOptimization);
        }

        // Error handling optimization
        const errorOptimization = this.optimizeErrorHandling(optimizedWorkflow);
        if (errorOptimization.applied) {
            optimizations.push(errorOptimization);
        }

        return {
            workflow: optimizedWorkflow,
            optimizations
        };
    }

    /**
     * Add batch processing optimization
     */
    addBatchProcessing(workflow) {
        const optimization = {
            type: 'batch_processing',
            applied: false,
            description: 'Added batch processing for better performance',
            nodes: []
        };

        // Find nodes that can benefit from batching
        const batchableNodes = workflow.nodes.filter(n => 
            n.type.includes('database') || 
            n.type.includes('http') ||
            n.type === 'n8n-nodes-base.code'
        );

        for (const node of batchableNodes) {
            if (!node.parameters.options) {
                node.parameters.options = {};
            }
            
            node.parameters.options.batchSize = 50;
            node.parameters.options.batchInterval = 100;
            
            optimization.nodes.push(node.name);
            optimization.applied = true;
        }

        return optimization;
    }

    /**
     * Optimize parallel execution
     */
    optimizeParallelExecution(workflow) {
        const optimization = {
            type: 'parallel_execution',
            applied: false,
            description: 'Optimized for parallel execution',
            changes: []
        };

        // This would analyze the workflow and restructure for parallelism
        // Simplified for demonstration
        
        return optimization;
    }

    /**
     * Optimize resource usage
     */
    optimizeResourceUsage(workflow) {
        const optimization = {
            type: 'resource_optimization',
            applied: false,
            description: 'Optimized resource usage',
            changes: []
        };

        // Add memory limits and timeouts
        for (const node of workflow.nodes) {
            if (node.type === 'n8n-nodes-base.code') {
                if (!node.parameters.options) {
                    node.parameters.options = {};
                }
                node.parameters.options.timeout = 30000;
                node.parameters.options.memoryLimit = '128MB';
                
                optimization.changes.push(`Added resource limits to ${node.name}`);
                optimization.applied = true;
            }
        }

        return optimization;
    }

    /**
     * Optimize error handling
     */
    optimizeErrorHandling(workflow) {
        const optimization = {
            type: 'error_handling',
            applied: false,
            description: 'Enhanced error handling',
            changes: []
        };

        // Check if error handling exists
        const hasErrorHandler = workflow.nodes.some(n => 
            n.type === 'n8n-nodes-base.errorTrigger'
        );

        if (!hasErrorHandler) {
            // Add error handler
            const errorHandler = {
                id: this.generateNodeId(),
                name: 'Error Handler',
                type: 'n8n-nodes-base.errorTrigger',
                typeVersion: 1,
                position: [650, 500],
                parameters: {}
            };

            workflow.nodes.push(errorHandler);
            optimization.changes.push('Added error handler node');
            optimization.applied = true;
        }

        return optimization;
    }

    /**
     * Deploy workflow
     */
    async deployWorkflow(workflow) {
        console.log('🚀 Deploying workflow...');
        
        const deployment = {
            success: true,
            workflowId: workflow.id,
            deployedAt: new Date(),
            url: null,
            activationStatus: 'inactive'
        };

        try {
            // Save workflow to n8n
            const fs = require('fs').promises;
            const workflowPath = path.join(
                this.config.n8nPath,
                'workflows',
                `${workflow.id}.json`
            );
            
            await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2));
            
            deployment.url = `file://${workflowPath}`;
            
            // In production, this would activate the workflow
            deployment.activationStatus = 'ready';
            
        } catch (error) {
            deployment.success = false;
            deployment.error = error.message;
        }

        return deployment;
    }

    /**
     * Trigger auto-debug for failed execution
     */
    async triggerAutoDebug(execution) {
        if (!this.debugAgent || !execution.error) return;

        const errorInfo = {
            type: 'execution_error',
            message: execution.error,
            workflowId: execution.workflowId,
            nodeId: execution.currentNode?.id,
            nodeType: execution.currentNode?.type,
            workflow: execution.workflow,
            severity: 'high',
            timestamp: new Date()
        };

        // Let debug agent handle it asynchronously
        this.debugAgent.emit('error-detected', {
            ...errorInfo,
            needsFixing: true
        });
    }

    /**
     * Handle monitor alerts
     */
    handleMonitorAlert(alert) {
        console.log(`🚨 Monitor alert: ${alert.type}`);
        
        // Take action based on alert type
        switch (alert.type) {
            case 'high_error_rate':
                // Could trigger investigation
                this.emit('high-error-rate-detected', alert);
                break;
                
            case 'performance_degradation':
                // Could trigger optimization
                if (this.config.autoOptimize) {
                    this.scheduleOptimization(alert.details.workflowId);
                }
                break;
                
            case 'repeated_failure':
                // Could trigger debugging
                if (this.config.autoDebug) {
                    this.scheduleDebugging(alert.details.workflowId);
                }
                break;
        }
    }

    /**
     * Schedule workflow optimization
     */
    async scheduleOptimization(workflowId) {
        console.log(`📅 Scheduling optimization for workflow: ${workflowId}`);
        // Implementation would queue optimization task
    }

    /**
     * Schedule workflow debugging
     */
    async scheduleDebugging(workflowId) {
        console.log(`📅 Scheduling debugging for workflow: ${workflowId}`);
        // Implementation would queue debugging task
    }

    /**
     * Generate solution summary
     */
    generateSolutionSummary(solution) {
        return {
            description: solution.description,
            workflowName: solution.workflow?.name,
            nodeCount: solution.workflow?.nodes?.length || 0,
            duration: solution.duration,
            iterations: solution.iterations,
            optimizations: solution.optimizations.length,
            validationPassed: solution.validationResult?.valid || false,
            deploymentSuccess: solution.deploymentResult?.success || false
        };
    }

    /**
     * Get solver statistics
     */
    getStats() {
        const stats = {
            activeSolutions: this.activeSolutions.size,
            completedSolutions: this.solutionHistory.size,
            successRate: 0,
            averageSolutionTime: 0,
            componentsHealth: {
                executor: this.executor ? 'active' : 'inactive',
                monitor: this.monitor?.isMonitoring ? 'active' : 'inactive',
                designer: this.designer ? 'active' : 'inactive',
                validator: this.validator ? 'active' : 'inactive',
                debugAgent: this.debugAgent?.isRunning ? 'active' : 'inactive'
            }
        };

        // Calculate success rate
        let successCount = 0;
        let totalTime = 0;
        
        for (const solution of this.solutionHistory.values()) {
            if (solution.status === 'completed') {
                successCount++;
                totalTime += solution.duration || 0;
            }
        }

        if (this.solutionHistory.size > 0) {
            stats.successRate = (successCount / this.solutionHistory.size) * 100;
            stats.averageSolutionTime = totalTime / successCount;
        }

        // Add component stats
        if (this.executor) {
            stats.executorStats = this.executor.getStats();
        }
        
        if (this.monitor) {
            stats.monitorReport = this.monitor.getReport();
        }

        return stats;
    }

    /**
     * Generate unique solution ID
     */
    generateSolutionId() {
        return `solution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate node ID
     */
    generateNodeId() {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Stop workflow solver
     */
    async stop() {
        console.log('🛑 Stopping Workflow Solver...');
        
        if (this.monitor) {
            this.monitor.stopMonitoring();
        }
        
        if (this.debugAgent && this.debugAgent.isRunning) {
            await this.debugAgent.stop();
        }
        
        this.emit('stopped');
        console.log('✅ Workflow Solver stopped');
    }
}

module.exports = WorkflowSolver;