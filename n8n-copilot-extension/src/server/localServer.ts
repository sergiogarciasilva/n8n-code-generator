import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
import { WorkflowValidator } from '../validators/workflowValidator';

export class LocalServer {
    private app: Express;
    private server: Server | null = null;
    private io: SocketIOServer | null = null;
    private validator: WorkflowValidator;

    constructor(private port: number) {
        this.app = express();
        this.validator = new WorkflowValidator();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // CORS for local development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            next();
        });
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Validate workflow
        this.app.post('/api/validate', async (req: Request, res: Response) => {
            try {
                const workflow = req.body;
                const results = await this.validator.validate(workflow);
                res.json({ success: true, results });
            } catch (error: any) {
                res.status(400).json({ success: false, error: error.message });
            }
        });

        // Execute workflow locally
        this.app.post('/api/execute', async (req: Request, res: Response) => {
            try {
                const { workflow, mockData } = req.body;
                
                // Simulate local execution
                const executionId = `local-${Date.now()}`;
                
                // Emit execution start event
                if (this.io) {
                    this.io.emit('execution:start', { executionId, workflow: workflow.name });
                }

                // Simulate node execution
                const results = await this.simulateExecution(workflow, mockData);
                
                // Emit execution complete event
                if (this.io) {
                    this.io.emit('execution:complete', { executionId, results });
                }

                res.json({ success: true, executionId, results });
            } catch (error: any) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get workflow templates
        this.app.get('/api/templates', async (req: Request, res: Response) => {
            // This would query the PostgreSQL database
            const templates = [
                {
                    id: 'telegram-bot-basic',
                    name: 'Basic Telegram Bot',
                    category: 'telegram',
                    description: 'Simple bot with command handling',
                    nodes: [],
                    tags: ['bot', 'telegram', 'messaging']
                },
                {
                    id: 'mcp-context-handler',
                    name: 'MCP Context Handler',
                    category: 'mcp',
                    description: 'Model Context Protocol workflow',
                    nodes: [],
                    tags: ['mcp', 'ai', 'context']
                },
                {
                    id: 'multi-agent-orchestrator',
                    name: 'Multi-Agent Orchestrator',
                    category: 'agent',
                    description: 'Orchestrate multiple AI agents',
                    nodes: [],
                    tags: ['agent', 'ai', 'orchestration']
                }
            ];
            
            res.json({ success: true, templates });
        });

        // Save workflow template
        this.app.post('/api/templates', async (req: Request, res: Response) => {
            try {
                const template = req.body;
                // Save to PostgreSQL
                res.json({ success: true, id: `template-${Date.now()}` });
            } catch (error: any) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get execution history
        this.app.get('/api/executions', async (req: Request, res: Response) => {
            // This would query execution history from database
            const executions = [];
            res.json({ success: true, executions });
        });

        // Get performance metrics
        this.app.get('/api/metrics', async (req: Request, res: Response) => {
            const metrics = {
                avgExecutionTime: 1250,
                successRate: 85,
                totalExecutions: 42,
                nodeUsageStats: {
                    'n8n-nodes-base.httpRequest': 120,
                    'n8n-nodes-base.telegram': 85,
                    'n8n-nodes-base.code': 200
                }
            };
            res.json({ success: true, metrics });
        });
    }

    async start(): Promise<void> {
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                console.log(`n8n Copilot local server running on port ${this.port}`);
                
                // Set up Socket.IO for real-time updates
                this.io = new SocketIOServer(this.server!, {
                    cors: {
                        origin: '*',
                        methods: ['GET', 'POST']
                    }
                });

                this.setupSocketHandlers();
                resolve();
            });
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        if (this.io) {
            this.io.close();
            this.io = null;
        }
    }

    private setupSocketHandlers(): void {
        if (!this.io) return;

        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);

            socket.on('workflow:validate', async (data) => {
                try {
                    const results = await this.validator.validate(data.workflow);
                    socket.emit('validation:result', { success: true, results });
                } catch (error: any) {
                    socket.emit('validation:result', { success: false, error: error.message });
                }
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });
    }

    private async simulateExecution(workflow: any, mockData: any): Promise<any> {
        const results = {
            nodes: {} as any,
            executionTime: 0,
            success: true
        };

        const startTime = Date.now();

        // Simulate execution of each node
        for (const node of workflow.nodes) {
            const nodeStartTime = Date.now();
            
            // Emit node execution start
            if (this.io) {
                this.io.emit('node:start', { nodeId: node.id, nodeName: node.name });
            }

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

            const nodeResult = {
                nodeId: node.id,
                nodeName: node.name,
                executionTime: Date.now() - nodeStartTime,
                output: this.generateMockOutput(node, mockData),
                success: true
            };

            results.nodes[node.id] = nodeResult;

            // Emit node execution complete
            if (this.io) {
                this.io.emit('node:complete', nodeResult);
            }
        }

        results.executionTime = Date.now() - startTime;
        return results;
    }

    private generateMockOutput(node: any, mockData: any): any {
        // Generate mock output based on node type
        switch (node.type) {
            case 'n8n-nodes-base.httpRequest':
                return {
                    statusCode: 200,
                    body: { message: 'Mock HTTP response', data: mockData }
                };
            case 'n8n-nodes-base.telegram':
                return {
                    message_id: Math.floor(Math.random() * 10000),
                    chat: { id: 123456, type: 'private' },
                    text: 'Mock message sent'
                };
            case 'n8n-nodes-base.code':
                return mockData || { processed: true };
            default:
                return { data: mockData || {}, nodeType: node.type };
        }
    }
}