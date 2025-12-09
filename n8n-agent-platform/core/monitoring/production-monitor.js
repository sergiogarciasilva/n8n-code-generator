/**
 * Production Monitor - Enterprise-grade monitoring and observability
 * Integrates with APM, logging, and metrics platforms
 */

const EventEmitter = require('events');
const winston = require('winston');
const promClient = require('prom-client');
const StatsD = require('node-statsd');
const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

class ProductionMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            serviceName: config.serviceName || 'n8n-agent-platform',
            environment: config.environment || process.env.NODE_ENV || 'development',
            
            // Logging
            logging: {
                level: config.logging?.level || 'info',
                console: config.logging?.console !== false,
                file: config.logging?.file,
                elasticsearch: config.logging?.elasticsearch,
                ...config.logging
            },
            
            // Metrics
            metrics: {
                prometheus: config.metrics?.prometheus !== false,
                statsd: config.metrics?.statsd,
                customMetrics: config.metrics?.customMetrics || [],
                ...config.metrics
            },
            
            // Tracing
            tracing: {
                enabled: config.tracing?.enabled !== false,
                jaeger: config.tracing?.jaeger,
                zipkin: config.tracing?.zipkin,
                samplingRate: config.tracing?.samplingRate || 0.1,
                ...config.tracing
            },
            
            // APM
            apm: {
                datadog: config.apm?.datadog,
                newrelic: config.apm?.newrelic,
                elastic: config.apm?.elastic,
                ...config.apm
            },
            
            // Error tracking
            errorTracking: {
                sentry: config.errorTracking?.sentry,
                rollbar: config.errorTracking?.rollbar,
                ...config.errorTracking
            },
            
            // Health checks
            healthChecks: config.healthChecks || [],
            
            ...config
        };

        // Components
        this.logger = null;
        this.metricsRegistry = null;
        this.statsdClient = null;
        this.tracer = null;
        this.apmAgents = new Map();
        this.errorTrackers = new Map();
        
        // State
        this.isInitialized = false;
        this.startTime = Date.now();
        this.healthStatus = { healthy: true, checks: {} };
    }

    /**
     * Initialize monitoring system
     */
    async initialize() {
        console.log('📊 Initializing Production Monitor...');
        
        try {
            // Setup logging
            await this.setupLogging();
            
            // Setup metrics
            await this.setupMetrics();
            
            // Setup tracing
            await this.setupTracing();
            
            // Setup APM
            await this.setupAPM();
            
            // Setup error tracking
            await this.setupErrorTracking();
            
            // Start health checks
            this.startHealthChecks();
            
            // Setup process monitoring
            this.setupProcessMonitoring();
            
            this.isInitialized = true;
            this.logger.info('Production Monitor initialized', {
                environment: this.config.environment,
                serviceName: this.config.serviceName
            });
            
        } catch (error) {
            console.error('Failed to initialize Production Monitor:', error);
            throw error;
        }
    }

    /**
     * Setup logging system
     */
    async setupLogging() {
        const transports = [];

        // Console transport
        if (this.config.logging.console) {
            transports.push(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.colorize(),
                    winston.format.printf(({ timestamp, level, message, ...meta }) => {
                        return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
                    })
                )
            }));
        }

        // File transport
        if (this.config.logging.file) {
            transports.push(new winston.transports.File({
                filename: this.config.logging.file,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                )
            }));
        }

        // Elasticsearch transport
        if (this.config.logging.elasticsearch) {
            const ElasticsearchTransport = require('winston-elasticsearch');
            transports.push(new ElasticsearchTransport({
                clientOpts: this.config.logging.elasticsearch,
                index: `${this.config.serviceName}-logs`,
                level: this.config.logging.level
            }));
        }

        this.logger = winston.createLogger({
            level: this.config.logging.level,
            defaultMeta: {
                service: this.config.serviceName,
                environment: this.config.environment
            },
            transports
        });

        // Capture unhandled errors
        this.logger.exceptions.handle(
            new winston.transports.File({ filename: 'exceptions.log' })
        );

        this.logger.rejections.handle(
            new winston.transports.File({ filename: 'rejections.log' })
        );
    }

    /**
     * Setup metrics collection
     */
    async setupMetrics() {
        // Prometheus metrics
        if (this.config.metrics.prometheus) {
            this.metricsRegistry = new promClient.Registry();
            
            // Add default labels
            this.metricsRegistry.setDefaultLabels({
                service: this.config.serviceName,
                environment: this.config.environment
            });

            // Collect default metrics
            promClient.collectDefaultMetrics({ register: this.metricsRegistry });

            // Setup custom metrics
            this.setupCustomMetrics();
        }

        // StatsD client
        if (this.config.metrics.statsd) {
            this.statsdClient = new StatsD({
                host: this.config.metrics.statsd.host,
                port: this.config.metrics.statsd.port,
                prefix: `${this.config.serviceName}.`,
                globalTags: {
                    env: this.config.environment
                }
            });

            this.statsdClient.socket.on('error', (error) => {
                this.logger.error('StatsD error:', error);
            });
        }
    }

    /**
     * Setup custom metrics
     */
    setupCustomMetrics() {
        // Workflow metrics
        this.metrics = {
            workflowExecutions: new promClient.Counter({
                name: 'workflow_executions_total',
                help: 'Total number of workflow executions',
                labelNames: ['status', 'workflow_id']
            }),
            
            workflowDuration: new promClient.Histogram({
                name: 'workflow_execution_duration_seconds',
                help: 'Workflow execution duration in seconds',
                labelNames: ['workflow_id'],
                buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
            }),
            
            nodeExecutions: new promClient.Counter({
                name: 'node_executions_total',
                help: 'Total number of node executions',
                labelNames: ['node_type', 'status']
            }),
            
            apiCalls: new promClient.Counter({
                name: 'external_api_calls_total',
                help: 'Total number of external API calls',
                labelNames: ['service', 'method', 'status']
            }),
            
            errorRate: new promClient.Gauge({
                name: 'error_rate',
                help: 'Current error rate',
                labelNames: ['error_type']
            }),
            
            activeConnections: new promClient.Gauge({
                name: 'active_connections',
                help: 'Number of active connections',
                labelNames: ['connection_type']
            }),
            
            queueSize: new promClient.Gauge({
                name: 'queue_size',
                help: 'Current queue size',
                labelNames: ['queue_name']
            })
        };

        // Register all metrics
        for (const metric of Object.values(this.metrics)) {
            this.metricsRegistry.registerMetric(metric);
        }
    }

    /**
     * Setup distributed tracing
     */
    async setupTracing() {
        if (!this.config.tracing.enabled) return;

        const resource = Resource.default().merge(
            new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
                [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
            })
        );

        const provider = new NodeTracerProvider({ resource });

        // Add exporters based on configuration
        if (this.config.tracing.jaeger) {
            const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
            const exporter = new JaegerExporter({
                endpoint: this.config.tracing.jaeger.endpoint,
                serviceName: this.config.serviceName
            });
            
            const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
            provider.addSpanProcessor(new BatchSpanProcessor(exporter));
        }

        if (this.config.tracing.zipkin) {
            const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
            const exporter = new ZipkinExporter({
                url: this.config.tracing.zipkin.url,
                serviceName: this.config.serviceName
            });
            
            const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
            provider.addSpanProcessor(new BatchSpanProcessor(exporter));
        }

        provider.register();
        this.tracer = opentelemetry.trace.getTracer(this.config.serviceName);
    }

    /**
     * Setup APM agents
     */
    async setupAPM() {
        // DataDog APM
        if (this.config.apm.datadog) {
            const tracer = require('dd-trace').init({
                service: this.config.serviceName,
                env: this.config.environment,
                ...this.config.apm.datadog
            });
            
            this.apmAgents.set('datadog', tracer);
        }

        // New Relic APM
        if (this.config.apm.newrelic) {
            process.env.NEW_RELIC_APP_NAME = this.config.serviceName;
            process.env.NEW_RELIC_LICENSE_KEY = this.config.apm.newrelic.licenseKey;
            
            const newrelic = require('newrelic');
            this.apmAgents.set('newrelic', newrelic);
        }

        // Elastic APM
        if (this.config.apm.elastic) {
            const apm = require('elastic-apm-node').start({
                serviceName: this.config.serviceName,
                environment: this.config.environment,
                ...this.config.apm.elastic
            });
            
            this.apmAgents.set('elastic', apm);
        }
    }

    /**
     * Setup error tracking
     */
    async setupErrorTracking() {
        // Sentry
        if (this.config.errorTracking.sentry) {
            const Sentry = require('@sentry/node');
            const { ProfilingIntegration } = require('@sentry/profiling-node');
            
            Sentry.init({
                dsn: this.config.errorTracking.sentry.dsn,
                environment: this.config.environment,
                integrations: [
                    new ProfilingIntegration()
                ],
                tracesSampleRate: this.config.tracing.samplingRate,
                profilesSampleRate: 1.0,
                ...this.config.errorTracking.sentry
            });
            
            this.errorTrackers.set('sentry', Sentry);
        }

        // Rollbar
        if (this.config.errorTracking.rollbar) {
            const Rollbar = require('rollbar');
            const rollbar = new Rollbar({
                accessToken: this.config.errorTracking.rollbar.accessToken,
                captureUncaught: true,
                captureUnhandledRejections: true,
                environment: this.config.environment,
                ...this.config.errorTracking.rollbar
            });
            
            this.errorTrackers.set('rollbar', rollbar);
        }
    }

    /**
     * Setup process monitoring
     */
    setupProcessMonitoring() {
        // Memory usage monitoring
        setInterval(() => {
            const memUsage = process.memoryUsage();
            
            if (this.metricsRegistry) {
                const memoryGauge = this.metricsRegistry.getSingleMetric('process_memory_bytes') ||
                    new promClient.Gauge({
                        name: 'process_memory_bytes',
                        help: 'Process memory usage in bytes',
                        labelNames: ['type']
                    });
                
                memoryGauge.set({ type: 'rss' }, memUsage.rss);
                memoryGauge.set({ type: 'heapTotal' }, memUsage.heapTotal);
                memoryGauge.set({ type: 'heapUsed' }, memUsage.heapUsed);
                memoryGauge.set({ type: 'external' }, memUsage.external);
            }

            if (this.statsdClient) {
                this.statsdClient.gauge('memory.rss', memUsage.rss);
                this.statsdClient.gauge('memory.heap_total', memUsage.heapTotal);
                this.statsdClient.gauge('memory.heap_used', memUsage.heapUsed);
            }
        }, 10000); // Every 10 seconds

        // CPU usage monitoring
        let lastCpuUsage = process.cpuUsage();
        setInterval(() => {
            const currentCpuUsage = process.cpuUsage(lastCpuUsage);
            const totalCpuTime = (currentCpuUsage.user + currentCpuUsage.system) / 1000000; // Convert to seconds
            
            if (this.statsdClient) {
                this.statsdClient.gauge('cpu.usage', totalCpuTime);
            }
            
            lastCpuUsage = process.cpuUsage();
        }, 10000);

        // Event loop lag monitoring
        let lastCheck = Date.now();
        setInterval(() => {
            const now = Date.now();
            const lag = now - lastCheck - 1000; // Expected 1 second interval
            
            if (lag > 100) { // More than 100ms lag
                this.logger.warn('Event loop lag detected', { lag });
            }
            
            if (this.statsdClient) {
                this.statsdClient.gauge('event_loop.lag', Math.max(0, lag));
            }
            
            lastCheck = now;
        }, 1000);

        // Handle process events
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception', { error: error.stack });
            this.trackError(error);
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled rejection', { reason, promise });
            this.trackError(new Error(`Unhandled rejection: ${reason}`));
        });
    }

    /**
     * Start health checks
     */
    startHealthChecks() {
        // Run health checks periodically
        setInterval(async () => {
            await this.runHealthChecks();
        }, 30000); // Every 30 seconds

        // Run initial health check
        this.runHealthChecks();
    }

    /**
     * Run all health checks
     */
    async runHealthChecks() {
        const results = {};
        let healthy = true;

        for (const check of this.config.healthChecks) {
            try {
                const result = await check.fn();
                results[check.name] = {
                    status: result.healthy ? 'healthy' : 'unhealthy',
                    message: result.message,
                    lastCheck: new Date().toISOString()
                };
                
                if (!result.healthy) {
                    healthy = false;
                    this.logger.warn(`Health check failed: ${check.name}`, result);
                }
            } catch (error) {
                results[check.name] = {
                    status: 'error',
                    error: error.message,
                    lastCheck: new Date().toISOString()
                };
                healthy = false;
                this.logger.error(`Health check error: ${check.name}`, { error: error.stack });
            }
        }

        this.healthStatus = {
            healthy,
            checks: results,
            uptime: Date.now() - this.startTime,
            timestamp: new Date().toISOString()
        };

        // Update health metric
        if (this.metricsRegistry) {
            const healthGauge = this.metricsRegistry.getSingleMetric('service_health') ||
                new promClient.Gauge({
                    name: 'service_health',
                    help: 'Service health status (1 = healthy, 0 = unhealthy)'
                });
            
            healthGauge.set(healthy ? 1 : 0);
        }
    }

    /**
     * Log message with appropriate level
     */
    log(level, message, meta = {}) {
        if (!this.logger) {
            console.log(`[${level}] ${message}`, meta);
            return;
        }

        this.logger.log(level, message, meta);
    }

    /**
     * Track metric
     */
    trackMetric(name, value, labels = {}) {
        // Prometheus
        if (this.metrics[name]) {
            if (this.metrics[name] instanceof promClient.Counter) {
                this.metrics[name].inc(labels, value);
            } else if (this.metrics[name] instanceof promClient.Gauge) {
                this.metrics[name].set(labels, value);
            } else if (this.metrics[name] instanceof promClient.Histogram) {
                this.metrics[name].observe(labels, value);
            }
        }

        // StatsD
        if (this.statsdClient) {
            const tags = Object.entries(labels).map(([k, v]) => `${k}:${v}`);
            
            if (name.includes('duration') || name.includes('time')) {
                this.statsdClient.timing(name, value, tags);
            } else if (name.includes('count') || name.includes('total')) {
                this.statsdClient.increment(name, value, tags);
            } else {
                this.statsdClient.gauge(name, value, tags);
            }
        }

        // APM custom metrics
        if (this.apmAgents.has('datadog')) {
            const tracer = this.apmAgents.get('datadog');
            tracer.dogstatsd.gauge(name, value, tags);
        }
    }

    /**
     * Create trace span
     */
    createSpan(name, options = {}) {
        if (!this.tracer) return null;

        return this.tracer.startSpan(name, {
            attributes: {
                'service.name': this.config.serviceName,
                ...options.attributes
            }
        });
    }

    /**
     * Track error
     */
    trackError(error, context = {}) {
        // Log error
        this.logger.error(error.message, {
            error: error.stack,
            context
        });

        // Track in error tracking services
        for (const [name, tracker] of this.errorTrackers.entries()) {
            try {
                if (name === 'sentry') {
                    tracker.captureException(error, {
                        extra: context
                    });
                } else if (name === 'rollbar') {
                    tracker.error(error, context);
                }
            } catch (trackingError) {
                this.logger.error(`Error tracking failed for ${name}:`, trackingError);
            }
        }

        // Increment error metrics
        this.trackMetric('errorRate', 1, {
            error_type: error.name || 'Unknown'
        });
    }

    /**
     * Get metrics for Prometheus scraping
     */
    async getMetrics() {
        if (!this.metricsRegistry) {
            return '';
        }

        return this.metricsRegistry.metrics();
    }

    /**
     * Get health status
     */
    getHealthStatus() {
        return this.healthStatus;
    }

    /**
     * Flush all pending data
     */
    async flush() {
        const promises = [];

        // Flush APM agents
        if (this.apmAgents.has('elastic')) {
            promises.push(new Promise(resolve => {
                this.apmAgents.get('elastic').flush(() => resolve());
            }));
        }

        // Flush error trackers
        if (this.errorTrackers.has('sentry')) {
            promises.push(this.errorTrackers.get('sentry').flush());
        }

        // Flush StatsD
        if (this.statsdClient) {
            promises.push(new Promise(resolve => {
                this.statsdClient.close(() => resolve());
            }));
        }

        await Promise.all(promises);
    }

    /**
     * Shutdown monitoring
     */
    async shutdown() {
        this.logger.info('Shutting down Production Monitor');
        
        await this.flush();
        
        // Close connections
        if (this.statsdClient) {
            this.statsdClient.close();
        }

        this.emit('shutdown');
    }
}

module.exports = ProductionMonitor;