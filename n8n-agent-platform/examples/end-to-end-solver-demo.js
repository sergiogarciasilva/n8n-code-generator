#!/usr/bin/env node

/**
 * End-to-End Workflow Solver Demo
 * Demonstrates the complete autonomous workflow solution
 */

const WorkflowSolver = require('../core/workflow-solver');

async function runDemo() {
    console.log('🎯 n8n Agent Platform - End-to-End Workflow Solver Demo');
    console.log('=====================================================\n');

    // Validate environment
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY environment variable is required');
        console.log('   Set it with: export OPENAI_API_KEY="your-api-key"');
        process.exit(1);
    }

    // Initialize the solver
    const solver = new WorkflowSolver({
        openaiApiKey: process.env.OPENAI_API_KEY,
        n8nPath: process.env.N8N_USER_FOLDER || '~/.n8n',
        autoDebug: true,
        autoOptimize: true,
        performanceTesting: true
    });

    // Setup event listeners
    setupEventListeners(solver);

    try {
        // Initialize all components
        console.log('🚀 Initializing solver components...\n');
        await solver.initialize();

        // Example 1: Simple data processing workflow
        console.log('\n📋 Example 1: Simple Data Processing Workflow');
        console.log('============================================');
        
        const example1 = await solver.solve(
            'Fetch data from a REST API, filter items where status is active, and save to a Google Sheet',
            {
                performance: {
                    expectedVolume: 100,
                    frequency: 'every hour'
                },
                security: ['api_key'],
                outputFormat: 'json'
            }
        );

        displayResult('Example 1', example1);

        // Example 2: Complex integration workflow
        console.log('\n📋 Example 2: Complex Integration Workflow');
        console.log('=========================================');
        
        const example2 = await solver.solve(
            'Monitor Salesforce for new leads, enrich data with Clearbit, analyze sentiment with AI, send personalized emails, and update CRM with results',
            {
                triggers: ['webhook', 'polling'],
                integrations: ['salesforce', 'clearbit', 'openai', 'sendgrid'],
                performance: {
                    expectedVolume: 1000,
                    frequency: 'real-time',
                    maxExecutionTime: 60000
                },
                errorHandling: 'retry_with_notification',
                security: ['oauth2', 'api_key']
            }
        );

        displayResult('Example 2', example2);

        // Example 3: Data transformation workflow
        console.log('\n📋 Example 3: Data Transformation Workflow');
        console.log('=========================================');
        
        const example3 = await solver.solve(
            'Read CSV files from FTP server, transform data format, validate against schema, merge with database records, and generate daily report',
            {
                dataSources: ['ftp', 'database'],
                dataDestinations: ['email', 'dashboard'],
                processingSteps: ['transform', 'validate', 'merge', 'aggregate'],
                performance: {
                    expectedVolume: 10000,
                    frequency: 'daily at 2 AM'
                }
            }
        );

        displayResult('Example 3', example3);

        // Example 4: Error-prone workflow (to test auto-debugging)
        console.log('\n📋 Example 4: Testing Auto-Debug Capability');
        console.log('==========================================');
        
        const example4 = await solver.solve(
            'Process JSON data with complex transformations, handle null values, parse dates, and calculate statistics',
            {
                sampleData: {
                    items: [
                        { id: 1, value: null, date: '2024-01-01' },
                        { id: 2, value: 100, date: 'invalid-date' },
                        { id: 3, value: 200 } // missing date
                    ]
                },
                errorHandling: 'auto_fix',
                outputFormat: 'json'
            }
        );

        displayResult('Example 4', example4);

        // Display final statistics
        console.log('\n📊 Solver Statistics');
        console.log('===================');
        const stats = solver.getStats();
        console.log(`Total Solutions: ${stats.completedSolutions}`);
        console.log(`Success Rate: ${stats.successRate.toFixed(1)}%`);
        console.log(`Average Solution Time: ${Math.round(stats.averageSolutionTime)}ms`);
        console.log(`\nComponent Health:`);
        Object.entries(stats.componentsHealth).forEach(([component, status]) => {
            console.log(`  ${component}: ${status === 'active' ? '✅' : '❌'} ${status}`);
        });

        // Stop the solver
        await solver.stop();

    } catch (error) {
        console.error('\n❌ Demo failed:', error);
        process.exit(1);
    }
}

