import { getDatabase } from './connection';

interface WorkflowTemplate {
    name: string;
    category: string;
    description: string;
    nodes: any;
    connections: any;
    tags: string[];
}

const templates: WorkflowTemplate[] = [
    // MCP Templates
    {
        name: 'Basic MCP Handler',
        category: 'mcp',
        description: 'Basic Model Context Protocol workflow with context initialization',
        nodes: [
            {
                id: 'webhook',
                name: 'Webhook',
                type: 'n8n-nodes-base.webhook',
                typeVersion: 1,
                position: [250, 300],
                parameters: {
                    path: 'mcp-handler',
                    responseMode: 'lastNode',
                    responseData: 'allEntries'
                }
            },
            {
                id: 'init-context',
                name: 'Initialize Context',
                type: 'n8n-nodes-base.code',
                typeVersion: 1,
                position: [450, 300],
                parameters: {
                    code: `const context = {
  protocol: 'mcp',
  version: '1.0',
  sessionId: \${{ $json.sessionId || crypto.randomUUID() }},
  boundaries: [],
  state: {}
};
return [{json: {...items[0].json, context}}];`
                }
            },
            {
                id: 'process-mcp',
                name: 'Process MCP Request',
                type: 'n8n-nodes-base.function',
                typeVersion: 1,
                position: [650, 300],
                parameters: {
                    functionCode: `// Process MCP request based on context
const { context, request } = items[0].json;

// Add your MCP processing logic here
const response = {
  status: 'processed',
  context: context,
  result: {}
};

return [{json: response}];`
                }
            }
        ],
        connections: {
            'webhook': {
                'main': [[{ node: 'init-context', type: 'main', index: 0 }]]
            },
            'init-context': {
                'main': [[{ node: 'process-mcp', type: 'main', index: 0 }]]
            }
        },
        tags: ['mcp', 'context', 'protocol', 'webhook']
    },
    {
        name: 'MCP with State Management',
        category: 'mcp',
        description: 'Advanced MCP workflow with persistent state management',
        nodes: [
            {
                id: 'trigger',
                name: 'MCP Trigger',
                type: 'n8n-nodes-base.webhook',
                typeVersion: 1,
                position: [250, 300],
                parameters: {
                    path: 'mcp-stateful',
                    responseMode: 'lastNode'
                }
            },
            {
                id: 'load-state',
                name: 'Load State',
                type: 'n8n-nodes-base.redis',
                typeVersion: 1,
                position: [450, 200],
                parameters: {
                    operation: 'get',
                    key: '={{$json.sessionId}}'
                }
            },
            {
                id: 'merge-state',
                name: 'Merge State',
                type: 'n8n-nodes-base.merge',
                typeVersion: 2,
                position: [650, 300],
                parameters: {}
            },
            {
                id: 'process',
                name: 'Process with State',
                type: 'n8n-nodes-base.code',
                typeVersion: 1,
                position: [850, 300],
                parameters: {
                    code: `// Process with state
const currentState = items[0].json.state || {};
const request = items[0].json.request;

// Your processing logic here
const newState = {
  ...currentState,
  lastProcessed: new Date().toISOString()
};

return [{json: {state: newState, response: {}}}];`
                }
            },
            {
                id: 'save-state',
                name: 'Save State',
                type: 'n8n-nodes-base.redis',
                typeVersion: 1,
                position: [1050, 300],
                parameters: {
                    operation: 'set',
                    key: '={{$json.sessionId}}',
                    value: '={{$json.state}}'
                }
            }
        ],
        connections: {
            'trigger': {
                'main': [[
                    { node: 'load-state', type: 'main', index: 0 },
                    { node: 'merge-state', type: 'main', index: 1 }
                ]]
            },
            'load-state': {
                'main': [[{ node: 'merge-state', type: 'main', index: 0 }]]
            },
            'merge-state': {
                'main': [[{ node: 'process', type: 'main', index: 0 }]]
            },
            'process': {
                'main': [[{ node: 'save-state', type: 'main', index: 0 }]]
            }
        },
        tags: ['mcp', 'state', 'redis', 'advanced']
    },

    // Telegram Templates
    {
        name: 'Simple Telegram Bot',
        category: 'telegram',
        description: 'Basic Telegram bot that responds to commands',
        nodes: [
            {
                id: 'telegram-trigger',
                name: 'Telegram Trigger',
                type: 'n8n-nodes-base.telegramTrigger',
                typeVersion: 1,
                position: [250, 300],
                parameters: {
                    updates: ['message', 'edited_message']
                },
                credentials: {
                    telegramApi: {
                        id: '{{TELEGRAM_CREDENTIALS_ID}}',
                        name: 'Telegram Bot'
                    }
                }
            },
            {
                id: 'check-command',
                name: 'Check Command',
                type: 'n8n-nodes-base.switch',
                typeVersion: 1,
                position: [450, 300],
                parameters: {
                    dataType: 'string',
                    value1: '={{$json.message.text}}',
                    rules: {
                        rules: [
                            {
                                value2: '/start',
                                output: 0
                            },
                            {
                                value2: '/help',
                                output: 1
                            },
                            {
                                value2: '/status',
                                output: 2
                            }
                        ]
                    },
                    fallbackOutput: 3
                }
            },
            {
                id: 'start-response',
                name: 'Start Response',
                type: 'n8n-nodes-base.telegram',
                typeVersion: 1,
                position: [650, 100],
                parameters: {
                    resource: 'message',
                    operation: 'sendMessage',
                    chatId: '={{$json.message.chat.id}}',
                    text: 'Welcome! I am your n8n bot. Use /help to see available commands.'
                },
                credentials: {
                    telegramApi: {
                        id: '{{TELEGRAM_CREDENTIALS_ID}}',
                        name: 'Telegram Bot'
                    }
                }
            },
            {
                id: 'help-response',
                name: 'Help Response',
                type: 'n8n-nodes-base.telegram',
                typeVersion: 1,
                position: [650, 250],
                parameters: {
                    resource: 'message',
                    operation: 'sendMessage',
                    chatId: '={{$json.message.chat.id}}',
                    text: 'Available commands:\\n/start - Start the bot\\n/help - Show this help\\n/status - Check bot status',
                    replyMarkup: 'inlineKeyboard',
                    inlineKeyboard: {
                        rows: [
                            {
                                row: [
                                    {
                                        text: 'Documentation',
                                        url: 'https://n8n.io'
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                id: 'status-response',
                name: 'Status Response',
                type: 'n8n-nodes-base.telegram',
                typeVersion: 1,
                position: [650, 400],
                parameters: {
                    resource: 'message',
                    operation: 'sendMessage',
                    chatId: '={{$json.message.chat.id}}',
                    text: 'Bot is running! 🟢\\nUptime: {{$workflow.active ? "Active" : "Inactive"}}'
                }
            },
            {
                id: 'default-response',
                name: 'Default Response',
                type: 'n8n-nodes-base.telegram',
                typeVersion: 1,
                position: [650, 550],
                parameters: {
                    resource: 'message',
                    operation: 'sendMessage',
                    chatId: '={{$json.message.chat.id}}',
                    text: 'Unknown command. Use /help to see available commands.'
                }
            }
        ],
        connections: {
            'telegram-trigger': {
                'main': [[{ node: 'check-command', type: 'main', index: 0 }]]
            },
            'check-command': {
                'main': [
                    [{ node: 'start-response', type: 'main', index: 0 }],
                    [{ node: 'help-response', type: 'main', index: 0 }],
                    [{ node: 'status-response', type: 'main', index: 0 }],
                    [{ node: 'default-response', type: 'main', index: 0 }]
                ]
            }
        },
        tags: ['telegram', 'bot', 'commands', 'messaging']
    },
    {
        name: 'Telegram Bot with AI',
        category: 'telegram',
        description: 'Telegram bot that uses OpenAI for intelligent responses',
        nodes: [
            {
                id: 'telegram-trigger',
                name: 'Telegram Trigger',
                type: 'n8n-nodes-base.telegramTrigger',
                typeVersion: 1,
                position: [250, 300],
                parameters: {
                    updates: ['message']
                }
            },
            {
                id: 'check-type',
                name: 'Check Message Type',
                type: 'n8n-nodes-base.if',
                typeVersion: 1,
                position: [450, 300],
                parameters: {
                    conditions: {
                        string: [
                            {
                                value1: '={{$json.message.text}}',
                                operation: 'startsWith',
                                value2: '/'
                            }
                        ]
                    }
                }
            },
            {
                id: 'ai-process',
                name: 'Process with AI',
                type: 'n8n-nodes-base.openAi',
                typeVersion: 1,
                position: [650, 400],
                parameters: {
                    resource: 'chat',
                    operation: 'message',
                    model: 'gpt-3.5-turbo',
                    messages: {
                        values: [
                            {
                                role: 'system',
                                content: 'You are a helpful Telegram bot assistant.'
                            },
                            {
                                role: 'user',
                                content: '={{$json.message.text}}'
                            }
                        ]
                    }
                },
                credentials: {
                    openAiApi: {
                        id: '{{OPENAI_CREDENTIALS_ID}}',
                        name: 'OpenAI'
                    }
                }
            },
            {
                id: 'send-response',
                name: 'Send Response',
                type: 'n8n-nodes-base.telegram',
                typeVersion: 1,
                position: [850, 300],
                parameters: {
                    resource: 'message',
                    operation: 'sendMessage',
                    chatId: '={{$json.message.chat.id}}',
                    text: '={{$json.choices[0].message.content}}'
                }
            }
        ],
        connections: {
            'telegram-trigger': {
                'main': [[{ node: 'check-type', type: 'main', index: 0 }]]
            },
            'check-type': {
                'main': [
                    [{ node: 'send-response', type: 'main', index: 0 }],
                    [{ node: 'ai-process', type: 'main', index: 0 }]
                ]
            },
            'ai-process': {
                'main': [[{ node: 'send-response', type: 'main', index: 0 }]]
            }
        },
        tags: ['telegram', 'ai', 'openai', 'chatbot']
    },

    // Agent Templates
    {
        name: 'Simple Agent System',
        category: 'agent',
        description: 'Basic multi-agent system with task distribution',
        nodes: [
            {
                id: 'webhook',
                name: 'Task Input',
                type: 'n8n-nodes-base.webhook',
                typeVersion: 1,
                position: [250, 300],
                parameters: {
                    path: 'agent-task',
                    responseMode: 'lastNode'
                }
            },
            {
                id: 'task-analyzer',
                name: 'Task Analyzer Agent',
                type: 'n8n-nodes-base.code',
                typeVersion: 1,
                position: [450, 300],
                parameters: {
                    code: `// Analyze the incoming task
const task = items[0].json;

const analysis = {
  taskType: detectTaskType(task),
  complexity: assessComplexity(task),
  requiredAgents: determineAgents(task),
  priority: task.priority || 'medium'
};

function detectTaskType(task) {
  // Add your task type detection logic
  return 'general';
}

function assessComplexity(task) {
  // Add complexity assessment
  return 'medium';
}

function determineAgents(task) {
  // Determine which agents are needed
  return ['processor', 'validator'];
}

return [{json: {...task, analysis}}];`
                }
            },
            {
                id: 'agent-router',
                name: 'Agent Router',
                type: 'n8n-nodes-base.switch',
                typeVersion: 1,
                position: [650, 300],
                parameters: {
                    dataType: 'string',
                    value1: '={{$json.analysis.taskType}}',
                    rules: {
                        rules: [
                            {
                                value2: 'data-processing',
                                output: 0
                            },
                            {
                                value2: 'text-generation',
                                output: 1
                            },
                            {
                                value2: 'analysis',
                                output: 2
                            }
                        ]
                    },
                    fallbackOutput: 3
                }
            },
            {
                id: 'data-agent',
                name: 'Data Processing Agent',
                type: 'n8n-nodes-base.function',
                typeVersion: 1,
                position: [850, 100],
                parameters: {
                    functionCode: `// Data processing agent logic
const data = items[0].json;
// Process data
const result = {
  agent: 'data-processor',
  processed: true,
  output: data
};
return [{json: result}];`
                }
            },
            {
                id: 'text-agent',
                name: 'Text Generation Agent',
                type: 'n8n-nodes-base.function',
                typeVersion: 1,
                position: [850, 300],
                parameters: {
                    functionCode: `// Text generation agent logic
const task = items[0].json;
// Generate text
const result = {
  agent: 'text-generator',
  generated: true,
  output: 'Generated text based on task'
};
return [{json: result}];`
                }
            },
            {
                id: 'result-aggregator',
                name: 'Result Aggregator',
                type: 'n8n-nodes-base.code',
                typeVersion: 1,
                position: [1050, 300],
                parameters: {
                    code: `// Aggregate results from all agents
const results = items.map(item => item.json);

const aggregated = {
  taskId: results[0].taskId || 'unknown',
  status: 'completed',
  results: results,
  timestamp: new Date().toISOString()
};

return [{json: aggregated}];`
                }
            }
        ],
        connections: {
            'webhook': {
                'main': [[{ node: 'task-analyzer', type: 'main', index: 0 }]]
            },
            'task-analyzer': {
                'main': [[{ node: 'agent-router', type: 'main', index: 0 }]]
            },
            'agent-router': {
                'main': [
                    [{ node: 'data-agent', type: 'main', index: 0 }],
                    [{ node: 'text-agent', type: 'main', index: 0 }],
                    [{ node: 'result-aggregator', type: 'main', index: 0 }],
                    [{ node: 'result-aggregator', type: 'main', index: 0 }]
                ]
            },
            'data-agent': {
                'main': [[{ node: 'result-aggregator', type: 'main', index: 0 }]]
            },
            'text-agent': {
                'main': [[{ node: 'result-aggregator', type: 'main', index: 0 }]]
            }
        },
        tags: ['agent', 'multi-agent', 'orchestration', 'task-routing']
    },
    {
        name: 'Agent System with Learning',
        category: 'agent',
        description: 'Advanced agent system with learning and adaptation capabilities',
        nodes: [
            {
                id: 'trigger',
                name: 'Agent Trigger',
                type: 'n8n-nodes-base.webhook',
                typeVersion: 1,
                position: [250, 300],
                parameters: {
                    path: 'learning-agent'
                }
            },
            {
                id: 'load-memory',
                name: 'Load Agent Memory',
                type: 'n8n-nodes-base.postgres',
                typeVersion: 2,
                position: [450, 200],
                parameters: {
                    operation: 'select',
                    table: 'agent_memory',
                    limit: 10,
                    orderBy: {
                        column: 'created_at',
                        direction: 'DESC'
                    }
                }
            },
            {
                id: 'merge-context',
                name: 'Merge Context',
                type: 'n8n-nodes-base.merge',
                typeVersion: 2,
                position: [650, 300],
                parameters: {}
            },
            {
                id: 'learning-agent',
                name: 'Learning Agent',
                type: 'n8n-nodes-base.code',
                typeVersion: 1,
                position: [850, 300],
                parameters: {
                    code: `// Learning agent with memory
const currentTask = items[0].json;
const memory = items[1]?.json || [];

// Learn from past experiences
const patterns = analyzePatterns(memory);
const strategy = determineStrategy(currentTask, patterns);

// Execute task with learned strategy
const result = executeWithStrategy(currentTask, strategy);

// Prepare learning data
const learning = {
  task: currentTask,
  strategy: strategy,
  result: result,
  success: result.success || false,
  timestamp: new Date().toISOString()
};

function analyzePatterns(memory) {
  // Pattern analysis logic
  return {identified: memory.length > 0};
}

function determineStrategy(task, patterns) {
  // Strategy determination based on patterns
  return {approach: 'adaptive'};
}

function executeWithStrategy(task, strategy) {
  // Execute task with chosen strategy
  return {
    completed: true,
    output: 'Task completed with learning'
  };
}

return [{json: {result, learning}}];`
                }
            },
            {
                id: 'save-learning',
                name: 'Save Learning',
                type: 'n8n-nodes-base.postgres',
                typeVersion: 2,
                position: [1050, 300],
                parameters: {
                    operation: 'insert',
                    table: 'agent_memory',
                    columns: 'task,strategy,result,success,created_at'
                }
            }
        ],
        connections: {
            'trigger': {
                'main': [[
                    { node: 'load-memory', type: 'main', index: 0 },
                    { node: 'merge-context', type: 'main', index: 1 }
                ]]
            },
            'load-memory': {
                'main': [[{ node: 'merge-context', type: 'main', index: 0 }]]
            },
            'merge-context': {
                'main': [[{ node: 'learning-agent', type: 'main', index: 0 }]]
            },
            'learning-agent': {
                'main': [[{ node: 'save-learning', type: 'main', index: 0 }]]
            }
        },
        tags: ['agent', 'learning', 'adaptive', 'memory', 'ai']
    }
];

async function seedDatabase() {
    const db = getDatabase();
    
    try {
        await db.connect();
        await db.runMigrations();
        
        console.log('Starting database seeding...');
        
        // Seed workflow templates
        for (const template of templates) {
            await db.query(
                `INSERT INTO workflow_templates (name, category, description, nodes, connections, tags)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (name) DO UPDATE SET
                 description = EXCLUDED.description,
                 nodes = EXCLUDED.nodes,
                 connections = EXCLUDED.connections,
                 tags = EXCLUDED.tags,
                 updated_at = CURRENT_TIMESTAMP`,
                [
                    template.name,
                    template.category,
                    template.description,
                    JSON.stringify(template.nodes),
                    JSON.stringify(template.connections),
                    JSON.stringify(template.tags)
                ]
            );
        }
        
        console.log(`Seeded ${templates.length} workflow templates`);
        
        // Seed common node types
        const nodeTypes = [
            { type: 'n8n-nodes-base.webhook', avgTime: 50, successRate: 0.99 },
            { type: 'n8n-nodes-base.httpRequest', avgTime: 500, successRate: 0.95 },
            { type: 'n8n-nodes-base.code', avgTime: 100, successRate: 0.98 },
            { type: 'n8n-nodes-base.telegram', avgTime: 400, successRate: 0.97 },
            { type: 'n8n-nodes-base.openAi', avgTime: 2000, successRate: 0.96 },
            { type: 'n8n-nodes-base.postgres', avgTime: 300, successRate: 0.98 },
            { type: 'n8n-nodes-base.redis', avgTime: 50, successRate: 0.99 }
        ];
        
        for (const nodeType of nodeTypes) {
            await db.query(
                `INSERT INTO node_usage_stats (node_type, avg_execution_time, success_rate)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (node_type) DO UPDATE SET
                 avg_execution_time = EXCLUDED.avg_execution_time,
                 success_rate = EXCLUDED.success_rate`,
                [nodeType.type, nodeType.avgTime, nodeType.successRate]
            );
        }
        
        console.log(`Seeded ${nodeTypes.length} node type statistics`);
        
        // Seed error patterns
        const errorPatterns = [
            {
                type: 'authentication_failed',
                nodeType: 'n8n-nodes-base.telegram',
                message: 'Invalid bot token',
                solution: 'Check your Telegram bot token in credentials'
            },
            {
                type: 'connection_timeout',
                nodeType: 'n8n-nodes-base.httpRequest',
                message: 'Request timeout',
                solution: 'Increase timeout or check endpoint availability'
            },
            {
                type: 'rate_limit',
                nodeType: 'n8n-nodes-base.openAi',
                message: 'Rate limit exceeded',
                solution: 'Add delay between requests or upgrade API plan'
            }
        ];
        
        for (const pattern of errorPatterns) {
            await db.query(
                `INSERT INTO error_patterns (error_type, node_type, error_message, solution)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT DO NOTHING`,
                [pattern.type, pattern.nodeType, pattern.message, pattern.solution]
            );
        }
        
        console.log(`Seeded ${errorPatterns.length} error patterns`);
        
        console.log('Database seeding completed successfully!');
    } catch (error) {
        console.error('Seeding failed:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run seeding if called directly
if (require.main === module) {
    seedDatabase().catch(console.error);
}

export { seedDatabase };