const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.LOCAL_SERVER_PORT || 3456;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'n8n Copilot Extension Server is running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// AI workflow generation endpoint
app.post('/api/generate-workflow', async (req, res) => {
    try {
        const { description } = req.body;
        
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }

        // TODO: Implement AI workflow generation
        // For now, return a simple example workflow
        const workflow = {
            name: `Generated Workflow - ${new Date().toISOString()}`,
            nodes: [
                {
                    parameters: {},
                    name: 'Start',
                    type: 'n8n-nodes-base.start',
                    typeVersion: 1,
                    position: [250, 300]
                },
                {
                    parameters: {
                        content: description
                    },
                    name: 'Set',
                    type: 'n8n-nodes-base.set',
                    typeVersion: 1,
                    position: [450, 300]
                }
            ],
            connections: {
                'Start': {
                    'main': [
                        [
                            {
                                node: 'Set',
                                type: 'main',
                                index: 0
                            }
                        ]
                    ]
                }
            }
        };

        res.json({ workflow });
    } catch (error) {
        console.error('Error generating workflow:', error);
        res.status(500).json({ error: 'Failed to generate workflow' });
    }
});

// Workflow validation endpoint
app.post('/api/validate-workflow', async (req, res) => {
    try {
        const { workflow } = req.body;
        
        if (!workflow) {
            return res.status(400).json({ error: 'Workflow is required' });
        }

        // Basic validation
        const errors = [];
        const warnings = [];

        if (!workflow.nodes || workflow.nodes.length === 0) {
            errors.push('Workflow must have at least one node');
        }

        if (!workflow.connections) {
            warnings.push('Workflow has no connections between nodes');
        }

        res.json({
            valid: errors.length === 0,
            errors,
            warnings
        });
    } catch (error) {
        console.error('Error validating workflow:', error);
        res.status(500).json({ error: 'Failed to validate workflow' });
    }
});

// Execute workflow endpoint (mock)
app.post('/api/execute-workflow', async (req, res) => {
    try {
        const { workflow } = req.body;
        
        if (!workflow) {
            return res.status(400).json({ error: 'Workflow is required' });
        }

        // Mock execution result
        const executionId = `exec_${Date.now()}`;
        
        res.json({
            executionId,
            status: 'success',
            message: 'Workflow executed successfully (mock)',
            data: {
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                executionTime: 0
            }
        });
    } catch (error) {
        console.error('Error executing workflow:', error);
        res.status(500).json({ error: 'Failed to execute workflow' });
    }
});

// List templates endpoint
app.get('/api/templates', async (req, res) => {
    try {
        const templates = [
            {
                id: 'telegram-bot',
                name: 'Telegram Bot',
                description: 'Create a Telegram bot that responds to messages',
                category: 'Communication'
            },
            {
                id: 'data-sync',
                name: 'Database Sync',
                description: 'Sync data between two databases',
                category: 'Data'
            },
            {
                id: 'webhook-processor',
                name: 'Webhook Processor',
                description: 'Process incoming webhooks and trigger actions',
                category: 'Integration'
            }
        ];

        res.json({ templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`n8n Copilot Extension Server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log(`  GET  http://localhost:${PORT}/health`);
    console.log(`  POST http://localhost:${PORT}/api/generate-workflow`);
    console.log(`  POST http://localhost:${PORT}/api/validate-workflow`);
    console.log(`  POST http://localhost:${PORT}/api/execute-workflow`);
    console.log(`  GET  http://localhost:${PORT}/api/templates`);
});