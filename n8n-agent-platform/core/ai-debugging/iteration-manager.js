/**
 * Iteration Manager - Manages the autonomous debugging loop
 * Coordinates error detection, analysis, fixing, and testing until success
 */

const EventEmitter = require('events');

class IterationManager extends EventEmitter {
    constructor(errorDetector, problemAnalyzer, codeFixer) {
        super();
        this.errorDetector = errorDetector;
        this.problemAnalyzer = problemAnalyzer;
        this.codeFixer = codeFixer;
        
        this.activeIterations = new Map();
        this.maxIterations = 10;
        this.iterationTimeout = 300000; // 5 minutes
        this.isRunning = false;
    }

    /**
     * Start the autonomous debugging system
     */
    async startAutonomousDebugging() {
        if (this.isRunning) return;

        console.log('🚀 Starting Autonomous Debugging System...');
        
        try {
            // Initialize all components
            await this.errorDetector.initialize?.();
            await this.problemAnalyzer.initialize();
            await this.codeFixer.initialize();

            // Set up event listeners
            this.setupEventListeners();

            // Start monitoring
            await this.errorDetector.startMonitoring();

            this.isRunning = true;
            this.emit('debugging-started');
            
            console.log('✅ Autonomous Debugging System is now active');

        } catch (error) {
            console.error('❌ Failed to start autonomous debugging:', error);
            this.emit('debugging-error', error);
        }
    }

    /**
     * Setup event listeners for the debugging loop
     */
    setupEventListeners() {
        // Listen for detected errors
        this.errorDetector.on('error-detected', async (errorInfo) => {
            if (errorInfo.needsFixing) {
                await this.startIterationLoop(errorInfo);
            }
        });

        // Listen for successful fixes
        this.on('fix-successful', async (iterationData) => {
            await this.handleSuccessfulFix(iterationData);
        });

        // Listen for failed iterations
        this.on('iteration-failed', async (iterationData) => {
            await this.handleFailedIteration(iterationData);
        });
    }

    /**
     * Start iteration loop for a specific error
     */
    async startIterationLoop(errorInfo) {
        const iterationId = this.generateIterationId(errorInfo);
        
        console.log(`🔄 Starting iteration loop for error: ${iterationId}`);

        // Check if already processing this error
        if (this.activeIterations.has(iterationId)) {
            console.log(`⚠️ Already processing error: ${iterationId}`);
            return;
        }

        const iterationData = {
            id: iterationId,
            errorInfo,
            startTime: new Date(),
            currentIteration: 0,
            attempts: [],
            status: 'running',
            timeout: null
        };

        this.activeIterations.set(iterationId, iterationData);

        // Set timeout for iteration
        iterationData.timeout = setTimeout(() => {
            this.handleIterationTimeout(iterationId);
        }, this.iterationTimeout);

        // Start the first iteration
        await this.performIteration(iterationId);
    }

