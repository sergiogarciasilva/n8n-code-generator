#!/usr/bin/env node

/**
 * Autonomous Workflow Debugging Startup Script
 * Starts the n8n Agent Platform autonomous debugging system
 */

const path = require('path');
const DebugAgent = require('./core/agents/debug-agent');

// Configuration
const config = {
    n8nPath: process.env.N8N_USER_FOLDER || path.join(process.env.HOME || process.env.USERPROFILE, '.n8n'),
    openaiApiKey: process.env.OPENAI_API_KEY,
    knowledgeBasePath: path.join(__dirname, 'knowledge'),
    maxIterations: parseInt(process.env.MAX_ITERATIONS) || 10,
    iterationTimeout: parseInt(process.env.ITERATION_TIMEOUT) || 300000, // 5 minutes
    autoStart: true
};

async function startAutonomousDebugging() {
    console.log('🤖 n8n Agent Platform - Autonomous Debugging System');
    console.log('================================================');
    console.log('');

    // Validate environment
    if (!config.openaiApiKey) {
        console.error('❌ OPENAI_API_KEY environment variable is required');
        console.log('   Set it with: export OPENAI_API_KEY="your-api-key"');
        process.exit(1);
    }

    console.log('📋 Configuration:');
    console.log(`   🗂️  n8n Path: ${config.n8nPath}`);
    console.log(`   🧠 Knowledge Base: ${config.knowledgeBasePath}`);
    console.log(`   🔄 Max Iterations: ${config.maxIterations}`);
    console.log(`   ⏱️  Timeout: ${config.iterationTimeout}ms`);
    console.log('');

    try {
        // Initialize Debug Agent
        const debugAgent = new DebugAgent(config);

        // Setup event listeners for monitoring
        setupEventListeners(debugAgent);

        // Initialize and start
        console.log('🚀 Initializing autonomous debugging system...');
        await debugAgent.initialize();
        
        console.log('');
        console.log('✅ Autonomous debugging system is now active!');
        console.log('');
        console.log('📊 System Status:');
        console.log('   🔍 Monitoring n8n workflows for errors');
        console.log('   🤖 AI-powered error analysis enabled');
        console.log('   🔧 Autonomous code fixing active');
        console.log('   📚 Knowledge base learning enabled');
        console.log('');
        console.log('Press Ctrl+C to stop...');

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down autonomous debugging system...');
            await debugAgent.stop();
            console.log('✅ Shutdown complete');
            process.exit(0);
        });

        // Keep the process alive
        setInterval(() => {
            // Print periodic stats
            const stats = debugAgent.getStats();
            if (stats.totalErrorsDetected > 0) {
                console.log(`📊 Stats: ${stats.totalErrorsDetected} errors detected, ${stats.totalFixesSuccessful} fixed successfully`);
            }
        }, 60000); // Every minute

    } catch (error) {
        console.error('❌ Failed to start autonomous debugging system:', error.message);
        process.exit(1);
    }
}

function setupEventListeners(debugAgent) {
    debugAgent.on('error-detected', (errorInfo) => {
        console.log(`🚨 [${new Date().toISOString()}] Error detected: ${errorInfo.type}`);
        console.log(`   📍 Workflow: ${errorInfo.workflowId}`);
        console.log(`   🔧 Node: ${errorInfo.nodeId}`);
        console.log(`   💬 Message: ${errorInfo.message}`);
        console.log('');
    });

    debugAgent.on('fix-successful', (iterationData) => {
        console.log(`🎉 [${new Date().toISOString()}] Fix successful!`);
        console.log(`   🔄 Iterations: ${iterationData.currentIteration}`);
        console.log(`   ⏱️  Duration: ${iterationData.duration}ms`);
        console.log(`   📍 Workflow: ${iterationData.errorInfo.workflowId}`);
        console.log('');
    });

    debugAgent.on('fix-failed', (iterationData) => {
        console.log(`💥 [${new Date().toISOString()}] Fix failed after ${iterationData.currentIteration} iterations`);
        console.log(`   📍 Workflow: ${iterationData.errorInfo.workflowId}`);
        console.log(`   ❌ Error: ${iterationData.errorInfo.type}`);
        console.log('   🔄 Manual intervention may be required');
        console.log('');
    });

    debugAgent.on('escalation-required', (data) => {
        console.log(`🚨 [${new Date().toISOString()}] ESCALATION REQUIRED`);
        console.log(`   📍 Workflow: ${data.errorInfo.workflowId}`);
        console.log(`   ❌ Error: ${data.errorInfo.type}`);
        console.log(`   🔄 Iterations: ${data.iterations}`);
        console.log('   👤 Human review needed');
        console.log('');
    });

    debugAgent.on('debugging-started', () => {
        console.log('🔄 Autonomous debugging engine started');
    });

    debugAgent.on('debugging-stopped', () => {
        console.log('🔄 Autonomous debugging engine stopped');
    });

    debugAgent.on('monitoring-started', () => {
        console.log('👁️  Error monitoring started');
    });

    debugAgent.on('monitoring-stopped', () => {
        console.log('👁️  Error monitoring stopped');
    });
}

// Health check endpoint (if running as service)
if (process.argv.includes('--health')) {
    console.log('🏥 Health check endpoint not implemented yet');
    process.exit(0);
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
🤖 n8n Agent Platform - Autonomous Debugging System

Usage: node start-autonomous-debugging.js [options]

Environment Variables:
  OPENAI_API_KEY        Required: OpenAI API key for AI analysis
  N8N_USER_FOLDER       Optional: Path to n8n user folder (default: ~/.n8n)
  MAX_ITERATIONS        Optional: Maximum fix iterations (default: 10)
  ITERATION_TIMEOUT     Optional: Timeout per iteration in ms (default: 300000)

Options:
  --help, -h           Show this help message
  --health             Run health check
  
Examples:
  # Start with default settings
  OPENAI_API_KEY="sk-..." node start-autonomous-debugging.js
  
  # Start with custom n8n path
  OPENAI_API_KEY="sk-..." N8N_USER_FOLDER="/custom/path" node start-autonomous-debugging.js
  
  # Start with higher iteration limit
  OPENAI_API_KEY="sk-..." MAX_ITERATIONS=15 node start-autonomous-debugging.js

Features:
  🔍 Automatic error detection in n8n workflows
  🧠 AI-powered error analysis using GPT-4
  🔧 Autonomous code fixing for JavaScript nodes
  🔄 Iterative improvement until success
  📚 Machine learning from successful fixes
  📊 Real-time monitoring and statistics

For more information, see: N8N_DESKTOP_INTEGRATION_PLAN.md
`);
    process.exit(0);
}

// Start the system
startAutonomousDebugging().catch(error => {
    console.error('❌ Startup failed:', error);
    process.exit(1);
});