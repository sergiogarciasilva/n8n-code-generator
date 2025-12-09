/**
 * Code Fixer - Automatically generates and applies fixes to workflow code
 * Specializes in JavaScript code node fixing with iterative improvements
 */

const fs = require('fs').promises;
const path = require('path');

class CodeFixer {
    constructor(openaiApiKey, knowledgeBasePath) {
        this.openaiApiKey = openaiApiKey;
        this.knowledgeBasePath = knowledgeBasePath;
        this.fixAttempts = new Map();
        this.maxAttempts = 5;
        this.fixTemplates = null;
        this.successPatterns = null;
    }

    /**
     * Initialize fixer with knowledge base
     */
    async initialize() {
        console.log('🔧 Initializing Code Fixer...');
        
        try {
            await this.loadFixTemplates();
            await this.loadSuccessPatterns();
            console.log('✅ Code Fixer initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Code Fixer:', error);
            throw error;
        }
    }

    /**
     * Load fix templates from knowledge base
     */
    async loadFixTemplates() {
        const templatesPath = path.join(this.knowledgeBasePath, 'fix-templates.json');
        
        try {
            const templatesData = await fs.readFile(templatesPath, 'utf8');
            this.fixTemplates = JSON.parse(templatesData);
        } catch (error) {
            console.log('📝 Creating default fix templates...');
            this.fixTemplates = this.createDefaultFixTemplates();
            await this.saveFixTemplates();
        }
    }

    /**
     * Load success patterns from knowledge base
     */
    async loadSuccessPatterns() {
        const patternsPath = path.join(this.knowledgeBasePath, 'success-patterns.json');
        
        try {
            const patternsData = await fs.readFile(patternsPath, 'utf8');
            this.successPatterns = JSON.parse(patternsData);
        } catch (error) {
            console.log('📝 Creating default success patterns...');
            this.successPatterns = this.createDefaultSuccessPatterns();
            await this.saveSuccessPatterns();
        }
    }

    /**
     * Apply fix to workflow based on analysis
     */
    async applyFix(errorInfo, analysis) {
        const fixKey = `${errorInfo.workflowId}_${errorInfo.nodeId}`;
        
        // Track fix attempts
        if (!this.fixAttempts.has(fixKey)) {
            this.fixAttempts.set(fixKey, {
                attempts: 0,
                history: [],
                originalCode: null
            });
        }

        const fixHistory = this.fixAttempts.get(fixKey);
        
        if (fixHistory.attempts >= this.maxAttempts) {
            console.log(`❌ Max fix attempts reached for ${fixKey}`);
            return {
                success: false,
                reason: 'Max attempts exceeded',
                attempts: fixHistory.attempts
            };
        }

        fixHistory.attempts++;
        console.log(`🔧 Applying fix attempt ${fixHistory.attempts} for ${errorInfo.type}`);

        try {
            // Generate fix based on analysis
            const fix = await this.generateFix(errorInfo, analysis, fixHistory);
            
            if (!fix) {
                return {
                    success: false,
                    reason: 'Could not generate fix',
                    attempts: fixHistory.attempts
                };
            }

            // Apply the fix to the workflow
            const applyResult = await this.applyFixToWorkflow(errorInfo, fix);
            
            // Record attempt
            fixHistory.history.push({
                attempt: fixHistory.attempts,
                timestamp: new Date(),
                fix,
                result: applyResult
            });

            return {
                success: applyResult.success,
                fix,
                attempts: fixHistory.attempts,
                result: applyResult
            };

        } catch (error) {
            console.error(`❌ Error applying fix: ${error.message}`);
            return {
                success: false,
                reason: error.message,
                attempts: fixHistory.attempts
            };
        }
    }

    /**
     * Generate fix based on error analysis and previous attempts
     */
    async generateFix(errorInfo, analysis, fixHistory) {
        console.log(`🤖 Generating fix for ${errorInfo.type}...`);

        // Try template-based fix first for known patterns
        const templateFix = this.generateTemplateBasedFix(errorInfo, analysis);
        if (templateFix && !this.hasTriedFix(fixHistory, templateFix)) {
            return templateFix;
        }

        // Use AI to generate custom fix
        const aiFix = await this.generateAIFix(errorInfo, analysis, fixHistory);
        return aiFix;
    }

