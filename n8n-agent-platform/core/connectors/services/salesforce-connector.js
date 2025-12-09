/**
 * Salesforce Connector - Real Salesforce API integration
 * Handles authentication, SOQL queries, and CRUD operations
 */

const BaseConnector = require('../base-connector');
const jsforce = require('jsforce');

class SalesforceConnector extends BaseConnector {
    constructor(config = {}) {
        super(config);
        
        this.conn = null;
        this.instanceUrl = null;
        this.apiVersion = config.apiVersion || '57.0';
        this.loginUrl = config.sandbox ? 
            'https://test.salesforce.com' : 
            'https://login.salesforce.com';
    }

    /**
     * Initialize Salesforce connection
     */
    async initialize() {
        console.log('🔌 Initializing Salesforce connector...');
        
        try {
            const { credentials } = this.config;
            
            if (!credentials) {
                throw new Error('Salesforce credentials not provided');
            }

            // Create jsforce connection
            this.conn = new jsforce.Connection({
                loginUrl: this.loginUrl,
                version: this.apiVersion
            });

            // Setup event handlers
            this.setupEventHandlers();

            // Authenticate based on credential type
            if (credentials.accessToken && credentials.instanceUrl) {
                // OAuth2 with existing token
                await this.authenticateWithToken(credentials);
            } else if (credentials.username && credentials.password) {
                // Username/Password authentication
                await this.authenticateWithPassword(credentials);
            } else if (credentials.clientId && credentials.clientSecret) {
                // OAuth2 flow
                await this.authenticateWithOAuth2(credentials);
            } else {
                throw new Error('Invalid Salesforce credentials');
            }

            this.isConnected = true;
            console.log('✅ Salesforce connector initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Salesforce connector:', error);
            throw error;
        }
    }

    /**
     * Setup jsforce event handlers
     */
    setupEventHandlers() {
        // Rate limit handling
        this.conn.on('request', (request) => {
            this.emit('request-start', {
                method: request.method,
                url: request.url
            });
        });

        this.conn.on('response', (response) => {
            this.emit('request-complete', {
                status: response.statusCode,
                headers: response.headers
            });

            // Check API usage
            if (response.headers && response.headers['sforce-limit-info']) {
                const limitInfo = this.parseLimitInfo(response.headers['sforce-limit-info']);
                this.emit('api-limits', limitInfo);
            }
        });
    }

    /**
     * Authenticate with access token
     */
    async authenticateWithToken(credentials) {
        this.conn.instanceUrl = credentials.instanceUrl;
        this.conn.accessToken = credentials.accessToken;
        
        if (credentials.refreshToken) {
            this.conn.refreshToken = credentials.refreshToken;
        }

        // Test connection
        await this.conn.identity();
        this.instanceUrl = this.conn.instanceUrl;
    }

    /**
     * Authenticate with username/password
     */
    async authenticateWithPassword(credentials) {
        const loginResult = await this.conn.login(
            credentials.username,
            credentials.password + (credentials.securityToken || '')
        );

        this.instanceUrl = this.conn.instanceUrl;
        console.log(`Logged in as: ${credentials.username}`);
        console.log(`Instance URL: ${this.instanceUrl}`);
    }

    /**
     * Authenticate with OAuth2
     */
    async authenticateWithOAuth2(credentials) {
        const oauth2 = new jsforce.OAuth2({
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            redirectUri: credentials.redirectUri || 'http://localhost:3000/oauth2/callback'
        });

        this.conn = new jsforce.Connection({ oauth2 });

        if (credentials.refreshToken) {
            await this.conn.oauth2.refreshToken(credentials.refreshToken);
        } else if (credentials.authCode) {
            await this.conn.authorize(credentials.authCode);
        } else {
            throw new Error('OAuth2 requires either refreshToken or authCode');
        }

        this.instanceUrl = this.conn.instanceUrl;
    }

