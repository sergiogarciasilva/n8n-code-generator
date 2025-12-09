/**
 * Error Detector - Monitors n8n workflow executions and detects failures
 * Part of the Autonomous Workflow Debugging System
 */

const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const EventEmitter = require('events');

class ErrorDetector extends EventEmitter {
    constructor(n8nPath) {
        super();
        this.n8nPath = n8nPath;
        this.executionLogPath = path.join(n8nPath, 'logs');
        this.isMonitoring = false;
        this.knownErrors = new Map();
        this.executionHistory = [];
    }

    /**
     * Start monitoring workflow executions for errors
     */
    async startMonitoring() {
        if (this.isMonitoring) return;

        console.log('🔍 Starting error detection monitoring...');
        
        try {
            // Monitor execution logs
            await this.watchExecutionLogs();
            
            // Monitor workflow files for syntax errors
            await this.watchWorkflowFiles();
            
            this.isMonitoring = true;
            this.emit('monitoring-started');
            
        } catch (error) {
            console.error('❌ Failed to start error monitoring:', error);
            this.emit('monitoring-error', error);
        }
    }

    /**
     * Watch n8n execution logs for runtime errors
     */
    async watchExecutionLogs() {
        const logWatcher = chokidar.watch(this.executionLogPath, {
            ignored: /^\./, 
            persistent: true
        });

        logWatcher.on('change', async (logPath) => {
            await this.analyzeLogFile(logPath);
        });

        logWatcher.on('add', async (logPath) => {
            await this.analyzeLogFile(logPath);
        });
    }

    /**
     * Watch workflow files for immediate syntax validation
     */
    async watchWorkflowFiles() {
        const workflowsPath = path.join(this.n8nPath, 'workflows');
        
        const workflowWatcher = chokidar.watch(workflowsPath, {
            ignored: /^\./, 
            persistent: true
        });

        workflowWatcher.on('change', async (workflowPath) => {
            await this.validateWorkflowSyntax(workflowPath);
        });
    }

    /**
     * Analyze log file for errors and execution failures
     */
    async analyzeLogFile(logPath) {
        try {
            const logContent = await fs.readFile(logPath, 'utf8');
            const logLines = logContent.split('\n');
            
            for (const line of logLines) {
                const errorInfo = this.parseLogLine(line);
                if (errorInfo) {
                    await this.handleDetectedError(errorInfo);
                }
            }
        } catch (error) {
            console.error('Error analyzing log file:', error);
        }
    }

    /**
     * Parse individual log line to extract error information
     */
    parseLogLine(line) {
        if (!line.trim()) return null;

        // Common n8n error patterns
        const errorPatterns = [
            // JavaScript execution errors
            {
                pattern: /ERROR.*Workflow.*execution.*failed.*JavaScript.*error/i,
                type: 'javascript_error',
                severity: 'high'
            },
            // API connection errors
            {
                pattern: /ERROR.*HTTP.*request.*failed|API.*connection.*error/i,
                type: 'api_error',
                severity: 'medium'
            },
            // Data transformation errors
            {
                pattern: /ERROR.*Data.*transformation.*failed|Invalid.*JSON/i,
                type: 'data_error',
                severity: 'medium'
            },
            // Node configuration errors
            {
                pattern: /ERROR.*Node.*configuration.*invalid|Missing.*required.*parameter/i,
                type: 'config_error',
                severity: 'high'
            },
            // General execution errors
            {
                pattern: /ERROR.*Workflow.*execution.*error/i,
                type: 'execution_error',
                severity: 'medium'
            }
        ];

        for (const { pattern, type, severity } of errorPatterns) {
            if (pattern.test(line)) {
                return {
                    timestamp: this.extractTimestamp(line),
                    type,
                    severity,
                    message: line.trim(),
                    workflowId: this.extractWorkflowId(line),
                    nodeId: this.extractNodeId(line),
                    rawLog: line
                };
            }
        }

        return null;
    }

    /**
     * Extract timestamp from log line
     */
    extractTimestamp(line) {
        const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
        return timestampMatch ? new Date(timestampMatch[1]) : new Date();
    }

    /**
     * Extract workflow ID from log line
     */
    extractWorkflowId(line) {
        const workflowMatch = line.match(/workflow[^\w]*([a-f0-9-]{36})/i);
        return workflowMatch ? workflowMatch[1] : null;
    }

    /**
     * Extract node ID from log line
     */
    extractNodeId(line) {
        const nodeMatch = line.match(/node[^\w]*([a-f0-9-]{36}|[\w-]+)/i);
        return nodeMatch ? nodeMatch[1] : null;
    }

