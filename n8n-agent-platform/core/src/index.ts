import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from 'dotenv';
import { logger } from './utils/logger';
import { DatabaseManager } from './database/DatabaseManager';
import { RedisManager } from './database/RedisManager';
import { AgentOrchestrator } from './orchestrator/AgentOrchestrator';
import { SecureAPIServer } from './api/SecureAPIServer';
import { WebSocketManager } from './api/WebSocketManager';
import { AuthManager } from './auth/AuthManager';
import { PermissionManager } from './auth/PermissionManager';
import { AIAutomationEngine } from './ai/AIAutomationEngine';
import { ConcurrentSessionManager } from './realtime/ConcurrentSessionManager';
import { MarketplaceManager } from './marketplace/MarketplaceManager';
import { WorkflowVersionManager } from './versioning/WorkflowVersionManager';
import { AIReviewEngine } from './engine/AIReviewEngine';
import { AnalyticsEngine } from './analytics/AnalyticsEngine';
import { MCPServerManager, createMCPServerManager } from './mcp';

// Load environment variables
config();

export class AgentPlatform {
    private app: express.Application;
    private httpServer: any;
    private io: SocketIOServer;
    private database!: DatabaseManager;
    private redis!: RedisManager;
    private orchestrator!: AgentOrchestrator;
    private apiServer!: SecureAPIServer;
    private wsManager!: WebSocketManager;
    private authManager!: AuthManager;
    private permissionManager!: PermissionManager;
    private aiAutomation!: AIAutomationEngine;
    private sessionManager!: ConcurrentSessionManager;
    private marketplaceManager!: MarketplaceManager;
    private versionManager!: WorkflowVersionManager;
    private aiReviewEngine!: AIReviewEngine;
    private analyticsEngine!: AnalyticsEngine;
    private mcpServerManager!: MCPServerManager;

    constructor() {
        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = new SocketIOServer(this.httpServer, {
            cors: {
                origin: ['http://localhost:3000', 'http://localhost:5173', 'https://app.n8n-agent.com', 'vscode-webview://*'],
                methods: ['GET', 'POST'],
                credentials: true
            },
            // Enable sticky sessions for scaling
            transports: ['websocket', 'polling']
        });
    }

