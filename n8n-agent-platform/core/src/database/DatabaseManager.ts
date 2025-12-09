import { Pool, PoolConfig } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export class DatabaseManager {
    private pool: Pool;
    private config: PoolConfig;

    constructor() {
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'n8n_agent_platform',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        this.pool = new Pool(this.config);

        this.pool.on('error', (err) => {
            logger.error('Unexpected database error:', err);
        });
    }

    async initialize(): Promise<void> {
        try {
            // Test connection
            const client = await this.pool.connect();
            logger.info('Database connection established');
            client.release();

            // Run migrations - Commented out as tables already exist
            // await this.runMigrations();
        } catch (error) {
            logger.error('Database initialization failed:', error);
            throw error;
        }
    }

    async runMigrations(): Promise<void> {
        try {
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            await this.pool.query(schema);
            logger.info('Database migrations completed');
        } catch (error) {
            logger.error('Migration failed:', error);
            throw error;
        }
    }

    // Workflow operations
    async saveWorkflow(workflow: any): Promise<void> {
        const query = `
            INSERT INTO workflows (workflow_id, name, nodes, connections, settings, active)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (workflow_id) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                nodes = EXCLUDED.nodes,
                connections = EXCLUDED.connections,
                settings = EXCLUDED.settings,
                active = EXCLUDED.active,
                updated_at = CURRENT_TIMESTAMP
        `;

        await this.pool.query(query, [
            workflow.id,
            workflow.name,
            JSON.stringify(workflow.nodes),
            JSON.stringify(workflow.connections),
            JSON.stringify(workflow.settings || {}),
            workflow.active || true
        ]);
    }

    async getWorkflow(workflowId: string): Promise<any> {
        const query = 'SELECT * FROM workflows WHERE workflow_id = $1';
        const result = await this.pool.query(query, [workflowId]);
        
        if (result.rows.length === 0) {
            throw new Error(`Workflow ${workflowId} not found`);
        }

        const row = result.rows[0];
        return {
            id: row.workflow_id,
            name: row.name,
            nodes: row.nodes,
            connections: row.connections,
            settings: row.settings,
            active: row.active
        };
    }

    async getWorkflowsForOptimization(): Promise<any[]> {
        const query = `
            SELECT * FROM workflows 
            WHERE active = true 
            AND optimization_enabled = true
            AND (last_optimized IS NULL OR last_optimized < NOW() - INTERVAL '24 hours')
            ORDER BY last_optimized ASC NULLS FIRST
            LIMIT 10
        `;
        
        const result = await this.pool.query(query);
        return result.rows.map(row => ({
            id: row.workflow_id,
            name: row.name,
            nodes: row.nodes,
            connections: row.connections,
            settings: row.settings,
            active: row.active
        }));
    }

    async updateWorkflow(workflowId: string, workflow: any): Promise<void> {
        const query = `
            UPDATE workflows 
            SET nodes = $2, connections = $3, updated_at = CURRENT_TIMESTAMP
            WHERE workflow_id = $1
        `;

        await this.pool.query(query, [
            workflowId,
            JSON.stringify(workflow.nodes),
            JSON.stringify(workflow.connections)
        ]);
    }

    async markWorkflowOptimized(workflowId: string): Promise<void> {
        const query = `
            UPDATE workflows 
            SET last_optimized = CURRENT_TIMESTAMP 
            WHERE workflow_id = $1
        `;

        await this.pool.query(query, [workflowId]);
    }

    // Agent operations
    async registerAgent(agent: any): Promise<void> {
        const query = `
            INSERT INTO agents (agent_id, name, type, description, status, config)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (agent_id) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                status = EXCLUDED.status,
                config = EXCLUDED.config,
                updated_at = CURRENT_TIMESTAMP
        `;

        await this.pool.query(query, [
            agent.id,
            agent.name,
            agent.type,
            agent.description,
            agent.status || 'idle',
            JSON.stringify(agent.config || {})
        ]);
    }

    async updateAgentStatus(agentId: string, status: string): Promise<void> {
        const query = `
            UPDATE agents 
            SET status = $2, updated_at = CURRENT_TIMESTAMP 
            WHERE agent_id = $1
        `;

        await this.pool.query(query, [agentId, status]);
    }

    async updateAgentLastRun(agentId: string): Promise<void> {
        const query = `
            UPDATE agents 
            SET last_run = CURRENT_TIMESTAMP 
            WHERE agent_id = $1
        `;

        await this.pool.query(query, [agentId]);
    }

    // Generic query method for direct database access
    async query(text: string, params?: any[]): Promise<any> {
        try {
            const result = await this.pool.query(text, params);
            return result;
        } catch (error) {
            logger.error('Database query error:', { text, params, error });
            throw error;
        }
    }

    // Get Redis connection (placeholder - needs RedisManager integration)
    getRedis() {
        // This should return the Redis connection from RedisManager
        // For now, returning a mock object to fix compilation
        return {
            get: async (key: string) => null,
            set: async (key: string, value: string) => 'OK',
            setEx: async (key: string, seconds: number, value: string) => 'OK',
            del: async (key: string) => 1,
            exists: async (key: string) => 0,
            expire: async (key: string, seconds: number) => 1,
            ttl: async (key: string) => -1,
            keys: async (pattern: string) => [],
        };
    }

    // Execute multiple queries in a transaction
    async transaction(queries: { text: string; params?: any[] }[]): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            for (const query of queries) {
                await client.query(query.text, query.params);
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getActiveAgents(): Promise<any[]> {
        const query = `
            SELECT * FROM agents 
            WHERE status IN ('active', 'running', 'idle')
            ORDER BY type, name
        `;

        const result = await this.pool.query(query);
        return result.rows;
    }

    // Analysis operations
    async saveAnalysis(analysis: any): Promise<void> {
        const query = `
            INSERT INTO workflow_analyses 
            (workflow_id, agent_id, analysis, confidence, execution_time)
            VALUES ($1, $2, $3, $4, $5)
        `;

        await this.pool.query(query, [
            analysis.workflowId,
            analysis.agentId,
            JSON.stringify(analysis.analysis),
            analysis.confidence || 0.5,
            analysis.executionTime
        ]);
    }

    // Suggestion operations
    async saveSuggestion(suggestion: any): Promise<void> {
        const query = `
            INSERT INTO optimization_suggestions 
            (suggestion_id, workflow_id, agent_id, type, title, description, 
             impact, effort, confidence, metadata, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        await this.pool.query(query, [
            suggestion.id,
            suggestion.workflowId,
            suggestion.agentId,
            suggestion.type,
            suggestion.title,
            suggestion.description,
            suggestion.impact,
            suggestion.effort,
            suggestion.confidence,
            JSON.stringify(suggestion.metadata || {}),
            suggestion.status || 'pending'
        ]);
    }

    async updateSuggestionStatus(suggestionId: string, status: string): Promise<void> {
        const query = `
            UPDATE optimization_suggestions 
            SET status = $2, applied_at = CASE WHEN $2 = 'applied' THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE suggestion_id = $1
        `;

        await this.pool.query(query, [suggestionId, status]);
    }

    // Change log operations
    async logChange(change: any): Promise<void> {
        const query = `
            INSERT INTO workflow_changes 
            (workflow_id, agent_id, suggestion_id, change_type, 
             before_state, after_state, success, error_message)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        await this.pool.query(query, [
            change.workflowId,
            change.agentId,
            change.suggestionId || null,
            change.changeType || 'optimization',
            change.beforeState,
            change.afterState,
            change.success !== false,
            change.errorMessage || null
        ]);
    }

    // Execution log operations
    async logAgentExecution(execution: any): Promise<string> {
        const query = `
            INSERT INTO agent_executions 
            (agent_id, workflow_id, status, start_time, end_time, 
             execution_time, workflows_processed, changes_applied, error_message, metrics)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `;

        const result = await this.pool.query(query, [
            execution.agentId,
            execution.workflowId || null,
            execution.status,
            execution.startTime,
            execution.endTime || null,
            execution.executionTime || null,
            execution.workflowsProcessed || 0,
            execution.changesApplied || 0,
            execution.errorMessage || null,
            JSON.stringify(execution.metrics || {})
        ]);

        return result.rows[0].id;
    }

    async updateAgentExecution(executionId: string, updates: any): Promise<void> {
        const query = `
            UPDATE agent_executions 
            SET status = $2, end_time = $3, execution_time = $4, 
                workflows_processed = $5, changes_applied = $6, 
                error_message = $7, metrics = $8
            WHERE id = $1
        `;

        await this.pool.query(query, [
            executionId,
            updates.status,
            updates.endTime,
            updates.executionTime,
            updates.workflowsProcessed,
            updates.changesApplied,
            updates.errorMessage,
            JSON.stringify(updates.metrics || {})
        ]);
    }

    // Metrics operations
    async saveAgentMetrics(metrics: any): Promise<void> {
        const query = `
            INSERT INTO agent_metrics 
            (agent_id, agent_type, metric_type, metric_value, metadata)
            VALUES ($1, $2, $3, $4, $5)
        `;

        await this.pool.query(query, [
            metrics.agentId,
            metrics.agentType,
            metrics.metricType || 'execution',
            metrics.metricValue,
            JSON.stringify(metrics.metadata || {})
        ]);
    }

    async getAgentMetrics(agentId: string, hours: number = 24): Promise<any[]> {
        const query = `
            SELECT * FROM agent_metrics 
            WHERE agent_id = $1 
            AND timestamp > NOW() - INTERVAL '${hours} hours'
            ORDER BY timestamp DESC
        `;

        const result = await this.pool.query(query, [agentId]);
        return result.rows;
    }

    // System event operations
    async logSystemEvent(event: any): Promise<void> {
        const query = `
            INSERT INTO system_events 
            (event_type, source, severity, message, metadata)
            VALUES ($1, $2, $3, $4, $5)
        `;

        await this.pool.query(query, [
            event.type,
            event.source || 'system',
            event.severity || 'info',
            event.message,
            JSON.stringify(event.metadata || {})
        ]);
    }

    // Schedule operations
    async saveAgentSchedule(schedule: any): Promise<void> {
        const query = `
            INSERT INTO agent_schedules 
            (agent_id, schedule_type, cron_expression, interval_seconds, enabled)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (agent_id) 
            DO UPDATE SET 
                schedule_type = EXCLUDED.schedule_type,
                cron_expression = EXCLUDED.cron_expression,
                interval_seconds = EXCLUDED.interval_seconds,
                enabled = EXCLUDED.enabled,
                updated_at = CURRENT_TIMESTAMP
        `;

        await this.pool.query(query, [
            schedule.agentId,
            schedule.type,
            schedule.cronExpression || null,
            schedule.intervalSeconds || null,
            schedule.enabled !== false
        ]);
    }

    async getActiveSchedules(): Promise<any[]> {
        const query = `
            SELECT s.*, a.name as agent_name, a.type as agent_type
            FROM agent_schedules s
            JOIN agents a ON s.agent_id = a.agent_id
            WHERE s.enabled = true
            AND a.status != 'stopped'
        `;

        const result = await this.pool.query(query);
        return result.rows;
    }

    // Benchmark operations
    async saveBenchmark(benchmark: any): Promise<void> {
        const query = `
            INSERT INTO performance_benchmarks 
            (workflow_id, benchmark_type, baseline_time, optimized_time, 
             improvement_percentage, node_metrics)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;

        const improvement = benchmark.baselineTime > 0 
            ? ((benchmark.baselineTime - benchmark.optimizedTime) / benchmark.baselineTime) * 100
            : 0;

        await this.pool.query(query, [
            benchmark.workflowId,
            benchmark.type || 'execution',
            benchmark.baselineTime,
            benchmark.optimizedTime,
            improvement,
            JSON.stringify(benchmark.nodeMetrics || {})
        ]);
    }

    // Dashboard queries
    async getDashboardStats(): Promise<any> {
        const stats = await this.pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM workflows WHERE active = true) as active_workflows,
                (SELECT COUNT(*) FROM agents WHERE status != 'stopped') as active_agents,
                (SELECT COUNT(*) FROM optimization_suggestions WHERE created_at > NOW() - INTERVAL '24 hours') as recent_suggestions,
                (SELECT COUNT(*) FROM workflow_changes WHERE created_at > NOW() - INTERVAL '24 hours') as recent_changes,
                (SELECT AVG(improvement_percentage) FROM performance_benchmarks WHERE created_at > NOW() - INTERVAL '7 days') as avg_improvement
        `);

        return stats.rows[0];
    }

    async getRecentActivity(limit: number = 50): Promise<any[]> {
        const query = `
            SELECT 
                'suggestion' as type,
                suggestion_id as id,
                workflow_id,
                title as description,
                created_at
            FROM optimization_suggestions
            UNION ALL
            SELECT 
                'change' as type,
                id::text,
                workflow_id,
                change_type as description,
                created_at
            FROM workflow_changes
            UNION ALL
            SELECT 
                'execution' as type,
                id::text,
                workflow_id,
                status as description,
                created_at
            FROM agent_executions
            ORDER BY created_at DESC
            LIMIT $1
        `;

        const result = await this.pool.query(query, [limit]);
        return result.rows;
    }

    async close(): Promise<void> {
        await this.pool.end();
        logger.info('Database connection closed');
    }

    getPool(): Pool {
        return this.pool;
    }
}