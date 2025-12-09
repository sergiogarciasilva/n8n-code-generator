import * as vscode from 'vscode';
import { WorkflowExecutor } from '../executors/workflowExecutor';

export class WebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'n8n-explorer';
    
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _executor: WorkflowExecutor;
    private _currentWorkflow: any = null;

    constructor(extensionUri: vscode.Uri, executor: WorkflowExecutor) {
        this._extensionUri = extensionUri;
        this._executor = executor;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'executeWorkflow':
                    this.executeWorkflow(data.workflow);
                    break;
                case 'saveWorkflow':
                    this.saveWorkflow(data.workflow);
                    break;
                case 'openInEditor':
                    this.openInEditor(data.workflow);
                    break;
                case 'refreshTemplates':
                    this.loadTemplates();
                    break;
            }
        });

        // Load initial data
        this.loadTemplates();
        this.updateExecutionResults(null);
    }

    public updateExecutionResults(results: any) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'executionResults',
                results: results
            });
        }
    }

    public openVisualEditor() {
        const panel = vscode.window.createWebviewPanel(
            'n8nVisualEditor',
            'n8n Visual Editor',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this._extensionUri]
            }
        );

        panel.webview.html = this._getVisualEditorHtml(panel.webview);

        // Handle messages
        panel.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'saveWorkflow':
                    await this.saveWorkflow(data.workflow);
                    break;
                case 'loadWorkflow':
                    const workflow = await this.loadCurrentWorkflow();
                    panel.webview.postMessage({
                        type: 'workflowLoaded',
                        workflow: workflow
                    });
                    break;
            }
        });
    }

    private async executeWorkflow(workflow: any) {
        try {
            const results = await this._executor.execute(workflow);
            this.updateExecutionResults(results);
            
            if (results.success) {
                vscode.window.showInformationMessage('Workflow executed successfully!');
            } else {
                vscode.window.showErrorMessage(`Workflow execution failed: ${results.error}`);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Execution error: ${error.message}`);
        }
    }

    private async saveWorkflow(workflow: any) {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${workflow.name || 'workflow'}.n8n.json`),
            filters: {
                'n8n Workflow': ['n8n.json', 'json']
            }
        });

        if (uri) {
            const content = JSON.stringify(workflow, null, 2);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
            vscode.window.showInformationMessage(`Workflow saved to ${uri.fsPath}`);
        }
    }

    private async openInEditor(workflow: any) {
        const doc = await vscode.workspace.openTextDocument({
            content: JSON.stringify(workflow, null, 2),
            language: 'json'
        });
        await vscode.window.showTextDocument(doc);
    }

    private async loadCurrentWorkflow() {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'json') {
            try {
                return JSON.parse(editor.document.getText());
            } catch (error) {
                console.error('Failed to parse workflow:', error);
            }
        }
        return null;
    }

    private loadTemplates() {
        // Load templates from database
        const templates = [
            {
                id: 'telegram-bot',
                name: 'Telegram Bot',
                description: 'Basic Telegram bot with command handling',
                category: 'telegram',
                tags: ['bot', 'messaging', 'automation']
            },
            {
                id: 'mcp-workflow',
                name: 'MCP Workflow',
                description: 'Model Context Protocol workflow',
                category: 'mcp',
                tags: ['ai', 'context', 'protocol']
            },
            {
                id: 'agent-system',
                name: 'Multi-Agent System',
                description: 'Orchestrated agent system',
                category: 'agent',
                tags: ['ai', 'agents', 'orchestration']
            }
        ];

        if (this._view) {
            this._view.webview.postMessage({
                type: 'templatesLoaded',
                templates: templates
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview-ui', 'sidebar.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview-ui', 'sidebar.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>n8n Explorer</title>
    <style>
        body {
            padding: 10px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
        }
        .section {
            margin-bottom: 20px;
        }
        .section-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--vscode-titleBar-activeForeground);
        }
        .template-list {
            list-style: none;
            padding: 0;
        }
        .template-item {
            padding: 8px;
            margin: 4px 0;
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            cursor: pointer;
        }
        .template-item:hover {
            background: var(--vscode-list-activeSelectionBackground);
        }
        .execution-status {
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
        }
        .execution-success {
            background: var(--vscode-testing-passBorder);
            color: var(--vscode-testing-passIcon);
        }
        .execution-error {
            background: var(--vscode-testing-failBorder);
            color: var(--vscode-testing-failIcon);
        }
        .metrics {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
        }
        .metric {
            text-align: center;
            flex: 1;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
        }
        .metric-label {
            font-size: 12px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">Workflow Templates</div>
        <ul class="template-list" id="templateList">
            <li class="template-item">Loading templates...</li>
        </ul>
    </div>

    <div class="section">
        <div class="section-title">Recent Executions</div>
        <div id="executionStatus">
            <p>No recent executions</p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Performance Metrics</div>
        <div class="metrics">
            <div class="metric">
                <div class="metric-value" id="avgTime">-</div>
                <div class="metric-label">Avg Time</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="successRate">-</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value" id="totalRuns">0</div>
                <div class="metric-label">Total Runs</div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'templatesLoaded':
                    displayTemplates(message.templates);
                    break;
                case 'executionResults':
                    updateExecutionStatus(message.results);
                    break;
            }
        });

        function displayTemplates(templates) {
            const list = document.getElementById('templateList');
            list.innerHTML = '';
            
            templates.forEach(template => {
                const item = document.createElement('li');
                item.className = 'template-item';
                item.innerHTML = \`
                    <strong>\${template.name}</strong><br>
                    <small>\${template.description}</small><br>
                    <small style="opacity: 0.6">\${template.tags.join(', ')}</small>
                \`;
                item.onclick = () => loadTemplate(template.id);
                list.appendChild(item);
            });
        }

        function loadTemplate(templateId) {
            vscode.postMessage({
                type: 'loadTemplate',
                templateId: templateId
            });
        }

        function updateExecutionStatus(results) {
            const statusDiv = document.getElementById('executionStatus');
            
            if (!results) {
                statusDiv.innerHTML = '<p>No recent executions</p>';
                return;
            }
            
            const statusClass = results.success ? 'execution-success' : 'execution-error';
            const statusText = results.success ? 'Success' : 'Failed';
            
            statusDiv.innerHTML = \`
                <div class="execution-status \${statusClass}">
                    <strong>Status:</strong> \${statusText}<br>
                    <strong>Time:</strong> \${results.executionTime}ms<br>
                    \${results.error ? \`<strong>Error:</strong> \${results.error}\` : ''}
                </div>
            \`;
            
            // Update metrics
            updateMetrics(results);
        }

        function updateMetrics(results) {
            // This would be updated with real metrics from execution history
            document.getElementById('avgTime').textContent = results.executionTime + 'ms';
            document.getElementById('successRate').textContent = results.success ? '100%' : '0%';
            
            const totalRuns = parseInt(document.getElementById('totalRuns').textContent) + 1;
            document.getElementById('totalRuns').textContent = totalRuns;
        }
    </script>
</body>
</html>`;
    }

    private _getVisualEditorHtml(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview-ui', 'visual-editor.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webview-ui', 'visual-editor.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>n8n Visual Editor</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            font-family: var(--vscode-font-family);
        }
        #canvas {
            width: 100vw;
            height: 100vh;
            background: var(--vscode-editor-background);
            position: relative;
        }
        .toolbar {
            position: absolute;
            top: 10px;
            left: 10px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            padding: 10px;
            border-radius: 4px;
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            margin: 0 4px;
            border-radius: 2px;
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div id="canvas">
        <div class="toolbar">
            <button onclick="saveWorkflow()">Save</button>
            <button onclick="loadWorkflow()">Load</button>
            <button onclick="executeWorkflow()">Execute</button>
            <button onclick="zoomIn()">Zoom In</button>
            <button onclick="zoomOut()">Zoom Out</button>
            <button onclick="fitToScreen()">Fit</button>
        </div>
        <div id="workflowCanvas"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let workflow = null;

        function saveWorkflow() {
            if (workflow) {
                vscode.postMessage({
                    type: 'saveWorkflow',
                    workflow: workflow
                });
            }
        }

        function loadWorkflow() {
            vscode.postMessage({
                type: 'loadWorkflow'
            });
        }

        function executeWorkflow() {
            if (workflow) {
                vscode.postMessage({
                    type: 'executeWorkflow',
                    workflow: workflow
                });
            }
        }

        function zoomIn() {
            // Implement zoom in
        }

        function zoomOut() {
            // Implement zoom out
        }

        function fitToScreen() {
            // Implement fit to screen
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'workflowLoaded' && message.workflow) {
                workflow = message.workflow;
                renderWorkflow(workflow);
            }
        });

        function renderWorkflow(wf) {
            // This would be replaced with actual canvas rendering logic
            const canvas = document.getElementById('workflowCanvas');
            canvas.innerHTML = '<p style="padding: 20px;">Visual editor rendering would go here</p>';
        }

        // Load workflow on startup
        loadWorkflow();
    </script>
</body>
</html>`;
    }
}