    /**
     * Perform a single iteration of the debugging loop
     */
    async performIteration(iterationId) {
        const iterationData = this.activeIterations.get(iterationId);
        
        if (!iterationData || iterationData.status !== 'running') {
            return;
        }

        iterationData.currentIteration++;
        
        console.log(`🔄 Iteration ${iterationData.currentIteration} for ${iterationId}`);

        const attempt = {
            iteration: iterationData.currentIteration,
            startTime: new Date(),
            phase: 'analysis',
            analysis: null,
            fix: null,
            testResult: null,
            success: false
        };

        iterationData.attempts.push(attempt);

        try {
            // Phase 1: Analyze the error
            attempt.phase = 'analysis';
            console.log(`🧠 Analyzing error (iteration ${iterationData.currentIteration})...`);
            
            attempt.analysis = await this.problemAnalyzer.analyzeError(iterationData.errorInfo);
            
            if (!attempt.analysis) {
                throw new Error('Failed to analyze error');
            }

            // Phase 2: Generate and apply fix
            attempt.phase = 'fixing';
            console.log(`🔧 Generating fix (iteration ${iterationData.currentIteration})...`);
            
            const fixResult = await this.codeFixer.applyFix(iterationData.errorInfo, attempt.analysis);
            attempt.fix = fixResult;

            if (!fixResult.success) {
                throw new Error(`Fix application failed: ${fixResult.reason}`);
            }

            // Phase 3: Test the fix
            attempt.phase = 'testing';
            console.log(`🧪 Testing fix (iteration ${iterationData.currentIteration})...`);
            
            attempt.testResult = await this.testFix(iterationData.errorInfo, fixResult);

            if (attempt.testResult.success) {
                // Success! Complete the iteration loop
                attempt.success = true;
                attempt.endTime = new Date();
                
                await this.completeIterationLoop(iterationId, true);
                return;
            }

            // Fix didn't work, prepare for next iteration
            attempt.endTime = new Date();
            attempt.success = false;

            // Check if we should continue iterating
            if (iterationData.currentIteration >= this.maxIterations) {
                console.log(`❌ Max iterations reached for ${iterationId}`);
                await this.completeIterationLoop(iterationId, false);
                return;
            }

            // Update error info with test results for next iteration
            iterationData.errorInfo.previousAttempts = iterationData.attempts;
            iterationData.errorInfo.lastTestResult = attempt.testResult;

            console.log(`🔄 Iteration ${iterationData.currentIteration} failed, continuing...`);
            
            // Wait a bit before next iteration
            setTimeout(() => {
                this.performIteration(iterationId);
            }, 2000);

        } catch (error) {
            console.error(`❌ Error in iteration ${iterationData.currentIteration}:`, error);
            attempt.error = error.message;
            attempt.endTime = new Date();
            attempt.success = false;

            // Decide whether to continue or abort
            if (iterationData.currentIteration >= this.maxIterations || this.isCriticalError(error)) {
                await this.completeIterationLoop(iterationId, false);
            } else {
                // Try again after a delay
                setTimeout(() => {
                    this.performIteration(iterationId);
                }, 3000);
            }
        }
    }

    /**
     * Test if the applied fix actually resolves the issue
     */
    async testFix(errorInfo, fixResult) {
        console.log(`🧪 Testing fix for ${errorInfo.workflowId}...`);

        try {
            // Basic validation: Check if the workflow is syntactically valid
            const syntaxTest = await this.validateWorkflowSyntax(fixResult.result.updatedWorkflow);
            
            if (!syntaxTest.valid) {
                return {
                    success: false,
                    phase: 'syntax_validation',
                    error: syntaxTest.error,
                    details: 'Workflow syntax validation failed'
                };
            }

            // Try to execute the workflow (if execution engine is available)
            const executionTest = await this.testWorkflowExecution(errorInfo, fixResult);
            
            if (!executionTest.success) {
                return {
                    success: false,
                    phase: 'execution_test',
                    error: executionTest.error,
                    details: executionTest.details
                };
            }

            // Specific JavaScript validation for code nodes
            if (errorInfo.nodeType === 'n8n-nodes-base.code') {
                const jsTest = await this.validateJavaScriptCode(fixResult.fix.code);
                
                if (!jsTest.valid) {
                    return {
                        success: false,
                        phase: 'javascript_validation',
                        error: jsTest.error,
                        details: 'JavaScript code validation failed'
                    };
                }
            }

            return {
                success: true,
                phase: 'complete',
                details: 'All validations passed',
                executionResult: executionTest.result
            };

        } catch (error) {
            return {
                success: false,
                phase: 'test_execution',
                error: error.message,
                details: 'Test execution failed'
            };
        }
    }

