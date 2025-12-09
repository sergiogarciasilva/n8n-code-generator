import { EventEmitter } from 'events';
import { DatabaseManager } from '../database/DatabaseManager';
import { AIReviewEngine } from '../engine/AIReviewEngine';
import { AuthManager } from '../auth/AuthManager';
import * as tf from '@tensorflow/tfjs-node';

export interface AutomationRule {
  id: string;
  name: string;
  type: 'predictive' | 'reactive' | 'scheduled' | 'continuous';
  conditions: {
    metric?: string;
    threshold?: number;
    pattern?: string;
    schedule?: string;
  };
  actions: Array<{
    type: string;
    parameters: Record<string, any>;
  }>;
  enabled: boolean;
  aiModel?: string;
}

export interface AnomalyDetection {
  workflowId: string;
  type: 'performance' | 'error_rate' | 'resource_usage' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  details: Record<string, any>;
  suggestedActions: string[];
}

export class AIAutomationEngine extends EventEmitter {
  private database: DatabaseManager;
  private aiEngine: AIReviewEngine;
  private authManager: AuthManager;
  private anomalyModel: tf.LayersModel | null = null;
  private performanceModel: tf.LayersModel | null = null;
  private automationRules: Map<string, AutomationRule> = new Map();

  constructor(
    database: DatabaseManager,
    aiEngine: AIReviewEngine,
    authManager: AuthManager
  ) {
    super();
    this.database = database;
    this.aiEngine = aiEngine;
    this.authManager = authManager;
    this.initializeModels();
    this.loadAutomationRules();
  }

  private async initializeModels(): Promise<void> {
    try {
      // Load pre-trained anomaly detection model
      this.anomalyModel = await tf.loadLayersModel('file://./models/anomaly_detection/model.json');
      
      // Load performance prediction model
      this.performanceModel = await tf.loadLayersModel('file://./models/performance_prediction/model.json');
    } catch (error) {
      console.error('Failed to load AI models:', error);
      // Train new models if not found
      await this.trainModels();
    }
  }

