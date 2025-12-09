/**
 * MCP API Router - REST endpoints for MCP server management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getMCPServerManager } from '../mcp';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/mcp/servers
 * List all configured MCP servers and their status
 */
router.get('/servers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const manager = getMCPServerManager();
        const statuses = manager.getAllServerStatuses();

        res.json({
            success: true,
            servers: statuses,
            connected: manager.getConnectedServers().length,
            total: statuses.length
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/mcp/servers/:serverId
 * Get status of a specific MCP server
 */
router.get('/servers/:serverId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serverId } = req.params;
        const manager = getMCPServerManager();
        const status = manager.getServerStatus(serverId);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: `Server ${serverId} not found`
            });
        }

        res.json({
            success: true,
            server: status
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/mcp/servers/:serverId/start
 * Start a specific MCP server
 */
router.post('/servers/:serverId/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serverId } = req.params;
        const manager = getMCPServerManager();

        await manager.startServer(serverId);
        const status = manager.getServerStatus(serverId);

        res.json({
            success: true,
            message: `Server ${serverId} started`,
            server: status
        });
    } catch (error: any) {
        logger.error(`Failed to start server ${req.params.serverId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mcp/servers/:serverId/stop
 * Stop a specific MCP server
 */
router.post('/servers/:serverId/stop', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serverId } = req.params;
        const manager = getMCPServerManager();

        await manager.stopServer(serverId);

        res.json({
            success: true,
            message: `Server ${serverId} stopped`
        });
    } catch (error: any) {
        logger.error(`Failed to stop server ${req.params.serverId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mcp/servers/:serverId/restart
 * Restart a specific MCP server
 */
router.post('/servers/:serverId/restart', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serverId } = req.params;
        const manager = getMCPServerManager();

        await manager.restartServer(serverId);
        const status = manager.getServerStatus(serverId);

        res.json({
            success: true,
            message: `Server ${serverId} restarted`,
            server: status
        });
    } catch (error: any) {
        logger.error(`Failed to restart server ${req.params.serverId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mcp/tools
 * List all available tools from all connected servers
 */
router.get('/tools', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const manager = getMCPServerManager();
        const tools = manager.getAllTools();

        res.json({
            success: true,
            tools,
            count: tools.length
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/mcp/tools/call
 * Call a tool on a specific server
 */
router.post('/tools/call', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serverId, toolName, arguments: args } = req.body;

        if (!serverId || !toolName) {
            return res.status(400).json({
                success: false,
                error: 'serverId and toolName are required'
            });
        }

        const manager = getMCPServerManager();
        const result = await manager.callTool({
            serverId,
            toolName,
            arguments: args || {}
        });

        res.json({
            success: result.success,
            result: result.content,
            isError: result.isError,
            error: result.errorMessage,
            executionTime: result.executionTime
        });
    } catch (error: any) {
        logger.error('Failed to call tool:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mcp/tools/call/:toolName
 * Call a tool by name (auto-discovers which server has it)
 */
router.post('/tools/call/:toolName', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { toolName } = req.params;
        const args = req.body;

        const manager = getMCPServerManager();
        const result = await manager.callToolByName(toolName, args);

        res.json({
            success: result.success,
            result: result.content,
            isError: result.isError,
            error: result.errorMessage,
            executionTime: result.executionTime
        });
    } catch (error: any) {
        logger.error(`Failed to call tool ${req.params.toolName}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mcp/servers/:serverId/resources
 * List resources from a specific server
 */
router.get('/servers/:serverId/resources', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serverId } = req.params;
        const manager = getMCPServerManager();
        const status = manager.getServerStatus(serverId);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: `Server ${serverId} not found`
            });
        }

        res.json({
            success: true,
            resources: status.resources
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/mcp/resources/read
 * Read a resource from a server
 */
router.post('/resources/read', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serverId, uri } = req.body;

        if (!serverId || !uri) {
            return res.status(400).json({
                success: false,
                error: 'serverId and uri are required'
            });
        }

        const manager = getMCPServerManager();
        const result = await manager.readResource({ serverId, uri });

        res.json({
            success: result.success,
            content: result.content,
            mimeType: result.mimeType,
            error: result.error
        });
    } catch (error: any) {
        logger.error('Failed to read resource:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mcp/servers/:serverId/prompts
 * List prompts from a specific server
 */
router.get('/servers/:serverId/prompts', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serverId } = req.params;
        const manager = getMCPServerManager();
        const status = manager.getServerStatus(serverId);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: `Server ${serverId} not found`
            });
        }

        res.json({
            success: true,
            prompts: status.prompts
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/mcp/prompts/execute
 * Execute a prompt from a server
 */
router.post('/prompts/execute', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serverId, promptName, arguments: args } = req.body;

        if (!serverId || !promptName) {
            return res.status(400).json({
                success: false,
                error: 'serverId and promptName are required'
            });
        }

        const manager = getMCPServerManager();
        const result = await manager.executePrompt({
            serverId,
            promptName,
            arguments: args
        });

        res.json({
            success: result.success,
            messages: result.messages,
            error: result.error
        });
    } catch (error: any) {
        logger.error('Failed to execute prompt:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/mcp/reload
 * Reload MCP configuration
 */
router.post('/reload', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const manager = getMCPServerManager();
        await manager.reloadConfiguration();

        res.json({
            success: true,
            message: 'Configuration reloaded',
            servers: manager.getAllServerStatuses()
        });
    } catch (error: any) {
        logger.error('Failed to reload configuration:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mcp/config
 * Get current MCP configuration (sanitized)
 */
router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const manager = getMCPServerManager();
        const config = manager.getConfiguration();

        if (!config) {
            return res.json({
                success: true,
                config: null
            });
        }

        // Sanitize sensitive data
        const sanitizedConfig = {
            ...config,
            mcpServers: Object.fromEntries(
                Object.entries(config.mcpServers).map(([id, server]) => [
                    id,
                    {
                        ...server,
                        env: Object.fromEntries(
                            Object.entries(server.env).map(([key, value]) => [
                                key,
                                key.toLowerCase().includes('key') ||
                                key.toLowerCase().includes('secret') ||
                                key.toLowerCase().includes('password')
                                    ? '***'
                                    : value
                            ])
                        )
                    }
                ])
            )
        };

        res.json({
            success: true,
            config: sanitizedConfig
        });
    } catch (error) {
        next(error);
    }
});

export default router;
