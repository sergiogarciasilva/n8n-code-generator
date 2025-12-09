/**
 * Service Connector Factory - Creates and manages real service connectors
 * Provides authenticated connections to external services
 */

const EventEmitter = require('events');

// Import service connectors
const SalesforceConnector = require('./services/salesforce-connector');
const AWSConnector = require('./services/aws-connector');
const GoogleCloudConnector = require('./services/google-cloud-connector');
const AzureConnector = require('./services/azure-connector');
const SlackConnector = require('./services/slack-connector');
const StripeConnector = require('./services/stripe-connector');
const SendGridConnector = require('./services/sendgrid-connector');
const TwilioConnector = require('./services/twilio-connector');
const GitHubConnector = require('./services/github-connector');
const JiraConnector = require('./services/jira-connector');

class ServiceConnectorFactory extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            credentialVault: config.credentialVault,
            cacheEnabled: config.cacheEnabled !== false,
            cacheTTL: config.cacheTTL || 3600000, // 1 hour
            retryConfig: {
                maxRetries: config.maxRetries || 3,
                retryDelay: config.retryDelay || 1000,
                backoffMultiplier: config.backoffMultiplier || 2
            },
            rateLimiting: config.rateLimiting !== false,
            monitoring: config.monitoring !== false,
            ...config
        };

        this.connectors = new Map();
        this.connectorTypes = new Map();
        this.connectionPool = new Map();
        this.metrics = {
            connectionsCreated: 0,
            connectionsReused: 0,
            connectionsFailed: 0,
            apiCalls: new Map()
        };

        this.registerConnectorTypes();
    }

    /**
     * Register all available connector types
     */
    registerConnectorTypes() {
        // CRM
        this.registerConnectorType('salesforce', SalesforceConnector, {
            name: 'Salesforce',
            category: 'CRM',
            authType: 'oauth2',
            description: 'Salesforce CRM integration'
        });

        // Cloud Providers
        this.registerConnectorType('aws', AWSConnector, {
            name: 'Amazon Web Services',
            category: 'Cloud',
            authType: 'accessKey',
            description: 'AWS services integration'
        });

        this.registerConnectorType('googleCloud', GoogleCloudConnector, {
            name: 'Google Cloud Platform',
            category: 'Cloud',
            authType: 'serviceAccount',
            description: 'GCP services integration'
        });

        this.registerConnectorType('azure', AzureConnector, {
            name: 'Microsoft Azure',
            category: 'Cloud',
            authType: 'oauth2',
            description: 'Azure services integration'
        });

        // Communication
        this.registerConnectorType('slack', SlackConnector, {
            name: 'Slack',
            category: 'Communication',
            authType: 'oauth2',
            description: 'Slack messaging integration'
        });

        this.registerConnectorType('sendgrid', SendGridConnector, {
            name: 'SendGrid',
            category: 'Email',
            authType: 'apiKey',
            description: 'SendGrid email service'
        });

        this.registerConnectorType('twilio', TwilioConnector, {
            name: 'Twilio',
            category: 'Communication',
            authType: 'apiKey',
            description: 'Twilio SMS/Voice integration'
        });

        // Development
        this.registerConnectorType('github', GitHubConnector, {
            name: 'GitHub',
            category: 'Development',
            authType: 'oauth2',
            description: 'GitHub repository integration'
        });

        this.registerConnectorType('jira', JiraConnector, {
            name: 'Jira',
            category: 'Project Management',
            authType: 'oauth2',
            description: 'Jira issue tracking'
        });

        // Payments
        this.registerConnectorType('stripe', StripeConnector, {
            name: 'Stripe',
            category: 'Payments',
            authType: 'apiKey',
            description: 'Stripe payment processing'
        });
    }

    /**
     * Register a connector type
     */
    registerConnectorType(type, connectorClass, metadata) {
        this.connectorTypes.set(type, {
            class: connectorClass,
            metadata
        });
        console.log(`📌 Registered connector type: ${type}`);
    }

    /**
     * Create or get connector instance
     */
    async createConnector(type, credentialId, options = {}) {
        console.log(`🔌 Creating connector: ${type} with credential: ${credentialId}`);

        // Check connection pool
        const poolKey = `${type}_${credentialId}`;
        if (this.config.cacheEnabled && this.connectionPool.has(poolKey)) {
            const pooledConnector = this.connectionPool.get(poolKey);
            if (pooledConnector.expiresAt > Date.now()) {
                console.log(`♻️ Reusing pooled connector: ${type}`);
                this.metrics.connectionsReused++;
                return pooledConnector.connector;
            }
        }

        try {
            // Get connector type
            const connectorType = this.connectorTypes.get(type);
            if (!connectorType) {
                throw new Error(`Unknown connector type: ${type}`);
            }

            // Get credentials from vault
            if (!this.config.credentialVault) {
                throw new Error('Credential vault not configured');
            }

            const credential = await this.config.credentialVault.retrieveCredential(credentialId);
            
            // Create connector instance
            const ConnectorClass = connectorType.class;
            const connector = new ConnectorClass({
                ...this.config,
                credentials: credential.data,
                ...options
            });

            // Initialize connector
            await connector.initialize();

            // Setup monitoring
            if (this.config.monitoring) {
                this.setupConnectorMonitoring(connector, type);
            }

            // Add to connection pool
            if (this.config.cacheEnabled) {
                this.connectionPool.set(poolKey, {
                    connector,
                    expiresAt: Date.now() + this.config.cacheTTL,
                    type,
                    credentialId
                });

                // Schedule cleanup
                setTimeout(() => {
                    this.cleanupPooledConnection(poolKey);
                }, this.config.cacheTTL);
            }

            this.metrics.connectionsCreated++;
            this.emit('connector-created', { type, credentialId });

            return connector;

        } catch (error) {
            console.error(`❌ Failed to create connector: ${error.message}`);
            this.metrics.connectionsFailed++;
            this.emit('connector-failed', { type, credentialId, error });
            throw error;
        }
    }

    /**
     * Setup connector monitoring
     */
    setupConnectorMonitoring(connector, type) {
        // Monitor API calls
        connector.on('api-call', (data) => {
            const key = `${type}_${data.method}_${data.endpoint}`;
            if (!this.metrics.apiCalls.has(key)) {
                this.metrics.apiCalls.set(key, {
                    count: 0,
                    totalTime: 0,
                    errors: 0
                });
            }

            const metric = this.metrics.apiCalls.get(key);
            metric.count++;
            metric.totalTime += data.duration || 0;
            if (data.error) metric.errors++;

            this.emit('api-call', { type, ...data });
        });

        // Monitor rate limits
        connector.on('rate-limit', (data) => {
            this.emit('rate-limit', { type, ...data });
        });

        // Monitor errors
        connector.on('error', (error) => {
            this.emit('connector-error', { type, error });
        });
    }

    /**
     * Cleanup pooled connection
     */
    async cleanupPooledConnection(poolKey) {
        const pooled = this.connectionPool.get(poolKey);
        if (!pooled) return;

        try {
            // Disconnect if needed
            if (pooled.connector.disconnect) {
                await pooled.connector.disconnect();
            }
            
            this.connectionPool.delete(poolKey);
            console.log(`🧹 Cleaned up pooled connector: ${pooled.type}`);
            
        } catch (error) {
            console.error('Error cleaning up connector:', error);
        }
    }

    /**
     * Get available connector types
     */
    getAvailableConnectors() {
        const connectors = [];
        
        for (const [type, info] of this.connectorTypes.entries()) {
            connectors.push({
                type,
                ...info.metadata
            });
        }

        return connectors;
    }

    /**
     * Get connectors by category
     */
    getConnectorsByCategory(category) {
        return this.getAvailableConnectors()
            .filter(c => c.category === category);
    }

    /**
     * Test connector configuration
     */
    async testConnector(type, credentials) {
        console.log(`🧪 Testing connector: ${type}`);

        try {
            const connectorType = this.connectorTypes.get(type);
            if (!connectorType) {
                throw new Error(`Unknown connector type: ${type}`);
            }

            const ConnectorClass = connectorType.class;
            const testConnector = new ConnectorClass({
                ...this.config,
                credentials
            });

            // Test connection
            const result = await testConnector.testConnection();
            
            // Cleanup
            if (testConnector.disconnect) {
                await testConnector.disconnect();
            }

            return {
                success: result.success,
                message: result.message || 'Connection successful',
                details: result.details
            };

        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error.stack
            };
        }
    }

    /**
     * Execute connector method
     */
    async execute(connectorInstance, method, params = {}) {
        if (!connectorInstance[method]) {
            throw new Error(`Method not found: ${method}`);
        }

        const startTime = Date.now();
        
        try {
            // Execute with retry logic
            let lastError;
            let delay = this.config.retryConfig.retryDelay;

            for (let attempt = 0; attempt <= this.config.retryConfig.maxRetries; attempt++) {
                try {
                    const result = await connectorInstance[method](params);
                    
                    // Emit metrics
                    connectorInstance.emit('api-call', {
                        method,
                        endpoint: params.endpoint || method,
                        duration: Date.now() - startTime,
                        success: true,
                        attempt
                    });

                    return result;

                } catch (error) {
                    lastError = error;

                    // Check if retryable
                    if (!this.isRetryableError(error) || attempt === this.config.retryConfig.maxRetries) {
                        throw error;
                    }

                    console.log(`🔄 Retrying ${method} (attempt ${attempt + 1})`);
                    await this.wait(delay);
                    delay *= this.config.retryConfig.backoffMultiplier;
                }
            }

            throw lastError;

        } catch (error) {
            // Emit error metrics
            connectorInstance.emit('api-call', {
                method,
                endpoint: params.endpoint || method,
                duration: Date.now() - startTime,
                success: false,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        // Network errors
        if (error.code === 'ECONNRESET' || 
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND') {
            return true;
        }

        // HTTP status codes
        if (error.response) {
            const status = error.response.status;
            // Retry on 429 (rate limit), 502, 503, 504
            return status === 429 || (status >= 502 && status <= 504);
        }

        return false;
    }

    /**
     * Get connector metrics
     */
    getMetrics() {
        const apiMetrics = {};
        
        for (const [key, metric] of this.metrics.apiCalls.entries()) {
            apiMetrics[key] = {
                ...metric,
                averageTime: metric.count > 0 ? metric.totalTime / metric.count : 0,
                errorRate: metric.count > 0 ? metric.errors / metric.count : 0
            };
        }

        return {
            connectionsCreated: this.metrics.connectionsCreated,
            connectionsReused: this.metrics.connectionsReused,
            connectionsFailed: this.metrics.connectionsFailed,
            connectionPoolSize: this.connectionPool.size,
            apiCalls: apiMetrics
        };
    }

    /**
     * Clear connection pool
     */
    async clearConnectionPool() {
        console.log('🧹 Clearing connection pool...');
        
        for (const [key, pooled] of this.connectionPool.entries()) {
            await this.cleanupPooledConnection(key);
        }

        this.connectionPool.clear();
    }

    /**
     * Batch execute multiple operations
     */
    async batchExecute(operations) {
        console.log(`🚀 Executing ${operations.length} operations in batch`);
        
        const results = [];
        const errors = [];

        // Group by connector type for efficiency
        const groupedOps = this.groupOperationsByConnector(operations);

        for (const [connectorKey, ops] of groupedOps.entries()) {
            const [type, credentialId] = connectorKey.split('_');
            
            try {
                // Get connector
                const connector = await this.createConnector(type, credentialId);
                
                // Execute operations
                for (const op of ops) {
                    try {
                        const result = await this.execute(connector, op.method, op.params);
                        results.push({
                            id: op.id,
                            success: true,
                            result
                        });
                    } catch (error) {
                        errors.push({
                            id: op.id,
                            success: false,
                            error: error.message
                        });
                    }
                }
                
            } catch (error) {
                // Failed to create connector
                for (const op of ops) {
                    errors.push({
                        id: op.id,
                        success: false,
                        error: `Connector failed: ${error.message}`
                    });
                }
            }
        }

        return {
            results,
            errors,
            summary: {
                total: operations.length,
                successful: results.length,
                failed: errors.length
            }
        };
    }

    /**
     * Group operations by connector
     */
    groupOperationsByConnector(operations) {
        const grouped = new Map();
        
        for (const op of operations) {
            const key = `${op.connectorType}_${op.credentialId}`;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(op);
        }

        return grouped;
    }

    /**
     * Wait utility
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Shutdown factory
     */
    async shutdown() {
        console.log('🛑 Shutting down Service Connector Factory...');
        
        // Clear connection pool
        await this.clearConnectionPool();
        
        // Clear metrics
        this.metrics.apiCalls.clear();
        
        this.emit('shutdown');
        console.log('✅ Service Connector Factory shutdown complete');
    }
}

module.exports = ServiceConnectorFactory;