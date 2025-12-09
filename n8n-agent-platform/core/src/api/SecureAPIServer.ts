import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { AgentOrchestrator } from '../orchestrator/AgentOrchestrator';
import { DatabaseManager } from '../database/DatabaseManager';
import { WebSocketManager } from './WebSocketManager';
import { AuthManager } from '../auth/AuthManager';
import { PermissionManager } from '../auth/PermissionManager';
import { SecurityMiddleware, AuthenticatedRequest } from '../middleware/SecurityMiddleware';
import { AIAutomationEngine } from '../ai/AIAutomationEngine';
import { ConcurrentSessionManager } from '../realtime/ConcurrentSessionManager';
import { MarketplaceManager } from '../marketplace/MarketplaceManager';
import { MarketplaceRouter } from './MarketplaceRouter';
import { WorkflowVersionManager } from '../versioning/WorkflowVersionManager';
import { VersioningRouter } from './VersioningRouter';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { AnalyticsRouter } from './AnalyticsRouter';
import { EnterpriseConnectorManager } from '../connectors/EnterpriseConnectorManager';
import { createEnterpriseConnectorRoutes } from './routes/enterprise-connectors';
import { WorkflowGeneratorRouter } from './WorkflowGeneratorRouter';
import MCPRouter from './MCPRouter';
import { logger, logAPICall } from '../utils/logger';
import Joi from 'joi';

export class SecureAPIServer {
    private security: SecurityMiddleware;
    private marketplaceRouter?: MarketplaceRouter;
    private versioningRouter?: VersioningRouter;
    private analyticsRouter?: AnalyticsRouter;
    private workflowGeneratorRouter?: WorkflowGeneratorRouter;
    private enterpriseConnectorManager?: EnterpriseConnectorManager;

    constructor(
        private app: Application,
        private orchestrator: AgentOrchestrator,
        private database: DatabaseManager,
        private wsManager: WebSocketManager,
        private authManager: AuthManager,
        private permissionManager: PermissionManager,
        private aiAutomation: AIAutomationEngine,
        private sessionManager: ConcurrentSessionManager,
        private marketplaceManager?: MarketplaceManager,
        private versionManager?: WorkflowVersionManager,
        private analyticsEngine?: AnalyticsEngine,
        enterpriseConnectorManager?: EnterpriseConnectorManager
    ) {
        this.enterpriseConnectorManager = enterpriseConnectorManager;
        this.security = new SecurityMiddleware(authManager, permissionManager, database);
        if (marketplaceManager) {
            this.marketplaceRouter = new MarketplaceRouter(
                marketplaceManager,
                authManager,
                permissionManager,
                database
            );
        }
        if (versionManager) {
            this.versioningRouter = new VersioningRouter(
                versionManager,
                authManager,
                permissionManager,
                database
            );
        }
        if (analyticsEngine) {
            this.analyticsRouter = new AnalyticsRouter(
                database.getPool(),
                analyticsEngine['redis'] // Access redis from analytics engine
            );
        }
        
        // Initialize WorkflowGeneratorRouter
        this.workflowGeneratorRouter = new WorkflowGeneratorRouter(
            database.getPool(),
            process.env.OPENAI_API_KEY || '',
            process.env.N8N_API_KEY,
            process.env.N8N_BASE_URL || 'http://localhost:5679'
        );
    }

