import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export class RedisManager {
    private client: RedisClientType;
    private connected: boolean = false;

    constructor() {
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = process.env.REDIS_PORT || '6379';
        const redisPassword = process.env.REDIS_PASSWORD;
        
        const redisUrl = redisPassword 
            ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
            : `redis://${redisHost}:${redisPort}`;
        
        this.client = createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger.error('Redis reconnection limit reached');
                        return new Error('Too many retries');
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        });

        this.client.on('error', (err) => {
            logger.error('Redis client error:', err);
        });

        this.client.on('connect', () => {
            logger.info('Redis client connected');
            this.connected = true;
        });

        this.client.on('disconnect', () => {
            logger.warn('Redis client disconnected');
            this.connected = false;
        });
    }

    async connect(): Promise<void> {
        try {
            await this.client.connect();
            await this.client.ping();
            logger.info('Redis connection established');
        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.connected) {
            await this.client.quit();
            logger.info('Redis connection closed');
        }
    }

    // Key-value operations
    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.client.setEx(key, ttl, value);
        } else {
            await this.client.set(key, value);
        }
    }

    async get(key: string): Promise<string | null> {
        return await this.client.get(key);
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }

    async exists(key: string): Promise<boolean> {
        const result = await this.client.exists(key);
        return result === 1;
    }

    async expire(key: string, seconds: number): Promise<void> {
        await this.client.expire(key, seconds);
    }

    // Hash operations
    async hSet(key: string, field: string, value: string): Promise<void> {
        await this.client.hSet(key, field, value);
    }

    async hGet(key: string, field: string): Promise<string | null> {
        const result = await this.client.hGet(key, field);
        return result || null;
    }

    async hGetAll(key: string): Promise<Record<string, string>> {
        return await this.client.hGetAll(key);
    }

    async hDel(key: string, field: string): Promise<void> {
        await this.client.hDel(key, field);
    }

    // List operations
    async lPush(key: string, value: string): Promise<void> {
        await this.client.lPush(key, value);
    }

    async rPush(key: string, value: string): Promise<void> {
        await this.client.rPush(key, value);
    }

    async lPop(key: string): Promise<string | null> {
        return await this.client.lPop(key);
    }

    async rPop(key: string): Promise<string | null> {
        return await this.client.rPop(key);
    }

    async lLen(key: string): Promise<number> {
        return await this.client.lLen(key);
    }

    async lRange(key: string, start: number, stop: number): Promise<string[]> {
        return await this.client.lRange(key, start, stop);
    }

    // Set operations
    async sAdd(key: string, member: string): Promise<void> {
        await this.client.sAdd(key, member);
    }

    async sRem(key: string, member: string): Promise<void> {
        await this.client.sRem(key, member);
    }

    async sMembers(key: string): Promise<string[]> {
        return await this.client.sMembers(key);
    }

    async sIsMember(key: string, member: string): Promise<boolean> {
        return await this.client.sIsMember(key, member);
    }

    // Sorted set operations
    async zAdd(key: string, score: number, member: string): Promise<void> {
        await this.client.zAdd(key, { score, value: member });
    }

    async zRange(key: string, start: number, stop: number): Promise<string[]> {
        return await this.client.zRange(key, start, stop);
    }

    async zRevRange(key: string, start: number, stop: number): Promise<string[]> {
        return await this.client.zRange(key, start, stop, { REV: true });
    }

    async zScore(key: string, member: string): Promise<number | null> {
        return await this.client.zScore(key, member);
    }

    // Pub/Sub operations
    async publish(channel: string, message: string): Promise<void> {
        await this.client.publish(channel, message);
    }

    async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
        const subscriber = this.client.duplicate();
        await subscriber.connect();
        
        await subscriber.subscribe(channel, (message) => {
            callback(message);
        });
    }

    // Agent-specific operations
    async lockAgent(agentId: string, ttl: number = 300): Promise<boolean> {
        const key = `lock:agent:${agentId}`;
        const result = await this.client.setNX(key, '1');
        
        if (result) {
            await this.expire(key, ttl);
            return true;
        }
        
        return false;
    }

    async unlockAgent(agentId: string): Promise<void> {
        const key = `lock:agent:${agentId}`;
        await this.del(key);
    }

    async setAgentState(agentId: string, state: any, ttl?: number): Promise<void> {
        const key = `state:agent:${agentId}`;
        await this.set(key, JSON.stringify(state), ttl);
    }

    async getAgentState(agentId: string): Promise<any | null> {
        const key = `state:agent:${agentId}`;
        const state = await this.get(key);
        return state ? JSON.parse(state) : null;
    }

    // Workflow cache operations
    async cacheWorkflow(workflowId: string, workflow: any, ttl: number = 3600): Promise<void> {
        const key = `workflow:${workflowId}`;
        await this.set(key, JSON.stringify(workflow), ttl);
    }

    async getCachedWorkflow(workflowId: string): Promise<any | null> {
        const key = `workflow:${workflowId}`;
        const workflow = await this.get(key);
        return workflow ? JSON.parse(workflow) : null;
    }

    async invalidateWorkflowCache(workflowId: string): Promise<void> {
        const key = `workflow:${workflowId}`;
        await this.del(key);
    }

    // Analysis cache operations
    async cacheAnalysis(workflowId: string, agentType: string, analysis: any, ttl: number = 3600): Promise<void> {
        const key = `analysis:${workflowId}:${agentType}`;
        await this.set(key, JSON.stringify(analysis), ttl);
    }

    async getCachedAnalysis(workflowId: string, agentType: string): Promise<any | null> {
        const key = `analysis:${workflowId}:${agentType}`;
        const analysis = await this.get(key);
        return analysis ? JSON.parse(analysis) : null;
    }

    // Queue operations for agent tasks
    async enqueueTask(queueName: string, task: any): Promise<void> {
        const key = `queue:${queueName}`;
        await this.rPush(key, JSON.stringify(task));
    }

    async dequeueTask(queueName: string): Promise<any | null> {
        const key = `queue:${queueName}`;
        const task = await this.lPop(key);
        return task ? JSON.parse(task) : null;
    }

    async getQueueLength(queueName: string): Promise<number> {
        const key = `queue:${queueName}`;
        return await this.lLen(key);
    }

    // Rate limiting
    async checkRateLimit(identifier: string, limit: number, window: number): Promise<boolean> {
        const key = `rate:${identifier}`;
        const current = await this.get(key);
        
        if (!current) {
            await this.set(key, '1', window);
            return true;
        }
        
        const count = parseInt(current);
        if (count >= limit) {
            return false;
        }
        
        await this.client.incr(key);
        return true;
    }

    // Metrics operations
    async incrementMetric(metric: string, value: number = 1): Promise<void> {
        const key = `metric:${metric}`;
        await this.client.incrBy(key, value);
    }

    async getMetric(metric: string): Promise<number> {
        const key = `metric:${metric}`;
        const value = await this.get(key);
        return value ? parseInt(value) : 0;
    }

    async recordMetric(metric: string, value: number, timestamp?: number): Promise<void> {
        const key = `metric:timeseries:${metric}`;
        const ts = timestamp || Date.now();
        await this.zAdd(key, ts, `${ts}:${value}`);
        
        // Keep only last 7 days of data
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
        await this.client.zRemRangeByScore(key, '-inf', cutoff);
    }

    async getMetricTimeSeries(metric: string, start: number, end: number): Promise<Array<{timestamp: number, value: number}>> {
        const key = `metric:timeseries:${metric}`;
        const data = await this.client.zRangeByScore(key, start, end);
        
        return data.map(entry => {
            const [timestamp, value] = entry.split(':');
            return {
                timestamp: parseInt(timestamp),
                value: parseFloat(value)
            };
        });
    }

    // Session management
    async createSession(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
        const key = `session:${sessionId}`;
        await this.set(key, JSON.stringify(data), ttl);
    }

    async getSession(sessionId: string): Promise<any | null> {
        const key = `session:${sessionId}`;
        const session = await this.get(key);
        return session ? JSON.parse(session) : null;
    }

    async updateSession(sessionId: string, data: any): Promise<void> {
        const key = `session:${sessionId}`;
        const ttl = await this.client.ttl(key);
        await this.set(key, JSON.stringify(data), ttl > 0 ? ttl : 3600);
    }

    async deleteSession(sessionId: string): Promise<void> {
        const key = `session:${sessionId}`;
        await this.del(key);
    }

    // Utility methods
    async flushAll(): Promise<void> {
        if (process.env.NODE_ENV === 'development') {
            await this.client.flushAll();
            logger.warn('Redis database flushed');
        } else {
            throw new Error('flushAll is only allowed in development');
        }
    }

    async keys(pattern: string): Promise<string[]> {
        return await this.client.keys(pattern);
    }

    isConnected(): boolean {
        return this.connected;
    }

    getClient(): RedisClientType {
        return this.client;
    }
}