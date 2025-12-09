const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8080;

// Enable CORS for VS Code
app.use(cors({
    origin: ['vscode-webview://*', 'http://localhost:*'],
    credentials: true
}));

app.use(express.json());
app.use(express.static('.'));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'n8n-copilot-extension',
        timestamp: new Date().toISOString()
    });
});

// Extension API endpoints
app.get('/api/workflows', (req, res) => {
    res.json({ workflows: [], message: 'Extension server running' });
});

app.post('/api/generate', (req, res) => {
    res.json({ 
        success: true, 
        workflow: { nodes: [], connections: [] },
        message: 'Workflow generation available'
    });
});

app.listen(PORT, () => {
    console.log(`VS Code Extension Server running on http://localhost:${PORT}`);
});