    setupRoutes(): void {
        // Security middleware
        this.app.use(this.security.helmetConfig());
        this.app.use(this.security.xssProtection());
        this.app.use(this.security.sanitizeQuery());
        
        // CORS configuration
        this.app.use(cors({
            origin: (origin, callback) => {
                const allowedOrigins = [
                    'http://localhost:3000',
                    'http://localhost:5173',
                    'https://app.n8n-agent.com',
                    'vscode-webview://*'
                ];
                
                if (!origin || allowedOrigins.some(allowed => 
                    origin.match(new RegExp(allowed.replace('*', '.*')))
                )) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true,
            optionsSuccessStatus: 200
        }));

        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request size limiting
        this.app.use(this.security.requestSizeLimit('10mb'));

        // Content type validation
        this.app.use(this.security.validateContentType(['application/json', 'application/x-www-form-urlencoded']));

        // API versioning
        this.app.use('/api/v1', this.security.apiVersion('v1'));

        // Rate limiting for different routes
        this.app.use('/api/v1/auth', this.security.createRateLimiter({
            windowMs: 15 * 60 * 1000,
            max: 5,
            message: 'Too many authentication attempts'
        }));

        this.app.use('/api/v1', this.security.createRateLimiter({
            windowMs: 15 * 60 * 1000,
            max: 100
        }));

        // Request logging
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            const start = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - start;
                logAPICall(req.path, req.method, res.statusCode, duration);
            });
            