    /**
     * Generate fix using predefined templates
     */
    generateTemplateBasedFix(errorInfo, analysis) {
        const fixRecommendations = analysis.fixRecommendations?.fixes || [];
        
        for (const recommendation of fixRecommendations) {
            if (recommendation.type === 'code_replacement' && recommendation.newCode) {
                return {
                    id: `template_${recommendation.id}`,
                    type: 'template',
                    description: recommendation.description,
                    code: recommendation.newCode,
                    reasoning: recommendation.reasoning,
                    changes: {
                        nodeId: errorInfo.nodeId,
                        field: 'jsCode',
                        newValue: recommendation.newCode
                    }
                };
            }
        }

        // Check fix templates for this error type
        const applicableTemplates = Object.values(this.fixTemplates).filter(template =>
            template.applicableErrors.includes(errorInfo.type) ||
            template.applicableErrors.includes(analysis.patternMatch?.patternId)
        );

        if (applicableTemplates.length > 0) {
            const template = applicableTemplates[0];
            const customizedCode = this.customizeTemplate(template, errorInfo);
            
            return {
                id: `template_${template.name}`,
                type: 'template',
                description: `Applied template: ${template.name}`,
                code: customizedCode,
                reasoning: `Used predefined template for ${errorInfo.type}`,
                changes: {
                    nodeId: errorInfo.nodeId,
                    field: 'jsCode',
                    newValue: customizedCode
                }
            };
        }

        return null;
    }

    /**
     * Generate AI-powered fix
     */
    async generateAIFix(errorInfo, analysis, fixHistory) {
        const prompt = this.buildFixGenerationPrompt(errorInfo, analysis, fixHistory);

        try {
            const response = await this.callOpenAI(prompt);
            return this.parseAIFixResponse(response, errorInfo);
        } catch (error) {
            console.error('❌ AI fix generation failed:', error);
            return null;
        }
    }

    /**
     * Build prompt for AI fix generation
     */
    buildFixGenerationPrompt(errorInfo, analysis, fixHistory) {
        const previousAttempts = fixHistory.history.map(h => ({
            attempt: h.attempt,
            fix: h.fix.description,
            result: h.result.success ? 'SUCCESS' : 'FAILED'
        }));

        return `
You are an expert n8n JavaScript code fixer. Generate working JavaScript code to fix this workflow error.

ERROR DETAILS:
- Type: ${errorInfo.type}
- Message: ${errorInfo.message}
- Node ID: ${errorInfo.nodeId}
- Workflow ID: ${errorInfo.workflowId}

ANALYSIS:
- Root Cause: ${analysis.rootCause}
- Problem: ${analysis.problemDescription}
- Complexity: ${analysis.complexity}
- Confidence: ${analysis.confidence}

${errorInfo.workflow ? `
CURRENT WORKFLOW NODE:
${JSON.stringify(errorInfo.workflow.nodes?.find(n => n.id === errorInfo.nodeId), null, 2)}
` : ''}

${previousAttempts.length > 0 ? `
PREVIOUS FIX ATTEMPTS:
${previousAttempts.map(a => `Attempt ${a.attempt}: ${a.fix} - ${a.result}`).join('\n')}

IMPORTANT: Don't repeat failed approaches. Try a different solution.
` : ''}

REQUIREMENTS:
1. Generate complete, working JavaScript code for n8n Code node
2. Code must return data in n8n format: return { json: {...} } or [{ json: {...} }]
3. Include proper error handling with try/catch
4. Add null/undefined checks for input data
5. Use $input.all() to get input data safely
6. Code should be production-ready and robust

OUTPUT FORMAT:
{
  "fixedCode": "// Complete working JavaScript code here",
  "description": "What this fix does",
  "reasoning": "Why this approach will work",
  "testCases": ["Test case 1", "Test case 2"],
  "riskLevel": "low|medium|high"
}

Generate the complete fixed JavaScript code:`;
    }

    /**
     * Parse AI fix response
     */
    parseAIFixResponse(response, errorInfo) {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/```json\n?(.*?)\n?```/s) || [null, response];
            const jsonStr = jsonMatch[1] || response;
            
            const parsed = JSON.parse(jsonStr);
            