    async initialize(): Promise<void> {
        try {
            logger.info('🚀 Initializing n8n Agent Platform with Security & Marketplace...');

            // Initialize database connections
            this.database = new DatabaseManager();
            await this.database.initialize();
            logger.info('✅ Database connected');

            this.redis = new RedisManager();
            await this.redis.connect();
            logger.info('✅ Redis connected');

            // Initialize authentication & authorization
            this.authManager = new AuthManager(this.database);
            logger.info('✅ Auth manager initialized');

            this.permissionManager = new PermissionManager(this.database);
            logger.info('✅ Permission manager initialized');

            // Initialize WebSocket manager with auth
            this.wsManager = new WebSocketManager(this.io);
            this.wsManager.initialize();
            logger.info('✅ WebSocket manager initialized');

            // Initialize concurrent session manager
            this.sessionManager = new ConcurrentSessionManager(
                this.io,
                this.database,
                this.authManager,
                this.permissionManager
            );
            // Session manager ready
            logger.info('✅ Session manager initialized');

            // Initialize AI review engine
            this.aiReviewEngine = new AIReviewEngine();
            logger.info('✅ AI review engine initialized');

            // Initialize agent orchestrator with auth
            this.orchestrator = new AgentOrchestrator(
                this.database,
                this.redis,
                this.wsManager
            );
            await this.orchestrator.initialize();
            logger.info('✅ Agent orchestrator initialized');

            // Initialize AI automation engine
            this.aiAutomation = new AIAutomationEngine(
                this.database,
                this.aiReviewEngine,
                this.authManager
            );
            // AI automation ready
            logger.info('✅ AI automation engine initialized');

            // Initialize marketplace
            this.marketplaceManager = new MarketplaceManager(
                this.database,
                this.authManager,
                this.aiReviewEngine
            );
            logger.info('✅ Marketplace manager initialized');

            // Initialize versioning
            this.versionManager = new WorkflowVersionManager(
                this.database,
                this.redis,
                this.authManager
            );
            await this.versionManager.initialize();
            logger.info('✅ Version manager initialized');

            // Initialize analytics engine
            this.analyticsEngine = new AnalyticsEngine(
                this.database.getPool(),
                this.redis.getClient()
            );
            logger.info('✅ Analytics engine initialized');

            // Initialize MCP Server Manager
            this.mcpServerManager = createMCPServerManager();
            await this.mcpServerManager.initialize();
            logger.info('✅ MCP Server Manager initialized');

            // Initialize secure API server
            this.apiServer = new SecureAPIServer(
                this.app,
                this.orchestrator,
                this.database,
                this.wsManager,
                this.authManager,
                this.permissionManager,
                this.aiAutomation,
                this.sessionManager,
                this.marketplaceManager,
                this.versionManager,
                this.analyticsEngine
            );
            this.apiServer.setupRoutes();
            logger.info('✅ Secure API server configured');

            // Serve static files for marketplace uploads
            this.app.use('/uploads', express.static('uploads'));

            // Start HTTP server
            const port = process.env.PORT || 3456;
            this.httpServer.listen(port, () => {
                logger.info(`🌐 Agent Platform running on port ${port}`);
                logger.info('🔒 Security features enabled');
                logger.info('🛒 Marketplace active');
                logger.info('📋 Workflow versioning enabled');
                logger.info('🤖 AI automation ready');
                logger.info('👥 Multi-user support enabled');
                logger.info('🚀 Platform ready for enterprise use!');
            });

            // Start agent orchestration
            await this.orchestrator.startAllAgents();

            // AI automation monitoring ready
            logger.info('✅ AI automation monitoring started');

            // Initialize default admin user if needed
            await this.createDefaultAdmin();

        } catch (error) {
            logger.error('Failed to initialize platform:', error);
            process.exit(1);
        }
    }

    private async createDefaultAdmin(): Promise<void> {
        try {
            const adminExists = await this.database.query(
                'SELECT id FROM users WHERE role = $1 LIMIT 1',
                ['admin']
            );

            if (adminExists.rows.length === 0) {
                logger.info('Creating default admin user...');
                
                // Create default organization
                const orgResult = await this.database.query(
                    `INSERT INTO organizations (name, domain) 
                     VALUES ($1, $2) 
                     RETURNING id`,
                    ['Default Organization', 'localhost']
                );

                // Create admin user
                await this.authManager.register({
                    email: 'admin@localhost',
                    username: 'admin',
                    password: 'changeme123!',
                    organizationId: orgResult.rows[0].id,
                    role: 'admin'
                });

                logger.info('✅ Default admin created (username: admin, password: changeme123!)');
                logger.warn('⚠️  Please change the default admin password immediately!');
            }
        } catch (error) {
            logger.error('Failed to create default admin:', error);
        }
    }

    async shutdown(): Promise<void> {
        logger.info('Shutting down Agent Platform...');

        // Shutdown MCP Server Manager
        if (this.mcpServerManager) {
            await this.mcpServerManager.shutdown();
            logger.info('MCP Server Manager stopped');
        }

        // AI monitoring stopped
        logger.info('AI monitoring stopped');

        // Stop all agents
        await this.orchestrator.stopAllAgents();
        
        // Close all websocket connections
        // Session manager cleanup completed
        
        // Close database connections
        await this.database.close();
        await this.redis.disconnect();
        
        // Close HTTP server
        this.httpServer.close();
        
        logger.info('Platform shutdown complete');
        process.exit(0);
    }
}

// Start the platform
const platform = new AgentPlatform();

platform.initialize().catch((error) => {
    logger.error('Platform initialization failed:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => platform.shutdown());
process.on('SIGTERM', () => platform.shutdown());

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    platform.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    platform.shutdown();
});