import { z } from 'zod';

// Workflow validation schemas
export const WorkflowNodeSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    typeVersion: z.number(),
    position: z.tuple([z.number(), z.number()]),
    parameters: z.record(z.any()),
    credentials: z.record(z.any()).optional(),
    disabled: z.boolean().optional(),
    continueOnFail: z.boolean().optional()
});

export const WorkflowConnectionSchema = z.object({
    node: z.string(),
    type: z.string(),
    index: z.number()
});

export const WorkflowSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    nodes: z.array(WorkflowNodeSchema),
    connections: z.record(z.record(z.array(z.array(WorkflowConnectionSchema)))),
    active: z.boolean().optional(),
    settings: z.record(z.any()).optional()
});

// Agent validation schemas
export const AgentConfigSchema = z.object({
    schedule: z.string().optional(),
    enabled: z.boolean(),
    options: z.record(z.any()).optional(),
    maxConcurrentWorkflows: z.number().optional(),
    timeout: z.number().optional()
});

export const AgentSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['mcp', 'telegram', 'multi-agent', 'general']),
    description: z.string(),
    status: z.enum(['idle', 'running', 'active', 'paused', 'stopped', 'error']),
    config: AgentConfigSchema.optional()
});

// Optimization validation schemas
export const OptimizationSuggestionSchema = z.object({
    id: z.string(),
    type: z.enum(['performance', 'reliability', 'security', 'feature', 'refactor']),
    title: z.string(),
    description: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
    effort: z.enum(['high', 'medium', 'low']),
    confidence: z.number().min(0).max(1).optional()
});

// Validation functions
export function validateWorkflow(workflow: any): { valid: boolean; errors?: string[] } {
    try {
        WorkflowSchema.parse(workflow);
        return { valid: true };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                valid: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            };
        }
        return { valid: false, errors: ['Unknown validation error'] };
    }
}

export function validateAgent(agent: any): { valid: boolean; errors?: string[] } {
    try {
        AgentSchema.parse(agent);
        return { valid: true };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                valid: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            };
        }
        return { valid: false, errors: ['Unknown validation error'] };
    }
}

export function validateCronExpression(expression: string): boolean {
    // Basic cron expression validation
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
    return cronRegex.test(expression);
}

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validateUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}