function setupEventListeners(solver) {
    solver.on('solution-started', (solution) => {
        console.log(`\n🔄 Starting solution: ${solution.id}`);
    });

    solver.on('execution-started', (execution) => {
        console.log(`   ▶️  Executing workflow: ${execution.workflowId}`);
    });

    solver.on('execution-completed', (execution) => {
        console.log(`   ✅ Execution completed in ${execution.duration}ms`);
    });

    solver.on('auto-fix-successful', (fix) => {
        console.log(`   🔧 Auto-fix successful: ${fix.errorInfo.type}`);
    });

    solver.on('alert', (alert) => {
        console.log(`   🚨 Alert: ${alert.type} - ${JSON.stringify(alert.details)}`);
    });
}

function displayResult(name, result) {
    console.log(`\n${name} Result:`);
    console.log('─'.repeat(50));
    
    if (result.success) {
        console.log(`✅ Success!`);
        console.log(`   Solution ID: ${result.solutionId}`);
        console.log(`   Workflow: ${result.workflow.name}`);
        console.log(`   Nodes: ${result.workflow.nodes.length}`);
        console.log(`   Summary:`);
        Object.entries(result.summary).forEach(([key, value]) => {
            console.log(`     ${key}: ${value}`);
        });
    } else {
        console.log(`❌ Failed: ${result.error}`);
        if (result.solution) {
            console.log(`   Status: ${result.solution.status}`);
            console.log(`   Errors: ${result.solution.errors.length}`);
        }
    }
}

// Demonstration workflows for different scenarios
const demoScenarios = {
    // E-commerce automation
    ecommerce: {
        description: 'Monitor Shopify for new orders, check inventory, process payment, update shipping, send confirmation email, and update analytics',
        requirements: {
            integrations: ['shopify', 'stripe', 'sendgrid', 'google_analytics'],
            performance: { expectedVolume: 5000, frequency: 'real-time' },
            security: ['api_key', 'webhook_verification'],
            errorHandling: 'retry_with_dlq'
        }
    },

    // Data pipeline
    dataPipeline: {
        description: 'Extract data from multiple databases, transform using Python scripts, validate quality, load into data warehouse, and trigger downstream jobs',
        requirements: {
            dataSources: ['postgres', 'mysql', 'mongodb'],
            dataDestinations: ['snowflake', 'bigquery'],
            processingSteps: ['extract', 'transform', 'validate', 'load'],
            performance: { expectedVolume: 1000000, frequency: 'every 6 hours' }
        }
    },

    // Customer support automation
    customerSupport: {
        description: 'Receive support tickets, analyze sentiment, categorize issues, assign to agents based on skill, escalate if needed, and track SLA',
        requirements: {
            triggers: ['email', 'webhook', 'form'],
            integrations: ['zendesk', 'slack', 'openai'],
            errorHandling: 'escalate_to_human',
            sla: { responseTime: 3600000, resolutionTime: 86400000 }
        }
    },

    // Marketing automation
    marketing: {
        description: 'Segment users based on behavior, create personalized content with AI, schedule multi-channel campaigns, track engagement, and optimize based on results',
        requirements: {
            dataSources: ['customer_db', 'analytics'],
            integrations: ['mailchimp', 'facebook', 'twitter', 'openai'],
            performance: { expectedVolume: 50000, frequency: 'daily' },
            outputFormat: 'campaign_report'
        }
    }
};

// Run the demo
runDemo().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down demo...');
    process.exit(0);
});