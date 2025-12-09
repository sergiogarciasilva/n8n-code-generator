/**
 * Problem Analyzer - AI-powered analysis of workflow errors and issues
 * Uses OpenAI GPT-4 to understand and diagnose workflow problems
 */

const fs = require('fs').promises;
const path = require('path');

class ProblemAnalyzer {
    constructor(openaiApiKey, knowledgeBasePath) {
        this.openaiApiKey = openaiApiKey;
        this.knowledgeBasePath = knowledgeBasePath;
        this.analysisCache = new Map();
        this.errorPatterns = null;
        this.fixTemplates = null;
    }

    /**
     * Initialize analyzer with knowledge base
     */
    async initialize() {
        console.log('🧠 Initializing AI Problem Analyzer...');
        
        try {
            await this.loadKnowledgeBase();
            console.log('✅ Problem Analyzer initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Problem Analyzer:', error);
            throw error;
        }
    }

    /**
     * Load knowledge base files
     */
    async loadKnowledgeBase() {
        const errorPatternsPath = path.join(this.knowledgeBasePath, 'error-patterns.json');
        const fixTemplatesPath = path.join(this.knowledgeBasePath, 'fix-templates.json');

        try {
            const errorPatternsData = await fs.readFile(errorPatternsPath, 'utf8');
            this.errorPatterns = JSON.parse(errorPatternsData);
        } catch (error) {
            console.log('📝 Creating default error patterns...');
            this.errorPatterns = this.createDefaultErrorPatterns();
            await this.saveErrorPatterns();
        }

        try {
            const fixTemplatesData = await fs.readFile(fixTemplatesPath, 'utf8');
            this.fixTemplates = JSON.parse(fixTemplatesData);
        } catch (error) {
            console.log('📝 Creating default fix templates...');
            this.fixTemplates = this.createDefaultFixTemplates();
            await this.saveFixTemplates();
        }
    }

