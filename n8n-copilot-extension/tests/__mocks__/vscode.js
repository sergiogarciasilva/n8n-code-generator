// Mock VS Code API for testing
const vscode = {
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showInputBox: jest.fn(),
        showQuickPick: jest.fn(),
        createStatusBarItem: jest.fn(() => ({
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
            text: '',
            tooltip: '',
            command: '',
            backgroundColor: undefined
        })),
        activeTextEditor: undefined,
        createWebviewPanel: jest.fn(),
        withProgress: jest.fn((options, task) => task({ report: jest.fn() })),
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key) => {
                const config = {
                    'cloudApiUrl': 'https://app.n8n.cloud/api/v1/',
                    'apiKey': 'test-api-key',
                    'openaiApiKey': 'test-openai-key',
                    'localServerPort': 3456
                };
                return config[key];
            }),
            update: jest.fn()
        })),
        openTextDocument: jest.fn(),
        createFileSystemWatcher: jest.fn(() => ({
            onDidChange: jest.fn(),
            onDidCreate: jest.fn(),
            onDidDelete: jest.fn(),
            dispose: jest.fn()
        })),
        fs: {
            writeFile: jest.fn(),
            readFile: jest.fn()
        }
    },
    commands: {
        registerCommand: jest.fn(),
        executeCommand: jest.fn()
    },
    languages: {
        createDiagnosticCollection: jest.fn(() => ({
            set: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        })),
        registerCompletionItemProvider: jest.fn()
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path })),
        parse: jest.fn(),
        joinPath: jest.fn()
    },
    CompletionItem: class {
        constructor(label, kind) {
            this.label = label;
            this.kind = kind;
        }
    },
    CompletionItemKind: {
        Class: 6,
        Property: 9,
        Reference: 17,
        Constant: 20,
        Variable: 5,
        Snippet: 14,
        Operator: 23
    },
    MarkdownString: class {
        constructor(value) {
            this.value = value;
        }
        appendMarkdown(value) {
            this.value += value;
        }
    },
    SnippetString: class {
        constructor(value) {
            this.value = value;
        }
    },
    ThemeColor: class {
        constructor(id) {
            this.id = id;
        }
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2
    },
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3
    },
    Range: class {
        constructor(startLine, startChar, endLine, endChar) {
            this.start = { line: startLine, character: startChar };
            this.end = { line: endLine, character: endChar };
        }
    },
    Position: class {
        constructor(line, character) {
            this.line = line;
            this.character = character;
        }
    },
    Diagnostic: class {
        constructor(range, message, severity) {
            this.range = range;
            this.message = message;
            this.severity = severity;
        }
    },
    ProgressLocation: {
        Notification: 15,
        Window: 10,
        SourceControl: 1
    },
    ExtensionContext: class {
        constructor() {
            this.subscriptions = [];
            this.extensionUri = { fsPath: '/test/extension' };
        }
    }
};

module.exports = vscode;