import { Router } from 'express';
import { WorkflowGenerator } from '../ai/WorkflowGenerator';
import { WorkflowKnowledgeBase } from '../ai/WorkflowKnowledgeBase';
import { WorkflowValidator } from '../validation/WorkflowValidator';
import { N8nCloudAPI } from '../integrations/N8nCloudAPI';
import { logger } from '../utils/logger';
import { Pool } from 'pg';

export class WorkflowGeneratorRouter {
    private router: Router;
    private generator: WorkflowGenerator;
    private knowledgeBase: WorkflowKnowledgeBase;
    private validator: WorkflowValidator;
    private n8nAPI: N8nCloudAPI;

    constructor(
        database: Pool,
        openaiApiKey: string,
        n8nApiKey?: string,
        n8nBaseUrl?: string
    ) {
        this.router = Router();
        
        // Initialize knowledge base
        const knowledgeBasePath = '/home/sergio/n8n_code_generator_github/n8n-workflows-knowledge';
        this.knowledgeBase = new WorkflowKnowledgeBase(database, knowledgeBasePath);
        
        // Initialize AI generator
        this.generator = new WorkflowGenerator(openaiApiKey, this.knowledgeBase);
        
        // Initialize validator
        this.validator = new WorkflowValidator();
        
        // Initialize n8n Cloud API integration
        if (n8nApiKey && n8nBaseUrl) {
            this.n8nAPI = new N8nCloudAPI(n8nApiKey, n8nBaseUrl);
        }
        
        this.setupRoutes();
        this.initializeKnowledgeBase();
    }

    private async initializeKnowledgeBase(): Promise<void> {
        try {
            await this.knowledgeBase.initialize();
            logger.info('WorkflowGeneratorRouter initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize WorkflowGeneratorRouter', { error: error.message });
        }
    }

