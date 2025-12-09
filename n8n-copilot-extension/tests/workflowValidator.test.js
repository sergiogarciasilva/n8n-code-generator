"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const workflowValidator_1 = require("../src/validators/workflowValidator");
describe('WorkflowValidator', () => {
    let validator;
    beforeEach(() => {
        validator = new workflowValidator_1.WorkflowValidator();
    });
    describe('validate', () => {
        test('should validate a valid workflow', async () => {
            const workflow = {
                name: 'Test Workflow',
                nodes: [
                    {
                        id: 'start',
                        name: 'Start',
                        type: 'n8n-nodes-base.start',
                        typeVersion: 1,
                        position: [250, 300],
                        parameters: {}
                    }
                ],
                connections: {},
                active: false
            };
            const results = await validator.validate(workflow);
            const errors = results.filter(r => !r.valid);
            expect(errors).toHaveLength(0);
        });
        test('should detect missing required fields', async () => {
            const workflow = {
                nodes: [
                    {
                        id: 'http',
                        name: 'HTTP Request',
                        type: 'n8n-nodes-base.httpRequest',
                        typeVersion: 1,
                        position: [250, 300],
                        parameters: {} // Missing required 'url' parameter
                    }
                ]
            };
            const results = await validator.validate(workflow);
            const errors = results.filter(r => !r.valid && r.level === 'error');
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].message).toContain('missing URL parameter');
        });
        test('should detect connection errors', async () => {
            const workflow = {
                name: 'Test',
                nodes: [
                    {
                        id: 'start',
                        name: 'Start',
                        type: 'n8n-nodes-base.start',
                        typeVersion: 1,
                        position: [250, 300],
                        parameters: {}
                    }
                ],
                connections: {
                    'start': {
                        'main': [[{ node: 'nonexistent', type: 'main', index: 0 }]]
                    }
                }
            };
            const results = await validator.validate(workflow);
            const errors = results.filter(r => !r.valid);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].message).toContain('non-existent node');
        });
        test('should detect workflow loops', async () => {
            const workflow = {
                name: 'Loop Test',
                nodes: [
                    {
                        id: 'node1',
                        name: 'Node 1',
                        type: 'n8n-nodes-base.set',
                        typeVersion: 1,
                        position: [250, 300],
                        parameters: {}
                    },
                    {
                        id: 'node2',
                        name: 'Node 2',
                        type: 'n8n-nodes-base.set',
                        typeVersion: 1,
                        position: [450, 300],
                        parameters: {}
                    }
                ],
                connections: {
                    'node1': {
                        'main': [[{ node: 'node2', type: 'main', index: 0 }]]
                    },
                    'node2': {
                        'main': [[{ node: 'node1', type: 'main', index: 0 }]]
                    }
                }
            };
            const results = await validator.validate(workflow);
            const warnings = results.filter(r => !r.valid && r.level === 'warning');
            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0].message).toContain('loop');
        });
    });
    describe('validateMCP', () => {
        test('should validate MCP-specific requirements', () => {
            const workflow = {
                nodes: [
                    {
                        id: 'mcp1',
                        name: 'MCP Node',
                        type: 'n8n-nodes-base.mcp',
                        parameters: {
                            protocol: 'mcp'
                            // Missing contextBoundary
                        }
                    }
                ]
            };
            const results = validator.validateMCP(workflow);
            const errors = results.filter(r => !r.valid);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].message).toContain('context boundary');
        });
    });
    describe('validateTelegram', () => {
        test('should validate Telegram-specific requirements', () => {
            const workflow = {
                nodes: [
                    {
                        id: 'telegram1',
                        name: 'Telegram Trigger',
                        type: 'n8n-nodes-base.telegramTrigger',
                        parameters: {}
                        // Missing webhookId
                    }
                ]
            };
            const results = validator.validateTelegram(workflow);
            const errors = results.filter(r => !r.valid);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].message).toContain('webhook configuration');
        });
    });
});
//# sourceMappingURL=workflowValidator.test.js.map