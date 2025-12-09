/**
 * Debug Agent - Main orchestrator for autonomous workflow debugging
 * Coordinates all debugging components and manages the autonomous fixing process
 */

const EventEmitter = require('events');
const path = require('path');

// Import debugging components
const ErrorDetector = require('../ai-debugging/error-detector');
const ProblemAnalyzer = require('../ai-debugging/problem-analyzer');
const CodeFixer = require('../ai-debugging/code-fixer');
const IterationManager = require('../ai-debugging/iteration-manager');
const KnowledgeBase = require('../ai-debugging/knowledge-base');

class DebugAgent extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            n8nPath: config.n8nPath || process.env.N8N_USER_FOLDER || '~/.n8n',
            openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
            knowledgeBasePath: config.knowledgeBasePath || path.join(__dirname, '../../knowledge'),
            maxIterations: config.maxIterations || 10,
            iterationTimeout: config.iterationTimeout || 300000, // 5 minutes
            autoStart: config.autoStart !== false,
            ...config
        };

        // Core components
        this.errorDetector = null;
        this.problemAnalyzer = null;
        this.codeFixer = null;
        this.iterationManager = null;
        this.knowledgeBase = null;

        // State
        this.isInitialized = false;
        this.isRunning = false;
        this.stats = {
            totalErrorsDetected: 0,
            totalFixesAttempted: 0,
            totalFixesSuccessful: 0,
            averageIterationsPerFix: 0,
            uptime: 0,
            startTime: null
        };

        this.activeDebuggingSessions = new Map();
    }

    /**
     * Initialize the Debug Agent and all components
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('🤖 Initializing Debug Agent...');
        console.log(`📁 n8n Path: ${this.config.n8nPath}`);
        console.log(`🧠 Knowledge Base: ${this.config.knowledgeBasePath}`);

        try {
            // Initialize knowledge base first
            this.knowledgeBase = new KnowledgeBase(this.config.knowledgeBasePath);
            await this.knowledgeBase.initialize();

            // Initialize core components
            this.errorDetector = new ErrorDetector(this.config.n8nPath);
            this.problemAnalyzer = new ProblemAnalyzer(
                this.config.openaiApiKey, 
                this.config.knowledgeBasePath
            );
            this.codeFixer = new CodeFixer(
                this.config.openaiApiKey, 
                this.config.knowledgeBasePath
            );

            // Initialize iteration manager with components
            this.iterationManager = new IterationManager(
                this.errorDetector,
                this.problemAnalyzer,
                this.codeFixer
            );

            // Setup event listeners
            this.setupEventListeners();

            this.isInitialized = true;
            this.emit('initialized');

            console.log('✅ Debug Agent initialized successfully');

            // Auto-start if configured
            if (this.config.autoStart) {
                await this.start();
            }

        } catch (error) {
            console.error('❌ Failed to initialize Debug Agent:', error);
            this.emit('initialization-error', error);
            throw error;
        }
    }

    /**
     * Setup event listeners between components
     */
    setupEventListeners() {
        // Error detection events
        this.errorDetector.on('error-detected', (errorInfo) => {
            this.stats.totalErrorsDetected++;
            this.emit('error-detected', errorInfo);
            
            console.log(`🚨 Error detected: ${errorInfo.type} in workflow ${errorInfo.workflowId}`);
        });

        this.errorDetector.on('monitoring-started', () => {
            console.log('👁️ Error monitoring started');
            this.emit('monitoring-started');
        });

        this.errorDetector.on('monitoring-stopped', () => {
            console.log('👁️ Error monitoring stopped');
            this.emit('monitoring-stopped');
        });

        // Iteration manager events
        this.iterationManager.on('debugging-started', () => {
            console.log('🔄 Autonomous debugging started');
            this.emit('debugging-started');
        });

        this.iterationManager.on('fix-successful', async (iterationData) => {
            this.stats.totalFixesSuccessful++;
            this.stats.averageIterationsPerFix = this.calculateAverageIterations();
            
            await this.handleSuccessfulFix(iterationData);
            this.emit('fix-successful', iterationData);
            
            console.log(`🎉 Fix successful: ${iterationData.errorInfo.type} in ${iterationData.currentIteration} iterations`);
        });

        this.iterationManager.on('iteration-failed', async (iterationData) => {
            await this.handleFailedFix(iterationData);
            this.emit('fix-failed', iterationData);
            
            console.log(`💥 Fix failed: ${iterationData.errorInfo.type} after ${iterationData.currentIteration} iterations`);
        });

        this.iterationManager.on('debugging-stopped', () => {
            console.log('🔄 Autonomous debugging stopped');
            this.emit('debugging-stopped');
        });
    }

    /**
     * Start the autonomous debugging system
     */
    async start() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.isRunning) {
            console.log('⚠️ Debug Agent is already running');
            return;
        }

        console.log('🚀 Starting Debug Agent...');

        try {
            // Validate configuration
            await this.validateConfiguration();

            // Start the iteration manager (which starts error detection)
            await this.iterationManager.startAutonomousDebugging();

            this.isRunning = true;
            this.stats.startTime = new Date();
            this.emit('started');

            console.log('✅ Debug Agent is now running and monitoring workflows');

            // Start stats update interval
            this.startStatsUpdater();

        } catch (error) {
            console.error('❌ Failed to start Debug Agent:', error);
            this.emit('start-error', error);
            throw error;
        }
    }

    /**
     * Stop the autonomous debugging system
     */
    async stop() {
        if (!this.isRunning) {
            console.log('⚠️ Debug Agent is not running');
            return;
        }

        console.log('🛑 Stopping Debug Agent...');

        try {
            // Stop iteration manager
            await this.iterationManager.stopAutonomousDebugging();

            // Complete any active sessions
            for (const [sessionId, session] of this.activeDebuggingSessions.entries()) {
                session.status = 'stopped';
                this.activeDebuggingSessions.delete(sessionId);
            }

            this.isRunning = false;
            this.emit('stopped');

            console.log('✅ Debug Agent stopped successfully');

        } catch (error) {
            console.error('❌ Error stopping Debug Agent:', error);
            this.emit('stop-error', error);
        }
    }

    /**
     * Validate configuration
     */
    async validateConfiguration() {
        // Check OpenAI API key
        if (!this.config.openaiApiKey) {
            throw new Error('OpenAI API key is required for autonomous debugging');
        }

        // Check n8n path
        const fs = require('fs').promises;
        try {
            await fs.access(this.config.n8nPath);
        } catch (error) {
            console.warn(`⚠️ n8n path not accessible: ${this.config.n8nPath}`);
            // Don't throw error - might be created later
        }

        // Test OpenAI connection
        try {
            await this.testOpenAIConnection();
        } catch (error) {
            throw new Error(`OpenAI connection test failed: ${error.message}`);
        }

        console.log('✅ Configuration validated');
    }

    /**
     * Test OpenAI connection
     */
    async testOpenAIConnection() {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${this.config.openaiApiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`OpenAI API test failed: ${response.statusText}`);
        }
    }

    /**
     * Handle successful fix
     */
    async handleSuccessfulFix(iterationData) {
        const sessionId = iterationData.id;
        
        // Update session
        if (this.activeDebuggingSessions.has(sessionId)) {
            const session = this.activeDebuggingSessions.get(sessionId);
            session.status = 'completed';
            session.endTime = new Date();
            session.result = 'success';
            session.iterations = iterationData.currentIteration;
        }

        // Record in knowledge base
        const lastAttempt = iterationData.attempts[iterationData.attempts.length - 1];
        if (lastAttempt?.fix && lastAttempt?.testResult) {
            await this.knowledgeBase.recordSuccess(
                iterationData.errorInfo,
                lastAttempt.fix.fix,
                lastAttempt.testResult
            );
        }

        // Generate success report
        const report = this.generateSuccessReport(iterationData);
        this.emit('success-report', report);
    }

    /**
     * Handle failed fix
     */
    async handleFailedFix(iterationData) {
        const sessionId = iterationData.id;
        
        // Update session
        if (this.activeDebuggingSessions.has(sessionId)) {
            const session = this.activeDebuggingSessions.get(sessionId);
            session.status = 'failed';
            session.endTime = new Date();
            session.result = 'failure';
            session.iterations = iterationData.currentIteration;
        }

        // Generate failure report
        const report = this.generateFailureReport(iterationData);
        this.emit('failure-report', report);

        // Consider escalation
        this.considerEscalation(iterationData);
    }

    /**
     * Generate success report
     */
    generateSuccessReport(iterationData) {
        const lastAttempt = iterationData.attempts[iterationData.attempts.length - 1];
        
        return {
            type: 'success',
            timestamp: new Date().toISOString(),
            sessionId: iterationData.id,
            errorInfo: {
                type: iterationData.errorInfo.type,
                workflowId: iterationData.errorInfo.workflowId,
                nodeId: iterationData.errorInfo.nodeId,
                message: iterationData.errorInfo.message
            },
            solution: {
                iterations: iterationData.currentIteration,
                duration: iterationData.endTime - iterationData.startTime,
                fixType: lastAttempt?.fix?.fix?.type,
                fixDescription: lastAttempt?.fix?.fix?.description,
                confidence: lastAttempt?.analysis?.confidence
            },
            metrics: {
                timeToResolution: iterationData.endTime - iterationData.startTime,
                iterationsUsed: iterationData.currentIteration,
                maxIterations: this.config.maxIterations
            }
        };
    }

    /**
     * Generate failure report
     */
    generateFailureReport(iterationData) {
        return {
            type: 'failure',
            timestamp: new Date().toISOString(),
            sessionId: iterationData.id,
            errorInfo: {
                type: iterationData.errorInfo.type,
                workflowId: iterationData.errorInfo.workflowId,
                nodeId: iterationData.errorInfo.nodeId,
                message: iterationData.errorInfo.message
            },
            failure: {
                iterations: iterationData.currentIteration,
                duration: iterationData.endTime - iterationData.startTime,
                lastError: iterationData.attempts[iterationData.attempts.length - 1]?.error,
                reason: 'Max iterations exceeded'
            },
            attempts: iterationData.attempts.map(attempt => ({
                iteration: attempt.iteration,
                phase: attempt.phase,
                success: attempt.success,
                error: attempt.error
            })),
            recommendations: this.generateFailureRecommendations(iterationData)
        };
    }

    /**
     * Generate recommendations for failed fixes
     */
    generateFailureRecommendations(iterationData) {
        const recommendations = [];

        // Check if it's a recurring pattern
        recommendations.push('Manual review required');
        recommendations.push('Consider updating error patterns');
        
        if (iterationData.currentIteration < 3) {
            recommendations.push('Error might be too complex for current templates');
        }

        return recommendations;
    }

    /**
     * Consider escalation for failed fixes
     */
    considerEscalation(iterationData) {
        // Log for human review
        console.log(`🚨 ESCALATION: Failed to fix ${iterationData.errorInfo.type} after ${iterationData.currentIteration} iterations`);
        
        // Could integrate with ticketing system, Slack, etc.
        this.emit('escalation-required', {
            errorInfo: iterationData.errorInfo,
            iterations: iterationData.currentIteration,
            attempts: iterationData.attempts
        });
    }

    /**
     * Calculate average iterations per fix
     */
    calculateAverageIterations() {
        if (this.stats.totalFixesSuccessful === 0) return 0;
        
        let totalIterations = 0;
        let successfulFixes = 0;
        
        for (const [sessionId, session] of this.activeDebuggingSessions.entries()) {
            if (session.status === 'completed' && session.result === 'success') {
                totalIterations += session.iterations || 0;
                successfulFixes++;
            }
        }
        
        return successfulFixes > 0 ? totalIterations / successfulFixes : 0;
    }

    /**
     * Start stats updater
     */
    startStatsUpdater() {
        setInterval(() => {
            if (this.isRunning && this.stats.startTime) {
                this.stats.uptime = Date.now() - this.stats.startTime.getTime();
            }
        }, 10000); // Update every 10 seconds
    }

    /**
     * Get comprehensive stats
     */
    getStats() {
        const baseStats = {
            ...this.stats,
            isRunning: this.isRunning,
            isInitialized: this.isInitialized,
            activeSessions: this.activeDebuggingSessions.size,
            configuration: {
                maxIterations: this.config.maxIterations,
                iterationTimeout: this.config.iterationTimeout,
                autoStart: this.config.autoStart
            }
        };

        // Add component stats if available
        if (this.errorDetector) {
            baseStats.errorDetector = this.errorDetector.getErrorStats?.() || {};
        }
        
        if (this.codeFixer) {
            baseStats.codeFixer = this.codeFixer.getFixStats?.() || {};
        }
        
        if (this.iterationManager) {
            baseStats.iterationManager = this.iterationManager.getDebuggingStats?.() || {};
        }
        
        if (this.knowledgeBase) {
            baseStats.knowledgeBase = this.knowledgeBase.getStats?.() || {};
        }

        return baseStats;
    }

    /**
     * Force restart debugging for specific error
     */
    async forceRestart(workflowId, nodeId) {
        console.log(`🔄 Force restarting debugging for ${workflowId}/${nodeId}`);
        
        if (this.iterationManager) {
            await this.iterationManager.forceRestartIteration(workflowId, nodeId);
        }
        
        this.emit('force-restart', { workflowId, nodeId });
    }

    /**
     * Manually trigger error analysis
     */
    async analyzeError(errorInfo) {
        if (!this.problemAnalyzer) {
            throw new Error('Debug Agent not initialized');
        }

        console.log(`🔍 Manual error analysis for ${errorInfo.type}`);
        
        const analysis = await this.problemAnalyzer.analyzeError(errorInfo);
        this.emit('manual-analysis', { errorInfo, analysis });
        
        return analysis;
    }

    /**
     * Manually apply fix
     */
    async applyFix(errorInfo, analysis) {
        if (!this.codeFixer) {
            throw new Error('Debug Agent not initialized');
        }

        console.log(`🔧 Manual fix application for ${errorInfo.type}`);
        
        const result = await this.codeFixer.applyFix(errorInfo, analysis);
        this.emit('manual-fix', { errorInfo, analysis, result });
        
        return result;
    }

    /**
     * Health check
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            components: {},
            issues: []
        };

        try {
            // Check if components are initialized
            health.components.errorDetector = this.errorDetector ? 'initialized' : 'not_initialized';
            health.components.problemAnalyzer = this.problemAnalyzer ? 'initialized' : 'not_initialized';
            health.components.codeFixer = this.codeFixer ? 'initialized' : 'not_initialized';
            health.components.iterationManager = this.iterationManager ? 'initialized' : 'not_initialized';
            health.components.knowledgeBase = this.knowledgeBase ? 'initialized' : 'not_initialized';

            // Check OpenAI connection
            if (this.config.openaiApiKey) {
                try {
                    await this.testOpenAIConnection();
                    health.components.openai = 'connected';
                } catch (error) {
                    health.components.openai = 'disconnected';
                    health.issues.push('OpenAI connection failed');
                }
            } else {
                health.components.openai = 'not_configured';
                health.issues.push('OpenAI API key not configured');
            }

            // Check n8n path
            const fs = require('fs').promises;
            try {
                await fs.access(this.config.n8nPath);
                health.components.n8nPath = 'accessible';
            } catch (error) {
                health.components.n8nPath = 'not_accessible';
                health.issues.push('n8n path not accessible');
            }

            if (health.issues.length > 0) {
                health.status = 'degraded';
            }

        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
        }

        return health;
    }
}

module.exports = DebugAgent;