    private setupRoutes(): void {
        // Generate workflow from description
        this.router.post('/generate', async (req, res) => {
            try {
                const { description, category, difficulty, useCase, maxExecutionTime, specificRequirements, integrations } = req.body;

                if (!description || !description.trim()) {
                    return res.status(400).json({
                        error: 'Description is required',
                        message: 'Please provide a description of the workflow you want to generate'
                    });
                }

                logger.info('Generating workflow', { description, category, difficulty });

                const generationRequest = {
                    description: description.trim(),
                    category: category || 'automation',
                    difficulty: difficulty || 'intermediate',
                    maxExecutionTime: maxExecutionTime || '5 minutes',
                    specificRequirements: specificRequirements || [],
                    integrations: integrations || [],
                    useCase: useCase || 'general'
                };

                const generatedWorkflow = await this.generator.generateWorkflow(generationRequest);

                // Increment usage count for similar templates
                const similarTemplates = await this.knowledgeBase.findSimilarWorkflows(description, category, 1);
                if (similarTemplates.length > 0) {
                    await this.knowledgeBase.incrementUsageCount(similarTemplates[0].template.id);
                }

                res.json({
                    success: true,
                    workflow: generatedWorkflow.workflow,
                    metadata: generatedWorkflow.metadata,
                    usage_instructions: generatedWorkflow.usage_instructions,
                    test_data: generatedWorkflow.test_data,
                    validation: generatedWorkflow.validation,
                    generation_stats: generatedWorkflow.generation_stats
                });

            } catch (error) {
                logger.error('Workflow generation failed', { error: error.message, body: req.body });
                res.status(500).json({
                    error: 'Generation failed',
                    message: error.message,
                    suggestion: 'Try with a more specific description or different parameters'
                });
            }
        });

        // Suggest next nodes
        this.router.post('/suggest-nodes', async (req, res) => {
            try {
                const { currentWorkflow, currentPosition, context } = req.body;

                if (!currentWorkflow) {
                    return res.status(400).json({
                        error: 'Current workflow is required'
                    });
                }

                const suggestions = await this.generator.suggestNextNode(
                    currentWorkflow,
                    currentPosition || 'end',
                    context || ''
                );

                res.json({
                    success: true,
                    suggestions: suggestions.map((nodeType, index) => ({
                        nodeType,
                        confidence: 1 - (index * 0.1), // Decreasing confidence
                        reason: `Logical next step based on workflow context`
                    }))
                });

            } catch (error) {
                logger.error('Node suggestion failed', { error: error.message });
                res.status(500).json({
                    error: 'Suggestion failed',
                    message: error.message
                });
            }
        });

        // Optimize workflow
        this.router.post('/optimize', async (req, res) => {
            try {
                const { workflow } = req.body;

                if (!workflow) {
                    return res.status(400).json({
                        error: 'Workflow is required'
                    });
                }

                const optimization = await this.generator.optimizeWorkflow(workflow);

                res.json({
                    success: true,
                    optimized_workflow: optimization.optimized_workflow,
                    optimizations: optimization.optimizations,
                    performance_improvement: 'Estimated 15-25% performance gain'
                });

            } catch (error) {
                logger.error('Workflow optimization failed', { error: error.message });
                res.status(500).json({
                    error: 'Optimization failed',
                    message: error.message
                });
            }
        });

        // Validate workflow
        this.router.post('/validate', async (req, res) => {
            try {
                const { workflow } = req.body;

                if (!workflow) {
                    return res.status(400).json({
                        error: 'Workflow is required'
                    });
                }

                const validation = await this.validator.validateWorkflow(workflow);

                res.json({
                    success: true,
                    validation: validation,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                logger.error('Workflow validation failed', { error: error.message });
                res.status(500).json({
                    error: 'Validation failed',
                    message: error.message
                });
            }
        });

        // Execute workflow (if n8n API is configured)
        this.router.post('/execute', async (req, res) => {
            try {
                const { workflow, testData } = req.body;

                if (!workflow) {
                    return res.status(400).json({
                        error: 'Workflow is required'
                    });
                }

                if (!this.n8nAPI) {
                    return res.status(501).json({
                        error: 'n8n API not configured',
                        message: 'n8n Cloud integration is not set up'
                    });
                }

                // First validate the workflow
                const validation = await this.validator.validateWorkflow(workflow);
                if (!validation.isValid) {
                    return res.status(400).json({
                        error: 'Workflow validation failed',
                        validation: validation
                    });
                }

                // Execute via n8n Cloud API
                const execution = await this.n8nAPI.executeWorkflow(workflow, testData);

                res.json({
                    success: true,
                    execution: execution,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                logger.error('Workflow execution failed', { error: error.message });
                res.status(500).json({
                    error: 'Execution failed',
                    message: error.message
                });
            }
        });

        // Save workflow to knowledge base
        this.router.post('/save', async (req, res) => {
            try {
                const { workflow, metadata, name, description, category, tags } = req.body;

                if (!workflow || !name) {
                    return res.status(400).json({
                        error: 'Workflow and name are required'
                    });
                }

                const template = {
                    id: `user-generated-${Date.now()}`,
                    name: name,
                    description: description || 'User generated workflow',
                    category: category || 'automation',
                    subcategory: 'user-generated',
                    tags: tags || [],
                    difficulty: metadata?.difficulty || 'intermediate',
                    n8n_version: 'v1.x.x',
                    workflow: workflow,
                    metadata: {
                        ...metadata,
                        saved_at: new Date().toISOString(),
                        user_generated: true
                    },
                    usage_count: 0,
                    rating: 0.0
                };

                await this.knowledgeBase.addTemplate(template);

                res.json({
                    success: true,
                    template_id: template.id,
                    message: 'Workflow saved to knowledge base'
                });

            } catch (error) {
                logger.error('Workflow save failed', { error: error.message });
                res.status(500).json({
                    error: 'Save failed',
                    message: error.message
                });
            }
        });

        // Search templates
        this.router.get('/templates/search', async (req, res) => {
            try {
                const { q, category, difficulty, tags, limit = 20 } = req.query;

                let templates;
                if (q) {
                    const filters = {
                        category: category as string,
                        difficulty: difficulty as string,
                        tags: tags ? (tags as string).split(',') : undefined
                    };
                    templates = await this.knowledgeBase.searchTemplates(q as string, filters, parseInt(limit as string));
                } else {
                    templates = await this.knowledgeBase.getPopularTemplates(parseInt(limit as string));
                }

                res.json({
                    success: true,
                    templates: templates,
                    count: templates.length
                });

            } catch (error) {
                logger.error('Template search failed', { error: error.message });
                res.status(500).json({
                    error: 'Search failed',
                    message: error.message
                });
            }
        });

        // Get templates by category
        this.router.get('/templates/category/:category', async (req, res) => {
            try {
                const { category } = req.params;
                const { limit = 20 } = req.query;

                const templates = await this.knowledgeBase.getTemplatesByCategory(
                    category,
                    parseInt(limit as string)
                );

                res.json({
                    success: true,
                    category: category,
                    templates: templates,
                    count: templates.length
                });

            } catch (error) {
                logger.error('Template fetch failed', { error: error.message });
                res.status(500).json({
                    error: 'Fetch failed',
                    message: error.message
                });
            }
        });

        // Get popular templates
        this.router.get('/templates/popular', async (req, res) => {
            try {
                const { limit = 10 } = req.query;

                const templates = await this.knowledgeBase.getPopularTemplates(parseInt(limit as string));

                res.json({
                    success: true,
                    templates: templates,
                    count: templates.length
                });

            } catch (error) {
                logger.error('Popular templates fetch failed', { error: error.message });
                res.status(500).json({
                    error: 'Fetch failed',
                    message: error.message
                });
            }
        });

        // Get recent templates
        this.router.get('/templates/recent', async (req, res) => {
            try {
                const { limit = 10 } = req.query;

                const templates = await this.knowledgeBase.getRecentTemplates(parseInt(limit as string));

                res.json({
                    success: true,
                    templates: templates,
                    count: templates.length
                });

            } catch (error) {
                logger.error('Recent templates fetch failed', { error: error.message });
                res.status(500).json({
                    error: 'Fetch failed',
                    message: error.message
                });
            }
        });

        // Get knowledge base statistics
        this.router.get('/stats', async (req, res) => {
            try {
                const stats = await this.knowledgeBase.getStatistics();

                res.json({
                    success: true,
                    statistics: stats,
                    capabilities: {
                        ai_generation: true,
                        validation: true,
                        optimization: true,
                        n8n_integration: !!this.n8nAPI,
                        knowledge_base: true
                    }
                });

            } catch (error) {
                logger.error('Stats fetch failed', { error: error.message });
                res.status(500).json({
                    error: 'Stats fetch failed',
                    message: error.message
                });
            }
        });

        // Rate template
        this.router.post('/templates/:templateId/rate', async (req, res) => {
            try {
                const { templateId } = req.params;
                const { rating } = req.body;

                if (!rating || rating < 1 || rating > 5) {
                    return res.status(400).json({
                        error: 'Rating must be between 1 and 5'
                    });
                }

                await this.knowledgeBase.rateTemplate(templateId, rating);

                res.json({
                    success: true,
                    message: 'Template rated successfully'
                });

            } catch (error) {
                logger.error('Template rating failed', { error: error.message });
                res.status(500).json({
                    error: 'Rating failed',
                    message: error.message
                });
            }
        });

        // Health check
        this.router.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                service: 'workflow-generator-api',
                version: '1.0.0',
                features: {
                    ai_generation: true,
                    knowledge_base: true,
                    validation: true,
                    optimization: true,
                    n8n_integration: !!this.n8nAPI
                },
                timestamp: new Date().toISOString()
            });
        });
    }

    getRouter(): Router {
        return this.router;
    }
}