    /**
     * Validate workflow file syntax immediately
     */
    async validateWorkflowSyntax(workflowPath) {
        try {
            const workflowContent = await fs.readFile(workflowPath, 'utf8');
            const workflow = JSON.parse(workflowContent);
            
            // Basic workflow validation
            const validationErrors = this.validateWorkflowStructure(workflow);
            
            if (validationErrors.length > 0) {
                const errorInfo = {
                    timestamp: new Date(),
                    type: 'syntax_error',
                    severity: 'high',
                    message: 'Workflow syntax validation failed',
                    workflowId: workflow.id,
                    workflowPath,
                    errors: validationErrors,
                    workflow
                };
                
                await this.handleDetectedError(errorInfo);
            }
            
        } catch (error) {
            // JSON parsing error
            const errorInfo = {
                timestamp: new Date(),
                type: 'json_error',
                severity: 'critical',
                message: `Invalid JSON in workflow: ${error.message}`,
                workflowPath,
                parseError: error
            };
            
            await this.handleDetectedError(errorInfo);
        }
    }

    /**
     * Validate workflow structure and node configurations
     */
    validateWorkflowStructure(workflow) {
        const errors = [];

        if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
            errors.push('Workflow must have nodes array');
            return errors;
        }

        for (const node of workflow.nodes) {
            // Validate node structure
            if (!node.id) {
                errors.push(`Node missing ID: ${JSON.stringify(node)}`);
            }
            
            if (!node.type) {
                errors.push(`Node missing type: ${node.id}`);
            }

            // Validate JavaScript nodes specifically
            if (node.type === 'n8n-nodes-base.code') {
                const codeErrors = this.validateJavaScriptNode(node);
                errors.push(...codeErrors);
            }

            // Validate API nodes
            if (node.type.includes('http') || node.type.includes('api')) {
                const apiErrors = this.validateApiNode(node);
                errors.push(...apiErrors);
            }
        }

        return errors;
    }

    /**
     * Validate JavaScript code node for common issues
     */
    validateJavaScriptNode(node) {
        const errors = [];
        const code = node.parameters?.jsCode || '';

        if (!code.trim()) {
            errors.push(`JavaScript node ${node.id} has empty code`);
            return errors;
        }

        // Check for common JavaScript issues
        const commonIssues = [
            {
                pattern: /return\s*;?\s*$/m,
                message: 'JavaScript node must return data'
            },
            {
                pattern: /console\.log/,
                message: 'Avoid console.log in production code'
            },
            {
                pattern: /\$input\s*\(\s*\)/,
                message: 'Check $input() usage - ensure data exists'
            },
            {
                pattern: /JSON\.parse\s*\(/,
                message: 'Add error handling for JSON.parse()'
            }
        ];

        for (const { pattern, message } of commonIssues) {
            if (pattern.test(code)) {
                errors.push(`${message} in node ${node.id}`);
            }
        }

        // Basic syntax check (simplified)
        try {
            new Function(code);
        } catch (syntaxError) {
            errors.push(`Syntax error in node ${node.id}: ${syntaxError.message}`);
        }

        return errors;
    }

    /**
     * Validate API/HTTP nodes for common configuration issues
     */
    validateApiNode(node) {
        const errors = [];
        const params = node.parameters || {};

        if (!params.url && !params.endpoint) {
            errors.push(`API node ${node.id} missing URL/endpoint`);
        }

        if (params.url && !this.isValidUrl(params.url)) {
            errors.push(`API node ${node.id} has invalid URL format`);
        }

        return errors;
    }

    /**
     * Basic URL validation
     */
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Handle detected error - emit event for debugging system
     */
    async handleDetectedError(errorInfo) {
        const errorId = this.generateErrorId(errorInfo);
        
        // Avoid duplicate error processing
        if (this.knownErrors.has(errorId)) {
            return;
        }

        this.knownErrors.set(errorId, errorInfo);
        this.executionHistory.push(errorInfo);

        console.log(`🚨 Error detected: ${errorInfo.type} - ${errorInfo.message}`);

        // Emit error for the debugging system to handle
        this.emit('error-detected', {
            ...errorInfo,
            errorId,
            needsFixing: this.determineIfNeedsFix(errorInfo)
        });
    }

    /**
     * Generate unique error ID to avoid duplicate processing
     */
    generateErrorId(errorInfo) {
        const key = `${errorInfo.type}_${errorInfo.workflowId}_${errorInfo.nodeId}_${errorInfo.timestamp.getTime()}`;
        return Buffer.from(key).toString('base64').substring(0, 16);
    }

    /**
     * Determine if error can be automatically fixed
     */
    determineIfNeedsFix(errorInfo) {
        const fixableTypes = [
            'javascript_error',
            'syntax_error', 
            'json_error',
            'data_error',
            'config_error'
        ];

        return fixableTypes.includes(errorInfo.type) && 
               errorInfo.severity !== 'critical';
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        const stats = {
            totalErrors: this.executionHistory.length,
            errorsByType: {},
            errorsBySeverity: {},
            recentErrors: this.executionHistory.slice(-10)
        };

        for (const error of this.executionHistory) {
            stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;
            stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;
        }

        return stats;
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.isMonitoring = false;
        this.emit('monitoring-stopped');
        console.log('🔍 Error detection monitoring stopped');
    }
}

module.exports = ErrorDetector;