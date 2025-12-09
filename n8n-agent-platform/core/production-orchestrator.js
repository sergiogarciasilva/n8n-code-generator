/**
 * Production Orchestrator - Complete production-ready system
 * Orchestrates all components with enterprise features
 */

const EventEmitter = require('events');
const cluster = require('cluster');
const os = require('os');

// Core components
const WorkflowSolver = require('./workflow-solver');
const N8nRuntimeClient = require('./integration/n8n-runtime-client');
const CredentialVault = require('./security/credential-vault');
const ServiceConnectorFactory = require('./connectors/service-connector-factory');
const ProductionMonitor = require('./monitoring/production-monitor');

// Queue and state management
const Bull = require('bull');
const Redis = require('ioredis');

class ProductionOrchestrator extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Clustering
            cluster: {
                enabled: config.cluster?.enabled !== false,
                workers: config.cluster?.workers || os.cpus().length,
                ...config.cluster
            },
            
            // Redis configuration
            redis: {
                host: config.redis?.host || 'localhost',
                port: config.redis?.port || 6379,
                password: config.redis?.password,
                db: config.redis?.db || 0,
                ...config.redis
            },
            
            // Queue configuration
            queues: {
                workflow: 'workflow-execution',
                debug: 'workflow-debug',
                optimization: 'workflow-optimization',
                ...config.queues
            },
            
            // Scaling
            scaling: {
                minWorkers: config.scaling?.minWorkers || 1,
                maxWorkers: config.scaling?.maxWorkers || 10,
                scaleUpThreshold: config.scaling?.scaleUpThreshold || 0.8,
                scaleDownThreshold: config.scaling?.scaleDownThreshold || 0.2,
                ...config.scaling
            },
            
            // High availability
            ha: {
                enabled: config.ha?.enabled !== false,
                heartbeatInterval: config.ha?.heartbeatInterval || 5000,
                failoverTimeout: config.ha?.failoverTimeout || 30000,
                ...config.ha
            },
            
            // Security
            security: {
                vaultPassword: config.security?.vaultPassword || process.env.VAULT_PASSWORD,
                tlsEnabled: config.security?.tlsEnabled !== false,
                certificates: config.security?.certificates,
                ...config.security
            },
            
            // Monitoring
            monitoring: {
                serviceName: 'n8n-agent-platform-production',
                ...config.monitoring
            },
            
            ...config
        };

        // Core components
        this.monitor = null;
        this.vault = null;
        this.connectorFactory = null;
        this.n8nClient = null;
        this.solver = null;
        
        // Infrastructure
        this.redis = null;
        this.queues = new Map();
        this.workers = new Map();
        
        // State
        this.isMaster = cluster.isMaster || cluster.isPrimary;
        this.isLeader = false;
        this.isInitialized = false;
        this.shutdownInProgress = false;
    }

    /**
     * Initialize production system
     */
    async initialize() {
        console.log('🚀 Initializing Production Orchestrator...');
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Mode: ${this.isMaster ? 'Master' : 'Worker'}`);

        try {
            if (this.isMaster && this.config.cluster.enabled) {
                await this.initializeMaster();
            } else {
                await this.initializeWorker();
            }

            this.isInitialized = true;
            console.log('✅ Production Orchestrator initialized');

        } catch (error) {
            console.error('❌ Failed to initialize Production Orchestrator:', error);
            throw error;
        }
    }

    /**
     * Initialize master process
     */
    async initializeMaster() {
        console.log('👑 Initializing master process...');

        // Setup monitoring first
        await this.setupMonitoring();

        // Setup Redis connection
        await this.setupRedis();

        // Setup high availability
        if (this.config.ha.enabled) {
            await this.setupHighAvailability();
        }

        // Fork workers
        this.forkWorkers();

        // Setup cluster management
        this.setupClusterManagement();

        // Setup auto-scaling
        if (this.config.scaling) {
            this.setupAutoScaling();
        }

        // Setup graceful shutdown
        this.setupGracefulShutdown();

        this.monitor.log('info', 'Master process initialized', {
            workers: this.config.cluster.workers,
            pid: process.pid
        });
    }

    /**
     * Initialize worker process
     */
    async initializeWorker() {
        console.log(`👷 Initializing worker process ${process.pid}...`);

        // Setup monitoring
        await this.setupMonitoring();

        // Setup Redis connection
        await this.setupRedis();

        // Setup credential vault
        await this.setupCredentialVault();

        // Setup service connectors
        await this.setupServiceConnectors();

        // Setup n8n client
        await this.setupN8nClient();

        // Setup workflow solver
        await this.setupWorkflowSolver();

        // Setup job queues
        await this.setupJobQueues();

        // Setup API server
        await this.setupAPIServer();

        this.monitor.log('info', 'Worker process initialized', {
            pid: process.pid,
            workerId: cluster.worker?.id
        });
    }

    /**
     * Setup monitoring
     */
    async setupMonitoring() {
        this.monitor = new ProductionMonitor({
            ...this.config.monitoring,
            healthChecks: [
                {
                    name: 'redis',
                    fn: async () => this.checkRedisHealth()
                },
                {
                    name: 'n8n',
                    fn: async () => this.checkN8nHealth()
                },
                {
                    name: 'memory',
                    fn: async () => this.checkMemoryHealth()
                }
            ]
        });

        await this.monitor.initialize();
    }

    /**
     * Setup Redis connection
     */
    async setupRedis() {
        this.redis = new Redis({
            ...this.config.redis,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                this.monitor.log('warn', `Redis connection retry ${times}`, { delay });
                return delay;
            }
        });

        this.redis.on('connect', () => {
            this.monitor.log('info', 'Redis connected');
        });

        this.redis.on('error', (error) => {
            this.monitor.trackError(error, { component: 'redis' });
        });

        // Test connection
        await this.redis.ping();
    }

    /**
     * Setup credential vault
     */
    async setupCredentialVault() {
        if (!this.config.security.vaultPassword) {
            throw new Error('Vault password not configured');
        }

        this.vault = new CredentialVault({
            useSystemKeychain: true,
            serviceName: this.config.monitoring.serviceName
        });

        await this.vault.initialize(this.config.security.vaultPassword);
        
        this.monitor.log('info', 'Credential vault initialized');
    }

    /**
     * Setup service connectors
     */
    async setupServiceConnectors() {
        this.connectorFactory = new ServiceConnectorFactory({
            credentialVault: this.vault,
            monitoring: true
        });

        // Setup monitoring for connectors
        this.connectorFactory.on('api-call', (data) => {
            this.monitor.trackMetric('apiCalls', 1, {
                service: data.type,
                method: data.method,
                status: data.success ? 'success' : 'error'
            });
        });

        this.connectorFactory.on('rate-limit', (data) => {
            this.monitor.log('warn', 'Service rate limit hit', data);
        });

        this.monitor.log('info', 'Service connectors initialized');
    }

    /**
     * Setup n8n client
     */
    async setupN8nClient() {
        this.n8nClient = new N8nRuntimeClient({
            n8nBaseUrl: this.config.n8n?.baseUrl || 'http://localhost:5678',
            n8nApiKey: this.config.n8n?.apiKey,
            useDocker: this.config.n8n?.useDocker
        });

        await this.n8nClient.initialize();

        // Setup monitoring
        this.n8nClient.on('execution-started', (data) => {
            this.monitor.trackMetric('workflowExecutions', 1, {
                status: 'started',
                workflow_id: data.workflowId
            });
        });

        this.n8nClient.on('execution-finished', (data) => {
            this.monitor.trackMetric('workflowExecutions', 1, {
                status: 'finished',
                workflow_id: data.workflowId
            });
            
            this.monitor.trackMetric('workflowDuration', data.duration, {
                workflow_id: data.workflowId
            });
        });

        this.monitor.log('info', 'n8n client initialized');
    }

    /**
     * Setup workflow solver
     */
    async setupWorkflowSolver() {
        this.solver = new WorkflowSolver({
            openaiApiKey: this.config.openai?.apiKey || process.env.OPENAI_API_KEY,
            n8nPath: this.config.n8n?.path,
            autoDebug: true,
            autoOptimize: true
        });

        await this.solver.initialize();

        // Setup monitoring
        this.solver.on('solution-completed', (solution) => {
            this.monitor.trackMetric('workflowSolutions', 1, {
                status: 'completed'
            });
        });

        this.solver.on('solution-failed', (solution) => {
            this.monitor.trackMetric('workflowSolutions', 1, {
                status: 'failed'
            });
        });

        this.monitor.log('info', 'Workflow solver initialized');
    }

    /**
     * Setup job queues
     */
    async setupJobQueues() {
        // Workflow execution queue
        const workflowQueue = new Bull(this.config.queues.workflow, {
            redis: this.config.redis
        });

        workflowQueue.process(this.config.cluster.workers, async (job) => {
            return await this.processWorkflowJob(job);
        });

        this.queues.set('workflow', workflowQueue);

        // Debug queue
        const debugQueue = new Bull(this.config.queues.debug, {
            redis: this.config.redis
        });

        debugQueue.process(async (job) => {
            return await this.processDebugJob(job);
        });

        this.queues.set('debug', debugQueue);

        // Setup queue monitoring
        for (const [name, queue] of this.queues.entries()) {
            queue.on('completed', (job) => {
                this.monitor.trackMetric('jobsCompleted', 1, {
                    queue: name
                });
            });

            queue.on('failed', (job, error) => {
                this.monitor.trackError(error, {
                    queue: name,
                    jobId: job.id
                });
            });

            // Track queue sizes
            setInterval(async () => {
                const waiting = await queue.getWaitingCount();
                const active = await queue.getActiveCount();
                
                this.monitor.trackMetric('queueSize', waiting + active, {
                    queue_name: name
                });
            }, 10000);
        }

        this.monitor.log('info', 'Job queues initialized');
    }

    /**
     * Process workflow job
     */
    async processWorkflowJob(job) {
        const span = this.monitor.createSpan('process_workflow_job', {
            attributes: {
                'job.id': job.id,
                'job.type': 'workflow'
            }
        });

        try {
            const { description, requirements } = job.data;
            
            // Solve workflow
            const result = await this.solver.solve(description, requirements);
            
            if (result.success) {
                // Deploy to n8n
                const workflow = await this.n8nClient.createWorkflow(result.workflow);
                
                return {
                    success: true,
                    workflowId: workflow.id,
                    solutionId: result.solutionId
                };
            }

            return result;

        } finally {
            if (span) span.end();
        }
    }

    /**
     * Process debug job
     */
    async processDebugJob(job) {
        const span = this.monitor.createSpan('process_debug_job', {
            attributes: {
                'job.id': job.id,
                'job.type': 'debug'
            }
        });

        try {
            const { workflowId, errorInfo } = job.data;
            
            // Get workflow
            const workflow = await this.n8nClient.getWorkflow(workflowId);
            
            // Debug using solver's debug agent
            const debugResult = await this.solver.debugAgent.analyzeError(errorInfo);
            
            return {
                success: true,
                analysis: debugResult,
                workflowId
            };

        } finally {
            if (span) span.end();
        }
    }

    /**
     * Setup API server
     */
    async setupAPIServer() {
        const express = require('express');
        const app = express();
        
        app.use(express.json());

        // Health endpoint
        app.get('/health', (req, res) => {
            const health = this.monitor.getHealthStatus();
            res.status(health.healthy ? 200 : 503).json(health);
        });

        // Metrics endpoint
        app.get('/metrics', async (req, res) => {
            const metrics = await this.monitor.getMetrics();
            res.set('Content-Type', 'text/plain');
            res.send(metrics);
        });

        // Create workflow endpoint
        app.post('/api/workflows/solve', async (req, res) => {
            try {
                const job = await this.queues.get('workflow').add(req.body);
                res.json({ jobId: job.id });
            } catch (error) {
                this.monitor.trackError(error);
                res.status(500).json({ error: error.message });
            }
        });

        // Execute workflow endpoint
        app.post('/api/workflows/:id/execute', async (req, res) => {
            try {
                const result = await this.n8nClient.executeWorkflow(
                    req.params.id,
                    req.body
                );
                res.json(result);
            } catch (error) {
                this.monitor.trackError(error);
                res.status(500).json({ error: error.message });
            }
        });

        const port = 3000 + (cluster.worker?.id || 0);
        app.listen(port, () => {
            this.monitor.log('info', `API server listening on port ${port}`);
        });
    }

    /**
     * Fork worker processes
     */
    forkWorkers() {
        for (let i = 0; i < this.config.cluster.workers; i++) {
            this.forkWorker();
        }
    }

    /**
     * Fork single worker
     */
    forkWorker() {
        const worker = cluster.fork();
        this.workers.set(worker.id, {
            id: worker.id,
            pid: worker.process.pid,
            startTime: Date.now()
        });

        this.monitor.log('info', `Worker ${worker.id} forked`, {
            pid: worker.process.pid
        });
    }

    /**
     * Setup cluster management
     */
    setupClusterManagement() {
        cluster.on('exit', (worker, code, signal) => {
            this.monitor.log('warn', `Worker ${worker.id} died`, {
                code,
                signal,
                pid: worker.process.pid
            });

            this.workers.delete(worker.id);

            // Restart worker if not shutting down
            if (!this.shutdownInProgress) {
                this.monitor.log('info', 'Restarting worker...');
                this.forkWorker();
            }
        });

        cluster.on('message', (worker, message) => {
            this.handleWorkerMessage(worker, message);
        });
    }

    /**
     * Setup auto-scaling
     */
    setupAutoScaling() {
        setInterval(async () => {
            if (this.shutdownInProgress) return;

            const metrics = await this.getClusterMetrics();
            
            // Scale up
            if (metrics.cpuUsage > this.config.scaling.scaleUpThreshold &&
                this.workers.size < this.config.scaling.maxWorkers) {
                
                this.monitor.log('info', 'Scaling up', { currentWorkers: this.workers.size });
                this.forkWorker();
            }
            
            // Scale down
            if (metrics.cpuUsage < this.config.scaling.scaleDownThreshold &&
                this.workers.size > this.config.scaling.minWorkers) {
                
                this.monitor.log('info', 'Scaling down', { currentWorkers: this.workers.size });
                const worker = Array.from(this.workers.values()).pop();
                if (worker) {
                    cluster.workers[worker.id].kill();
                }
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Setup high availability
     */
    async setupHighAvailability() {
        const acquireLock = async () => {
            const result = await this.redis.set(
                'orchestrator:leader',
                process.pid,
                'PX',
                this.config.ha.heartbeatInterval * 2,
                'NX'
            );
            
            return result === 'OK';
        };

        const renewLock = async () => {
            if (!this.isLeader) return;

            const result = await this.redis.set(
                'orchestrator:leader',
                process.pid,
                'PX',
                this.config.ha.heartbeatInterval * 2,
                'XX'
            );

            if (result !== 'OK') {
                this.isLeader = false;
                this.monitor.log('warn', 'Lost leader status');
            }
        };

        // Try to become leader
        this.isLeader = await acquireLock();
        
        if (this.isLeader) {
            this.monitor.log('info', 'Acquired leader status');
        }

        // Heartbeat
        setInterval(async () => {
            if (this.isLeader) {
                await renewLock();
            } else {
                // Try to acquire leadership
                this.isLeader = await acquireLock();
                if (this.isLeader) {
                    this.monitor.log('info', 'Acquired leader status');
                }
            }
        }, this.config.ha.heartbeatInterval);
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            if (this.shutdownInProgress) return;
            
            this.shutdownInProgress = true;
            this.monitor.log('info', `Received ${signal}, starting graceful shutdown`);

            // Stop accepting new jobs
            for (const queue of this.queues.values()) {
                await queue.pause();
            }

            // Wait for workers to finish
            const timeout = setTimeout(() => {
                this.monitor.log('warn', 'Shutdown timeout, forcing exit');
                process.exit(1);
            }, 30000);

            // Disconnect workers
            for (const worker of Object.values(cluster.workers)) {
                worker.disconnect();
            }

            // Wait for workers to exit
            await new Promise(resolve => {
                const checkWorkers = setInterval(() => {
                    if (this.workers.size === 0) {
                        clearInterval(checkWorkers);
                        resolve();
                    }
                }, 100);
            });

            clearTimeout(timeout);

            // Cleanup
            await this.cleanup();
            
            this.monitor.log('info', 'Graceful shutdown complete');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        // Close queues
        for (const queue of this.queues.values()) {
            await queue.close();
        }

        // Disconnect services
        if (this.n8nClient) {
            await this.n8nClient.disconnect();
        }

        if (this.connectorFactory) {
            await this.connectorFactory.shutdown();
        }

        // Close Redis
        if (this.redis) {
            await this.redis.quit();
        }

        // Shutdown monitoring
        if (this.monitor) {
            await this.monitor.shutdown();
        }
    }

    /**
     * Handle worker messages
     */
    handleWorkerMessage(worker, message) {
        if (message.type === 'metrics') {
            // Aggregate worker metrics
            this.updateWorkerMetrics(worker.id, message.data);
        }
    }

    /**
     * Get cluster metrics
     */
    async getClusterMetrics() {
        let totalCpu = 0;
        let totalMemory = 0;

        for (const worker of this.workers.values()) {
            // Get metrics from Redis (workers publish their metrics)
            const metrics = await this.redis.get(`worker:${worker.id}:metrics`);
            if (metrics) {
                const parsed = JSON.parse(metrics);
                totalCpu += parsed.cpu || 0;
                totalMemory += parsed.memory || 0;
            }
        }

        return {
            cpuUsage: totalCpu / this.workers.size,
            memoryUsage: totalMemory / this.workers.size,
            workerCount: this.workers.size
        };
    }

    /**
     * Check Redis health
     */
    async checkRedisHealth() {
        try {
            await this.redis.ping();
            return { healthy: true, message: 'Redis is healthy' };
        } catch (error) {
            return { healthy: false, message: error.message };
        }
    }

    /**
     * Check n8n health
     */
    async checkN8nHealth() {
        try {
            if (!this.n8nClient) {
                return { healthy: true, message: 'n8n client not initialized (master process)' };
            }
            
            const status = this.n8nClient.getStatus();
            return {
                healthy: status.connected,
                message: status.connected ? 'n8n is healthy' : 'n8n disconnected'
            };
        } catch (error) {
            return { healthy: false, message: error.message };
        }
    }

    /**
     * Check memory health
     */
    async checkMemoryHealth() {
        const usage = process.memoryUsage();
        const heapUsedPercent = usage.heapUsed / usage.heapTotal;
        
        return {
            healthy: heapUsedPercent < 0.9,
            message: `Heap usage: ${Math.round(heapUsedPercent * 100)}%`
        };
    }

    /**
     * Get orchestrator status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            isMaster: this.isMaster,
            isLeader: this.isLeader,
            workers: this.workers.size,
            uptime: Date.now() - this.monitor?.startTime || 0,
            shutdownInProgress: this.shutdownInProgress
        };
    }
}

module.exports = ProductionOrchestrator;