    /**
     * Test connection
     */
    async testConnection() {
        try {
            const identity = await this.conn.identity();
            return {
                success: true,
                message: `Connected to Salesforce as ${identity.username}`,
                details: {
                    userId: identity.user_id,
                    organizationId: identity.organization_id,
                    username: identity.username
                }
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
     * Query records using SOQL
     */
    async query(soql, options = {}) {
        try {
            const queryOptions = {
                autoFetch: options.autoFetch !== false,
                maxFetch: options.maxFetch || 10000
            };

            const result = await this.conn.query(soql, queryOptions);
            
            return {
                totalSize: result.totalSize,
                done: result.done,
                records: result.records,
                nextRecordsUrl: result.nextRecordsUrl
            };
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Query records with automatic pagination
     */
    async *queryAll(soql, batchSize = 2000) {
        let locator = null;
        let done = false;

        while (!done) {
            const result = locator ? 
                await this.conn.queryMore(locator) :
                await this.conn.query(soql);

            yield result.records;

            done = result.done;
            locator = result.nextRecordsUrl;
        }
    }

    /**
     * Get SObject describe
     */
    async describeSObject(objectName) {
        try {
            const describe = await this.conn.sobject(objectName).describe();
            return describe;
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Create records
     */
    async create(objectName, records) {
        try {
            const recordsArray = Array.isArray(records) ? records : [records];
            const result = await this.conn.sobject(objectName).create(recordsArray);
            
            return Array.isArray(records) ? result : result[0];
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Update records
     */
    async update(objectName, records) {
        try {
            const recordsArray = Array.isArray(records) ? records : [records];
            const result = await this.conn.sobject(objectName).update(recordsArray);
            
            return Array.isArray(records) ? result : result[0];
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Upsert records
     */
    async upsert(objectName, records, externalIdField) {
        try {
            const recordsArray = Array.isArray(records) ? records : [records];
            const result = await this.conn.sobject(objectName)
                .upsert(recordsArray, externalIdField);
            
            return Array.isArray(records) ? result : result[0];
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Delete records
     */
    async delete(objectName, ids) {
        try {
            const idsArray = Array.isArray(ids) ? ids : [ids];
            const result = await this.conn.sobject(objectName).destroy(idsArray);
            
            return Array.isArray(ids) ? result : result[0];
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Retrieve records by IDs
     */
    async retrieve(objectName, ids, fields = null) {
        try {
            const idsArray = Array.isArray(ids) ? ids : [ids];
            const sobject = this.conn.sobject(objectName);
            
            const result = fields ? 
                await sobject.retrieve(idsArray, { fields }) :
                await sobject.retrieve(idsArray);
            
            return Array.isArray(ids) ? result : result[0];
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Search records using SOSL
     */
    async search(searchString) {
        try {
            const result = await this.conn.search(searchString);
            return result.searchRecords;
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Execute Apex code
     */
    async executeApex(apexBody) {
        try {
            const result = await this.conn.tooling.executeAnonymous(apexBody);
            return result;
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Get API limits
     */
    async getLimits() {
        try {
            const limits = await this.conn.limits();
            return limits;
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Subscribe to platform events
     */
    async subscribeToPlatformEvent(eventName, callback) {
        try {
            const channel = `/event/${eventName}`;
            
            const subscription = this.conn.streaming.topic(channel).subscribe((message) => {
                callback(null, message);
            });

            subscription.on('error', (error) => {
                callback(error, null);
            });

            return subscription;
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Subscribe to Change Data Capture
     */
    async subscribeToCDC(objectName, callback) {
        try {
            const channel = `/data/${objectName}ChangeEvent`;
            
            const subscription = this.conn.streaming.topic(channel).subscribe((message) => {
                callback(null, message);
            });

            subscription.on('error', (error) => {
                callback(error, null);
            });

            return subscription;
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Bulk API operations
     */
    async bulkOperation(objectName, operation, records) {
        try {
            const job = this.conn.bulk.createJob(objectName, operation);
            const batch = job.createBatch();
            
            return new Promise((resolve, reject) => {
                batch.execute(records)
                    .on('error', reject)
                    .on('queue', (batchInfo) => {
                        console.log(`Bulk job queued: ${batchInfo.id}`);
                    })
                    .on('response', (results) => {
                        resolve(results);
                    });
            });
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Get metadata
     */
    async getMetadata(types) {
        try {
            const result = await this.conn.metadata.read(types.type, types.members);
            return result;
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Deploy metadata
     */
    async deployMetadata(zipBuffer, options = {}) {
        try {
            const deployOptions = {
                rollbackOnError: true,
                singlePackage: true,
                ...options
            };

            const result = await this.conn.metadata.deploy(zipBuffer, deployOptions)
                .complete(true);
            
            return result;
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Parse Salesforce limit info header
     */
    parseLimitInfo(limitInfo) {
        const limits = {};
        const parts = limitInfo.split(';');
        
        for (const part of parts) {
            const [key, value] = part.trim().split('=');
            if (key && value) {
                const [used, total] = value.split('/');
                limits[key] = {
                    used: parseInt(used),
                    total: parseInt(total),
                    remaining: parseInt(total) - parseInt(used)
                };
            }
        }

        return limits;
    }

    /**
     * Format Salesforce-specific errors
     */
    formatError(error) {
        const formatted = super.formatError(error);
        
        // Handle Salesforce-specific error format
        if (error.errorCode) {
            formatted.code = error.errorCode;
            formatted.fields = error.fields;
        }

        return formatted;
    }

    /**
     * Refresh OAuth token
     */
    async refreshAccessToken() {
        if (!this.conn.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            await this.conn.oauth2.refreshToken(this.conn.refreshToken);
            
            this.emit('token-refreshed', {
                accessToken: this.conn.accessToken,
                instanceUrl: this.conn.instanceUrl
            });

            return {
                accessToken: this.conn.accessToken,
                instanceUrl: this.conn.instanceUrl
            };
        } catch (error) {
            throw this.formatError(error);
        }
    }

    /**
     * Disconnect from Salesforce
     */
    async disconnect() {
        if (this.conn) {
            await this.conn.logout();
        }
        
        await super.disconnect();
        console.log('🔌 Disconnected from Salesforce');
    }

    /**
     * Get connection info
     */
    getConnectionInfo() {
        return {
            instanceUrl: this.instanceUrl,
            apiVersion: this.apiVersion,
            organizationId: this.conn?.userInfo?.organizationId,
            userId: this.conn?.userInfo?.id,
            ...this.getStatus()
        };
    }
}

module.exports = SalesforceConnector;