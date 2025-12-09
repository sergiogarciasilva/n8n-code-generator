import * as vscode from 'vscode';
import { AIEngine } from '../ai-engine/aiEngine';
import { WorkflowValidator } from '../validators/workflowValidator';

export class CompletionProvider implements vscode.CompletionItemProvider {
    private nodeTypes: Map<string, NodeTypeInfo>;
    private recentSuggestions: string[] = [];

    constructor(
        private aiEngine: AIEngine,
        private validator: WorkflowValidator
    ) {
        this.nodeTypes = new Map();
        this.initializeNodeTypes();
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        const items: vscode.CompletionItem[] = [];

        try {
            // Parse current workflow
            const text = document.getText();
            const workflow = JSON.parse(text);
            
            // Get context at cursor position
            const lineText = document.lineAt(position).text;
            const wordRange = document.getWordRangeAtPosition(position);
            const currentWord = wordRange ? document.getText(wordRange) : '';
            
            // Determine context type
            const contextType = this.getContextType(text, position, lineText);
            
            switch (contextType) {
                case 'nodeType':
                    items.push(...this.getNodeTypeCompletions(currentWord));
                    break;
                case 'nodeParameter':
                    items.push(...await this.getNodeParameterCompletions(workflow, position, currentWord));
                    break;
                case 'connection':
                    items.push(...this.getConnectionCompletions(workflow, currentWord));
                    break;
                case 'credential':
                    items.push(...this.getCredentialCompletions(currentWord));
                    break;
                case 'expression':
                    items.push(...this.getExpressionCompletions(workflow, currentWord));
                    break;
                default:
                    // Get AI suggestions for general context
                    const aiSuggestions = await this.aiEngine.suggestNextNode(workflow, position);
                    items.push(...this.convertAISuggestionsToCompletionItems(aiSuggestions));
            }

            // Add snippets
            items.push(...this.getSnippetCompletions(contextType));

        } catch (error) {
            console.error('Completion provider error:', error);
        }

        return items;
    }

    private initializeNodeTypes(): void {
        // Core nodes
        this.addNodeType('n8n-nodes-base.start', 'Start', 'Trigger workflow manually', ['trigger']);
        this.addNodeType('n8n-nodes-base.webhook', 'Webhook', 'Receive HTTP requests', ['trigger', 'http']);
        this.addNodeType('n8n-nodes-base.schedule', 'Schedule', 'Trigger workflow on schedule', ['trigger', 'cron']);
        
        // Data transformation
        this.addNodeType('n8n-nodes-base.set', 'Set', 'Set data fields', ['data', 'transform']);
        this.addNodeType('n8n-nodes-base.code', 'Code', 'Execute JavaScript code', ['data', 'transform', 'javascript']);
        this.addNodeType('n8n-nodes-base.function', 'Function', 'Execute custom function', ['data', 'transform']);
        
        // Flow control
        this.addNodeType('n8n-nodes-base.if', 'IF', 'Conditional branching', ['control', 'condition']);
        this.addNodeType('n8n-nodes-base.switch', 'Switch', 'Multiple conditional branches', ['control', 'condition']);
        this.addNodeType('n8n-nodes-base.merge', 'Merge', 'Merge multiple branches', ['control']);
        this.addNodeType('n8n-nodes-base.splitInBatches', 'Split In Batches', 'Process data in batches', ['control', 'batch']);
        
        // Communication
        this.addNodeType('n8n-nodes-base.httpRequest', 'HTTP Request', 'Make HTTP requests', ['http', 'api']);
        this.addNodeType('n8n-nodes-base.telegram', 'Telegram', 'Send Telegram messages', ['communication', 'bot']);
        this.addNodeType('n8n-nodes-base.telegramTrigger', 'Telegram Trigger', 'Receive Telegram messages', ['trigger', 'bot']);
        this.addNodeType('n8n-nodes-base.slack', 'Slack', 'Send Slack messages', ['communication']);
        this.addNodeType('n8n-nodes-base.emailSend', 'Email', 'Send emails', ['communication']);
        
        // AI/ML
        this.addNodeType('n8n-nodes-base.openAi', 'OpenAI', 'Use OpenAI API', ['ai', 'ml']);
        
        // Databases
        this.addNodeType('n8n-nodes-base.postgres', 'PostgreSQL', 'Query PostgreSQL database', ['database']);
        this.addNodeType('n8n-nodes-base.mongodb', 'MongoDB', 'Query MongoDB database', ['database']);
        this.addNodeType('n8n-nodes-base.redis', 'Redis', 'Use Redis cache', ['database', 'cache']);
    }

