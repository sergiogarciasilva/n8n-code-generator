import * as vscode from 'vscode';
import { N8nApiClient } from './n8nApiClient';

export class StatusBarManager {
    private connectionStatus: vscode.StatusBarItem;
    private executionStatus: vscode.StatusBarItem;
    private errorCount: vscode.StatusBarItem;
    private performanceMetrics: vscode.StatusBarItem;
    
    private executionHistory: ExecutionMetric[] = [];
    private currentErrors: number = 0;

    constructor() {
        this.connectionStatus = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.executionStatus = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.errorCount = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            98
        );
        this.performanceMetrics = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            97
        );
    }

    initialize(context: vscode.ExtensionContext): void {
        // Set up status bar items
        this.connectionStatus.command = 'n8n.showConnectionDetails';
        this.executionStatus.command = 'n8n.showExecutionHistory';
        this.errorCount.command = 'n8n.showErrors';
        this.performanceMetrics.command = 'n8n.showPerformanceMetrics';

        // Add to subscriptions
        context.subscriptions.push(
            this.connectionStatus,
            this.executionStatus,
            this.errorCount,
            this.performanceMetrics
        );

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('n8n.showConnectionDetails', () => {
                this.showConnectionDetails();
            }),
            vscode.commands.registerCommand('n8n.showExecutionHistory', () => {
                this.showExecutionHistory();
            }),
            vscode.commands.registerCommand('n8n.showErrors', () => {
                this.showErrors();
            }),
            vscode.commands.registerCommand('n8n.showPerformanceMetrics', () => {
                this.showPerformanceMetrics();
            })
        );

        // Show items
        this.connectionStatus.show();
        this.executionStatus.show();
        this.errorCount.show();
        this.performanceMetrics.show();

        // Set initial states
        this.updateConnectionStatus(null);
        this.updateExecutionStatus(null);
        this.updateErrorCount(0);
        this.updatePerformanceMetrics();
    }

    async updateConnectionStatus(apiClient: N8nApiClient | null): Promise<void> {
        if (!apiClient) {
            this.connectionStatus.text = '$(circle-slash) n8n: Not Connected';
            this.connectionStatus.tooltip = 'Click to configure n8n connection';
            this.connectionStatus.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            return;
        }

        const isConnected = await apiClient.testConnection();
        
        if (isConnected) {
            this.connectionStatus.text = '$(check) n8n: Connected';
            this.connectionStatus.tooltip = 'Connected to n8n Cloud';
            this.connectionStatus.backgroundColor = undefined;
        } else {
            this.connectionStatus.text = '$(alert) n8n: Connection Failed';
            this.connectionStatus.tooltip = 'Failed to connect to n8n Cloud. Click to retry.';
            this.connectionStatus.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }

    updateExecutionStatus(execution: any): void {
        if (!execution) {
            this.executionStatus.text = '$(debug-stop) No Recent Execution';
            this.executionStatus.tooltip = 'No workflows executed yet';
            return;
        }

        const metric: ExecutionMetric = {
            timestamp: Date.now(),
            executionTime: execution.executionTime || 0,
            success: execution.success,
            nodeCount: execution.nodeCount || 0
        };

        this.executionHistory.push(metric);
        if (this.executionHistory.length > 10) {
            this.executionHistory.shift();
        }

        const icon = execution.success ? '$(check)' : '$(error)';
        const status = execution.success ? 'Success' : 'Failed';
        const time = this.formatExecutionTime(execution.executionTime);

        this.executionStatus.text = `${icon} Last: ${status} (${time})`;
        this.executionStatus.tooltip = this.generateExecutionTooltip(execution);
    }

    updateErrorCount(count: number): void {
        this.currentErrors = count;
        
        if (count === 0) {
            this.errorCount.text = '$(check) No Errors';
            this.errorCount.tooltip = 'No workflow errors detected';
            this.errorCount.backgroundColor = undefined;
        } else {
            this.errorCount.text = `$(error) ${count} Error${count > 1 ? 's' : ''}`;
            this.errorCount.tooltip = `${count} workflow error${count > 1 ? 's' : ''} detected. Click to view.`;
            this.errorCount.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    updatePerformanceMetrics(): void {
        if (this.executionHistory.length === 0) {
            this.performanceMetrics.text = '$(dashboard) No Metrics';
            this.performanceMetrics.tooltip = 'No performance metrics available yet';
            return;
        }

        const avgTime = this.calculateAverageExecutionTime();
        const successRate = this.calculateSuccessRate();

        this.performanceMetrics.text = `$(dashboard) Avg: ${this.formatExecutionTime(avgTime)} | ${successRate}% Success`;
        this.performanceMetrics.tooltip = this.generatePerformanceTooltip();
    }

    private calculateAverageExecutionTime(): number {
        if (this.executionHistory.length === 0) return 0;
        
        const sum = this.executionHistory.reduce((acc, metric) => acc + metric.executionTime, 0);
        return Math.round(sum / this.executionHistory.length);
    }

    private calculateSuccessRate(): number {
        if (this.executionHistory.length === 0) return 0;
        
        const successCount = this.executionHistory.filter(m => m.success).length;
        return Math.round((successCount / this.executionHistory.length) * 100);
    }

    private formatExecutionTime(ms: number): string {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
        }
    }

    private generateExecutionTooltip(execution: any): string {
        const lines = [
            `Status: ${execution.success ? 'Success' : 'Failed'}`,
            `Execution Time: ${this.formatExecutionTime(execution.executionTime)}`,
            `Nodes Executed: ${execution.nodeCount || 'Unknown'}`
        ];

        if (execution.error) {
            lines.push(`Error: ${execution.error}`);
        }

        if (execution.executionId) {
            lines.push(`Execution ID: ${execution.executionId}`);
        }

        return lines.join('\n');
    }

    private generatePerformanceTooltip(): string {
        const lines = [
            `Performance Metrics (Last ${this.executionHistory.length} executions)`,
            '',
            `Average Execution Time: ${this.formatExecutionTime(this.calculateAverageExecutionTime())}`,
            `Success Rate: ${this.calculateSuccessRate()}%`,
            `Total Executions: ${this.executionHistory.length}`
        ];

        if (this.executionHistory.length > 0) {
            const fastest = Math.min(...this.executionHistory.map(m => m.executionTime));
            const slowest = Math.max(...this.executionHistory.map(m => m.executionTime));
            lines.push(
                '',
                `Fastest: ${this.formatExecutionTime(fastest)}`,
                `Slowest: ${this.formatExecutionTime(slowest)}`
            );
        }

        return lines.join('\n');
    }

    private async showConnectionDetails(): Promise<void> {
        const options = ['Test Connection', 'Configure API Key', 'Change n8n URL'];
        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select an action'
        });

        switch (selected) {
            case 'Test Connection':
                vscode.commands.executeCommand('n8n.testConnection');
                break;
            case 'Configure API Key':
                vscode.commands.executeCommand('n8n.configureApiKey');
                break;
            case 'Change n8n URL':
                vscode.commands.executeCommand('n8n.configureUrl');
                break;
        }
    }

    private async showExecutionHistory(): Promise<void> {
        if (this.executionHistory.length === 0) {
            vscode.window.showInformationMessage('No execution history available');
            return;
        }

        const items = this.executionHistory.map((metric, index) => ({
            label: `Execution ${index + 1}`,
            description: `${metric.success ? 'Success' : 'Failed'} - ${this.formatExecutionTime(metric.executionTime)}`,
            detail: `${metric.nodeCount} nodes - ${new Date(metric.timestamp).toLocaleString()}`
        }));

        await vscode.window.showQuickPick(items, {
            placeHolder: 'Execution History'
        });
    }

    private showErrors(): void {
        if (this.currentErrors === 0) {
            vscode.window.showInformationMessage('No errors detected');
        } else {
            vscode.commands.executeCommand('workbench.actions.view.problems');
        }
    }

    private async showPerformanceMetrics(): Promise<void> {
        const message = this.generatePerformanceTooltip();
        await vscode.window.showInformationMessage(message, { modal: true });
    }
}

interface ExecutionMetric {
    timestamp: number;
    executionTime: number;
    success: boolean;
    nodeCount: number;
}