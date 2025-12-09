/**
 * Knowledge Base Manager - Centralized storage and retrieval of debugging patterns
 * Manages error patterns, fix templates, and learning from successful debugging
 */

const fs = require('fs').promises;
const path = require('path');

class KnowledgeBase {
    constructor(knowledgeBasePath) {
        this.knowledgeBasePath = knowledgeBasePath;
        this.errorPatterns = null;
        this.fixTemplates = null;
        this.successPatterns = null;
        this.learningData = null;
        this.isInitialized = false;
    }

    /**
     * Initialize knowledge base with all data files
     */
    async initialize() {
        console.log('📚 Initializing Knowledge Base...');
        
        try {
            await this.ensureDirectoryExists();
            await this.loadAllData();
            this.isInitialized = true;
            console.log('✅ Knowledge Base initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Knowledge Base:', error);
            throw error;
        }
    }

    /**
     * Ensure knowledge base directory exists
     */
    async ensureDirectoryExists() {
        try {
            await fs.access(this.knowledgeBasePath);
        } catch (error) {
            console.log('📁 Creating knowledge base directory...');
            await fs.mkdir(this.knowledgeBasePath, { recursive: true });
        }
    }

    /**
     * Load all knowledge base data
     */
    async loadAllData() {
        await Promise.all([
            this.loadErrorPatterns(),
            this.loadFixTemplates(),
            this.loadSuccessPatterns(),
            this.loadLearningData()
        ]);
    }

