import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { AgentOrchestrator } from '../orchestrator/AgentOrchestrator';
import { DatabaseManager } from '../database/DatabaseManager';
import { WebSocketManager } from './WebSocketManager';
import { logger, logAPICall } from '../utils/logger';

export class APIServer {
    constructor(
        private app: Application,
        private orchestrator: AgentOrchestrator,
        private database: DatabaseManager,
        private wsManager: WebSocketManager
    ) {}

    setupRoutes(): void {
        // Middleware
        this.app.use(cors({
            origin: ['http://localhost:3000', 'http://localhost:5173', 'vscode-webview://*'],
            credentials: true
        }));
        this.app.use(helmet());
        this.app.use(compression());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // Request logging middleware
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const start = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - start;
                logAPICall(req.path, req.method, res.statusCode, duration);
            });
            
            next();
        });

        // Health check
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({
                status: 'healthy',
                timestamp: new Date(),
                uptime: process.uptime(),
                version: '1.0.0'
            });
        });

        // Agent routes
        this.setupAgentRoutes();

        // Workflow routes
        this.setupWorkflowRoutes();

        // Metrics routes
        this.setupMetricsRoutes();

        // System routes
        this.setupSystemRoutes();

        // Error handling middleware
        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            logger.error('API Error:', err);
            res.status(500).json({
                error: 'Internal server error',
                message: err.message,
                timestamp: new Date()
            });
        });
    }

    private setupAgentRoutes(): void {
        // Get all agents
        this.app.get('/api/agents', async (req: Request, res: Response) => {
            try {
                const agents = this.orchestrator.getAllAgents().map(agent => agent.toJSON());
                res.json({ agents });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get agent by ID
        this.app.get('/api/agents/:agentId', async (req: Request, res: Response) => {
            try {
                const agent = this.orchestrator.getAgent(req.params.agentId);
                if (!agent) {
                    return res.status(404).json({ error: 'Agent not found' });
                }
                res.json({ agent: agent.toJSON() });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Run agent
        this.app.post('/api/agents/:agentId/run', async (req: Request, res: Response) => {
            try {
                const { workflowId } = req.body;
                const result = await this.orchestrator.runAgent(req.params.agentId, workflowId);
                res.json({ result });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Start agent
        this.app.post('/api/agents/:agentId/start', async (req: Request, res: Response) => {
            try {
                await this.orchestrator.startAgent(req.params.agentId);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Stop agent
        this.app.post('/api/agents/:agentId/stop', async (req: Request, res: Response) => {
            try {
                await this.orchestrator.stopAgent(req.params.agentId);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Pause agent
        this.app.post('/api/agents/:agentId/pause', async (req: Request, res: Response) => {
            try {
                await this.orchestrator.pauseAgent(req.params.agentId);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Resume agent
        this.app.post('/api/agents/:agentId/resume', async (req: Request, res: Response) => {
            try {
                await this.orchestrator.resumeAgent(req.params.agentId);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Schedule agent
        this.app.post('/api/agents/:agentId/schedule', async (req: Request, res: Response) => {
            try {
                const { cronExpression } = req.body;
                await this.orchestrator.scheduleAgent(req.params.agentId, cronExpression);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Unschedule agent
        this.app.delete('/api/agents/:agentId/schedule', async (req: Request, res: Response) => {
            try {
                this.orchestrator.unscheduleAgent(req.params.agentId);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get agent metrics
        this.app.get('/api/agents/:agentId/metrics', async (req: Request, res: Response) => {
            try {
                const hours = parseInt(req.query.hours as string) || 24;
                const metrics = await this.orchestrator.getAgentMetrics(req.params.agentId, hours);
                res.json({ metrics });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    private setupWorkflowRoutes(): void {
        // Get workflows for optimization
        this.app.get('/api/workflows/optimization-candidates', async (req: Request, res: Response) => {
            try {
                const workflows = await this.database.getWorkflowsForOptimization();
                res.json({ workflows });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Save workflow
        this.app.post('/api/workflows', async (req: Request, res: Response) => {
            try {
                const workflow = req.body;
                await this.database.saveWorkflow(workflow);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get workflow
        this.app.get('/api/workflows/:workflowId', async (req: Request, res: Response) => {
            try {
                const workflow = await this.database.getWorkflow(req.params.workflowId);
                res.json({ workflow });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Update workflow
        this.app.put('/api/workflows/:workflowId', async (req: Request, res: Response) => {
            try {
                const workflow = req.body;
                await this.database.updateWorkflow(req.params.workflowId, workflow);
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get workflow changes
        this.app.get('/api/workflows/:workflowId/changes', async (req: Request, res: Response) => {
            try {
                const limit = parseInt(req.query.limit as string) || 50;
                const changes = await this.database.query(
                    `SELECT * FROM workflow_changes 
                     WHERE workflow_id = $1 
                     ORDER BY created_at DESC 
                     LIMIT $2`,
                    [req.params.workflowId, limit]
                );
                res.json({ changes: changes.rows });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get workflow suggestions
        this.app.get('/api/workflows/:workflowId/suggestions', async (req: Request, res: Response) => {
            try {
                const status = req.query.status as string;
                let query = `SELECT * FROM optimization_suggestions WHERE workflow_id = $1`;
                const params: any[] = [req.params.workflowId];
                
                if (status) {
                    query += ` AND status = $2`;
                    params.push(status);
                }
                
                query += ` ORDER BY created_at DESC`;
                
                const suggestions = await this.database.query(query, params);
                res.json({ suggestions: suggestions.rows });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    private setupMetricsRoutes(): void {
        // Dashboard stats
        this.app.get('/api/metrics/dashboard', async (req: Request, res: Response) => {
            try {
                const stats = await this.database.getDashboardStats();
                const queueStatus = await this.orchestrator.getQueueStatus();
                const wsStats = this.wsManager.getConnectionStats();
                
                res.json({
                    database: stats,
                    queue: queueStatus,
                    websocket: wsStats,
                    timestamp: new Date()
                });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Recent activity
        this.app.get('/api/metrics/activity', async (req: Request, res: Response) => {
            try {
                const limit = parseInt(req.query.limit as string) || 50;
                const activity = await this.database.getRecentActivity(limit);
                res.json({ activity });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Performance metrics
        this.app.get('/api/metrics/performance', async (req: Request, res: Response) => {
            try {
                const days = parseInt(req.query.days as string) || 7;
                const metrics = await this.database.query(
                    `SELECT * FROM performance_benchmarks 
                     WHERE created_at > NOW() - INTERVAL '${days} days'
                     ORDER BY created_at DESC`,
                    []
                );
                res.json({ metrics: metrics.rows });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Agent performance
        this.app.get('/api/metrics/agents', async (req: Request, res: Response) => {
            try {
                const metrics = await this.database.query(
                    `SELECT 
                        agent_id,
                        agent_type,
                        COUNT(*) as total_runs,
                        AVG(metric_value) as avg_value,
                        MAX(metric_value) as max_value,
                        MIN(metric_value) as min_value
                     FROM agent_metrics
                     WHERE timestamp > NOW() - INTERVAL '24 hours'
                     GROUP BY agent_id, agent_type`,
                    []
                );
                res.json({ metrics: metrics.rows });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    private setupSystemRoutes(): void {
        // System events
        this.app.get('/api/system/events', async (req: Request, res: Response) => {
            try {
                const limit = parseInt(req.query.limit as string) || 100;
                const severity = req.query.severity as string;
                
                let query = `SELECT * FROM system_events`;
                const params: any[] = [];
                
                if (severity) {
                    query += ` WHERE severity = $1`;
                    params.push(severity);
                }
                
                query += ` ORDER BY created_at DESC LIMIT ${limit}`;
                
                const events = await this.database.query(query, params);
                res.json({ events: events.rows });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Queue management
        this.app.post('/api/system/queue/pause', async (req: Request, res: Response) => {
            try {
                await this.orchestrator.pauseQueue();
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/system/queue/resume', async (req: Request, res: Response) => {
            try {
                await this.orchestrator.resumeQueue();
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.delete('/api/system/queue/clear', async (req: Request, res: Response) => {
            try {
                await this.orchestrator.clearQueue();
                res.json({ success: true });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/system/queue/status', async (req: Request, res: Response) => {
            try {
                const status = await this.orchestrator.getQueueStatus();
                res.json({ status });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });

        // Configuration
        this.app.get('/api/system/config', async (req: Request, res: Response) => {
            try {
                const config = {
                    version: '1.0.0',
                    environment: process.env.NODE_ENV || 'development',
                    features: {
                        aiProviders: ['openai', 'anthropic'],
                        agentTypes: ['mcp', 'telegram', 'multi-agent'],
                        maxWorkflowSize: 50,
                        maxExecutionTime: 300000 // 5 minutes
                    }
                };
                res.json({ config });
            } catch (error: any) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}