    private addNodeType(type: string, name: string, description: string, tags: string[]): void {
        this.nodeTypes.set(type, { type, name, description, tags });
    }

    private getContextType(text: string, position: vscode.Position, lineText: string): string {
        // Check if we're inside a specific JSON property
        if (lineText.includes('"type"')) return 'nodeType';
        if (lineText.includes('"parameters"')) return 'nodeParameter';
        if (lineText.includes('"connections"')) return 'connection';
        if (lineText.includes('"credentials"')) return 'credential';
        if (lineText.includes('{{') && lineText.includes('}}')) return 'expression';
        
        return 'general';
    }

    private getNodeTypeCompletions(currentWord: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        this.nodeTypes.forEach((info, type) => {
            if (type.toLowerCase().includes(currentWord.toLowerCase()) || 
                info.name.toLowerCase().includes(currentWord.toLowerCase())) {
                
                const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.Class);
                item.detail = info.name;
                item.documentation = new vscode.MarkdownString(info.description);
                item.insertText = `"${type}"`;
                item.sortText = `0${info.name}`;
                
                // Add tags as additional info
                if (info.tags.length > 0) {
                    item.documentation.appendMarkdown(`\n\nTags: ${info.tags.join(', ')}`);
                }
                
                items.push(item);
            }
        });
        
