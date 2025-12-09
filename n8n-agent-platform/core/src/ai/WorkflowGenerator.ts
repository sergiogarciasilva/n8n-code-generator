import { OpenAI } from 'openai';
import { WorkflowKnowledgeBase } from './WorkflowKnowledgeBase';
import { N8nWorkflow, N8nNode, WorkflowGenerationRequest, GeneratedWorkflow } from '../types/workflows';
import { logger } from '../utils/logger';

export class WorkflowGenerator {
    private openai: OpenAI;
    private knowledgeBase: WorkflowKnowledgeBase;
    private systemPrompt: string;

    constructor(apiKey: string, knowledgeBase: WorkflowKnowledgeBase) {
        this.openai = new OpenAI({ apiKey });
        this.knowledgeBase = knowledgeBase;
        this.systemPrompt = this.buildSystemPrompt();
    }

    private buildSystemPrompt(): string {
        return `You are an expert n8n workflow developer and AI assistant specialized in creating production-ready workflows.

CAPABILITIES:
- Generate complete n8n workflows from natural language descriptions
- Create workflows for MCPs (Model Context Protocol), Telegram bots, and AI agent systems
- Optimize workflows for performance and reliability
- Follow n8n best practices and security guidelines

WORKFLOW TYPES EXPERTISE:
1. **MCPs (Model Context Protocol)**: AI agent orchestration, context management, multi-model workflows
2. **Telegram Bots**: Chat automation, webhook handling, media processing, inline keyboards
3. **AI Agent Systems**: Multi-agent coordination, state management, decision trees
4. **Data Processing**: ETL pipelines, transformations, validations
5. **API Integrations**: REST/GraphQL APIs, webhooks, authentication
6. **Automation**: Email, notifications, scheduling, file processing

TECHNICAL REQUIREMENTS:
- Target n8n Cloud v1.98 compatibility
- Use proper node types and configurations
- Include error handling and validation
- Optimize for 10-50 node workflows
- Follow security best practices
- Include proper webhook configurations
- Add meaningful descriptions and labels

OUTPUT FORMAT:
Always respond with valid JSON containing:
{
  "workflow": { /* complete n8n workflow JSON */ },
  "metadata": {
    "name": "string",
    "description": "string", 
    "category": "automation|integration|ai-ml|data-processing|communication|monitoring|enterprise",
    "difficulty": "beginner|intermediate|advanced|expert",
    "estimated_execution_time": "string",
    "dependencies": ["array of required services/credentials"],
    "tags": ["array of relevant tags"]
  },
  "usage_instructions": "string explaining how to use the workflow",
  "test_data": { /* sample test data for the workflow */ }
}

IMPORTANT RULES:
1. Always create functional, executable workflows
2. Include proper error handling with IF nodes
3. Use webhook triggers for external integrations
4. Add Code nodes for complex logic
5. Include proper variable naming and descriptions
6. Ensure all connections are properly defined
7. Add success/error response nodes for webhooks
8. Use environment variables for sensitive data
9. Follow n8n JSON schema exactly
10. Include position coordinates for visual layout`;
    }

