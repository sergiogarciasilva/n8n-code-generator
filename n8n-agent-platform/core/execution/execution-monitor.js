/**
 * Execution Monitor - Real-time monitoring of workflow executions
 * Tracks performance, detects issues, and provides analytics
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class ExecutionMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            metricsInterval: config.metricsInterval || 5000, // 5 seconds
            alertThresholds: {
                executionTime: config.executionTimeThreshold || 60000, // 1 minute
                errorRate: config.errorRateThreshold || 0.1, // 10%
                queueLength: config.queueLengthThreshold || 100,
                memoryUsage: config.memoryUsageThreshold || 0.8, // 80%
                ...config.alertThresholds
            },
            retentionPeriod: config.retentionPeriod || 86400000, // 24 hours
            ...config
        };

        this.executions = new Map();
        this.metrics = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0,
            nodeMetrics: new Map(),
            errorTypes: new Map(),
            performanceHistory: []
        };

        this.alerts = new Map();
        this.isMonitoring = false;
        this.metricsInterval = null;
        this.performanceBaseline = null;
    }

    /**
     * Start monitoring executions
     */
    async startMonitoring(workflowExecutor) {
        if (this.isMonitoring) return;

        console.log('📊 Starting execution monitoring...');
        
        this.workflowExecutor = workflowExecutor;
        
        // Subscribe to executor events
        this.setupExecutorListeners();
        
        // Start metrics collection
        this.startMetricsCollection();
        
        // Load performance baseline
        await this.loadPerformanceBaseline();
        
        this.isMonitoring = true;
        this.emit('monitoring-started');
        
        console.log('✅ Execution monitoring active');
    }

    /**
     * Setup executor event listeners
     */
    setupExecutorListeners() {
        if (!this.workflowExecutor) return;

        this.workflowExecutor.on('execution-started', (execution) => {
            this.trackExecutionStart(execution);
        });

        this.workflowExecutor.on('execution-completed', (execution) => {
            this.trackExecutionComplete(execution);
        });

        this.workflowExecutor.on('execution-failed', (execution) => {
            this.trackExecutionFailed(execution);
        });

        this.workflowExecutor.on('node-executed', (nodeExecution) => {
            this.trackNodeExecution(nodeExecution);
        });
    }

    /**
     * Track execution start
     */
    trackExecutionStart(execution) {
        const monitor = {
            id: execution.id,
            workflowId: execution.workflowId,
            workflowName: execution.workflow?.name,
            startTime: new Date(),
            status: 'running',
            nodes: new Map(),
            checkpoints: [],
            resourceUsage: {
                startMemory: process.memoryUsage(),
                startCpu: process.cpuUsage()
            }
        };

        this.executions.set(execution.id, monitor);
        
        // Add checkpoint
        this.addCheckpoint(execution.id, 'start', {
            nodeCount: execution.workflow?.nodes?.length || 0,
            inputDataSize: JSON.stringify(execution.inputData).length
        });

        console.log(`📊 Monitoring execution: ${execution.id}`);
    }

    /**
     * Track execution completion
     */
    trackExecutionComplete(execution) {
        const monitor = this.executions.get(execution.id);
        if (!monitor) return;

        monitor.endTime = new Date();
        monitor.duration = monitor.endTime - monitor.startTime;
        monitor.status = 'completed';
        monitor.resourceUsage.endMemory = process.memoryUsage();
        monitor.resourceUsage.endCpu = process.cpuUsage();

        // Calculate resource consumption
        monitor.resourceUsage.memoryDelta = 
            monitor.resourceUsage.endMemory.heapUsed - monitor.resourceUsage.startMemory.heapUsed;
        
        // Update metrics
        this.updateMetrics('success', monitor);
        
        // Check for performance issues
        this.checkPerformanceAnomaly(monitor);
        
        // Add final checkpoint
        this.addCheckpoint(execution.id, 'complete', {
            duration: monitor.duration,
            nodesExecuted: monitor.nodes.size,
            outputDataSize: JSON.stringify(execution.results).length
        });

        console.log(`✅ Execution completed in ${monitor.duration}ms`);
        
        this.emit('execution-monitored', {
            type: 'success',
            execution: monitor
        });
    }

    /**
     * Track execution failure
     */
    trackExecutionFailed(execution) {
        const monitor = this.executions.get(execution.id);
        if (!monitor) return;

        monitor.endTime = new Date();
        monitor.duration = monitor.endTime - monitor.startTime;
        monitor.status = 'failed';
        monitor.error = execution.error;
        monitor.failedNode = execution.currentNode;

        // Update metrics
        this.updateMetrics('failure', monitor);
        
        // Track error type
        this.trackErrorType(execution.error, execution.currentNode);
        
        // Check for error patterns
        this.checkErrorPattern(monitor);
        
        // Add failure checkpoint
        this.addCheckpoint(execution.id, 'failed', {
            error: execution.error,
            failedNode: execution.currentNode?.name,
            duration: monitor.duration
        });

        console.log(`❌ Execution failed after ${monitor.duration}ms: ${execution.error}`);
        
        this.emit('execution-monitored', {
            type: 'failure',
            execution: monitor
        });

        // Trigger alerts if needed
        this.checkAlertConditions();
    }

    /**
     * Track individual node execution
     */
    trackNodeExecution(nodeExecution) {
        const monitor = this.executions.get(nodeExecution.executionId);
        if (!monitor) return;

        const nodeMetric = {
            nodeId: nodeExecution.nodeId,
            nodeName: nodeExecution.nodeName,
            nodeType: nodeExecution.nodeType,
            startTime: nodeExecution.startTime,
            endTime: nodeExecution.endTime,
            duration: nodeExecution.duration,
            success: nodeExecution.success,
            error: nodeExecution.error,
            inputItemCount: nodeExecution.inputItemCount,
            outputItemCount: nodeExecution.outputItemCount
        };

        monitor.nodes.set(nodeExecution.nodeId, nodeMetric);
        
        // Update node-level metrics
        this.updateNodeMetrics(nodeMetric);
        
        // Add node checkpoint
        this.addCheckpoint(nodeExecution.executionId, 'node', {
            nodeId: nodeExecution.nodeId,
            nodeName: nodeExecution.nodeName,
            duration: nodeExecution.duration,
            success: nodeExecution.success
        });
    }

    /**
     * Add execution checkpoint
     */
    addCheckpoint(executionId, type, data) {
        const monitor = this.executions.get(executionId);
        if (!monitor) return;

        monitor.checkpoints.push({
            timestamp: new Date(),
            type,
            data
        });
    }

    /**
     * Update overall metrics
     */
    updateMetrics(result, monitor) {
        this.metrics.totalExecutions++;
        
        if (result === 'success') {
            this.metrics.successfulExecutions++;
        } else {
            this.metrics.failedExecutions++;
        }

        // Update average execution time
        const successfulMonitors = Array.from(this.executions.values())
            .filter(m => m.status === 'completed');
        
        if (successfulMonitors.length > 0) {
            const totalTime = successfulMonitors.reduce((sum, m) => sum + m.duration, 0);
            this.metrics.averageExecutionTime = totalTime / successfulMonitors.length;
        }

        // Update performance history
        this.metrics.performanceHistory.push({
            timestamp: new Date(),
            executionTime: monitor.duration,
            success: result === 'success',
            workflowId: monitor.workflowId,
            memoryUsage: monitor.resourceUsage?.memoryDelta
        });

        // Trim old history
        const cutoff = Date.now() - this.config.retentionPeriod;
        this.metrics.performanceHistory = this.metrics.performanceHistory
            .filter(h => h.timestamp.getTime() > cutoff);
    }

    /**
     * Update node-level metrics
     */
    updateNodeMetrics(nodeMetric) {
        const key = `${nodeMetric.nodeType}_${nodeMetric.nodeId}`;
        
        if (!this.metrics.nodeMetrics.has(key)) {
            this.metrics.nodeMetrics.set(key, {
                nodeId: nodeMetric.nodeId,
                nodeName: nodeMetric.nodeName,
                nodeType: nodeMetric.nodeType,
                executions: 0,
                successes: 0,
                failures: 0,
                totalDuration: 0,
                averageDuration: 0,
                lastExecution: null
            });
        }

        const metric = this.metrics.nodeMetrics.get(key);
        metric.executions++;
        metric.totalDuration += nodeMetric.duration;
        metric.averageDuration = metric.totalDuration / metric.executions;
        metric.lastExecution = new Date();

        if (nodeMetric.success) {
            metric.successes++;
        } else {
            metric.failures++;
        }
    }

    /**
     * Track error types
     */
    trackErrorType(error, node) {
        const errorType = this.classifyError(error);
        
        if (!this.metrics.errorTypes.has(errorType)) {
            this.metrics.errorTypes.set(errorType, {
                type: errorType,
                count: 0,
                lastOccurrence: null,
                affectedNodes: new Set()
            });
        }

        const errorMetric = this.metrics.errorTypes.get(errorType);
        errorMetric.count++;
        errorMetric.lastOccurrence = new Date();
        
        if (node) {
            errorMetric.affectedNodes.add(node.id);
        }
    }

    /**
     * Classify error type
     */
    classifyError(error) {
        if (!error) return 'unknown';

        const errorStr = error.toString().toLowerCase();
        
        if (errorStr.includes('timeout')) return 'timeout';
        if (errorStr.includes('authentication') || errorStr.includes('401')) return 'authentication';
        if (errorStr.includes('not found') || errorStr.includes('404')) return 'not_found';
        if (errorStr.includes('rate limit') || errorStr.includes('429')) return 'rate_limit';
        if (errorStr.includes('syntax') || errorStr.includes('parse')) return 'syntax';
        if (errorStr.includes('connection') || errorStr.includes('network')) return 'network';
        if (errorStr.includes('memory')) return 'memory';
        if (errorStr.includes('permission') || errorStr.includes('403')) return 'permission';
        
        return 'general';
    }

    /**
     * Check for performance anomalies
     */
    checkPerformanceAnomaly(monitor) {
        if (!this.performanceBaseline) return;

        const baseline = this.performanceBaseline[monitor.workflowId];
        if (!baseline) return;

        // Check if execution time is significantly higher than baseline
        const deviation = (monitor.duration - baseline.averageDuration) / baseline.averageDuration;
        
        if (deviation > 0.5) { // 50% slower than baseline
            this.createAlert('performance_degradation', {
                workflowId: monitor.workflowId,
                executionTime: monitor.duration,
                baseline: baseline.averageDuration,
                deviation: `${Math.round(deviation * 100)}%`
            });
        }

        // Check memory usage
        if (monitor.resourceUsage?.memoryDelta > baseline.averageMemory * 2) {
            this.createAlert('excessive_memory_usage', {
                workflowId: monitor.workflowId,
                memoryUsed: monitor.resourceUsage.memoryDelta,
                baseline: baseline.averageMemory
            });
        }
    }

    /**
     * Check for error patterns
     */
    checkErrorPattern(monitor) {
        // Get recent failures for this workflow
        const recentFailures = Array.from(this.executions.values())
            .filter(m => 
                m.workflowId === monitor.workflowId && 
                m.status === 'failed' &&
                m.endTime && 
                m.endTime.getTime() > Date.now() - 3600000 // Last hour
            );

        if (recentFailures.length >= 3) {
            // Check if failures have similar patterns
            const errorTypes = recentFailures.map(f => this.classifyError(f.error));
            const uniqueErrors = new Set(errorTypes);
            
            if (uniqueErrors.size === 1) {
                // Same error type repeating
                this.createAlert('repeated_failure', {
                    workflowId: monitor.workflowId,
                    errorType: errorTypes[0],
                    failureCount: recentFailures.length,
                    timeWindow: '1 hour'
                });
            }
        }
    }

    /**
     * Check alert conditions
     */
    checkAlertConditions() {
        // Error rate check
        const errorRate = this.metrics.failedExecutions / this.metrics.totalExecutions;
        if (errorRate > this.config.alertThresholds.errorRate) {
            this.createAlert('high_error_rate', {
                errorRate: `${Math.round(errorRate * 100)}%`,
                threshold: `${Math.round(this.config.alertThresholds.errorRate * 100)}%`
            });
        }

        // Queue length check (if executor provides it)
        if (this.workflowExecutor?.getStats) {
            const stats = this.workflowExecutor.getStats();
            if (stats.queueLength > this.config.alertThresholds.queueLength) {
                this.createAlert('queue_backlog', {
                    queueLength: stats.queueLength,
                    threshold: this.config.alertThresholds.queueLength
                });
            }
        }

        // Memory usage check
        const memUsage = process.memoryUsage();
        const memoryPercent = memUsage.heapUsed / memUsage.heapTotal;
        if (memoryPercent > this.config.alertThresholds.memoryUsage) {
            this.createAlert('high_memory_usage', {
                usage: `${Math.round(memoryPercent * 100)}%`,
                threshold: `${Math.round(this.config.alertThresholds.memoryUsage * 100)}%`
            });
        }
    }

    /**
     * Create alert
     */
    createAlert(type, details) {
        const alertKey = `${type}_${JSON.stringify(details)}`;
        
        // Prevent duplicate alerts
        if (this.alerts.has(alertKey)) {
            const existingAlert = this.alerts.get(alertKey);
            if (Date.now() - existingAlert.timestamp < 300000) { // 5 minutes
                return;
            }
        }

        const alert = {
            id: `alert_${Date.now()}`,
            type,
            severity: this.getAlertSeverity(type),
            timestamp: Date.now(),
            details,
            resolved: false
        };

        this.alerts.set(alertKey, alert);
        
        console.log(`🚨 Alert: ${type} - ${JSON.stringify(details)}`);
        this.emit('alert', alert);
    }

    /**
     * Get alert severity
     */
    getAlertSeverity(type) {
        const severityMap = {
            'high_error_rate': 'critical',
            'repeated_failure': 'high',
            'performance_degradation': 'medium',
            'queue_backlog': 'high',
            'high_memory_usage': 'critical',
            'excessive_memory_usage': 'high'
        };

        return severityMap[type] || 'medium';
    }

    /**
     * Start metrics collection interval
     */
    startMetricsCollection() {
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
            this.cleanupOldData();
            this.checkAlertConditions();
        }, this.config.metricsInterval);
    }

    /**
     * Collect current metrics
     */
    collectMetrics() {
        const snapshot = {
            timestamp: new Date(),
            executions: {
                active: Array.from(this.executions.values())
                    .filter(e => e.status === 'running').length,
                total: this.metrics.totalExecutions,
                successful: this.metrics.successfulExecutions,
                failed: this.metrics.failedExecutions,
                successRate: this.metrics.totalExecutions > 0 
                    ? this.metrics.successfulExecutions / this.metrics.totalExecutions 
                    : 0
            },
            performance: {
                averageExecutionTime: this.metrics.averageExecutionTime,
                p95ExecutionTime: this.calculatePercentile(95),
                p99ExecutionTime: this.calculatePercentile(99)
            },
            resources: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            },
            nodes: {
                totalTypes: this.metrics.nodeMetrics.size,
                slowestNodes: this.getSlowestNodes(5),
                errorProneNodes: this.getErrorProneNodes(5)
            },
            errors: {
                types: Array.from(this.metrics.errorTypes.entries())
                    .map(([type, data]) => ({
                        type,
                        count: data.count,
                        lastOccurrence: data.lastOccurrence
                    }))
                    .sort((a, b) => b.count - a.count)
            }
        };

        this.emit('metrics-collected', snapshot);
    }

    /**
     * Calculate percentile execution time
     */
    calculatePercentile(percentile) {
        const times = this.metrics.performanceHistory
            .filter(h => h.success)
            .map(h => h.executionTime)
            .sort((a, b) => a - b);

        if (times.length === 0) return 0;

        const index = Math.ceil((percentile / 100) * times.length) - 1;
        return times[index];
    }

    /**
     * Get slowest nodes
     */
    getSlowestNodes(limit) {
        return Array.from(this.metrics.nodeMetrics.values())
            .sort((a, b) => b.averageDuration - a.averageDuration)
            .slice(0, limit)
            .map(node => ({
                nodeId: node.nodeId,
                nodeName: node.nodeName,
                nodeType: node.nodeType,
                averageDuration: Math.round(node.averageDuration),
                executions: node.executions
            }));
    }

    /**
     * Get error-prone nodes
     */
    getErrorProneNodes(limit) {
        return Array.from(this.metrics.nodeMetrics.values())
            .filter(node => node.failures > 0)
            .sort((a, b) => (b.failures / b.executions) - (a.failures / a.executions))
            .slice(0, limit)
            .map(node => ({
                nodeId: node.nodeId,
                nodeName: node.nodeName,
                nodeType: node.nodeType,
                errorRate: Math.round((node.failures / node.executions) * 100) + '%',
                failures: node.failures,
                executions: node.executions
            }));
    }

    /**
     * Load performance baseline
     */
    async loadPerformanceBaseline() {
        try {
            const baselinePath = path.join(this.config.dataPath || '.', 'performance-baseline.json');
            const data = await fs.readFile(baselinePath, 'utf8');
            this.performanceBaseline = JSON.parse(data);
            console.log('📊 Loaded performance baseline');
        } catch (error) {
            console.log('📊 No performance baseline found, will create one');
            this.performanceBaseline = {};
        }
    }

    /**
     * Update performance baseline
     */
    async updatePerformanceBaseline() {
        // Calculate baseline from recent successful executions
        const workflowBaselines = {};

        for (const [workflowId, executions] of this.groupExecutionsByWorkflow()) {
            const successful = executions.filter(e => e.status === 'completed');
            
            if (successful.length >= 10) { // Need at least 10 runs
                workflowBaselines[workflowId] = {
                    averageDuration: successful.reduce((sum, e) => sum + e.duration, 0) / successful.length,
                    averageMemory: successful.reduce((sum, e) => 
                        sum + (e.resourceUsage?.memoryDelta || 0), 0) / successful.length,
                    sampleSize: successful.length,
                    lastUpdated: new Date()
                };
            }
        }

        this.performanceBaseline = workflowBaselines;

        // Save baseline
        try {
            const baselinePath = path.join(this.config.dataPath || '.', 'performance-baseline.json');
            await fs.writeFile(baselinePath, JSON.stringify(this.performanceBaseline, null, 2));
            console.log('📊 Updated performance baseline');
        } catch (error) {
            console.error('Failed to save baseline:', error);
        }
    }

    /**
     * Group executions by workflow
     */
    groupExecutionsByWorkflow() {
        const groups = new Map();

        for (const execution of this.executions.values()) {
            if (!groups.has(execution.workflowId)) {
                groups.set(execution.workflowId, []);
            }
            groups.get(execution.workflowId).push(execution);
        }

        return groups;
    }

    /**
     * Clean up old data
     */
    cleanupOldData() {
        const cutoff = Date.now() - this.config.retentionPeriod;

        // Clean executions
        for (const [id, execution] of this.executions.entries()) {
            if (execution.endTime && execution.endTime.getTime() < cutoff) {
                this.executions.delete(id);
            }
        }

        // Clean alerts
        for (const [key, alert] of this.alerts.entries()) {
            if (alert.timestamp < cutoff) {
                this.alerts.delete(key);
            }
        }
    }

    /**
     * Get monitoring report
     */
    getReport() {
        const report = {
            summary: {
                monitoringStarted: this.startTime,
                totalExecutions: this.metrics.totalExecutions,
                successRate: this.metrics.totalExecutions > 0 
                    ? Math.round((this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100) + '%'
                    : 'N/A',
                averageExecutionTime: Math.round(this.metrics.averageExecutionTime) + 'ms',
                activeExecutions: Array.from(this.executions.values())
                    .filter(e => e.status === 'running').length
            },
            performance: {
                slowestWorkflows: this.getSlowestWorkflows(10),
                fastestWorkflows: this.getFastestWorkflows(10),
                performanceTrends: this.getPerformanceTrends()
            },
            reliability: {
                errorRate: Math.round((this.metrics.failedExecutions / this.metrics.totalExecutions) * 100) + '%',
                commonErrors: Array.from(this.metrics.errorTypes.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10),
                unreliableWorkflows: this.getUnreliableWorkflows(10)
            },
            alerts: {
                active: Array.from(this.alerts.values()).filter(a => !a.resolved),
                recent: Array.from(this.alerts.values())
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 20)
            },
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    /**
     * Get slowest workflows
     */
    getSlowestWorkflows(limit) {
        const workflowStats = new Map();

        for (const execution of this.executions.values()) {
            if (execution.status !== 'completed') continue;

            if (!workflowStats.has(execution.workflowId)) {
                workflowStats.set(execution.workflowId, {
                    workflowId: execution.workflowId,
                    workflowName: execution.workflowName,
                    executions: 0,
                    totalTime: 0,
                    averageTime: 0
                });
            }

            const stats = workflowStats.get(execution.workflowId);
            stats.executions++;
            stats.totalTime += execution.duration;
            stats.averageTime = stats.totalTime / stats.executions;
        }

        return Array.from(workflowStats.values())
            .sort((a, b) => b.averageTime - a.averageTime)
            .slice(0, limit);
    }

    /**
     * Get fastest workflows
     */
    getFastestWorkflows(limit) {
        const workflows = this.getSlowestWorkflows(1000); // Get all
        return workflows.reverse().slice(0, limit);
    }

    /**
     * Get performance trends
     */
    getPerformanceTrends() {
        const hourlyBuckets = new Map();
        const now = Date.now();

        for (const point of this.metrics.performanceHistory) {
            const hourBucket = Math.floor(point.timestamp.getTime() / 3600000);
            
            if (!hourlyBuckets.has(hourBucket)) {
                hourlyBuckets.set(hourBucket, {
                    timestamp: new Date(hourBucket * 3600000),
                    executions: 0,
                    totalTime: 0,
                    failures: 0
                });
            }

            const bucket = hourlyBuckets.get(hourBucket);
            bucket.executions++;
            bucket.totalTime += point.executionTime;
            if (!point.success) bucket.failures++;
        }

        return Array.from(hourlyBuckets.values())
            .map(bucket => ({
                timestamp: bucket.timestamp,
                averageTime: bucket.executions > 0 ? bucket.totalTime / bucket.executions : 0,
                executionCount: bucket.executions,
                errorRate: bucket.executions > 0 ? bucket.failures / bucket.executions : 0
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Get unreliable workflows
     */
    getUnreliableWorkflows(limit) {
        const workflowStats = new Map();

        for (const execution of this.executions.values()) {
            if (!workflowStats.has(execution.workflowId)) {
                workflowStats.set(execution.workflowId, {
                    workflowId: execution.workflowId,
                    workflowName: execution.workflowName,
                    executions: 0,
                    failures: 0,
                    errorRate: 0
                });
            }

            const stats = workflowStats.get(execution.workflowId);
            stats.executions++;
            if (execution.status === 'failed') {
                stats.failures++;
            }
            stats.errorRate = stats.failures / stats.executions;
        }

        return Array.from(workflowStats.values())
            .filter(stats => stats.failures > 0)
            .sort((a, b) => b.errorRate - a.errorRate)
            .slice(0, limit);
    }

    /**
     * Generate recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        // High error rate recommendation
        const errorRate = this.metrics.failedExecutions / this.metrics.totalExecutions;
        if (errorRate > 0.1) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                message: `High error rate detected (${Math.round(errorRate * 100)}%). Review error logs and common failure patterns.`,
                action: 'Review and fix error-prone workflows'
            });
        }

        // Slow workflow recommendation
        const slowWorkflows = this.getSlowestWorkflows(5);
        if (slowWorkflows.length > 0 && slowWorkflows[0].averageTime > 60000) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                message: `Some workflows are running slowly. Consider optimizing workflows that take over 1 minute.`,
                action: 'Optimize slow workflows',
                details: slowWorkflows
            });
        }

        // Memory usage recommendation
        const memUsage = process.memoryUsage();
        const memPercent = memUsage.heapUsed / memUsage.heapTotal;
        if (memPercent > 0.7) {
            recommendations.push({
                type: 'resources',
                priority: 'high',
                message: `High memory usage detected (${Math.round(memPercent * 100)}%). Consider scaling or optimizing memory-intensive workflows.`,
                action: 'Reduce memory usage'
            });
        }

        // Node-specific recommendations
        const errorProneNodes = this.getErrorProneNodes(3);
        if (errorProneNodes.length > 0 && errorProneNodes[0].failures > 5) {
            recommendations.push({
                type: 'reliability',
                priority: 'medium',
                message: 'Some nodes are failing frequently. Review and fix problematic nodes.',
                action: 'Fix error-prone nodes',
                details: errorProneNodes
            });
        }

        return recommendations;
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;

        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }

        this.isMonitoring = false;
        this.emit('monitoring-stopped');
        
        console.log('📊 Execution monitoring stopped');
    }

    /**
     * Export metrics data
     */
    async exportMetrics(format = 'json') {
        const data = {
            exportDate: new Date(),
            metrics: this.metrics,
            executions: Array.from(this.executions.values()),
            alerts: Array.from(this.alerts.values()),
            report: this.getReport()
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            // Convert to CSV format
            return this.convertToCSV(data);
        }

        return data;
    }

    /**
     * Convert metrics to CSV
     */
    convertToCSV(data) {
        // Simplified CSV conversion
        const rows = [
            ['Metric', 'Value'],
            ['Total Executions', data.metrics.totalExecutions],
            ['Successful', data.metrics.successfulExecutions],
            ['Failed', data.metrics.failedExecutions],
            ['Average Time', data.metrics.averageExecutionTime],
            ['Export Date', data.exportDate]
        ];

        return rows.map(row => row.join(',')).join('\n');
    }
}

module.exports = ExecutionMonitor;