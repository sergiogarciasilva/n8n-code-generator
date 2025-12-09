import * as vscode from 'vscode';
import { WorkflowValidator } from '../validators/workflowValidator';
import { N8nApiClient } from './n8nApiClient';
import { AIEngine } from '../ai-engine/aiEngine';
import { WorkflowExecutor } from '../executors/workflowExecutor';
import { WebviewProvider } from './webviewProvider';
import { StatusBarManager } from './statusBarManager';
import { CompletionProvider } from './completionProvider';
import { LocalServer } from '../server/localServer';

let localServer: LocalServer;

export async function activate(context: vscode.ExtensionContext) {
    console.log('n8n Copilot extension is now active!');

    // Initialize components
    const config = vscode.workspace.getConfiguration('n8n');
    const validator = new WorkflowValidator();
    const apiClient = new N8nApiClient(config.get('cloudApiUrl')!, config.get('apiKey'));
    const aiEngine = new AIEngine(config.get('openaiApiKey'));
    const executor = new WorkflowExecutor(apiClient);
    const statusBar = new StatusBarManager();
    
    // Start local server
    localServer = new LocalServer(config.get('localServerPort') || 3456);
    await localServer.start();

    // Register webview provider
    const webviewProvider = new WebviewProvider(context.extensionUri, executor);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('n8n-explorer', webviewProvider)
    );

    // Register completion provider
    const completionProvider = new CompletionProvider(aiEngine, validator);
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'json', pattern: '**/*.n8n.json' },
            completionProvider,
            '.', '"', ':', '['
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('n8n.createWorkflow', async () => {
            const description = await vscode.window.showInputBox({
                prompt: 'Describe the workflow you want to create',
                placeHolder: 'e.g., Create a Telegram bot that responds to messages with AI'
            });

            if (description) {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Generating workflow...',
                    cancellable: false
                }, async () => {
                    try {
                        const workflow = await aiEngine.generateWorkflow(description);
                        const doc = await vscode.workspace.openTextDocument({
                            content: JSON.stringify(workflow, null, 2),
                            language: 'json'
                        });
                        await vscode.window.showTextDocument(doc);
                        vscode.window.showInformationMessage('Workflow generated successfully!');
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to generate workflow: ${error}`);
                    }
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('n8n.validateWorkflow', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            try {
                const content = editor.document.getText();
                const workflow = JSON.parse(content);
                const results = await validator.validate(workflow);
                
                const diagnostics: vscode.Diagnostic[] = [];
                results.forEach(result => {
                    if (!result.valid) {
                        const diagnostic = new vscode.Diagnostic(
                            new vscode.Range(0, 0, 0, 0),
                            result.message,
                            result.level === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
                        );
                        diagnostics.push(diagnostic);
                    }
                });

                const diagnosticCollection = vscode.languages.createDiagnosticCollection('n8n');
                diagnosticCollection.set(editor.document.uri, diagnostics);
                context.subscriptions.push(diagnosticCollection);

                if (diagnostics.length === 0) {
                    vscode.window.showInformationMessage('Workflow is valid!');
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Validation failed: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('n8n.executeWorkflow', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            try {
                const content = editor.document.getText();
                const workflow = JSON.parse(content);
                
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Executing workflow...',
                    cancellable: true
                }, async (progress, token) => {
                    const result = await executor.execute(workflow, token);
                    if (result.success) {
                        vscode.window.showInformationMessage(`Workflow executed successfully in ${result.executionTime}ms`);
                        webviewProvider.updateExecutionResults(result);
                    } else {
                        vscode.window.showErrorMessage(`Execution failed: ${result.error}`);
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Execution failed: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('n8n.openVisualEditor', () => {
            webviewProvider.openVisualEditor();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('n8n.generateTests', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            try {
                const content = editor.document.getText();
                const workflow = JSON.parse(content);
                const tests = await aiEngine.generateTests(workflow);
                
                const testDoc = await vscode.workspace.openTextDocument({
                    content: tests,
                    language: 'typescript'
                });
                await vscode.window.showTextDocument(testDoc);
                vscode.window.showInformationMessage('Tests generated successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate tests: ${error}`);
            }
        })
    );

    // Initialize status bar
    statusBar.initialize(context);
    await statusBar.updateConnectionStatus(apiClient);

    // Watch for workflow file changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.n8n.json');
    watcher.onDidChange(async (uri) => {
        const doc = await vscode.workspace.openTextDocument(uri);
        const content = doc.getText();
        try {
            const workflow = JSON.parse(content);
            await validator.validateInBackground(workflow, uri);
        } catch (error) {
            // Invalid JSON, will be caught by VS Code
        }
    });
    context.subscriptions.push(watcher);
}

export function deactivate() {
    if (localServer) {
        localServer.stop();
    }
}