    /**
     * Load error patterns
     */
    async loadErrorPatterns() {
        const filePath = path.join(this.knowledgeBasePath, 'error-patterns.json');
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            this.errorPatterns = JSON.parse(data);
            console.log('📋 Loaded error patterns');
        } catch (error) {
            console.log('📋 Creating default error patterns...');
            this.errorPatterns = this.createDefaultErrorPatterns();
            await this.saveErrorPatterns();
        }
    }

    /**
     * Load fix templates
     */
    async loadFixTemplates() {
        const filePath = path.join(this.knowledgeBasePath, 'fix-templates.json');
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            this.fixTemplates = JSON.parse(data);
            console.log('🔧 Loaded fix templates');
        } catch (error) {
            console.log('🔧 Creating default fix templates...');
            this.fixTemplates = this.createDefaultFixTemplates();
            await this.saveFixTemplates();
        }
    }

    /**
     * Load success patterns
     */
    async loadSuccessPatterns() {
        const filePath = path.join(this.knowledgeBasePath, 'success-patterns.json');
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            this.successPatterns = JSON.parse(data);
            console.log('🎯 Loaded success patterns');
        } catch (error) {
            console.log('🎯 Creating default success patterns...');
            this.successPatterns = this.createDefaultSuccessPatterns();
            await this.saveSuccessPatterns();
        }
    }

    /**
     * Load learning data
     */
    async loadLearningData() {
        const filePath = path.join(this.knowledgeBasePath, 'learning-data.json');
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            this.learningData = JSON.parse(data);
            console.log('🧠 Loaded learning data');
        } catch (error) {
            console.log('🧠 Creating default learning data...');
            this.learningData = this.createDefaultLearningData();
            await this.saveLearningData();
        }
    }

    /**
     * Find matching error patterns
     */
    findMatchingPatterns(errorInfo) {
        if (!this.errorPatterns || !this.errorPatterns[errorInfo.type]) {
            return [];
        }

        const patterns = this.errorPatterns[errorInfo.type];
        const matches = [];

        for (const pattern of patterns) {
            const confidence = this.calculatePatternMatch(errorInfo, pattern);
            if (confidence > 0.5) {
                matches.push({
                    ...pattern,
                    matchConfidence: confidence
                });
            }
        }

        // Sort by confidence
        return matches.sort((a, b) => b.matchConfidence - a.matchConfidence);
    }

    /**
     * Calculate how well an error matches a pattern
     */
    calculatePatternMatch(errorInfo, pattern) {
        let confidence = 0.5; // Base confidence

        // Check message pattern
        if (pattern.messagePattern) {
            const regex = new RegExp(pattern.messagePattern, 'i');
            if (regex.test(errorInfo.message)) {
                confidence += 0.3;
            } else {
                return 0; // No match if message doesn't match
            }
        }

        // Check node type
        if (pattern.nodeType && errorInfo.nodeType === pattern.nodeType) {
            confidence += 0.2;
        }

        // Check additional conditions
        if (pattern.conditions) {
            let conditionMatches = 0;
            for (const condition of pattern.conditions) {
                if (this.evaluateCondition(errorInfo, condition)) {
                    conditionMatches++;
                }
            }
            confidence += (conditionMatches / pattern.conditions.length) * 0.2;
        }

        return Math.min(confidence, 1.0);
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
            case 'regex':
                return new RegExp(condition.value, 'i').test(errorInfo.message);
            default:
                return true;
        }
    }

    /**
     * Get applicable fix templates for error
     */
    getApplicableFixTemplates(errorInfo, analysisResult) {
        const templates = [];

        for (const [templateId, template] of Object.entries(this.fixTemplates)) {
            if (this.isTemplateApplicable(template, errorInfo, analysisResult)) {
                templates.push({
                    id: templateId,
                    ...template,
                    applicabilityScore: this.calculateTemplateApplicability(template, errorInfo)
                });
            }
        }

        return templates.sort((a, b) => b.applicabilityScore - a.applicabilityScore);
    }

    /**
     * Check if template is applicable to error
     */
    isTemplateApplicable(template, errorInfo, analysisResult) {
        // Check direct error type match
        if (template.applicableErrors.includes(errorInfo.type)) {
            return true;
        }

        // Check pattern match
        if (analysisResult?.patternMatch?.patternId && 
            template.applicableErrors.includes(analysisResult.patternMatch.patternId)) {
            return true;
        }

        // Check node type match
        if (template.nodeTypes && template.nodeTypes.includes(errorInfo.nodeType)) {
            return true;
        }

        return false;
    }

    /**
     * Calculate template applicability score
     */
    calculateTemplateApplicability(template, errorInfo) {
        let score = 0.5;

        // Direct error type match
        if (template.applicableErrors.includes(errorInfo.type)) {
            score += 0.3;
        }

        // Confidence score from template
        if (template.confidence) {
            score += template.confidence * 0.2;
        }

        // Success rate from learning data
        const successRate = this.getTemplateSuccessRate(template.name, errorInfo.type);
        score += successRate * 0.3;

        return Math.min(score, 1.0);
    }

    /**
     * Get success rate for template from learning data
     */
    getTemplateSuccessRate(templateName, errorType) {
        if (!this.learningData?.templateSuccess?.[templateName]?.[errorType]) {
            return 0;
        }

        const data = this.learningData.templateSuccess[templateName][errorType];
        return data.successes / (data.successes + data.failures);
    }

    /**
     * Record successful fix
     */
    async recordSuccess(errorInfo, fix, testResult) {
        console.log('📈 Recording successful fix in knowledge base...');

        // Update success patterns
        await this.updateSuccessPatterns(errorInfo, fix, testResult);

        // Update learning data
        await this.updateLearningData(errorInfo, fix, testResult);

        // Promote successful AI fixes to templates if applicable
        if (fix.type === 'ai_generated' && this.shouldPromoteToTemplate(fix, testResult)) {
            await this.promoteToTemplate(errorInfo, fix);
        }

        // Save all updates
        await Promise.all([
            this.saveSuccessPatterns(),
            this.saveLearningData(),
            this.saveFixTemplates()
        ]);
    }

    /**
     * Update success patterns with new data
     */
    async updateSuccessPatterns(errorInfo, fix, testResult) {
        if (!this.successPatterns.recent) {
            this.successPatterns.recent = [];
        }

        const successEntry = {
            id: `success_${Date.now()}`,
            timestamp: new Date().toISOString(),
            errorType: errorInfo.type,
            nodeType: errorInfo.nodeType,
            fixType: fix.type,
            fixId: fix.id,
            description: fix.description,
            testResult: {
                success: testResult.success,
                phase: testResult.phase,
                duration: testResult.duration
            },
            workflowContext: {
                workflowId: errorInfo.workflowId,
                nodeId: errorInfo.nodeId
            }
        };

        this.successPatterns.recent.unshift(successEntry);

        // Keep only last 1000 entries
        if (this.successPatterns.recent.length > 1000) {
            this.successPatterns.recent = this.successPatterns.recent.slice(0, 1000);
        }

        // Update aggregated data
        if (!this.successPatterns.aggregated) {
            this.successPatterns.aggregated = {};
        }

        const key = `${errorInfo.type}_${fix.type}`;
        if (!this.successPatterns.aggregated[key]) {
            this.successPatterns.aggregated[key] = {
                count: 0,
                successRate: 0,
                averageDuration: 0,
                lastSuccess: null
            };
        }

        const agg = this.successPatterns.aggregated[key];
        agg.count++;
        agg.lastSuccess = new Date().toISOString();
        
        // Update success rate (simplified calculation)
        agg.successRate = Math.min(agg.successRate + 0.1, 1.0);
    }

    /**
     * Update learning data
     */
    async updateLearningData(errorInfo, fix, testResult) {
        // Update template success rates
        if (fix.type === 'template') {
            if (!this.learningData.templateSuccess) {
                this.learningData.templateSuccess = {};
            }

            const templateName = fix.id.replace('template_', '');
            if (!this.learningData.templateSuccess[templateName]) {
                this.learningData.templateSuccess[templateName] = {};
            }

            if (!this.learningData.templateSuccess[templateName][errorInfo.type]) {
                this.learningData.templateSuccess[templateName][errorInfo.type] = {
                    successes: 0,
                    failures: 0
                };
            }

            if (testResult.success) {
                this.learningData.templateSuccess[templateName][errorInfo.type].successes++;
            } else {
                this.learningData.templateSuccess[templateName][errorInfo.type].failures++;
            }
        }

        // Update error type statistics
        if (!this.learningData.errorStats) {
            this.learningData.errorStats = {};
        }

        if (!this.learningData.errorStats[errorInfo.type]) {
            this.learningData.errorStats[errorInfo.type] = {
                totalOccurrences: 0,
                successfulFixes: 0,
                averageIterations: 0,
                commonPatterns: []
            };
        }

        const stats = this.learningData.errorStats[errorInfo.type];
        stats.totalOccurrences++;
        if (testResult.success) {
            stats.successfulFixes++;
        }
    }

    /**
     * Check if fix should be promoted to template
     */
    shouldPromoteToTemplate(fix, testResult) {
        // Promote if:
        // 1. Fix was successful
        // 2. Code is substantial (not just a simple fix)
        // 3. Uses good patterns
        
        if (!testResult.success) return false;
        
        const codeLength = fix.code?.length || 0;
        if (codeLength < 100) return false; // Too simple
        
        // Check for good patterns
        const goodPatterns = [
            /try\s*\{.*catch/s,  // Has error handling
            /\$input\.all\(\)/, // Uses proper n8n input
            /return.*json/i      // Returns proper format
        ];

        return goodPatterns.some(pattern => pattern.test(fix.code));
    }

    /**
     * Promote successful fix to template
     */
    async promoteToTemplate(errorInfo, fix) {
        const templateId = `promoted_${errorInfo.type}_${Date.now()}`;
        
        const template = {
            name: `Auto-promoted: ${fix.description}`,
            template: fix.code,
            applicableErrors: [errorInfo.type],
            nodeTypes: errorInfo.nodeType ? [errorInfo.nodeType] : [],
            description: `Promoted from successful AI fix: ${fix.description}`,
            confidence: 0.8,
            promotedAt: new Date().toISOString(),
            originalFixId: fix.id,
            metadata: {
                promotionReason: 'successful_ai_fix',
                originalContext: {
                    workflowId: errorInfo.workflowId,
                    nodeId: errorInfo.nodeId,
                    errorType: errorInfo.type
                }
            }
        };

        this.fixTemplates[templateId] = template;
        
        console.log(`📈 Promoted fix to template: ${templateId}`);
    }

    /**
     * Search knowledge base for similar patterns
     */
    searchSimilarPatterns(errorInfo, limit = 10) {
        const results = [];

        // Search in success patterns
        if (this.successPatterns.recent) {
            for (const pattern of this.successPatterns.recent) {
                if (pattern.errorType === errorInfo.type || 
                    pattern.nodeType === errorInfo.nodeType) {
                    
                    const similarity = this.calculateSimilarity(errorInfo, pattern);
                    if (similarity > 0.5) {
                        results.push({
                            type: 'success_pattern',
                            pattern,
                            similarity
                        });
                    }
                }
            }
        }

        // Search in error patterns
        const errorPatterns = this.findMatchingPatterns(errorInfo);
        for (const pattern of errorPatterns) {
            results.push({
                type: 'error_pattern',
                pattern,
                similarity: pattern.matchConfidence
            });
        }

        // Sort by similarity and limit results
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    /**
     * Calculate similarity between error and pattern
     */
    calculateSimilarity(errorInfo, pattern) {
        let similarity = 0;

        // Error type match
        if (errorInfo.type === pattern.errorType) {
            similarity += 0.4;
        }

        // Node type match
        if (errorInfo.nodeType === pattern.nodeType) {
            similarity += 0.3;
        }

        // Message similarity (simplified)
        if (pattern.message && errorInfo.message) {
            const messageWords1 = errorInfo.message.toLowerCase().split(/\s+/);
            const messageWords2 = pattern.message.toLowerCase().split(/\s+/);
            const commonWords = messageWords1.filter(word => messageWords2.includes(word));
            similarity += (commonWords.length / Math.max(messageWords1.length, messageWords2.length)) * 0.3;
        }

        return Math.min(similarity, 1.0);
    }

    /**
     * Get knowledge base statistics
     */
    getStats() {
        return {
            errorPatterns: {
                total: Object.values(this.errorPatterns || {}).reduce((sum, patterns) => sum + patterns.length, 0),
                byType: Object.fromEntries(
                    Object.entries(this.errorPatterns || {}).map(([type, patterns]) => [type, patterns.length])
                )
            },
            fixTemplates: {
                total: Object.keys(this.fixTemplates || {}).length,
                promoted: Object.values(this.fixTemplates || {}).filter(t => t.promotedAt).length
            },
            successPatterns: {
                recent: this.successPatterns?.recent?.length || 0,
                aggregated: Object.keys(this.successPatterns?.aggregated || {}).length
            },
            learningData: {
                templateSuccessEntries: Object.keys(this.learningData?.templateSuccess || {}).length,
                errorStatsEntries: Object.keys(this.learningData?.errorStats || {}).length
            }
        };
    }

    /**
     * Create default error patterns
     */
    createDefaultErrorPatterns() {
        return {
            javascript_error: [
                {
                    id: 'js_undefined_var',
                    name: 'Undefined Variable',
                    messagePattern: '.*is not defined.*',
                    description: 'Variable used before declaration',
                    commonCauses: ['Typo in variable name', 'Variable not declared', 'Scope issue'],
                    quickFix: 'Check variable declarations',
                    confidence: 0.9,
                    nodeType: 'n8n-nodes-base.code'
                },
                {
                    id: 'js_null_reference',
                    name: 'Null Reference Error',
                    messagePattern: '.*Cannot read prop.*of (null|undefined).*',
                    description: 'Attempting to access property of null/undefined',
                    commonCauses: ['Missing input validation', 'API returned null', 'Data not available'],
                    quickFix: 'Add null checks',
                    confidence: 0.85
                },
                {
                    id: 'js_syntax_error',
                    name: 'Syntax Error',
                    messagePattern: '.*(Unexpected token|SyntaxError).*',
                    description: 'JavaScript syntax error',
                    commonCauses: ['Missing brackets', 'Invalid syntax', 'Typos'],
                    quickFix: 'Fix syntax',
                    confidence: 0.95
                }
            ],
            api_error: [
                {
                    id: 'api_timeout',
                    name: 'API Timeout',
                    messagePattern: '.*timeout.*',
                    description: 'API request timed out',
                    commonCauses: ['Slow API', 'Network issues', 'Incorrect timeout'],
                    quickFix: 'Increase timeout or check API',
                    confidence: 0.9
                },
                {
                    id: 'api_401',
                    name: 'Authentication Error',
                    messagePattern: '.*(401|Unauthorized).*',
                    description: 'API authentication failed',
                    commonCauses: ['Invalid credentials', 'Expired token', 'Wrong API key'],
                    quickFix: 'Check authentication',
                    confidence: 0.95
                }
            ],
            data_error: [
                {
                    id: 'invalid_json',
                    name: 'Invalid JSON',
                    messagePattern: '.*Invalid JSON.*',
                    description: 'JSON parsing failed',
                    commonCauses: ['Malformed JSON', 'Wrong data format', 'Encoding issues'],
                    quickFix: 'Validate JSON format',
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
            null_safety: {
                name: 'Null Safety Template',
                template: `
try {
  const inputData = $input.all();
  
  if (!inputData || inputData.length === 0) {
    return [{ json: { error: 'No input data', success: false } }];
  }

  const data = inputData[0].json;
  
  if (!data) {
    return [{ json: { error: 'Input data is null', success: false } }];
  }

  // Your processing logic here
  const result = {
    data: data,
    processed: true,
    timestamp: new Date().toISOString()
  };

  return [{ json: result }];
  
} catch (error) {
  return [{ 
    json: { 
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    }
  }];
}`,
                applicableErrors: ['js_null_reference', 'js_undefined_var'],
                nodeTypes: ['n8n-nodes-base.code'],
                description: 'Comprehensive null safety and error handling',
                confidence: 0.9
            },

            error_handling: {
                name: 'Error Handling Template',
                template: `
try {
  // Your code here
  const result = { success: true };
  return [{ json: result }];
  
} catch (error) {
  console.error('Error in workflow:', error);
  return [{ 
    json: { 
      error: error.message,
      success: false,
      retry: true 
    }
  }];
}`,
                applicableErrors: ['javascript_error', 'syntax_error'],
                nodeTypes: ['n8n-nodes-base.code'],
                description: 'Basic error handling wrapper',
                confidence: 0.8
            }
        };
    }

    /**
     * Create default success patterns
     */
    createDefaultSuccessPatterns() {
        return {
            recent: [],
            aggregated: {},
            metrics: {
                totalSuccesses: 0,
                averageIterations: 0,
                successRateByType: {}
            }
        };
    }

    /**
     * Create default learning data
     */
    createDefaultLearningData() {
        return {
            templateSuccess: {},
            errorStats: {},
            metadata: {
                created: new Date().toISOString(),
                version: '1.0'
            }
        };
    }

    // Save methods
    async saveErrorPatterns() {
        const filePath = path.join(this.knowledgeBasePath, 'error-patterns.json');
        await fs.writeFile(filePath, JSON.stringify(this.errorPatterns, null, 2));
    }

    async saveFixTemplates() {
        const filePath = path.join(this.knowledgeBasePath, 'fix-templates.json');
        await fs.writeFile(filePath, JSON.stringify(this.fixTemplates, null, 2));
    }

    async saveSuccessPatterns() {
        const filePath = path.join(this.knowledgeBasePath, 'success-patterns.json');
        await fs.writeFile(filePath, JSON.stringify(this.successPatterns, null, 2));
    }

    async saveLearningData() {
        const filePath = path.join(this.knowledgeBasePath, 'learning-data.json');
        await fs.writeFile(filePath, JSON.stringify(this.learningData, null, 2));
    }

    /**
     * Export knowledge base for backup
     */
    async exportKnowledgeBase() {
        return {
            errorPatterns: this.errorPatterns,
            fixTemplates: this.fixTemplates,
            successPatterns: this.successPatterns,
            learningData: this.learningData,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import knowledge base from backup
     */
    async importKnowledgeBase(data) {
        if (data.errorPatterns) this.errorPatterns = data.errorPatterns;
        if (data.fixTemplates) this.fixTemplates = data.fixTemplates;
        if (data.successPatterns) this.successPatterns = data.successPatterns;
        if (data.learningData) this.learningData = data.learningData;

        await this.saveAllData();
        console.log('📥 Knowledge base imported successfully');
    }

    /**
     * Save all data
     */
    async saveAllData() {
        await Promise.all([
            this.saveErrorPatterns(),
            this.saveFixTemplates(),
            this.saveSuccessPatterns(),
            this.saveLearningData()
        ]);
    }
}

module.exports = KnowledgeBase;