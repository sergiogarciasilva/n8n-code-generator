/**
 * Base Connector - Abstract base class for all service connectors
 * Provides common functionality for API connections
 */

const EventEmitter = require('events');
const axios = require('axios');
const axiosRetry = require('axios-retry');

class BaseConnector extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            credentials: config.credentials || {},
            timeout: config.timeout || 30000,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            rateLimitDelay: config.rateLimitDelay || 60000,
            headers: config.headers || {},
            ...config
        };

        this.name = this.constructor.name;
        this.isConnected = false;
        this.rateLimitInfo = null;
        this.requestQueue = [];
        this.isProcessingQueue = false;
        
        // API client
        this.apiClient = null;
        
        // Metrics
        this.metrics = {
            requestCount: 0,
            errorCount: 0,
            totalLatency: 0,
            rateLimitHits: 0
        };
    }

    /**
     * Initialize connector - must be implemented by subclasses
     */
    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    /**
     * Test connection - must be implemented by subclasses
     */
    async testConnection() {
        throw new Error('testConnection() must be implemented by subclass');
    }

    /**
     * Create axios client with common configuration
     */
    createApiClient(baseURL, additionalConfig = {}) {
        this.apiClient = axios.create({
            baseURL,
            timeout: this.config.timeout,
            headers: {
                'User-Agent': 'n8n-agent-platform/1.0',
                ...this.config.headers,
                ...additionalConfig.headers
            },
            ...additionalConfig
        });

        // Setup retry logic
        axiosRetry(this.apiClient, {
            retries: this.config.maxRetries,
            retryDelay: axiosRetry.exponentialDelay,
            retryCondition: (error) => {
                return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                       error.response?.status === 429; // Rate limit
            }
        });

        // Request interceptor
        this.apiClient.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now() };
                this.emit('request-start', { 
                    method: config.method,
                    url: config.url 
                });
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.apiClient.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.metadata.startTime;
                this.updateMetrics(true, duration);
                
                this.emit('request-complete', {
                    method: response.config.method,
                    url: response.config.url,
                    status: response.status,
                    duration
                });

                // Check for rate limit headers
                this.checkRateLimitHeaders(response.headers);
                
                return response;
            },
            async (error) => {
                const duration = error.config?.metadata ? 
                    Date.now() - error.config.metadata.startTime : 0;
                
                this.updateMetrics(false, duration);
                
                // Handle rate limiting
                if (error.response?.status === 429) {
                    return this.handleRateLimit(error);
                }

                this.emit('request-error', {
                    method: error.config?.method,
                    url: error.config?.url,
                    status: error.response?.status,
                    error: error.message,
                    duration
                });

                return Promise.reject(error);
            }
        );

        return this.apiClient;
    }

    /**
     * Make API request with queuing support
     */
    async makeRequest(config) {
        // Check if we're rate limited
        if (this.isRateLimited()) {
            return this.queueRequest(config);
        }

        try {
            const response = await this.apiClient.request(config);
            return response.data;
        } catch (error) {
            if (error.response?.status === 429) {
                // Rate limited - queue the request
                return this.queueRequest(config);
            }
            throw this.formatError(error);
        }
    }

    /**
     * Check if currently rate limited
     */
    isRateLimited() {
        if (!this.rateLimitInfo) return false;
        return Date.now() < this.rateLimitInfo.resetTime;
    }

    /**
     * Handle rate limit response
     */
    async handleRateLimit(error) {
        const headers = error.response.headers;
        const resetTime = this.extractRateLimitReset(headers);
        const remaining = headers['x-ratelimit-remaining'] || 0;
        
        this.rateLimitInfo = {
            limit: headers['x-ratelimit-limit'],
            remaining,
            resetTime
        };

        this.metrics.rateLimitHits++;
        
        this.emit('rate-limit', {
            limit: this.rateLimitInfo.limit,
            remaining,
            resetTime: new Date(resetTime),
            retryAfter: Math.max(0, resetTime - Date.now())
        });

        // Wait and retry
        const waitTime = Math.max(1000, resetTime - Date.now());
        await this.wait(waitTime);
        
        return this.apiClient.request(error.config);
    }

    /**
     * Extract rate limit reset time from headers
     */
    extractRateLimitReset(headers) {
        // Try common header names
        const resetHeader = headers['x-ratelimit-reset'] || 
                          headers['x-rate-limit-reset'] ||
                          headers['retry-after'];
        
        if (!resetHeader) {
            return Date.now() + this.config.rateLimitDelay;
        }

        // Check if it's a timestamp or seconds
        const resetValue = parseInt(resetHeader);
        if (resetValue > 1000000000) {
            // Looks like a timestamp
            return resetValue * 1000; // Convert to milliseconds
        } else {
            // Seconds until reset
            return Date.now() + (resetValue * 1000);
        }
    }

    /**
     * Check rate limit headers proactively
     */
    checkRateLimitHeaders(headers) {
        const remaining = parseInt(headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining'] || -1);
        
        if (remaining === 0) {
            const resetTime = this.extractRateLimitReset(headers);
            this.rateLimitInfo = {
                limit: headers['x-ratelimit-limit'],
                remaining: 0,
                resetTime
            };
            
            this.emit('rate-limit-warning', {
                remaining: 0,
                resetTime: new Date(resetTime)
            });
        }
    }

    /**
     * Queue request for later execution
     */
    async queueRequest(config) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ config, resolve, reject });
            
            if (!this.isProcessingQueue) {
                this.processQueue();
            }
        });
    }

    /**
     * Process queued requests
     */
    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0 && !this.isRateLimited()) {
            const { config, resolve, reject } = this.requestQueue.shift();
            
            try {
                const response = await this.apiClient.request(config);
                resolve(response.data);
            } catch (error) {
                reject(this.formatError(error));
            }

            // Small delay between requests
            await this.wait(100);
        }

        this.isProcessingQueue = false;

        // Schedule next queue processing if still rate limited
        if (this.requestQueue.length > 0 && this.isRateLimited()) {
            const waitTime = this.rateLimitInfo.resetTime - Date.now();
            setTimeout(() => this.processQueue(), waitTime);
        }
    }

    /**
     * Format error for consistent error handling
     */
    formatError(error) {
        const formatted = new Error(error.message);
        
        if (error.response) {
            formatted.status = error.response.status;
            formatted.statusText = error.response.statusText;
            formatted.data = error.response.data;
            formatted.headers = error.response.headers;
            
            // Try to extract error message from response
            if (error.response.data) {
                if (typeof error.response.data === 'string') {
                    formatted.message = error.response.data;
                } else if (error.response.data.error) {
                    formatted.message = error.response.data.error.message || 
                                      error.response.data.error;
                } else if (error.response.data.message) {
                    formatted.message = error.response.data.message;
                }
            }
        }

        formatted.code = error.code;
        formatted.config = error.config;
        
        return formatted;
    }

    /**
     * Update metrics
     */
    updateMetrics(success, latency) {
        this.metrics.requestCount++;
        this.metrics.totalLatency += latency;
        
        if (!success) {
            this.metrics.errorCount++;
        }
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            averageLatency: this.metrics.requestCount > 0 ? 
                this.metrics.totalLatency / this.metrics.requestCount : 0,
            errorRate: this.metrics.requestCount > 0 ?
                this.metrics.errorCount / this.metrics.requestCount : 0,
            queueLength: this.requestQueue.length,
            isRateLimited: this.isRateLimited()
        };
    }

    /**
     * Paginate through API results
     */
    async *paginate(method, params = {}, pageSize = 100) {
        let page = params.page || 1;
        let hasMore = true;

        while (hasMore) {
            const result = await method({
                ...params,
                page,
                limit: pageSize,
                per_page: pageSize,
                page_size: pageSize
            });

            yield result.data || result;

            // Check if there are more pages
            hasMore = this.hasMorePages(result, page, pageSize);
            page++;
        }
    }

    /**
     * Check if there are more pages - override in subclasses
     */
    hasMorePages(result, currentPage, pageSize) {
        // Default implementation - override for specific APIs
        if (result.has_more !== undefined) return result.has_more;
        if (result.next_page !== undefined) return !!result.next_page;
        if (Array.isArray(result.data || result)) {
            return (result.data || result).length === pageSize;
        }
        return false;
    }

    /**
     * Batch operations
     */
    async batchOperation(items, operation, batchSize = 10) {
        const results = [];
        const errors = [];

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (item, index) => {
                try {
                    const result = await operation(item);
                    return { index: i + index, success: true, result };
                } catch (error) {
                    return { index: i + index, success: false, error };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            for (const result of batchResults) {
                if (result.success) {
                    results.push(result);
                } else {
                    errors.push(result);
                }
            }

            // Rate limiting between batches
            if (i + batchSize < items.length) {
                await this.wait(1000);
            }
        }

        return { results, errors };
    }

    /**
     * Wait utility
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Disconnect - override in subclasses if needed
     */
    async disconnect() {
        this.isConnected = false;
        this.requestQueue = [];
        this.emit('disconnected');
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            name: this.name,
            connected: this.isConnected,
            metrics: this.getMetrics(),
            rateLimitInfo: this.rateLimitInfo
        };
    }
}

module.exports = BaseConnector;