    /**
     * Analyze error using AI and knowledge base
     */
    async analyzeError(errorInfo) {
        console.log(`🔍 Analyzing error: ${errorInfo.type} in ${errorInfo.workflowId}`);

        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(errorInfo);
            if (this.analysisCache.has(cacheKey)) {
                return this.analysisCache.get(cacheKey);
            }

            // Step 1: Quick pattern matching
            const patternMatch = this.matchErrorPattern(errorInfo);

            // Step 2: AI-powered analysis
            const aiAnalysis = await this.performAIAnalysis(errorInfo, patternMatch);

            // Step 3: Generate fix recommendations
            const fixRecommendations = await this.generateFixRecommendations(errorInfo, aiAnalysis);

            const analysis = {
                errorId: errorInfo.errorId,
                timestamp: new Date(),
                
                // Pattern matching results
                patternMatch,
                
                // AI analysis
                rootCause: aiAnalysis.rootCause,
                problemDescription: aiAnalysis.problemDescription,
                severity: aiAnalysis.severity,
                complexity: aiAnalysis.complexity,
                
                // Fix recommendations
                fixRecommendations,
                
                // Metadata
                confidence: aiAnalysis.confidence,
                analysisTime: new Date() - new Date(),
                canAutoFix: this.canAutoFix(errorInfo, aiAnalysis)
            };

            // Cache the analysis
            this.analysisCache.set(cacheKey, analysis);

            return analysis;

        } catch (error) {
            console.error('❌ Error during analysis:', error);
            return this.createFallbackAnalysis(errorInfo);
        }
    }

    /**
     * Match error against known patterns
     */
    matchErrorPattern(errorInfo) {
        const patterns = this.errorPatterns[errorInfo.type] || [];
        
        for (const pattern of patterns) {
            if (this.matchesPattern(errorInfo, pattern)) {
                return {
                    patternId: pattern.id,
                    name: pattern.name,
                    description: pattern.description,
                    commonCauses: pattern.commonCauses,
                    quickFix: pattern.quickFix,
                    confidence: pattern.confidence || 0.7
                };
            }
        }

        return null;
    }

    /**
     * Check if error matches a specific pattern
     */
    matchesPattern(errorInfo, pattern) {
        // Check message pattern
        if (pattern.messagePattern) {
            const regex = new RegExp(pattern.messagePattern, 'i');
            if (!regex.test(errorInfo.message)) {
                return false;
            }
        }

        // Check node type
        if (pattern.nodeType && errorInfo.nodeType !== pattern.nodeType) {
            return false;
        }

        // Check additional conditions
        if (pattern.conditions) {
            for (const condition of pattern.conditions) {
                if (!this.evaluateCondition(errorInfo, condition)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Evaluate pattern condition
     */
    evaluateCondition(errorInfo, condition) {
        switch (condition.type) {
            case 'contains':
                return errorInfo.message.toLowerCase().includes(condition.value.toLowerCase());
            case 'severity':
                return errorInfo.severity === condition.value;
            case 'node_type':
                return errorInfo.nodeType === condition.value;
            default:
                return true;
        }
    }

    /**
     * Perform AI-powered analysis using OpenAI
     */
    async performAIAnalysis(errorInfo, patternMatch) {
        const prompt = this.buildAnalysisPrompt(errorInfo, patternMatch);

        try {
            const response = await this.callOpenAI(prompt, 'analysis');
            return this.parseAIAnalysisResponse(response);
        } catch (error) {
            console.error('❌ AI analysis failed:', error);
            return this.createFallbackAIAnalysis(errorInfo);
        }
    }

    /**
     * Build prompt for AI analysis
     */
    buildAnalysisPrompt(errorInfo, patternMatch) {
        return `
You are an expert n8n workflow debugger. Analyze this workflow error and provide detailed insights.

ERROR INFORMATION:
- Type: ${errorInfo.type}
- Message: ${errorInfo.message}
- Severity: ${errorInfo.severity}
- Workflow ID: ${errorInfo.workflowId}
- Node ID: ${errorInfo.nodeId}
- Timestamp: ${errorInfo.timestamp}

${patternMatch ? `
PATTERN MATCH:
- Pattern: ${patternMatch.name}
- Description: ${patternMatch.description}
- Common Causes: ${patternMatch.commonCauses.join(', ')}
` : ''}

${errorInfo.workflow ? `
WORKFLOW CONTEXT:
${JSON.stringify(errorInfo.workflow, null, 2)}
` : ''}

Please provide a detailed analysis in JSON format:
{
  "rootCause": "The fundamental cause of this error",
  "problemDescription": "Detailed explanation of what went wrong",
  "severity": "critical|high|medium|low",
  "complexity": "simple|medium|complex",
  "confidence": 0.8,
  "technicalDetails": "Technical explanation of the issue",
  "userImpact": "How this affects the workflow execution",
  "prerequisites": ["What needs to be checked before fixing"],
  "relatedIssues": ["Potential related problems to watch for"]
}
`.trim();
    }

    /**
     * Generate fix recommendations using AI
     */
    async generateFixRecommendations(errorInfo, aiAnalysis) {
        const prompt = this.buildFixPrompt(errorInfo, aiAnalysis);

        try {
            const response = await this.callOpenAI(prompt, 'fix-generation');
            return this.parseFixRecommendations(response);
        } catch (error) {
            console.error('❌ Fix generation failed:', error);
            return this.createFallbackFixRecommendations(errorInfo);
        }
    }

    /**
     * Build prompt for fix generation
     */
    buildFixPrompt(errorInfo, aiAnalysis) {
        return `
You are an expert n8n workflow fixer. Generate specific, actionable fixes for this error.

ERROR ANALYSIS:
- Root Cause: ${aiAnalysis.rootCause}
- Problem: ${aiAnalysis.problemDescription}
- Complexity: ${aiAnalysis.complexity}

ERROR DETAILS:
- Type: ${errorInfo.type}
- Message: ${errorInfo.message}
- Node ID: ${errorInfo.nodeId}

${errorInfo.workflow ? `
CURRENT WORKFLOW:
${JSON.stringify(errorInfo.workflow, null, 2)}
` : ''}

Generate fix recommendations in JSON format:
{
  "fixes": [
    {
      "id": "fix_1",
      "type": "code_replacement|config_update|node_addition|node_removal",
      "priority": "high|medium|low",
      "description": "What this fix does",
      "changes": {
        "nodeId": "target_node_id",
        "field": "field_to_change",
        "oldValue": "current_value",
        "newValue": "corrected_value",
        "newCode": "if type is code_replacement"
      },
      "reasoning": "Why this fix will work",
      "riskLevel": "low|medium|high",
      "testSteps": ["How to verify the fix works"]
    }
  ],
  "alternativeFixes": [],
  "preventionTips": ["How to avoid this error in future"]
}
`.trim();
    }

    /**
     * Call OpenAI API
     */
    async callOpenAI(prompt, type) {
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
                        content: 'You are an expert n8n workflow debugger and fixer. Provide precise, actionable solutions.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: type === 'analysis' ? 0.3 : 0.5,
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
     * Parse AI analysis response
     */
    parseAIAnalysisResponse(response) {
        try {
            // Extract JSON from response (handle markdown formatting)
            const jsonMatch = response.match(/```json\n?(.*?)\n?```/s) || [null, response];
            const jsonStr = jsonMatch[1] || response;
            
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('Failed to parse AI response:', error);
            return this.createFallbackAIAnalysis();
        }
    }

    /**
     * Parse fix recommendations response
     */
    parseFixRecommendations(response) {
        try {
            const jsonMatch = response.match(/```json\n?(.*?)\n?```/s) || [null, response];
            const jsonStr = jsonMatch[1] || response;
            
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('Failed to parse fix recommendations:', error);
            return this.createFallbackFixRecommendations();
        }
    }

    /**
     * Determine if error can be automatically fixed
     */
    canAutoFix(errorInfo, aiAnalysis) {
        // Auto-fix criteria
        const autoFixableTypes = ['javascript_error', 'syntax_error', 'config_error'];
        const maxComplexity = 'medium';
        const minConfidence = 0.7;

        return autoFixableTypes.includes(errorInfo.type) &&
               aiAnalysis.complexity !== 'complex' &&
               aiAnalysis.confidence >= minConfidence;
    }

    /**
     * Generate cache key for analysis
     */
    generateCacheKey(errorInfo) {
        return `${errorInfo.type}_${errorInfo.message}_${errorInfo.nodeId}`.replace(/\s+/g, '_');
    }

    /**
     * Create default error patterns
     */
    createDefaultErrorPatterns() {
        return {
            javascript_error: [
                {
                    id: 'js_undefined_variable',
                    name: 'Undefined Variable',
                    messagePattern: '.*is not defined.*',
                    description: 'JavaScript code references undefined variable',
                    commonCauses: ['Typo in variable name', 'Variable not declared', 'Scope issue'],
                    quickFix: 'Check variable names and declarations',
                    confidence: 0.9
                },
                {
                    id: 'js_null_reference',
                    name: 'Null Reference',
                    messagePattern: '.*Cannot read prop.*of null.*',
                    description: 'Attempting to access property of null/undefined object',
                    commonCauses: ['Data not available', 'API returned null', 'Missing input validation'],
                    quickFix: 'Add null checks before property access',
                    confidence: 0.8
                }
            ],
            api_error: [
                {
                    id: 'api_timeout',
                    name: 'API Timeout',
                    messagePattern: '.*timeout.*',
                    description: 'API request timed out',
                    commonCauses: ['Slow API response', 'Network issues', 'Incorrect timeout setting'],
                    quickFix: 'Increase timeout or check API status',
                    confidence: 0.9
                }
            ]
        };
    }

    /**
     * Create default fix templates
     */
    createDefaultFixTemplates() {
        return {
            javascript_null_check: {
                name: 'Add Null Check',
                template: `
if (!$input.all() || $input.all().length === 0) {
  return { error: 'No input data available' };
}

const data = $input.all()[0].json;
if (!data) {
  return { error: 'Input data is null or undefined' };
}

// Original code here with null-safe access
return { data };
`,
                applicableErrors: ['js_null_reference', 'js_undefined_variable']
            },
            javascript_error_handling: {
                name: 'Add Error Handling',
                template: `
try {
  // Original code here
  return result;
} catch (error) {
  console.error('JavaScript execution error:', error);
  return { 
    error: error.message,
    success: false 
  };
}
`,
                applicableErrors: ['javascript_error']
            }
        };
    }

    /**
     * Create fallback analysis when AI fails
     */
    createFallbackAnalysis(errorInfo) {
        return {
            errorId: errorInfo.errorId,
            timestamp: new Date(),
            rootCause: 'Unable to determine root cause automatically',
            problemDescription: errorInfo.message,
            severity: errorInfo.severity,
            complexity: 'medium',
            confidence: 0.3,
            canAutoFix: false,
            fixRecommendations: this.createFallbackFixRecommendations(errorInfo)
        };
    }

    /**
     * Create fallback AI analysis
     */
    createFallbackAIAnalysis(errorInfo) {
        return {
            rootCause: 'Analysis failed - manual review required',
            problemDescription: errorInfo.message,
            severity: errorInfo.severity,
            complexity: 'medium',
            confidence: 0.3
        };
    }

    /**
     * Create fallback fix recommendations
     */
    createFallbackFixRecommendations(errorInfo) {
        return {
            fixes: [
                {
                    id: 'manual_review',
                    type: 'manual_intervention',
                    priority: 'high',
                    description: 'Manual review and fix required',
                    reasoning: 'Automatic fix generation failed',
                    riskLevel: 'low',
                    testSteps: ['Review error manually', 'Apply appropriate fix']
                }
            ],
            alternativeFixes: [],
            preventionTips: ['Add error handling', 'Validate inputs', 'Test thoroughly']
        };
    }

    /**
     * Save error patterns to knowledge base
     */
    async saveErrorPatterns() {
        const filePath = path.join(this.knowledgeBasePath, 'error-patterns.json');
        await fs.writeFile(filePath, JSON.stringify(this.errorPatterns, null, 2));
    }

    /**
     * Save fix templates to knowledge base
     */
    async saveFixTemplates() {
        const filePath = path.join(this.knowledgeBasePath, 'fix-templates.json');
        await fs.writeFile(filePath, JSON.stringify(this.fixTemplates, null, 2));
    }

    /**
     * Learn from successful fix
     */
    async learnFromSuccess(errorInfo, appliedFix, outcome) {
        console.log(`📚 Learning from successful fix: ${appliedFix.id}`);
        
        // Update error patterns based on successful fix
        const pattern = this.findOrCreatePattern(errorInfo);
        if (pattern) {
            pattern.successfulFixes = pattern.successfulFixes || [];
            pattern.successfulFixes.push({
                fixId: appliedFix.id,
                timestamp: new Date(),
                outcome
            });
            
            await this.saveErrorPatterns();
        }
    }

    /**
     * Find or create error pattern
     */
    findOrCreatePattern(errorInfo) {
        if (!this.errorPatterns[errorInfo.type]) {
            this.errorPatterns[errorInfo.type] = [];
        }

        let pattern = this.errorPatterns[errorInfo.type].find(p => 
            this.matchesPattern(errorInfo, p)
        );

        if (!pattern) {
            pattern = {
                id: `generated_${Date.now()}`,
                name: `Auto-generated pattern for ${errorInfo.type}`,
                messagePattern: this.extractMessagePattern(errorInfo.message),
                description: 'Pattern learned from error resolution',
                commonCauses: ['Unknown'],
                quickFix: 'Apply learned fix',
                confidence: 0.5
            };
            
            this.errorPatterns[errorInfo.type].push(pattern);
        }

        return pattern;
    }

    /**
     * Extract pattern from error message
     */
    extractMessagePattern(message) {
        // Simple pattern extraction - can be enhanced
        return message.replace(/[0-9]+/g, '\\d+')
                     .replace(/[a-f0-9-]{36}/g, '[a-f0-9-]{36}')
                     .replace(/"/g, '.*');
    }
}

module.exports = ProblemAnalyzer;