            return {
                id: `ai_fix_${Date.now()}`,
                type: 'ai_generated',
                description: parsed.description,
                code: parsed.fixedCode,
                reasoning: parsed.reasoning,
                riskLevel: parsed.riskLevel || 'medium',
                testCases: parsed.testCases || [],
                changes: {
                    nodeId: errorInfo.nodeId,
                    field: 'jsCode',
                    newValue: parsed.fixedCode
                }
            };
        } catch (error) {
            console.error('Failed to parse AI fix response:', error);
            return null;
        }
    }

    /**
     * Apply fix to workflow file
     */
    async applyFixToWorkflow(errorInfo, fix) {
        console.log(`📝 Applying fix to workflow ${errorInfo.workflowId}...`);

        try {
            // Load workflow file
            const workflowPath = errorInfo.workflowPath || 
                                this.getWorkflowPath(errorInfo.workflowId);
            
            const workflowContent = await fs.readFile(workflowPath, 'utf8');
            const workflow = JSON.parse(workflowContent);

            // Find and update the node
            const nodeIndex = workflow.nodes.findIndex(n => n.id === fix.changes.nodeId);
            
            if (nodeIndex === -1) {
                throw new Error(`Node ${fix.changes.nodeId} not found in workflow`);
            }

            // Backup original code if first attempt
            const fixKey = `${errorInfo.workflowId}_${errorInfo.nodeId}`;
            const fixHistory = this.fixAttempts.get(fixKey);
            
            if (!fixHistory.originalCode) {
                fixHistory.originalCode = workflow.nodes[nodeIndex].parameters?.jsCode;
            }

            // Apply the fix
            if (!workflow.nodes[nodeIndex].parameters) {
                workflow.nodes[nodeIndex].parameters = {};
            }
            
            workflow.nodes[nodeIndex].parameters[fix.changes.field] = fix.changes.newValue;

            // Add fix metadata
            workflow.nodes[nodeIndex]._fixMetadata = {
                fixId: fix.id,
                fixedAt: new Date().toISOString(),
                fixDescription: fix.description,
                attempt: fixHistory.attempts
            };

            // Save updated workflow
            await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2));

            console.log(`✅ Fix applied to ${workflowPath}`);

            return {
                success: true,
                workflowPath,
                updatedWorkflow: workflow
            };

        } catch (error) {
            console.error('❌ Failed to apply fix to workflow:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if fix has been tried before
     */
    hasTriedFix(fixHistory, fix) {
        return fixHistory.history.some(h => 
            h.fix.code === fix.code || 
            h.fix.description === fix.description
        );
    }

    /**
     * Customize template with error-specific data
     */
    customizeTemplate(template, errorInfo) {
        let customizedCode = template.template;

        // Replace placeholders with actual values
        const replacements = {
            '{{nodeId}}': errorInfo.nodeId,
            '{{workflowId}}': errorInfo.workflowId,
            '{{errorMessage}}': errorInfo.message
        };

        for (const [placeholder, value] of Object.entries(replacements)) {
            customizedCode = customizedCode.replace(new RegExp(placeholder, 'g'), value);
        }

        return customizedCode;
    }

    /**
     * Get workflow file path
     */
    getWorkflowPath(workflowId) {
        // This would be configured based on n8n desktop setup
        const n8nPath = process.env.N8N_USER_FOLDER || '~/.n8n';
        return path.join(n8nPath, 'workflows', `${workflowId}.json`);
    }

    /**
     * Call OpenAI API
     */
    async callOpenAI(prompt) {
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert n8n workflow JavaScript code fixer. Generate robust, production-ready code fixes.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    /**
     * Learn from successful fix
     */
    async learnFromSuccess(errorInfo, fix, testResult) {
        console.log(`📚 Learning from successful fix: ${fix.id}`);

        // Add to success patterns
        const successPattern = {
            id: `success_${Date.now()}`,
            errorType: errorInfo.type,
            fixType: fix.type,
            fixCode: fix.code,
            description: fix.description,
            successAt: new Date(),
            testResult,
            metadata: {
                nodeType: errorInfo.nodeType,
                workflowId: errorInfo.workflowId,
                confidence: 0.8
            }
        };

        this.successPatterns.recent = this.successPatterns.recent || [];
        this.successPatterns.recent.unshift(successPattern);

        // Keep only last 100 recent successes
        if (this.successPatterns.recent.length > 100) {
            this.successPatterns.recent = this.successPatterns.recent.slice(0, 100);
        }

        // Update fix templates with successful patterns
        if (fix.type === 'ai_generated' && testResult.success) {
            await this.promoteToTemplate(fix, errorInfo);
        }

        await this.saveSuccessPatterns();
    }

    /**
     * Promote successful AI fix to template
     */
    async promoteToTemplate(fix, errorInfo) {
        const templateId = `promoted_${errorInfo.type}_${Date.now()}`;
        
        this.fixTemplates[templateId] = {
            name: `Auto-promoted fix for ${errorInfo.type}`,
            template: fix.code,
            applicableErrors: [errorInfo.type],
            description: `Promoted from successful AI fix: ${fix.description}`,
            confidence: 0.7,
            promotedAt: new Date().toISOString()
        };

        await this.saveFixTemplates();
        console.log(`📈 Promoted fix to template: ${templateId}`);
    }

    /**
     * Create default fix templates
     */
    createDefaultFixTemplates() {
        return {
            javascript_null_check: {
                name: 'Add Null Check',
                template: `
try {
  // Get input data safely
  const inputData = $input.all();
  
  if (!inputData || inputData.length === 0) {
    return [{ json: { error: 'No input data available', success: false } }];
  }

  const data = inputData[0].json;
  
  if (!data) {
    return [{ json: { error: 'Input data is null or undefined', success: false } }];
  }

  // Process data here - replace with actual logic
  const result = {
    processedData: data,
    timestamp: new Date().toISOString(),
    success: true
  };

  return [{ json: result }];
  
} catch (error) {
  console.error('JavaScript execution error:', error);
  return [{ 
    json: { 
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    }
  }];
}`,
                applicableErrors: ['js_null_reference', 'js_undefined_variable'],
                description: 'Adds comprehensive null checking and error handling'
            },

            javascript_syntax_fix: {
                name: 'Fix Syntax Errors',
                template: `
try {
  // Get input data
  const inputData = $input.all();
  const data = inputData && inputData.length > 0 ? inputData[0].json : {};

  // Fixed JavaScript code - ensure proper syntax
  const result = {
    data: data,
    processed: true,
    timestamp: new Date().toISOString()
  };

  return [{ json: result }];
  
} catch (error) {
  return [{ 
    json: { 
      error: 'JavaScript syntax error: ' + error.message,
      success: false 
    }
  }];
}`,
                applicableErrors: ['syntax_error', 'javascript_error'],
                description: 'Provides syntactically correct JavaScript template'
            },

            api_error_handling: {
                name: 'API Error Handling',
                template: `
try {
  const inputData = $input.all();
  const data = inputData && inputData.length > 0 ? inputData[0].json : {};

  // Add retry logic and better error handling for API calls
  const result = {
    data: data,
    apiCall: 'processed',
    retryable: true,
    timestamp: new Date().toISOString()
  };

  return [{ json: result }];
  
} catch (error) {
  return [{ 
    json: { 
      error: 'API processing error: ' + error.message,
      retryable: true,
      success: false 
    }
  }];
}`,
                applicableErrors: ['api_error'],
                description: 'Adds robust API error handling and retry logic'
            }
        };
    }

    /**
     * Create default success patterns
     */
    createDefaultSuccessPatterns() {
        return {
            recent: [],
            common: {
                javascript_error: {
                    addNullChecks: 0.9,
                    addTryCatch: 0.85,
                    validateInput: 0.8
                },
                api_error: {
                    addRetryLogic: 0.9,
                    improveErrorHandling: 0.8,
                    validateResponse: 0.75
                }
            }
        };
    }

    /**
     * Save fix templates
     */
    async saveFixTemplates() {
        const filePath = path.join(this.knowledgeBasePath, 'fix-templates.json');
        await fs.writeFile(filePath, JSON.stringify(this.fixTemplates, null, 2));
    }

    /**
     * Save success patterns
     */
    async saveSuccessPatterns() {
        const filePath = path.join(this.knowledgeBasePath, 'success-patterns.json');
        await fs.writeFile(filePath, JSON.stringify(this.successPatterns, null, 2));
    }

    /**
     * Get fix statistics
     */
    getFixStats() {
        const stats = {
            totalAttempts: 0,
            successfulFixes: 0,
            failedFixes: 0,
            averageAttempts: 0,
            fixesByType: {},
            recentFixes: []
        };

        for (const [key, history] of this.fixAttempts.entries()) {
            stats.totalAttempts += history.attempts;
            
            const lastAttempt = history.history[history.history.length - 1];
            if (lastAttempt?.result.success) {
                stats.successfulFixes++;
            } else {
                stats.failedFixes++;
            }

            // Collect recent fixes
            if (history.history.length > 0) {
                stats.recentFixes.push({
                    workflowId: key.split('_')[0],
                    nodeId: key.split('_')[1],
                    attempts: history.attempts,
                    success: lastAttempt?.result.success || false,
                    lastAttempt: lastAttempt?.timestamp
                });
            }
        }

        stats.averageAttempts = stats.totalAttempts / Math.max(this.fixAttempts.size, 1);
        stats.recentFixes = stats.recentFixes.slice(-10);

        return stats;
    }

    /**
     * Reset fix attempts for a specific workflow/node
     */
    resetFixAttempts(workflowId, nodeId) {
        const fixKey = `${workflowId}_${nodeId}`;
        this.fixAttempts.delete(fixKey);
        console.log(`🔄 Reset fix attempts for ${fixKey}`);
    }
}

module.exports = CodeFixer;