    async generateWorkflow(request: WorkflowGenerationRequest): Promise<GeneratedWorkflow> {
        try {
            logger.info('Starting workflow generation', { 
                description: request.description,
                category: request.category 
            });

            // Get relevant examples from knowledge base
            const examples = await this.knowledgeBase.findSimilarWorkflows(
                request.description, 
                request.category, 
                3
            );

            // Build enhanced prompt with examples
            const enhancedPrompt = this.buildEnhancedPrompt(request, examples);

            // Generate workflow using OpenAI
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: this.systemPrompt },
                    { role: 'user', content: enhancedPrompt }
                ],
                temperature: 0.3, // Lower temperature for more consistent outputs
                max_tokens: 4000,
                response_format: { type: 'json_object' }
            });

            const generatedContent = response.choices[0]?.message?.content;
            if (!generatedContent) {
                throw new Error('No content generated from OpenAI');
            }

            // Parse and validate the generated workflow
            const generated = JSON.parse(generatedContent);
            const validatedWorkflow = await this.validateAndEnhanceWorkflow(generated, request);

            logger.info('Workflow generation completed successfully', {
                nodeCount: validatedWorkflow.workflow.nodes?.length || 0,
                category: validatedWorkflow.metadata.category
            });

            return validatedWorkflow;

        } catch (error) {
            logger.error('Workflow generation failed', { error: error.message, request });
            throw new Error(`Workflow generation failed: ${error.message}`);
        }
    }

    private buildEnhancedPrompt(request: WorkflowGenerationRequest, examples: any[]): string {
        let prompt = `Generate a complete n8n workflow for the following requirement:

DESCRIPTION: ${request.description}

CATEGORY: ${request.category}
DIFFICULTY: ${request.difficulty || 'intermediate'}
TARGET EXECUTION TIME: ${request.maxExecutionTime || '5 minutes'}`;

        if (request.specificRequirements?.length) {
            prompt += `\n\nSPECIFIC REQUIREMENTS:
${request.specificRequirements.map(req => `- ${req}`).join('\n')}`;
        }

        if (request.integrations?.length) {
            prompt += `\n\nREQUIRED INTEGRATIONS:
${request.integrations.map(int => `- ${int}`).join('\n')}`;
        }

        if (examples.length > 0) {
            prompt += `\n\nRELEVANT EXAMPLES FROM KNOWLEDGE BASE:
${examples.map((ex, i) => `
Example ${i + 1}: ${ex.name}
Description: ${ex.description}
Key nodes: ${ex.common_nodes?.join(', ') || 'N/A'}
`).join('')}

Use these examples as inspiration but create a unique workflow tailored to the specific requirements.`;
        }

        prompt += `\n\nGenerate a complete, functional n8n workflow that meets all requirements. Include proper error handling, validation, and follow n8n best practices.`;

        return prompt;
    }

    private async validateAndEnhanceWorkflow(generated: any, request: WorkflowGenerationRequest): Promise<GeneratedWorkflow> {
        // Validate basic structure
        if (!generated.workflow || !generated.metadata) {
            throw new Error('Generated workflow missing required structure');
        }

        // Ensure workflow has nodes and connections
        if (!generated.workflow.nodes || !Array.isArray(generated.workflow.nodes)) {
            throw new Error('Workflow must have nodes array');
        }

        // Add generated timestamp and metadata
        const enhancedMetadata = {
            ...generated.metadata,
            id: `generated-${Date.now()}`,
            generated_at: new Date().toISOString(),
            generated_by: 'ai-workflow-generator',
            n8n_version: 'v1.x.x',
            user_request: request.description,
            auto_generated: true
        };

        // Ensure proper node positioning
        this.ensureNodePositioning(generated.workflow.nodes);

        // Add validation status
        const validationResult = await this.performWorkflowValidation(generated.workflow);

        return {
            workflow: generated.workflow,
            metadata: enhancedMetadata,
            usage_instructions: generated.usage_instructions || 'No specific instructions provided',
            test_data: generated.test_data || {},
            validation: validationResult,
            generation_stats: {
                tokens_used: 0, // Would be populated from OpenAI response
                generation_time: Date.now(),
                confidence_score: this.calculateConfidenceScore(generated.workflow)
            }
        };
    }

    private ensureNodePositioning(nodes: N8nNode[]): void {
        nodes.forEach((node, index) => {
            if (!node.position) {
                // Auto-arrange nodes in a flow from left to right
                node.position = [
                    240 + (index % 3) * 220, // X position (3 columns)
                    300 + Math.floor(index / 3) * 100 // Y position (new row every 3 nodes)
                ];
            }
        });
    }

    private async performWorkflowValidation(workflow: N8nWorkflow): Promise<any> {
        const validation = {
            syntax_valid: true,
            errors: [] as string[],
            warnings: [] as string[],
            node_count: workflow.nodes?.length || 0,
            connection_count: 0,
            estimated_complexity: 'medium'
        };

        // Basic validation checks
        if (!workflow.nodes || workflow.nodes.length === 0) {
            validation.syntax_valid = false;
            validation.errors.push('Workflow must have at least one node');
        }

        // Check for required fields in nodes
        workflow.nodes?.forEach((node, index) => {
            if (!node.id || !node.name || !node.type) {
                validation.errors.push(`Node ${index} missing required fields (id, name, type)`);
                validation.syntax_valid = false;
            }
        });

        // Count connections
        if (workflow.connections) {
            validation.connection_count = Object.keys(workflow.connections).length;
        }

        // Estimate complexity
        const nodeCount = validation.node_count;
        if (nodeCount <= 5) validation.estimated_complexity = 'simple';
        else if (nodeCount <= 15) validation.estimated_complexity = 'medium';
        else if (nodeCount <= 30) validation.estimated_complexity = 'complex';
        else validation.estimated_complexity = 'very_complex';

        return validation;
    }

    private calculateConfidenceScore(workflow: N8nWorkflow): number {
        let score = 0.5; // Base score

        // Increase score based on workflow completeness
        if (workflow.nodes && workflow.nodes.length > 0) score += 0.2;
        if (workflow.connections && Object.keys(workflow.connections).length > 0) score += 0.2;
        if (workflow.nodes?.some(node => node.type === 'n8n-nodes-base.webhook')) score += 0.1;

        return Math.min(score, 1.0);
    }

    async suggestNextNode(
        currentWorkflow: N8nWorkflow, 
        currentPosition: string, 
        context: string
    ): Promise<string[]> {
        try {
            const prompt = `Based on this n8n workflow context, suggest the next 3-5 most logical nodes to add:

CURRENT WORKFLOW NODES:
${currentWorkflow.nodes?.map(node => `- ${node.name} (${node.type})`).join('\n') || 'No nodes yet'}

CURRENT POSITION: ${currentPosition}
CONTEXT: ${context}

Respond with an array of node type suggestions in order of relevance. Only return the JSON array.`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { 
                        role: 'system', 
                        content: 'You are an n8n expert. Suggest logical next nodes for workflows. Respond only with a JSON array of node types.' 
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 200
            });

            const suggestions = JSON.parse(response.choices[0]?.message?.content || '[]');
            return Array.isArray(suggestions) ? suggestions : [];

        } catch (error) {
            logger.error('Node suggestion failed', { error: error.message });
            return []; // Return empty array on error
        }
    }

    async optimizeWorkflow(workflow: N8nWorkflow): Promise<{ 
        optimized_workflow: N8nWorkflow, 
        optimizations: string[] 
    }> {
        try {
            const prompt = `Analyze this n8n workflow and suggest optimizations:

WORKFLOW:
${JSON.stringify(workflow, null, 2)}

Provide optimizations for:
1. Performance improvements
2. Error handling enhancements
3. Security best practices
4. Code simplification
5. Resource usage optimization

Respond with JSON: { "optimized_workflow": {...}, "optimizations": ["list of changes made"] }`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    { 
                        role: 'system', 
                        content: 'You are an n8n optimization expert. Analyze workflows and provide performance and security improvements.' 
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 3000,
                response_format: { type: 'json_object' }
            });

            const result = JSON.parse(response.choices[0]?.message?.content || '{}');
            return {
                optimized_workflow: result.optimized_workflow || workflow,
                optimizations: result.optimizations || []
            };

        } catch (error) {
            logger.error('Workflow optimization failed', { error: error.message });
            return {
                optimized_workflow: workflow,
                optimizations: [`Optimization failed: ${error.message}`]
            };
        }
    }
}