    /**
     * Validate workflow syntax
     */
    async validateWorkflowSyntax(workflow) {
        try {
            // Basic structure validation
            if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
                return { valid: false, error: 'Invalid workflow structure' };
            }

            // Check each node
            for (const node of workflow.nodes) {
                if (!node.id || !node.type) {
                    return { valid: false, error: `Invalid node: ${node.id || 'unknown'}` };
                }

                // Validate JavaScript nodes specifically
                if (node.type === 'n8n-nodes-base.code' && node.parameters?.jsCode) {
                    try {
                        new Function(node.parameters.jsCode);
                    } catch (syntaxError) {
                        return { 
                            valid: false, 
                            error: `JavaScript syntax error in node ${node.id}: ${syntaxError.message}` 
                        };
                    }
                }
            }

            return { valid: true };

        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Test workflow execution (simplified simulation)
     */
    async testWorkflowExecution(errorInfo, fixResult) {
        try {
            // This would integrate with actual n8n execution engine
            // For now, we'll do basic validation and simulation
            
            const workflow = fixResult.result.updatedWorkflow;
            const targetNode = workflow.nodes.find(n => n.id === errorInfo.nodeId);
            
            if (!targetNode) {
                return {
                    success: false,
                    error: 'Target node not found',
                    details: 'Cannot test execution without target node'
                };
            }

            // Simulate execution for JavaScript nodes
            if (targetNode.type === 'n8n-nodes-base.code') {
                const mockResult = await this.simulateJavaScriptExecution(targetNode.parameters.jsCode);
                return {
                    success: mockResult.success,
                    error: mockResult.error,
                    result: mockResult.result,
                    details: 'JavaScript execution simulation'
                };
            }

            // For other node types, assume success if syntax is valid
            return {
                success: true,
                result: { simulated: true },
                details: 'Syntax validation passed'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                details: 'Execution test failed'
            };
        }
    }

    /**
     * Simulate JavaScript code execution
     */
    async simulateJavaScriptExecution(jsCode) {
        try {
            // Create mock n8n environment
            const mockInput = {
                all: () => [{ json: { test: 'data', value: 123 } }]
            };

            // Create safe execution context
            const mockFunction = new Function('$input', jsCode);
            const result = mockFunction(mockInput);

            // Validate result format
            if (!result) {
                return {
                    success: false,
                    error: 'Code returned null/undefined'
                };
            }

            // Check if result has proper n8n format
            const isValidFormat = Array.isArray(result) || 
                                 (result.json && typeof result.json === 'object');

            if (!isValidFormat) {
                return {
                    success: false,
                    error: 'Invalid return format - must return array or {json: object}'
                };
            }

            return {
                success: true,
                result: result
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate JavaScript code
     */
    async validateJavaScriptCode(code) {
        try {
            // Basic syntax check
            new Function(code);

            // Check for required patterns
            const hasReturn = /return\s+/.test(code);
            if (!hasReturn) {
                return { valid: false, error: 'JavaScript code must return data' };
            }

            // Check for dangerous patterns
            const dangerousPatterns = [
                /eval\s*\(/,
                /Function\s*\(/,
                /process\./,
                /require\s*\(/,
                /global\./
            ];

            for (const pattern of dangerousPatterns) {
                if (pattern.test(code)) {
                    return { valid: false, error: 'Code contains potentially dangerous patterns' };
                }
            }

            return { valid: true };

        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Complete iteration loop (success or failure)
     */
    async completeIterationLoop(iterationId, success) {
        const iterationData = this.activeIterations.get(iterationId);
        
        if (!iterationData) return;

        // Clear timeout
        if (iterationData.timeout) {
            clearTimeout(iterationData.timeout);
        }

        iterationData.status = success ? 'completed' : 'failed';
        iterationData.endTime = new Date();
        iterationData.duration = iterationData.endTime - iterationData.startTime;

        console.log(`${success ? '✅' : '❌'} Iteration loop ${success ? 'completed' : 'failed'} for ${iterationId}`);
        console.log(`📊 Total iterations: ${iterationData.currentIteration}, Duration: ${iterationData.duration}ms`);

        if (success) {
            await this.handleSuccessfulFix(iterationData);
            this.emit('fix-successful', iterationData);
        } else {
            await this.handleFailedIteration(iterationData);
            this.emit('iteration-failed', iterationData);
        }

        // Clean up
        this.activeIterations.delete(iterationId);
    }

    /**
     * Handle successful fix
     */
    async handleSuccessfulFix(iterationData) {
        const lastAttempt = iterationData.attempts[iterationData.attempts.length - 1];
        
        if (lastAttempt?.fix && lastAttempt?.testResult) {
            // Learn from the successful fix
            await this.codeFixer.learnFromSuccess(
                iterationData.errorInfo,
                lastAttempt.fix.fix,
                lastAttempt.testResult
            );

            // Update problem analyzer with success
            await this.problemAnalyzer.learnFromSuccess?.(
                iterationData.errorInfo,
                lastAttempt.fix.fix,
                lastAttempt.testResult
            );
        }

        console.log(`🎉 Successfully fixed ${iterationData.errorInfo.type} in ${iterationData.currentIteration} iterations`);
    }

    /**
     * Handle failed iteration
     */
    async handleFailedIteration(iterationData) {
        console.log(`💥 Failed to fix ${iterationData.errorInfo.type} after ${iterationData.currentIteration} iterations`);
        
        // Log failure for analysis
        this.emit('fix-failed', {
            errorInfo: iterationData.errorInfo,
            attempts: iterationData.attempts,
            reason: 'Max iterations exceeded'
        });
    }

    /**
     * Handle iteration timeout
     */
    handleIterationTimeout(iterationId) {
        console.log(`⏰ Iteration timeout for ${iterationId}`);
        this.completeIterationLoop(iterationId, false);
    }

    /**
     * Check if error is critical and should stop iteration
     */
    isCriticalError(error) {
        const criticalPatterns = [
            /ENOENT/,
            /permission denied/i,
            /out of memory/i,
            /maximum call stack/i
        ];

        return criticalPatterns.some(pattern => pattern.test(error.message));
    }

    /**
     * Generate unique iteration ID
     */
    generateIterationId(errorInfo) {
        return `${errorInfo.workflowId}_${errorInfo.nodeId}_${errorInfo.type}_${Date.now()}`;
    }

    /**
     * Stop autonomous debugging
     */
    async stopAutonomousDebugging() {
        if (!this.isRunning) return;

        console.log('🛑 Stopping Autonomous Debugging System...');

        // Stop error detection
        this.errorDetector.stopMonitoring?.();

        // Complete all active iterations
        for (const [iterationId, iterationData] of this.activeIterations.entries()) {
            if (iterationData.timeout) {
                clearTimeout(iterationData.timeout);
            }
            iterationData.status = 'stopped';
        }

        this.activeIterations.clear();
        this.isRunning = false;
        
        this.emit('debugging-stopped');
        console.log('✅ Autonomous Debugging System stopped');
    }

    /**
     * Get debugging statistics
     */
    getDebuggingStats() {
        const stats = {
            isRunning: this.isRunning,
            activeIterations: this.activeIterations.size,
            errorDetectorStats: this.errorDetector.getErrorStats?.() || {},
            problemAnalyzerStats: this.problemAnalyzer.getAnalysisStats?.() || {},
            codeFixerStats: this.codeFixer.getFixStats?.() || {},
            iterationSummary: {
                total: 0,
                successful: 0,
                failed: 0,
                averageIterations: 0
            }
        };

        return stats;
    }

    /**
     * Force restart iteration for specific error
     */
    async forceRestartIteration(workflowId, nodeId) {
        const iterationId = Array.from(this.activeIterations.keys())
            .find(id => id.includes(`${workflowId}_${nodeId}`));

        if (iterationId) {
            await this.completeIterationLoop(iterationId, false);
            console.log(`🔄 Force restarted iteration for ${workflowId}/${nodeId}`);
        }
    }
}

module.exports = IterationManager;