        return items;
    }

    private async getNodeParameterCompletions(workflow: any, position: vscode.Position, currentWord: string): Promise<vscode.CompletionItem[]> {
        const items: vscode.CompletionItem[] = [];
        
        // Common parameters
        const commonParams = [
            { name: 'resource', type: 'string', description: 'Resource to operate on' },
            { name: 'operation', type: 'string', description: 'Operation to perform' },
            { name: 'url', type: 'string', description: 'URL for the request' },
            { name: 'method', type: 'string', description: 'HTTP method', values: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
            { name: 'headers', type: 'object', description: 'Request headers' },
            { name: 'queryParameters', type: 'object', description: 'Query parameters' },
            { name: 'body', type: 'object', description: 'Request body' },
            { name: 'responseFormat', type: 'string', description: 'Response format', values: ['json', 'string', 'file'] }
        ];
        
        commonParams.forEach(param => {
            if (param.name.includes(currentWord)) {
                const item = new vscode.CompletionItem(param.name, vscode.CompletionItemKind.Property);
                item.detail = param.type;
                item.documentation = param.description;
                
                if (param.values) {
                    item.insertText = new vscode.SnippetString(`"${param.name}": "\${1|${param.values.join(',')}|}"`);
                } else {
                    item.insertText = new vscode.SnippetString(`"${param.name}": "$1"`);
                }
                
                items.push(item);
            }
        });
        
        return items;
    }

    private getConnectionCompletions(workflow: any, currentWord: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        // Get all node IDs for connection suggestions
        if (workflow.nodes) {
            workflow.nodes.forEach((node: any) => {
                if (node.id.includes(currentWord) || node.name.toLowerCase().includes(currentWord.toLowerCase())) {
                    const item = new vscode.CompletionItem(node.id, vscode.CompletionItemKind.Reference);
                    item.detail = `${node.name} (${node.type})`;
                    item.documentation = 'Connect to this node';
                    item.insertText = `"${node.id}"`;
                    items.push(item);
                }
            });
        }
        
        return items;
    }

    private getCredentialCompletions(currentWord: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        const credentialTypes = [
            { type: 'telegramApi', name: 'Telegram API', description: 'Telegram Bot credentials' },
            { type: 'openAiApi', name: 'OpenAI API', description: 'OpenAI API credentials' },
            { type: 'postgres', name: 'PostgreSQL', description: 'PostgreSQL database credentials' },
            { type: 'mongoDb', name: 'MongoDB', description: 'MongoDB connection credentials' },
            { type: 'redis', name: 'Redis', description: 'Redis connection credentials' },
            { type: 'httpBasicAuth', name: 'HTTP Basic Auth', description: 'Basic authentication credentials' },
            { type: 'httpHeaderAuth', name: 'HTTP Header Auth', description: 'Header authentication credentials' }
        ];
        
        credentialTypes.forEach(cred => {
            if (cred.type.includes(currentWord) || cred.name.toLowerCase().includes(currentWord.toLowerCase())) {
                const item = new vscode.CompletionItem(cred.type, vscode.CompletionItemKind.Constant);
                item.detail = cred.name;
                item.documentation = cred.description;
                item.insertText = new vscode.SnippetString(`{\n\t"${cred.type}": {\n\t\t"id": "$1",\n\t\t"name": "$2"\n\t}\n}`);
                items.push(item);
            }
        });
        
        return items;
    }

    private getExpressionCompletions(workflow: any, currentWord: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        // n8n expression variables
        const expressions = [
            { expr: '$json', description: 'Access current item data' },
            { expr: '$node', description: 'Access data from other nodes' },
            { expr: '$workflow', description: 'Access workflow metadata' },
            { expr: '$execution', description: 'Access execution metadata' },
            { expr: '$item', description: 'Access current item index' },
            { expr: '$items', description: 'Access all items' },
            { expr: '$now', description: 'Current timestamp' },
            { expr: '$today', description: 'Today\'s date' },
            { expr: '$jmespath', description: 'JMESPath query function' }
        ];
        
        expressions.forEach(exp => {
            if (exp.expr.includes(currentWord)) {
                const item = new vscode.CompletionItem(exp.expr, vscode.CompletionItemKind.Variable);
                item.documentation = exp.description;
                item.insertText = exp.expr;
                items.push(item);
            }
        });
        
        // Node references
        if (workflow.nodes) {
            workflow.nodes.forEach((node: any) => {
                const nodeRef = `$node["${node.name}"].json`;
                const item = new vscode.CompletionItem(nodeRef, vscode.CompletionItemKind.Reference);
                item.detail = 'Reference node output';
                item.documentation = `Access output from "${node.name}" node`;
                item.insertText = nodeRef;
                items.push(item);
            });
        }
        
        return items;
    }

    private getSnippetCompletions(contextType: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        // Workflow structure snippets
        if (contextType === 'general') {
            const workflowSnippet = new vscode.CompletionItem('n8n-workflow', vscode.CompletionItemKind.Snippet);
            workflowSnippet.detail = 'Basic n8n workflow structure';
            workflowSnippet.insertText = new vscode.SnippetString(
`{
\t"name": "\${1:My Workflow}",
\t"nodes": [
\t\t{
\t\t\t"id": "start",
\t\t\t"name": "Start",
\t\t\t"type": "n8n-nodes-base.start",
\t\t\t"typeVersion": 1,
\t\t\t"position": [250, 300]
\t\t}
\t],
\t"connections": {},
\t"active": false,
\t"settings": {},
\t"id": "\${2:workflow-id}"
}`);
            items.push(workflowSnippet);
            
            // Node snippet
            const nodeSnippet = new vscode.CompletionItem('n8n-node', vscode.CompletionItemKind.Snippet);
            nodeSnippet.detail = 'Add a new node';
            nodeSnippet.insertText = new vscode.SnippetString(
`{
\t"id": "\${1:node-id}",
\t"name": "\${2:Node Name}",
\t"type": "\${3:n8n-nodes-base.}",
\t"typeVersion": 1,
\t"position": [\${4:450}, \${5:300}],
\t"parameters": {
\t\t$6
\t}
}`);
            items.push(nodeSnippet);
        }
        
        return items;
    }

    private convertAISuggestionsToCompletionItems(suggestions: any[]): vscode.CompletionItem[] {
        return suggestions.map((suggestion, index) => {
            const item = new vscode.CompletionItem(
                suggestion.name || suggestion.type,
                vscode.CompletionItemKind.Operator
            );
            item.detail = 'AI Suggestion';
            item.documentation = `Suggested node type: ${suggestion.type}`;
            item.sortText = `9${index}`; // AI suggestions appear last
            item.insertText = new vscode.SnippetString(
`{
\t"id": "\${1:${suggestion.type.split('.').pop()}-\${TM_FILENAME_BASE}}",
\t"name": "\${2:${suggestion.name || 'New Node'}}",
\t"type": "${suggestion.type}",
\t"typeVersion": 1,
\t"position": [\${3:450}, \${4:300}],
\t"parameters": {
\t\t$5
\t}
}`);
            
            // Mark as recently suggested
            this.recentSuggestions.push(suggestion.type);
            if (this.recentSuggestions.length > 10) {
                this.recentSuggestions.shift();
            }
            
            return item;
        });
    }
}

interface NodeTypeInfo {
    type: string;
    name: string;
    description: string;
    tags: string[];
}