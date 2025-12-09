const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:3000"],
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.API_PORT || 3000;

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '15432'),
    database: process.env.DB_NAME || 'n8n_agent_platform',
    user: process.env.DB_USER || 'analytics',
    password: process.env.DB_PASSWORD || 'analytics',
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'n8n-agent-platform-api',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// API Routes

// Agents endpoints
app.get('/api/agents', async (req, res) => {
    try {
        const agents = [
            {
                id: 'agent-1',
                name: 'Workflow Optimizer',
                type: 'optimization',
                status: 'active',
                description: 'Optimizes n8n workflows for performance',
                stats: {
                    workflowsProcessed: 150,
                    optimizationsSuggested: 89,
                    averageImprovement: 35
                }
            },
            {
                id: 'agent-2',
                name: 'Error Handler',
                type: 'error-handling',
                status: 'active',
                description: 'Monitors and handles workflow errors',
                stats: {
                    errorsDetected: 45,
                    errorsResolved: 42,
                    successRate: 93.3
                }
            },
            {
                id: 'agent-3',
                name: 'Security Scanner',
                type: 'security',
                status: 'paused',
                description: 'Scans workflows for security vulnerabilities',
                stats: {
                    workflowsScanned: 200,
                    vulnerabilitiesFound: 3,
                    lastScan: new Date().toISOString()
                }
            }
        ];
        res.json(agents);
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

// Workflows endpoints
app.get('/api/workflows', async (req, res) => {
    try {
        const workflows = [
            {
                id: 'wf-1',
                name: 'Customer Onboarding',
                status: 'active',
                executionCount: 1250,
                successRate: 98.5,
                avgExecutionTime: 3.2,
                lastExecution: new Date(Date.now() - 1000 * 60 * 5).toISOString()
            },
            {
                id: 'wf-2',
                name: 'Data Sync Pipeline',
                status: 'active',
                executionCount: 5420,
                successRate: 99.1,
                avgExecutionTime: 1.8,
                lastExecution: new Date(Date.now() - 1000 * 60 * 2).toISOString()
            },
            {
                id: 'wf-3',
                name: 'Email Marketing Campaign',
                status: 'inactive',
                executionCount: 850,
                successRate: 97.2,
                avgExecutionTime: 5.5,
                lastExecution: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
            }
        ];
        res.json(workflows);
    } catch (error) {
        console.error('Error fetching workflows:', error);
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
});

// Metrics endpoints
app.get('/api/metrics', async (req, res) => {
    try {
        const metrics = {
            overview: {
                totalWorkflows: 45,
                activeWorkflows: 38,
                totalExecutions: 125000,
                successRate: 98.2,
                avgExecutionTime: 2.8
            },
            performance: {
                cpuUsage: 45,
                memoryUsage: 62,
                diskUsage: 38,
                networkLatency: 12
            },
            timeline: generateTimelineData()
        };
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// Analytics endpoints
app.get('/api/analytics/:metric', async (req, res) => {
    try {
        const { metric } = req.params;
        const data = generateAnalyticsData(metric);
        res.json(data);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Optimization suggestions
app.get('/api/optimizations', async (req, res) => {
    try {
        const optimizations = [
            {
                id: 'opt-1',
                type: 'performance',
                title: 'Reduce HTTP Request nodes',
                description: 'Combine multiple HTTP requests into batch operations',
                impact: 'high',
                estimatedImprovement: '40% faster execution',
                affectedWorkflows: ['wf-1', 'wf-2']
            },
            {
                id: 'opt-2',
                type: 'reliability',
                title: 'Add error handling to Database nodes',
                description: 'Implement retry logic for database operations',
                impact: 'medium',
                estimatedImprovement: '15% fewer failures',
                affectedWorkflows: ['wf-2']
            },
            {
                id: 'opt-3',
                type: 'cost',
                title: 'Optimize webhook polling frequency',
                description: 'Reduce polling frequency during off-peak hours',
                impact: 'low',
                estimatedImprovement: '20% cost reduction',
                affectedWorkflows: ['wf-3']
            }
        ];
        res.json(optimizations);
    } catch (error) {
        console.error('Error fetching optimizations:', error);
        res.status(500).json({ error: 'Failed to fetch optimizations' });
    }
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send initial data
    socket.emit('welcome', { 
        message: 'Connected to n8n Agent Platform',
        timestamp: new Date().toISOString()
    });

    // Simulate real-time metrics
    const metricsInterval = setInterval(() => {
        socket.emit('metrics:update', {
            cpu: 40 + Math.random() * 20,
            memory: 50 + Math.random() * 30,
            activeWorkflows: Math.floor(35 + Math.random() * 10),
            executionsPerMinute: Math.floor(100 + Math.random() * 50)
        });
    }, 5000);

    // Simulate workflow events
    const eventsInterval = setInterval(() => {
        const events = [
            { type: 'workflow:started', workflowId: 'wf-' + Math.floor(Math.random() * 3 + 1) },
            { type: 'workflow:completed', workflowId: 'wf-' + Math.floor(Math.random() * 3 + 1) },
            { type: 'optimization:suggested', workflowId: 'wf-' + Math.floor(Math.random() * 3 + 1) }
        ];
        const randomEvent = events[Math.floor(Math.random() * events.length)];
        socket.emit('workflow:event', {
            ...randomEvent,
            timestamp: new Date().toISOString()
        });
    }, 8000);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        clearInterval(metricsInterval);
        clearInterval(eventsInterval);
    });
});

// Helper functions
function generateTimelineData() {
    const data = [];
    const now = Date.now();
    for (let i = 0; i < 24; i++) {
        data.push({
            timestamp: new Date(now - i * 60 * 60 * 1000).toISOString(),
            executions: Math.floor(80 + Math.random() * 40),
            errors: Math.floor(Math.random() * 5),
            successRate: 95 + Math.random() * 4
        });
    }
    return data.reverse();
}

function generateAnalyticsData(metric) {
    const data = [];
    const now = Date.now();
    for (let i = 0; i < 30; i++) {
        data.push({
            date: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
            value: Math.floor(Math.random() * 100) + 50,
            trend: Math.random() > 0.5 ? 'up' : 'down'
        });
    }
    return {
        metric,
        data: data.reverse(),
        summary: {
            current: data[data.length - 1].value,
            average: 75,
            min: 50,
            max: 150,
            trend: 'improving'
        }
    };
}

// Workflow Generator Endpoint (temporary implementation)
app.post('/api/v1/generator/generate', (req, res) => {
    const { description, category, difficulty, useCase, specificRequirements, integrations } = req.body;
    
    if (!description || !description.trim()) {
        return res.status(400).json({
            error: 'Description is required',
            message: 'Please provide a description of the workflow you want to generate'
        });
    }

    // Mock workflow generation response
    const mockWorkflow = {
        id: `workflow_${Date.now()}`,
        name: `Generated: ${description.slice(0, 50)}...`,
        nodes: [
            {
                id: "start",
                type: "webhook",
                name: "Webhook",
                position: [250, 300],
                parameters: {
                    httpMethod: "POST",
                    path: "webhook"
                }
            },
            {
                id: "process",
                type: "code",
                name: "Process Data",
                position: [450, 300],
                parameters: {
                    jsCode: `// Process the incoming data
return {
  processedData: items[0].json,
  timestamp: new Date().toISOString(),
  description: "${description}"
};`
                }
            },
            {
                id: "output",
                type: "http-request",
                name: "Send Response",
                position: [650, 300],
                parameters: {
                    url: "https://webhook.site/your-endpoint",
                    method: "POST"
                }
            }
        ],
        connections: {
            "start": {
                "main": [
                    [
                        {
                            "node": "process",
                            "type": "main",
                            "index": 0
                        }
                    ]
                ]
            },
            "process": {
                "main": [
                    [
                        {
                            "node": "output",
                            "type": "main",
                            "index": 0
                        }
                    ]
                ]
            }
        }
    };

    const response = {
        success: true,
        workflow: mockWorkflow,
        metadata: {
            category: category || 'automation',
            difficulty: difficulty || 'intermediate',
            useCase: useCase || 'general',
            estimatedExecutionTime: '30-60 seconds',
            generatedAt: new Date().toISOString()
        },
        usage_instructions: [
            "1. Import this workflow into your n8n instance",
            "2. Configure the webhook URL if needed",
            "3. Update the HTTP request endpoint to your desired destination",
            "4. Test the workflow with sample data",
            "5. Activate the workflow when ready"
        ],
        test_data: {
            webhook: {
                body: {
                    test: true,
                    message: "Sample test data",
                    timestamp: new Date().toISOString()
                }
            }
        },
        validation: {
            isValid: true,
            errors: [],
            warnings: [],
            suggestions: [
                "Consider adding error handling nodes",
                "Add data validation before processing",
                "Implement logging for better debugging"
            ]
        },
        generation_stats: {
            processingTime: Math.random() * 2000 + 500,
            templateUsed: "generic-webhook-processor",
            confidence: 0.85
        }
    };

    res.json(response);
});

// Error handling
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// Start server
httpServer.listen(PORT, () => {
    console.log(`n8n Agent Platform API running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log(`  GET  http://localhost:${PORT}/health`);
    console.log(`  GET  http://localhost:${PORT}/api/agents`);
    console.log(`  GET  http://localhost:${PORT}/api/workflows`);
    console.log(`  GET  http://localhost:${PORT}/api/metrics`);
    console.log(`  GET  http://localhost:${PORT}/api/analytics/:metric`);
    console.log(`  GET  http://localhost:${PORT}/api/optimizations`);
    console.log('WebSocket available for real-time updates');
});