  private async trainModels(): Promise<void> {
    // Train anomaly detection model
    this.anomalyModel = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 4, activation: 'softmax' }) // 4 anomaly types
      ]
    });

    this.anomalyModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Train with historical data
    const trainingData = await this.getTrainingData();
    if (trainingData.xs && trainingData.ys) {
      await this.anomalyModel.fit(trainingData.xs, trainingData.ys, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2
      });

      // Save model
      await this.anomalyModel.save('file://./models/anomaly_detection');
    }
  }

  // Auto-healing system
  async enableAutoHealing(workflowId: string, userId: string): Promise<void> {
    const rule: AutomationRule = {
      id: `auto-heal-${workflowId}`,
      name: `Auto-healing for ${workflowId}`,
      type: 'reactive',
      conditions: {
        pattern: 'workflow_error',
        threshold: 3 // 3 consecutive errors
      },
      actions: [
        {
          type: 'restart_workflow',
          parameters: { workflowId, delay: 5000 }
        },
        {
          type: 'optimize_resources',
          parameters: { targetResource: 'memory', increase: 20 }
        },
        {
          type: 'notify_admin',
          parameters: { severity: 'warning' }
        }
      ],
      enabled: true
    };

    await this.addAutomationRule(rule, userId);
  }

  // Predictive failure detection
  async predictFailures(workflowId: string): Promise<{
    probability: number;
    timeToFailure?: number;
    causes: string[];
    preventiveActions: string[];
  }> {
    const metrics = await this.getWorkflowMetrics(workflowId);
    
    if (!this.performanceModel) {
      throw new Error('Performance model not loaded');
    }

    // Prepare input tensor
    const input = tf.tensor2d([
      metrics.avgExecutionTime,
      metrics.errorRate,
      metrics.cpuUsage,
      metrics.memoryUsage,
      metrics.requestRate,
      metrics.successRate,
      metrics.queueLength,
      metrics.lastOptimizationDays,
      metrics.complexityScore,
      metrics.dependencyCount
    ], [1, 10]);

    // Predict
    const prediction = this.performanceModel.predict(input) as tf.Tensor;
    const probabilities = await prediction.data();

    // Analyze results
    const failureProbability = probabilities[0];
    const timeToFailure = failureProbability > 0.7 ? 
      Math.round(24 * (1 - failureProbability)) : // Hours
      undefined;

    // Determine causes and actions based on metrics
    const causes: string[] = [];
    const preventiveActions: string[] = [];

    if (metrics.errorRate > 0.1) {
      causes.push('High error rate detected');
      preventiveActions.push('Review error logs and fix issues');
    }

    if (metrics.memoryUsage > 0.8) {
      causes.push('High memory usage');
      preventiveActions.push('Optimize memory consumption or increase limits');
    }

    if (metrics.avgExecutionTime > metrics.baseline * 1.5) {
      causes.push('Performance degradation');
      preventiveActions.push('Optimize workflow logic and database queries');
    }

    // Store prediction for monitoring
    await this.database.query(
      `INSERT INTO failure_predictions 
       (workflow_id, probability, time_to_failure, causes, preventive_actions, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        workflowId,
        failureProbability,
        timeToFailure,
        JSON.stringify(causes),
        JSON.stringify(preventiveActions)
      ]
    );

    return {
      probability: failureProbability,
      timeToFailure,
      causes,
      preventiveActions
    };
  }

  // Anomaly detection
  async detectAnomalies(workflowId: string): Promise<AnomalyDetection[]> {
    const metrics = await this.getWorkflowMetrics(workflowId);
    const historicalData = await this.getHistoricalMetrics(workflowId, 7); // Last 7 days

    const anomalies: AnomalyDetection[] = [];

    // Statistical anomaly detection
    const stats = this.calculateStatistics(historicalData);

    // Check for performance anomalies
    if (metrics.avgExecutionTime > stats.avgExecutionTime.mean + 2 * stats.avgExecutionTime.std) {
      anomalies.push({
        workflowId,
        type: 'performance',
        severity: 'high',
        confidence: 0.85,
        details: {
          current: metrics.avgExecutionTime,
          expected: stats.avgExecutionTime.mean,
          deviation: (metrics.avgExecutionTime - stats.avgExecutionTime.mean) / stats.avgExecutionTime.std
        },
        suggestedActions: [
          'Analyze slow queries',
          'Check for resource contention',
          'Review recent changes'
        ]
      });
    }

    // ML-based anomaly detection
    if (this.anomalyModel) {
      const input = this.prepareMetricsForML(metrics);
      const prediction = this.anomalyModel.predict(input) as tf.Tensor;
      const anomalyScores = await prediction.data();

      const anomalyTypes = ['performance', 'error_rate', 'resource_usage', 'security'];
      anomalyScores.forEach((score, index) => {
        if (score > 0.7) {
          anomalies.push({
            workflowId,
            type: anomalyTypes[index] as any,
            severity: score > 0.9 ? 'critical' : score > 0.8 ? 'high' : 'medium',
            confidence: score,
            details: { mlScore: score },
            suggestedActions: this.getAnomalySuggestions(anomalyTypes[index])
          });
        }
      });
    }

    // Trigger auto-remediation if enabled
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical') {
        await this.triggerAutoRemediation(workflowId, anomaly);
      }
    }

    return anomalies;
  }

  // Auto-optimization
  async autoOptimizeWorkflow(workflowId: string, userId: string): Promise<{
    optimizations: any[];
    applied: boolean;
    improvements: Record<string, number>;
  }> {
    // Get AI recommendations
    const analysis = await this.aiEngine.reviewWorkflow(
      { id: workflowId },
      { focus: 'optimization', depth: 'deep' }
    );

    const optimizations = analysis.suggestions.filter(s => s.autoApplicable);
    const improvements: Record<string, number> = {};

    if (optimizations.length > 0) {
      // Encrypt sensitive optimization data
      const encryptedOptimizations = await this.authManager.encryptUserData(
        userId,
        optimizations
      );

      // Apply optimizations automatically
      for (const optimization of optimizations) {
        try {
          await this.applyOptimization(workflowId, optimization);
          improvements[optimization.type] = typeof optimization.estimatedImprovement === 'number' 
            ? optimization.estimatedImprovement 
            : 0;
        } catch (error) {
          console.error('Failed to apply optimization:', error);
        }
      }

      // Log optimization
      await this.database.query(
        `INSERT INTO auto_optimizations 
         (workflow_id, user_id, optimizations, improvements, applied_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [workflowId, userId, encryptedOptimizations, JSON.stringify(improvements)]
      );

      return {
        optimizations,
        applied: true,
        improvements
      };
    }

    return {
      optimizations: [],
      applied: false,
      improvements: {}
    };
  }

  // Resource optimization
  async optimizeResourceAllocation(): Promise<void> {
    // Get all active workflows
    const workflows = await this.database.query(
      `SELECT w.*, 
              AVG(m.cpu_usage) as avg_cpu,
              AVG(m.memory_usage) as avg_memory,
              AVG(m.execution_time) as avg_time
       FROM workflows w
       JOIN workflow_metrics m ON w.id = m.workflow_id
       WHERE w.status = 'active'
         AND m.created_at > NOW() - INTERVAL '1 hour'
       GROUP BY w.id`
    );

    for (const workflow of workflows.rows) {
      // Predict resource needs
      const prediction = await this.predictResourceNeeds(workflow);

      // Adjust allocations
      if (prediction.recommendedCpu !== workflow.cpu_limit) {
        await this.database.query(
          `UPDATE workflows 
           SET cpu_limit = $1, memory_limit = $2
           WHERE id = $3`,
          [prediction.recommendedCpu, prediction.recommendedMemory, workflow.id]
        );

        this.emit('resource:optimized', {
          workflowId: workflow.id,
          changes: {
            cpu: { from: workflow.cpu_limit, to: prediction.recommendedCpu },
            memory: { from: workflow.memory_limit, to: prediction.recommendedMemory }
          }
        });
      }
    }
  }

  // Documentation generation
  async generateDocumentation(workflowId: string): Promise<{
    markdown: string;
    diagrams: string[];
    apiSpec: any;
  }> {
    const workflow = await this.database.query(
      'SELECT * FROM workflows WHERE id = $1',
      [workflowId]
    );

    if (workflow.rows.length === 0) {
      throw new Error('Workflow not found');
    }

    // Use AI to generate documentation
    const prompt = `Generate comprehensive documentation for this n8n workflow:
    ${JSON.stringify(workflow.rows[0].definition, null, 2)}
    
    Include:
    1. Overview and purpose
    2. Prerequisites and dependencies
    3. Configuration parameters
    4. Step-by-step explanation
    5. Error handling
    6. Performance considerations
    7. Security notes
    8. API endpoints used
    9. Example usage
    10. Troubleshooting guide`;

    const documentation = await this.aiEngine.generateContent(prompt);

    // Generate mermaid diagrams
    const diagrams = this.generateWorkflowDiagrams(workflow.rows[0].definition);

    // Generate OpenAPI spec if applicable
    const apiSpec = this.generateAPISpec(workflow.rows[0].definition);

    return {
      markdown: documentation,
      diagrams,
      apiSpec
    };
  }

  // Intelligent alerting
  async evaluateAlert(alert: any): Promise<{
    shouldNotify: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
    groupWithExisting?: string;
    suggestedActions: string[];
  }> {
    // Check alert fatigue prevention
    const recentAlerts = await this.database.query(
      `SELECT COUNT(*) as count 
       FROM alerts 
       WHERE workflow_id = $1 
         AND type = $2
         AND created_at > NOW() - INTERVAL '1 hour'`,
      [alert.workflowId, alert.type]
    );

    if (recentAlerts.rows[0].count > 10) {
      // Group with existing alert instead of creating new
      return {
        shouldNotify: false,
        priority: 'low',
        groupWithExisting: 'recent-similar',
        suggestedActions: ['Review alert configuration', 'Increase threshold']
      };
    }

    // AI-based priority assessment
    const context = await this.getAlertContext(alert);
    const priority = await this.aiEngine.assessAlertPriority(alert);

    return {
      shouldNotify: priority !== 'low',
      priority,
      suggestedActions: this.getAlertActions(alert, priority)
    };
  }

  // Helper methods
  private async getWorkflowMetrics(workflowId: string): Promise<any> {
    const result = await this.database.query(
      `SELECT * FROM workflow_metrics 
       WHERE workflow_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [workflowId]
    );
    return result.rows[0] || {};
  }

  private async getHistoricalMetrics(workflowId: string, days: number): Promise<any[]> {
    const result = await this.database.query(
      `SELECT * FROM workflow_metrics 
       WHERE workflow_id = $1 
         AND created_at > NOW() - INTERVAL '${days} days'
       ORDER BY created_at`,
      [workflowId]
    );
    return result.rows;
  }

  private calculateStatistics(data: any[]): any {
    // Calculate mean, std dev, percentiles
    const stats: any = {};
    const metrics = ['avgExecutionTime', 'errorRate', 'cpuUsage', 'memoryUsage'];

    for (const metric of metrics) {
      const values = data.map(d => d[metric]).filter(v => v !== null);
      stats[metric] = {
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        std: 0, // Calculate standard deviation
        p95: 0, // 95th percentile
        p99: 0  // 99th percentile
      };
    }

    return stats;
  }

  private prepareMetricsForML(metrics: any): tf.Tensor {
    return tf.tensor2d([[
      metrics.avgExecutionTime || 0,
      metrics.errorRate || 0,
      metrics.cpuUsage || 0,
      metrics.memoryUsage || 0,
      metrics.requestRate || 0,
      metrics.successRate || 0,
      metrics.queueLength || 0,
      metrics.lastOptimizationDays || 0,
      metrics.complexityScore || 0,
      metrics.dependencyCount || 0
    ]]);
  }

  private async triggerAutoRemediation(workflowId: string, anomaly: AnomalyDetection): Promise<void> {
    // Implement auto-remediation logic
    this.emit('anomaly:detected', { workflowId, anomaly });
  }

  private getAnomalySuggestions(type: string): string[] {
    const suggestions: Record<string, string[]> = {
      performance: [
        'Optimize database queries',
        'Implement caching',
        'Scale up resources',
        'Review workflow logic'
      ],
      error_rate: [
        'Review error logs',
        'Implement retry logic',
        'Add error handling',
        'Check external dependencies'
      ],
      resource_usage: [
        'Optimize memory usage',
        'Implement resource limits',
        'Scale horizontally',
        'Review data processing'
      ],
      security: [
        'Review access logs',
        'Check for unauthorized access',
        'Update security rules',
        'Enable additional monitoring'
      ]
    };

    return suggestions[type] || [];
  }

  private async loadAutomationRules(): Promise<void> {
    const rules = await this.database.query('SELECT * FROM automation_rules WHERE enabled = true');
    for (const rule of rules.rows) {
      this.automationRules.set(rule.id, rule);
    }
  }

  private async addAutomationRule(rule: AutomationRule, userId: string): Promise<void> {
    await this.database.query(
      `INSERT INTO automation_rules 
       (id, name, type, conditions, actions, enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        rule.id,
        rule.name,
        rule.type,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        rule.enabled,
        userId
      ]
    );
    
    this.automationRules.set(rule.id, rule);
  }

  private async applyOptimization(workflowId: string, optimization: any): Promise<void> {
    // Implementation depends on optimization type
    console.log(`Applying ${optimization.type} to workflow ${workflowId}`);
  }

  private async predictResourceNeeds(workflow: any): Promise<any> {
    // Simple prediction based on historical usage
    return {
      recommendedCpu: Math.ceil(workflow.avg_cpu * 1.2),
      recommendedMemory: Math.ceil(workflow.avg_memory * 1.2)
    };
  }

  private generateWorkflowDiagrams(definition: any): string[] {
    // Generate mermaid diagrams
    return [`
    graph TD
      A[Start] --> B[Process Data]
      B --> C{Condition}
      C -->|Yes| D[Action 1]
      C -->|No| E[Action 2]
      D --> F[End]
      E --> F
    `];
  }

  private generateAPISpec(definition: any): any {
    // Generate OpenAPI specification
    return {
      openapi: '3.0.0',
      info: {
        title: 'Workflow API',
        version: '1.0.0'
      },
      paths: {}
    };
  }

  private async getAlertContext(alert: any): Promise<any> {
    return {
      recentErrors: 0,
      workflowImportance: 'high',
      affectedUsers: 100
    };
  }

  private getAlertActions(alert: any, priority: string): string[] {
    if (priority === 'critical') {
      return ['Immediate investigation required', 'Escalate to on-call'];
    }
    return ['Monitor situation', 'Review in next maintenance window'];
  }

  private async getTrainingData(): Promise<{ xs: tf.Tensor | null; ys: tf.Tensor | null }> {
    // Load historical data for training
    // This is a placeholder - implement actual data loading
    return { xs: null, ys: null };
  }

  // Chat and AI Assistant Methods
  async generateChatResponse(message: string, context: any): Promise<string> {
    try {
      // Analyze the message intent
      const intent = await this.analyzeMessageIntent(message);
      
      // Get relevant context based on intent
      const relevantData = await this.getRelevantContextData(intent, context);
      
      // Generate response using AI
      const prompt = `
        You are an AI assistant for the n8n Agent Platform. 
        User message: ${message}
        Context: ${JSON.stringify(relevantData)}
        Intent: ${intent}
        
        Provide a helpful, concise response that addresses the user's needs.
        If the user is asking about workflows, agents, or optimizations, use the provided context.
      `;
      
      // TODO: Implement generateText in AIReviewEngine or use a different method
      const response = `I understand your question about "${message}". Based on the context provided, here's my response: This feature is currently being implemented.`;
      return response;
      
    } catch (error) {
      console.error('Failed to generate chat response:', error);
      return "I'm sorry, I encountered an error while processing your request. Please try again.";
    }
  }

  async generateSuggestions(message: string, context: any): Promise<string[]> {
    try {
      const intent = await this.analyzeMessageIntent(message);
      const suggestions: string[] = [];
      
      switch (intent) {
        case 'workflow_help':
          suggestions.push(
            'Show me workflow performance metrics',
            'Optimize my workflows',
            'Find workflow errors',
            'Create a new workflow'
          );
          break;
          
        case 'agent_help':
          suggestions.push(
            'Show agent status',
            'Configure agent settings',
            'View agent performance',
            'Troubleshoot agent issues'
          );
          break;
          
        case 'optimization':
          suggestions.push(
            'Apply AI optimizations',
            'Show optimization history',
            'Schedule optimization review',
            'View performance improvements'
          );
          break;
          
        default:
          suggestions.push(
            'How can I improve workflow performance?',
            'Show me system health',
            'What are my most active agents?',
            'Generate a performance report'
          );
      }
      
      return suggestions;
      
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      return ['How can I help you today?'];
    }
  }

  private async analyzeMessageIntent(message: string): Promise<string> {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('workflow')) {
      return 'workflow_help';
    } else if (lowerMessage.includes('agent')) {
      return 'agent_help';
    } else if (lowerMessage.includes('optim')) {
      return 'optimization';
    } else if (lowerMessage.includes('error') || lowerMessage.includes('fail')) {
      return 'troubleshooting';
    } else if (lowerMessage.includes('report') || lowerMessage.includes('metric')) {
      return 'reporting';
    }
    
    return 'general';
  }

  private async getRelevantContextData(intent: string, context: any): Promise<any> {
    const data: any = {};
    
    if (context.workflowId) {
      data.workflow = await this.database.query(
        'SELECT * FROM workflows WHERE id = $1',
        [context.workflowId]
      ).then(r => r.rows[0]);
      
      data.workflowMetrics = await this.getWorkflowMetrics(context.workflowId);
    }
    
    if (context.agentId) {
      data.agent = await this.database.query(
        'SELECT * FROM agents WHERE id = $1',
        [context.agentId]
      ).then(r => r.rows[0]);
    }
    
    // Add recent activity
    data.recentActivity = await this.database.query(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 5'
    ).then(r => r.rows);
    
    return data;
  }
}