            next();
        });

        // Public routes (no auth required)
        this.setupPublicRoutes();

        // Authentication routes
        this.setupAuthRoutes();

        // Protected routes (auth required)
        this.app.use('/api/v1', this.security.authenticate());

        // Setup all API routes
        this.setupAgentRoutes();
        this.setupWorkflowRoutes();
        this.setupMetricsRoutes();
        this.setupSystemRoutes();
        this.setupAIAutomationRoutes();
        this.setupUserManagementRoutes();
        this.setupDashboardRoutes();
        this.setupNotificationRoutes();
        this.setupReportRoutes();
        this.setupChatRoutes();
        
        // Setup marketplace routes if available
        if (this.marketplaceRouter) {
            this.app.use('/api/v1/marketplace', this.marketplaceRouter.getRouter());
        }
        
        // Setup versioning routes if available
        if (this.versioningRouter) {
            this.app.use('/api/v1/versioning', this.versioningRouter.getRouter());
        }
        
        // Setup analytics routes if available
        if (this.analyticsRouter) {
            this.app.use('/api/v1/analytics', this.analyticsRouter.getRouter());
        }
        
        // Setup workflow generator routes
        if (this.workflowGeneratorRouter) {
            this.app.use('/api/v1/generator', this.workflowGeneratorRouter.getRouter());
        }
        
        // Setup enterprise connector routes if available
        if (this.enterpriseConnectorManager) {
            const enterpriseRoutes = createEnterpriseConnectorRoutes(
                this.database.getPool(),
                this.database.getRedis() as any,
                this.enterpriseConnectorManager
            );
            this.app.use('/api/v1/enterprise', enterpriseRoutes);
        }

        // Setup MCP server routes
        this.app.use('/api/v1/mcp', MCPRouter);
        logger.info('✅ MCP routes configured at /api/v1/mcp');

        // Error handling
        this.setupErrorHandling();
    }

    private setupPublicRoutes(): void {
        // Health check
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({
                status: 'healthy',
                timestamp: new Date(),
                uptime: process.uptime(),
                version: '1.0.0'
            });
        });

        // API documentation
        this.app.get('/api/v1/docs', (req: Request, res: Response) => {
            res.json({
                version: 'v1',
                endpoints: [
                    { method: 'POST', path: '/auth/register', description: 'Register new user' },
                    { method: 'POST', path: '/auth/login', description: 'Login user' },
                    { method: 'GET', path: '/agents', description: 'List agents' },
                    // ... more endpoints
                ]
            });
        });
        
        // PUBLIC GENERATOR ROUTES - Temporal para pruebas
        if (this.workflowGeneratorRouter) {
            this.app.use('/api/v1/public/generator', this.workflowGeneratorRouter.getRouter());
        }
    }

    private setupAuthRoutes(): void {
        const authRouter = express.Router();

        // User registration
        authRouter.post('/register',
            this.security.validateInput(Joi.object({
                email: Joi.string().email().required(),
                username: Joi.string().alphanum().min(3).max(30).required(),
                password: Joi.string().min(12).required(),
                organizationName: Joi.string().min(3).max(100).required()
            })),
            async (req: Request, res: Response) => {
                try {
                    // Create organization first
                    const orgResult = await this.database.query(
                        `INSERT INTO organizations (name, domain) 
                         VALUES ($1, $2) 
                         RETURNING id, encryption_key`,
                        [req.body.organizationName, req.body.email.split('@')[1]]
                    );

                    const organizationId = orgResult.rows[0].id;

                    // Register user
                    const result = await this.authManager.register({
                        ...req.body,
                        organizationId,
                        role: 'admin' // First user is admin
                    });

                    res.status(201).json({
                        user: {
                            id: result.user.id,
                            email: result.user.email,
                            username: result.user.username,
                            role: result.user.role
                        },
                        tokens: result.tokens
                    });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // User login
        authRouter.post('/login',
            this.security.validateInput(Joi.object({
                email: Joi.string().email().required(),
                password: Joi.string().required(),
                twoFactorCode: Joi.string().optional(),
                rememberMe: Joi.boolean().optional()
            })),
            async (req: Request, res: Response) => {
                try {
                    const result = await this.authManager.login({
                        ...req.body,
                        deviceInfo: req.headers['user-agent'] || 'unknown',
                        ipAddress: req.ip
                    });

                    if ('requiresTwoFactor' in result) {
                        return res.json({ requiresTwoFactor: true });
                    }

                    res.json({
                        user: {
                            id: result.user.id,
                            email: result.user.email,
                            username: result.user.username,
                            role: result.user.role
                        },
                        tokens: result.tokens
                    });
                } catch (error: any) {
                    res.status(401).json({ error: error.message });
                }
            }
        );

        // Refresh token
        authRouter.post('/refresh',
            this.security.validateInput(Joi.object({
                refreshToken: Joi.string().required()
            })),
            async (req: Request, res: Response) => {
                try {
                    const { accessToken } = await this.authManager.refreshToken(req.body.refreshToken);
                    res.json({ accessToken });
                } catch (error: any) {
                    res.status(401).json({ error: error.message });
                }
            }
        );

        // Logout
        authRouter.post('/logout',
            this.security.authenticate(),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.authManager.logout(req.user!.sessionId);
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Enable 2FA
        authRouter.post('/2fa/enable',
            this.security.authenticate(),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const { secret, qrCode } = await this.authManager.enableTwoFactor(req.user!.userId);
                    res.json({ secret, qrCode });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/auth', authRouter);
    }

    private setupAgentRoutes(): void {
        const agentRouter = express.Router();

        // List agents
        agentRouter.get('/',
            this.security.requirePermission('agents', 'read'),
            this.security.auditLog('list_agents'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const agents = this.orchestrator.getAllAgents()
                        .filter(agent => {
                            // Filter by organization
                            return agent.getConfig().organizationId === req.user!.organizationId;
                        })
                        .map(agent => agent.toJSON());
                    
                    res.json({ agents });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Create agent
        agentRouter.post('/',
            this.security.requirePermission('agents', 'create'),
            this.security.validateInput(Joi.object({
                name: Joi.string().required(),
                type: Joi.string().valid('mcp', 'telegram', 'multi-agent').required(),
                config: Joi.object().required()
            })),
            this.security.auditLog('create_agent'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    // Encrypt sensitive config
                    const encryptedConfig = await this.authManager.encryptUserData(
                        req.user!.userId,
                        req.body.config
                    );

                    const agent = await this.orchestrator.createAgent(req.body.type, {
                        ...req.body,
                        config: encryptedConfig,
                        organizationId: req.user!.organizationId,
                        createdBy: req.user!.userId
                    });

                    res.status(201).json({ agent: agent.toJSON() });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Run agent
        agentRouter.post('/:agentId/run',
            this.security.requirePermission('agents', 'execute'),
            this.security.auditLog('run_agent'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const result = await this.orchestrator.runAgent(
                        req.params.agentId,
                        req.body.workflowId
                    );
                    res.json({ result });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Other agent routes...
        this.app.use('/api/v1/agents', agentRouter);
    }

    private setupWorkflowRoutes(): void {
        const workflowRouter = express.Router();

        // List workflows
        workflowRouter.get('/',
            this.security.requirePermission('workflows', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const workflows = await this.database.query(
                        `SELECT w.* FROM workflows w
                         JOIN workflow_permissions wp ON w.id = wp.workflow_id
                         WHERE wp.user_id = $1 OR $2 = 'admin'`,
                        [req.user!.userId, req.user!.role]
                    );
                    res.json({ workflows: workflows.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Optimize workflow with AI
        workflowRouter.post('/:workflowId/optimize',
            this.security.requirePermission('workflows', 'optimize'),
            this.security.auditLog('optimize_workflow'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const result = await this.aiAutomation.autoOptimizeWorkflow(
                        req.params.workflowId,
                        req.user!.userId
                    );
                    res.json(result);
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Predict failures
        workflowRouter.get('/:workflowId/predict-failures',
            this.security.requirePermission('workflows', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const prediction = await this.aiAutomation.predictFailures(req.params.workflowId);
                    res.json(prediction);
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Detect anomalies
        workflowRouter.get('/:workflowId/anomalies',
            this.security.requirePermission('workflows', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const anomalies = await this.aiAutomation.detectAnomalies(req.params.workflowId);
                    res.json({ anomalies });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Generate documentation
        workflowRouter.post('/:workflowId/generate-docs',
            this.security.requirePermission('workflows', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const docs = await this.aiAutomation.generateDocumentation(req.params.workflowId);
                    res.json(docs);
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/workflows', workflowRouter);
    }

    private setupAIAutomationRoutes(): void {
        const aiRouter = express.Router();

        // Enable auto-healing
        aiRouter.post('/workflows/:workflowId/auto-healing',
            this.security.requirePermission('workflows', 'update'),
            this.security.auditLog('enable_auto_healing'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.aiAutomation.enableAutoHealing(
                        req.params.workflowId,
                        req.user!.userId
                    );
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Optimize resource allocation
        aiRouter.post('/optimize-resources',
            this.security.requirePermission('settings', 'update'),
            this.security.auditLog('optimize_resources'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.aiAutomation.optimizeResourceAllocation();
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/ai', aiRouter);
    }

    private setupUserManagementRoutes(): void {
        const userRouter = express.Router();

        // Get current user
        userRouter.get('/me',
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const user = await this.database.query(
                        'SELECT id, email, username, role, organization_id FROM users WHERE id = $1',
                        [req.user!.userId]
                    );
                    res.json({ user: user.rows[0] });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Update profile
        userRouter.put('/me',
            this.security.validateInput(Joi.object({
                username: Joi.string().alphanum().min(3).max(30).optional(),
                preferences: Joi.object().optional()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.database.query(
                        'UPDATE users SET username = COALESCE($1, username), preferences = COALESCE($2, preferences) WHERE id = $3',
                        [req.body.username, req.body.preferences, req.user!.userId]
                    );
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // List users (admin only)
        userRouter.get('/',
            this.security.requirePermission('users', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const users = await this.database.query(
                        'SELECT id, email, username, role, created_at, last_login FROM users WHERE organization_id = $1',
                        [req.user!.organizationId]
                    );
                    res.json({ users: users.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Invite user
        userRouter.post('/invite',
            this.security.requirePermission('users', 'create'),
            this.security.validateInput(Joi.object({
                email: Joi.string().email().required(),
                role: Joi.string().valid('admin', 'developer', 'analyst', 'viewer').required()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    // Create invitation logic
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/users', userRouter);
    }

    private setupMetricsRoutes(): void {
        // Reuse existing metrics routes with added security
        const metricsRouter = express.Router();

        metricsRouter.get('/dashboard',
            this.security.requirePermission('metrics', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const stats = await this.database.getDashboardStats();
                    const queueStatus = await this.orchestrator.getQueueStatus();
                    const wsStats = this.wsManager.getConnectionStats();
                    const activeUsers = await this.sessionManager.getActiveUsers();
                    
                    res.json({
                        database: stats,
                        queue: queueStatus,
                        websocket: wsStats,
                        activeUsers,
                        timestamp: new Date()
                    });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/metrics', metricsRouter);
    }

    private setupSystemRoutes(): void {
        const systemRouter = express.Router();

        // Get security logs
        systemRouter.get('/security/logs',
            this.security.requirePermission('logs', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const logs = await this.database.query(
                        `SELECT * FROM security_logs 
                         WHERE ($1 = 'admin' OR user_id = $2)
                         ORDER BY created_at DESC 
                         LIMIT 100`,
                        [req.user!.role, req.user!.userId]
                    );
                    res.json({ logs: logs.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get active sessions
        systemRouter.get('/sessions',
            this.security.requirePermission('users', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const sessions = await this.sessionManager.getUserSessions(req.user!.userId);
                    res.json({ sessions });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/system', systemRouter);
    }

    private setupDashboardRoutes(): void {
        const dashboardRouter = express.Router();

        // Get dashboard data
        dashboardRouter.get('/data',
            this.security.requirePermission('dashboard', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    // Get real metrics
                    const [agents, workflows, executions, errors] = await Promise.all([
                        this.database.query(
                            'SELECT COUNT(*) as count FROM agents WHERE organization_id = $1',
                            [req.user!.organizationId]
                        ),
                        this.database.query(
                            'SELECT COUNT(*) as count FROM workflows WHERE organization_id = $1',
                            [req.user!.organizationId]
                        ),
                        this.database.query(
                            'SELECT COUNT(*) as count FROM workflow_executions WHERE created_at > NOW() - INTERVAL \'24 hours\'',
                            []
                        ),
                        this.database.query(
                            'SELECT COUNT(*) as count FROM workflow_executions WHERE status = $1 AND created_at > NOW() - INTERVAL \'24 hours\'',
                            ['error']
                        )
                    ]);

                    // Get agent statuses
                    const activeAgents = this.orchestrator.getAllAgents()
                        .filter(agent => agent.getConfig().organizationId === req.user!.organizationId)
                        .map(agent => ({
                            id: agent.getId(),
                            name: agent.getName(),
                            type: agent.getType(),
                            status: agent.getStatus(),
                            health: 'healthy', // TODO: Implement getHealth() method
                            lastActivity: new Date(), // TODO: Implement getLastActivity() method
                            metrics: {} // TODO: Implement getMetrics() method
                        }));

                    // Get recent activities
                    const activities = await this.database.query(
                        `SELECT * FROM activity_logs 
                         WHERE organization_id = $1 
                         ORDER BY created_at DESC 
                         LIMIT 20`,
                        [req.user!.organizationId]
                    );

                    res.json({
                        metrics: {
                            totalAgents: parseInt(agents.rows[0].count),
                            activeAgents: activeAgents.filter(a => a.status === 'running').length,
                            totalWorkflows: parseInt(workflows.rows[0].count),
                            executionsToday: parseInt(executions.rows[0].count),
                            errorsToday: parseInt(errors.rows[0].count),
                            successRate: executions.rows[0].count > 0 
                                ? ((parseInt(executions.rows[0].count) - parseInt(errors.rows[0].count)) / parseInt(executions.rows[0].count) * 100).toFixed(1)
                                : 100
                        },
                        agents: activeAgents,
                        activities: activities.rows,
                        timestamp: new Date()
                    });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Update agent settings
        dashboardRouter.put('/agents/:agentId/settings',
            this.security.requirePermission('agents', 'update'),
            this.security.auditLog('update_agent_settings'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const agent = this.orchestrator.getAgent(req.params.agentId);
                    if (!agent) {
                        return res.status(404).json({ error: 'Agent not found' });
                    }

                    // TODO: Implement updateConfig method in BaseAgent
                    // await agent.updateConfig(req.body);
                    
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Toggle agent status
        dashboardRouter.post('/agents/:agentId/toggle',
            this.security.requirePermission('agents', 'execute'),
            this.security.auditLog('toggle_agent'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const agent = this.orchestrator.getAgent(req.params.agentId);
                    if (!agent) {
                        return res.status(404).json({ error: 'Agent not found' });
                    }

                    const currentStatus = agent.getStatus();
                    if (currentStatus === 'running') {
                        await agent.stop();
                    } else {
                        await agent.start();
                    }
                    
                    res.json({ 
                        success: true,
                        newStatus: agent.getStatus()
                    });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/dashboard', dashboardRouter);
    }

    private setupNotificationRoutes(): void {
        const notificationRouter = express.Router();

        // Get notifications
        notificationRouter.get('/',
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const notifications = await this.database.query(
                        `SELECT * FROM notifications 
                         WHERE user_id = $1 AND archived = false
                         ORDER BY created_at DESC 
                         LIMIT 50`,
                        [req.user!.userId]
                    );
                    res.json({ notifications: notifications.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Mark as read
        notificationRouter.put('/:id/read',
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.database.query(
                        'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
                        [req.params.id, req.user!.userId]
                    );
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Archive notification
        notificationRouter.delete('/:id',
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.database.query(
                        'UPDATE notifications SET archived = true WHERE id = $1 AND user_id = $2',
                        [req.params.id, req.user!.userId]
                    );
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Perform notification action
        notificationRouter.post('/:id/action',
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const notification = await this.database.query(
                        'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
                        [req.params.id, req.user!.userId]
                    );

                    if (notification.rows.length === 0) {
                        return res.status(404).json({ error: 'Notification not found' });
                    }

                    const { type, metadata } = notification.rows[0];
                    const { action } = req.body;

                    // Handle different notification actions
                    switch (type) {
                        case 'workflow_error':
                            if (action === 'view') {
                                // Redirect to workflow details
                                res.json({ redirect: `/workflows/${metadata.workflowId}` });
                            } else if (action === 'restart') {
                                // Restart workflow
                                await this.orchestrator.runAgent(metadata.agentId, metadata.workflowId);
                                res.json({ success: true, message: 'Workflow restarted' });
                            }
                            break;
                        
                        case 'new_version':
                            if (action === 'review') {
                                res.json({ redirect: `/workflows/${metadata.workflowId}/versions` });
                            }
                            break;
                        
                        default:
                            res.json({ success: true });
                    }

                    // Mark notification as actioned
                    await this.database.query(
                        'UPDATE notifications SET actioned = true WHERE id = $1',
                        [req.params.id]
                    );

                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Snooze notification
        notificationRouter.post('/:id/snooze',
            this.security.validateInput(Joi.object({
                duration: Joi.number().min(5).max(1440).required() // minutes
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const snoozeUntil = new Date(Date.now() + req.body.duration * 60 * 1000);
                    
                    await this.database.query(
                        'UPDATE notifications SET snoozed_until = $1 WHERE id = $2 AND user_id = $3',
                        [snoozeUntil, req.params.id, req.user!.userId]
                    );
                    
                    res.json({ success: true, snoozedUntil: snoozeUntil });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/notifications', notificationRouter);
    }

    private setupReportRoutes(): void {
        const reportRouter = express.Router();

        // Generate report
        reportRouter.post('/generate',
            this.security.requirePermission('reports', 'create'),
            this.security.validateInput(Joi.object({
                type: Joi.string().valid('workflow', 'agent', 'system').required(),
                format: Joi.string().valid('pdf', 'csv', 'json').required(),
                dateRange: Joi.object({
                    start: Joi.date().required(),
                    end: Joi.date().required()
                }).required(),
                filters: Joi.object().optional()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const { type, format, dateRange, filters } = req.body;
                    
                    // Generate report data
                    let reportData;
                    switch (type) {
                        case 'workflow':
                            reportData = await this.generateWorkflowReport(dateRange, filters);
                            break;
                        case 'agent':
                            reportData = await this.generateAgentReport(dateRange, filters);
                            break;
                        case 'system':
                            reportData = await this.generateSystemReport(dateRange, filters);
                            break;
                    }

                    // Format report
                    let report;
                    switch (format) {
                        case 'pdf':
                            report = await this.formatReportAsPDF(reportData);
                            res.setHeader('Content-Type', 'application/pdf');
                            res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${Date.now()}.pdf"`);
                            res.send(report);
                            break;
                        case 'csv':
                            report = this.formatReportAsCSV(reportData);
                            res.setHeader('Content-Type', 'text/csv');
                            res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${Date.now()}.csv"`);
                            res.send(report);
                            break;
                        case 'json':
                            res.json(reportData);
                            break;
                    }
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Schedule report
        reportRouter.post('/schedule',
            this.security.requirePermission('reports', 'create'),
            this.security.validateInput(Joi.object({
                name: Joi.string().required(),
                type: Joi.string().valid('workflow', 'agent', 'system').required(),
                format: Joi.string().valid('pdf', 'csv', 'json').required(),
                schedule: Joi.object({
                    frequency: Joi.string().valid('daily', 'weekly', 'monthly').required(),
                    time: Joi.string().required(),
                    dayOfWeek: Joi.number().min(0).max(6).when('frequency', {
                        is: 'weekly',
                        then: Joi.required()
                    }),
                    dayOfMonth: Joi.number().min(1).max(31).when('frequency', {
                        is: 'monthly',
                        then: Joi.required()
                    })
                }).required(),
                recipients: Joi.array().items(Joi.string().email()).required()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    // Save scheduled report
                    const result = await this.database.query(
                        `INSERT INTO scheduled_reports 
                         (name, type, format, schedule, recipients, user_id, organization_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         RETURNING id`,
                        [
                            req.body.name,
                            req.body.type,
                            req.body.format,
                            JSON.stringify(req.body.schedule),
                            req.body.recipients,
                            req.user!.userId,
                            req.user!.organizationId
                        ]
                    );

                    res.json({ 
                        success: true, 
                        reportId: result.rows[0].id,
                        message: 'Report scheduled successfully' 
                    });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/reports', reportRouter);
    }

    private setupChatRoutes(): void {
        const chatRouter = express.Router();

        // Send message to AI assistant
        chatRouter.post('/message',
            this.security.validateInput(Joi.object({
                message: Joi.string().required(),
                context: Joi.object({
                    workflowId: Joi.string().optional(),
                    agentId: Joi.string().optional(),
                    conversationId: Joi.string().optional()
                }).optional()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const { message, context } = req.body;
                    
                    // Get or create conversation
                    let conversationId = context?.conversationId;
                    if (!conversationId) {
                        const result = await this.database.query(
                            'INSERT INTO chat_conversations (user_id) VALUES ($1) RETURNING id',
                            [req.user!.userId]
                        );
                        conversationId = result.rows[0].id;
                    }

                    // Save user message
                    await this.database.query(
                        'INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                        [conversationId, 'user', message]
                    );

                    // Generate AI response using AIAutomationEngine
                    const response = await this.aiAutomation.generateChatResponse(message, {
                        userId: req.user!.userId,
                        ...context
                    });

                    // Save AI response
                    await this.database.query(
                        'INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
                        [conversationId, 'assistant', response]
                    );

                    res.json({
                        response,
                        conversationId,
                        suggestions: await this.aiAutomation.generateSuggestions(message, context)
                    });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get conversation history
        chatRouter.get('/conversations/:conversationId',
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const messages = await this.database.query(
                        `SELECT * FROM chat_messages 
                         WHERE conversation_id = $1 
                         ORDER BY created_at ASC`,
                        [req.params.conversationId]
                    );
                    res.json({ messages: messages.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        this.app.use('/api/v1/chat', chatRouter);
    }

    // Helper methods for report generation
    private async generateWorkflowReport(dateRange: any, filters: any) {
        const data = await this.database.query(
            `SELECT 
                w.name,
                COUNT(we.id) as executions,
                AVG(we.execution_time) as avg_time,
                SUM(CASE WHEN we.status = 'success' THEN 1 ELSE 0 END) as successes,
                SUM(CASE WHEN we.status = 'error' THEN 1 ELSE 0 END) as errors
             FROM workflows w
             LEFT JOIN workflow_executions we ON w.id = we.workflow_id
             WHERE we.created_at BETWEEN $1 AND $2
             GROUP BY w.id, w.name`,
            [dateRange.start, dateRange.end]
        );
        return {
            title: 'Workflow Performance Report',
            dateRange,
            data: data.rows
        };
    }

    private async generateAgentReport(dateRange: any, filters: any) {
        const agents = this.orchestrator.getAllAgents();
        const report = agents.map(agent => ({
            name: agent.getName(),
            type: agent.getType(),
            status: agent.getStatus(),
            metrics: {}, // TODO: Implement getMetrics() method
            uptime: 0 // TODO: Implement uptime tracking
        }));
        return {
            title: 'Agent Status Report',
            dateRange,
            data: report
        };
    }

    private async generateSystemReport(dateRange: any, filters: any) {
        const [users, storage, performance] = await Promise.all([
            this.database.query('SELECT COUNT(*) as total FROM users'),
            this.database.query('SELECT pg_database_size(current_database()) as size'),
            this.database.query(
                `SELECT 
                    AVG(execution_time) as avg_execution_time,
                    COUNT(*) as total_executions
                 FROM workflow_executions
                 WHERE created_at BETWEEN $1 AND $2`,
                [dateRange.start, dateRange.end]
            )
        ]);
        return {
            title: 'System Health Report',
            dateRange,
            data: {
                totalUsers: users.rows[0].total,
                databaseSize: storage.rows[0].size,
                performance: performance.rows[0]
            }
        };
    }

    private async formatReportAsPDF(data: any): Promise<Buffer> {
        // Use a PDF generation library like puppeteer or pdfkit
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument();
        
        doc.fontSize(20).text(data.title, 50, 50);
        doc.fontSize(12).text(`Date Range: ${data.dateRange.start} - ${data.dateRange.end}`, 50, 100);
        
        // Add data to PDF
        let y = 150;
        data.data.forEach((row: any) => {
            doc.text(JSON.stringify(row), 50, y);
            y += 20;
        });
        
        doc.end();
        
        return new Promise((resolve) => {
            const chunks: any[] = [];
            doc.on('data', (chunk: any) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
        });
    }

    private formatReportAsCSV(data: any): string {
        const headers = Object.keys(data.data[0]).join(',');
        const rows = data.data.map((row: any) => Object.values(row).join(','));
        return [headers, ...rows].join('\n');
    }

    private setupErrorHandling(): void {
        // 404 handler
        this.app.use((req: Request, res: Response) => {
            res.status(404).json({
                error: 'Not found',
                path: req.path,
                timestamp: new Date()
            });
        });

        // Error handling middleware
        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            logger.error('API Error:', err);

            // Don't leak error details in production
            const isDev = process.env.NODE_ENV === 'development';
            
            res.status(500).json({
                error: 'Internal server error',
                message: isDev ? err.message : 'An error occurred',
                stack: isDev ? err.stack : undefined,
                timestamp: new Date()
            });
        });
    }
}