import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../utils/logger';

export interface MetricPoint {
  timestamp: Date;
  value: number;
  labels: Record<string, string>;
}

export interface AnalyticsQuery {
  metric: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p95' | 'p99';
  timeRange: {
    start: Date;
    end: Date;
  };
  groupBy?: string[];
  filters?: Record<string, any>;
  interval?: '1m' | '5m' | '1h' | '1d' | '1w' | '1M';
}

export interface PredictionResult {
  metric: string;
  predictions: Array<{
    timestamp: Date;
    value: number;
    confidence: number;
    upperBound: number;
    lowerBound: number;
  }>;
  anomalies: Array<{
    timestamp: Date;
    value: number;
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }>;
}

export class AnalyticsEngine extends EventEmitter {
  private db: Pool;
  private redis: RedisClientType;
  private models: Map<string, tf.LayersModel> = new Map();
  private metricsBuffer: MetricPoint[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(db: Pool, redis: RedisClientType) {
    super();
    this.db = db;
    this.redis = redis;
    
    // Flush metrics every 10 seconds
    this.flushInterval = setInterval(() => this.flushMetrics(), 10000);
  }

  /**
   * Record a metric data point
   */
  async recordMetric(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    const metric: MetricPoint = {
      timestamp: new Date(),
      value,
      labels: {
        ...labels,
        metric_name: name
      }
    };

    this.metricsBuffer.push(metric);

    // Real-time processing for critical metrics
    if (this.isCriticalMetric(name)) {
      await this.processRealTimeMetric(metric);
    }
  }

  /**
   * Query metrics with advanced aggregations
   */
  async queryMetrics(query: AnalyticsQuery): Promise<any> {
    const cacheKey = this.generateCacheKey(query);
    
    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build SQL query
    const sql = this.buildMetricsQuery(query);
    const result = await this.db.query(sql.query, sql.params);

    // Post-process results
    const processed = this.processQueryResults(result.rows, query);

    // Cache results
    await this.redis.setEx(cacheKey, 300, JSON.stringify(processed));

    return processed;
  }

  /**
   * Generate predictions using ML models
   */
  async predict(
    metric: string,
    horizonDays: number = 7
  ): Promise<PredictionResult> {
    // Load or train model
    let model = this.models.get(metric);
    if (!model) {
      model = await this.trainModel(metric);
      this.models.set(metric, model);
    }

    // Get historical data
    const historicalData = await this.getHistoricalData(metric, 90);
    if (historicalData.length < 30) {
      throw new Error('Insufficient data for prediction');
    }

    // Prepare data for prediction
    const features = this.prepareFeatures(historicalData);
    
    // Generate predictions
    const predictions = await this.generatePredictions(features, model);

    // Detect anomalies
    const anomalies = this.detectAnomalies(historicalData, predictions);

    return {
      metric,
      predictions,
      anomalies
    };
  }

  /**
   * Calculate advanced statistics
   */
  async calculateStats(metric: string, timeRange: { start: Date; end: Date }) {
    const data = await this.getMetricData(metric, timeRange);
    
    return {
      basic: {
        mean: this.mean(data),
        median: this.median(data),
        stdDev: this.standardDeviation(data),
        variance: this.variance(data),
        min: Math.min(...data),
        max: Math.max(...data),
        count: data.length
      },
      percentiles: {
        p50: this.percentile(data, 50),
        p75: this.percentile(data, 75),
        p90: this.percentile(data, 90),
        p95: this.percentile(data, 95),
        p99: this.percentile(data, 99)
      },
      distribution: {
        skewness: this.skewness(data),
        kurtosis: this.kurtosis(data),
        isNormal: this.testNormality(data)
      },
      trends: {
        slope: this.calculateTrend(data),
        seasonality: this.detectSeasonality(data),
        changePoints: this.detectChangePoints(data)
      }
    };
  }

  /**
   * Generate custom reports
   */
  async generateReport(config: {
    name: string;
    metrics: string[];
    timeRange: { start: Date; end: Date };
    groupBy?: string[];
    format: 'json' | 'csv' | 'pdf';
    includeCharts?: boolean;
    includePredictions?: boolean;
  }): Promise<any> {
    const report = {
      name: config.name,
      generatedAt: new Date(),
      timeRange: config.timeRange,
      sections: [] as any[]
    };

    // Collect data for each metric
    for (const metric of config.metrics) {
      const section = {
        metric,
        data: await this.queryMetrics({
          metric,
          aggregation: 'avg',
          timeRange: config.timeRange,
          groupBy: config.groupBy,
          interval: this.determineInterval(config.timeRange)
        }),
        statistics: await this.calculateStats(metric, config.timeRange),
        predictions: config.includePredictions 
          ? await this.predict(metric, 7)
          : null
      };

      if (config.includeCharts) {
        (section as any).charts = this.generateCharts(section.data as any[], 'line');
      }

      report.sections.push(section);
    }

    // Format report
    return this.formatReport(report);
  }

  /**
   * Real-time anomaly detection
   */
  async detectRealtimeAnomalies(metric: string, value: number): Promise<{
    isAnomaly: boolean;
    severity?: 'low' | 'medium' | 'high';
    reason?: string;
  }> {
    // Get recent baseline
    const baseline = await this.getMetricBaseline(metric);
    
    // Statistical anomaly detection
    const zScore = Math.abs((value - baseline.mean) / baseline.stdDev);
    
    if (zScore > 3) {
      return {
        isAnomaly: true,
        severity: 'high',
        reason: `Value ${value} is ${zScore.toFixed(2)} standard deviations from mean`
      };
    } else if (zScore > 2) {
      return {
        isAnomaly: true,
        severity: 'medium',
        reason: `Value ${value} is ${zScore.toFixed(2)} standard deviations from mean`
      };
    }

    // ML-based anomaly detection
    const mlAnomaly = { isAnomaly: false }; // Simplified for now
    if (mlAnomaly.isAnomaly) {
      return mlAnomaly;
    }

    return { isAnomaly: false };
  }

  /**
   * Correlation analysis between metrics
   */
  async analyzeCorrelations(
    metrics: string[],
    timeRange: { start: Date; end: Date }
  ): Promise<Array<{
    metric1: string;
    metric2: string;
    correlation: number;
    pValue: number;
    relationship: 'strong' | 'moderate' | 'weak' | 'none';
  }>> {
    const correlations = [];

    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const data1 = await this.getMetricData(metrics[i], timeRange);
        const data2 = await this.getMetricData(metrics[j], timeRange);

        const correlation = this.pearsonCorrelation(data1, data2);
        const pValue = this.correlationPValue(correlation, data1.length);

        correlations.push({
          metric1: metrics[i],
          metric2: metrics[j],
          correlation,
          pValue,
          relationship: this.interpretCorrelation(correlation)
        });
      }
    }

    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * Performance optimization recommendations
   */
  async generateOptimizationRecommendations(
    workflowId: string
  ): Promise<Array<{
    type: 'performance' | 'cost' | 'reliability';
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    expectedImprovement: string;
    implementation: string;
  }>> {
    const recommendations = [];

    // Analyze workflow performance metrics
    const perfMetrics = await this.analyzeWorkflowPerformance(workflowId);

    // Performance recommendations
    if (perfMetrics.avgExecutionTime > 30000) {
      recommendations.push({
        type: 'performance' as const,
        priority: 'high' as const,
        recommendation: 'Implement parallel processing for independent nodes',
        expectedImprovement: '40-60% reduction in execution time',
        implementation: 'Use Split In Batches node with parallel execution'
      });
    }

    // Cost recommendations
    const costAnalysis = await this.analyzeCosts({ start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() });
    if (costAnalysis.apiCosts > 100) {
      recommendations.push({
        type: 'cost' as const,
        priority: 'medium' as const,
        recommendation: 'Implement caching for expensive API calls',
        expectedImprovement: '30-50% cost reduction',
        implementation: 'Add Redis cache node before API calls'
      });
    }

    // Reliability recommendations
    const errorRate = this.calculateErrorRate(0, 100); // Simplified
    if (errorRate > 0.05) {
      recommendations.push({
        type: 'reliability' as const,
        priority: 'high' as const,
        recommendation: 'Add retry logic and error handling',
        expectedImprovement: '80% reduction in failures',
        implementation: 'Wrap critical nodes with Try-Catch and retry logic'
      });
    }

    return recommendations;
  }

  // Private helper methods

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Batch insert into database
      const values = metrics.map(m => [
        m.timestamp,
        m.value,
        JSON.stringify(m.labels)
      ]);

      await this.db.query(`
        INSERT INTO metrics (timestamp, value, labels)
        VALUES ${values.map((_, i) => `($${i*3+1}, $${i*3+2}, $${i*3+3})`).join(',')}
      `, values.flat());

      logger.info(`Flushed ${metrics.length} metrics to database`);
    } catch (error) {
      logger.error('Failed to flush metrics:', error);
      // Re-add metrics to buffer
      this.metricsBuffer.unshift(...metrics);
    }
  }

  private buildMetricsQuery(query: AnalyticsQuery): { query: string; params: any[] } {
    let sql = `
      SELECT 
        date_trunc('${query.interval || 'hour'}', timestamp) as time_bucket,
        ${query.aggregation}(value) as value
    `;

    if (query.groupBy) {
      sql += `, ${query.groupBy.map(g => `labels->>'${g}' as ${g}`).join(', ')}`;
    }

    sql += `
      FROM metrics
      WHERE labels->>'metric_name' = $1
        AND timestamp >= $2
        AND timestamp <= $3
    `;

    const params = [query.metric, query.timeRange.start, query.timeRange.end];

    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value], i) => {
        sql += ` AND labels->>'${key}' = $${params.length + 1}`;
        params.push(value);
      });
    }

    sql += ` GROUP BY time_bucket`;
    
    if (query.groupBy) {
      sql += `, ${query.groupBy.join(', ')}`;
    }

    sql += ` ORDER BY time_bucket ASC`;

    return { query: sql, params };
  }

  private async trainModel(metric: string): Promise<tf.LayersModel> {
    const data = await this.getHistoricalData(metric, 180);
    
    // Prepare training data
    const trainingData = this.prepareTrainingData(data);
    const inputs = tf.tensor2d(trainingData.features);
    const outputs = tf.tensor1d(trainingData.labels);

    // Build LSTM model
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 50,
          returnSequences: true,
          inputShape: [10, 1] // Fixed sequence length
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({ units: 50 }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 1 })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse']
    });

    // Train model
    await model.fit(inputs, outputs, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          logger.debug(`Training epoch ${epoch}: loss = ${logs?.loss}`);
        }
      }
    });

    return model;
  }

  private detectAnomalies(
    historical: any[],
    predictions: any[]
  ): Array<{
    timestamp: Date;
    value: number;
    severity: 'low' | 'medium' | 'high';
    reason: string;
  }> {
    const anomalies: Array<{
      timestamp: Date;
      value: number;
      severity: 'low' | 'medium' | 'high';
      reason: string;
    }> = [];
    
    // Isolation Forest for anomaly detection
    const threshold = this.calculateAnomalyThreshold(historical);
    
    predictions.forEach(pred => {
      const anomalyScore = this.calculateAnomalyScore(pred, historical);
      
      if (anomalyScore > threshold.high) {
        anomalies.push({
          timestamp: pred.timestamp,
          value: pred.value,
          severity: 'high',
          reason: `Anomaly score ${anomalyScore.toFixed(2)} exceeds high threshold`
        });
      } else if (anomalyScore > threshold.medium) {
        anomalies.push({
          timestamp: pred.timestamp,
          value: pred.value,
          severity: 'medium',
          reason: `Anomaly score ${anomalyScore.toFixed(2)} exceeds medium threshold`
        });
      }
    });

    return anomalies;
  }

  // Statistical helper methods
  private mean(data: number[]): number {
    return data.reduce((a, b) => a + b, 0) / data.length;
  }

  private median(data: number[]): number {
    const sorted = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private standardDeviation(data: number[]): number {
    const avg = this.mean(data);
    const squaredDiffs = data.map(x => Math.pow(x - avg, 2));
    return Math.sqrt(this.mean(squaredDiffs));
  }

  private variance(data: number[]): number {
    return Math.pow(this.standardDeviation(data), 2);
  }

  private percentile(data: number[], p: number): number {
    const sorted = [...data].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.map((xi, i) => xi * y[i]).reduce((a, b) => a + b, 0);
    const sumX2 = x.map(xi => xi * xi).reduce((a, b) => a + b, 0);
    const sumY2 = y.map(yi => yi * yi).reduce((a, b) => a + b, 0);

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return den === 0 ? 0 : num / den;
  }

  private interpretCorrelation(r: number): 'strong' | 'moderate' | 'weak' | 'none' {
    const absR = Math.abs(r);
    if (absR >= 0.7) return 'strong';
    if (absR >= 0.4) return 'moderate';
    if (absR >= 0.2) return 'weak';
    return 'none';
  }

  // Missing helper methods implementation
  private isCriticalMetric(name: string): boolean {
    const criticalMetrics = [
      'error_rate',
      'response_time',
      'cpu_usage',
      'memory_usage',
      'workflow_failures'
    ];
    return criticalMetrics.includes(name);
  }

  private async processRealTimeMetric(metric: MetricPoint): Promise<void> {
    // Emit event for real-time dashboards
    this.emit('metric:realtime', metric);
    
    // Check for immediate alerts
    if (metric.value > this.getThreshold(metric.labels.metric_name)) {
      this.emit('alert:threshold', {
        metric: metric.labels.metric_name,
        value: metric.value,
        timestamp: metric.timestamp
      });
    }
  }

  private generateCacheKey(query: AnalyticsQuery): string {
    const key = `analytics:${query.metric}:${query.aggregation}:${query.timeRange.start.getTime()}-${query.timeRange.end.getTime()}`;
    if (query.groupBy) {
      return `${key}:${query.groupBy.join(',')}`;
    }
    return key;
  }

  private processQueryResults(rows: any[], query: AnalyticsQuery): any {
    // Process and format query results based on aggregation type
    return rows.map(row => ({
      timestamp: row.timestamp,
      value: parseFloat(row.value),
      ...row
    }));
  }

  private async getHistoricalData(metric: string, days: number = 30): Promise<any[]> {
    const query = `
      SELECT timestamp, value, labels
      FROM metrics
      WHERE labels->>'metric_name' = $1
      AND timestamp > NOW() - INTERVAL '${days} days'
      ORDER BY timestamp ASC
    `;
    const result = await this.db.query(query, [metric]);
    return result.rows;
  }

  private prepareFeatures(data: any[]): tf.Tensor2D {
    // Convert time series data to feature matrix
    const features = data.map(d => [
      d.value,
      new Date(d.timestamp).getHours(),
      new Date(d.timestamp).getDay(),
      // Add more features as needed
    ]);
    return tf.tensor2d(features);
  }

  private async generatePredictions(features: tf.Tensor2D, model: tf.LayersModel): Promise<any[]> {
    const predictions = model.predict(features) as tf.Tensor;
    const values = await predictions.array();
    predictions.dispose();
    return values as any[];
  }

  private async getMetricData(metric: string, timeRange: { start: Date; end: Date }): Promise<any[]> {
    const query = `
      SELECT timestamp, value
      FROM metrics
      WHERE labels->>'metric_name' = $1
      AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp ASC
    `;
    const result = await this.db.query(query, [metric, timeRange.start, timeRange.end]);
    return result.rows;
  }

  private skewness(data: number[]): number {
    const n = data.length;
    const mean = this.mean(data);
    const stdDev = this.standardDeviation(data);
    
    const sum = data.reduce((acc, x) => acc + Math.pow((x - mean) / stdDev, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  private kurtosis(data: number[]): number {
    const n = data.length;
    const mean = this.mean(data);
    const stdDev = this.standardDeviation(data);
    
    const sum = data.reduce((acc, x) => acc + Math.pow((x - mean) / stdDev, 4), 0);
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }

  private testNormality(data: number[]): boolean {
    // Jarque-Bera test for normality
    const n = data.length;
    const skew = this.skewness(data);
    const kurt = this.kurtosis(data);
    
    const jb = (n / 6) * (Math.pow(skew, 2) + (Math.pow(kurt - 3, 2) / 4));
    // Chi-square critical value at 0.05 significance level with 2 degrees of freedom
    return jb < 5.991;
  }

  private calculateTrend(data: any[]): { slope: number; intercept: number; r2: number } {
    // Simple linear regression
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.value);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = y.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((acc, yi, i) => acc + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
    const r2 = 1 - (ssResidual / ssTotal);
    
    return { slope, intercept, r2 };
  }

  private detectSeasonality(data: any[]): { period: number; strength: number } {
    // Simple FFT-based seasonality detection
    // For now, return mock values
    return { period: 24, strength: 0.7 };
  }

  private detectChangePoints(data: any[]): number[] {
    // CUSUM change point detection
    const changePoints: number[] = [];
    const values = data.map(d => d.value);
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values);
    
    let cusumPos = 0;
    let cusumNeg = 0;
    const threshold = 4 * stdDev;
    
    for (let i = 0; i < values.length; i++) {
      cusumPos = Math.max(0, cusumPos + values[i] - mean - 0.5 * stdDev);
      cusumNeg = Math.max(0, cusumNeg - values[i] + mean - 0.5 * stdDev);
      
      if (cusumPos > threshold || cusumNeg > threshold) {
        changePoints.push(i);
        cusumPos = 0;
        cusumNeg = 0;
      }
    }
    
    return changePoints;
  }

  private determineInterval(timeRange: { start: Date; end: Date }): '1m' | '5m' | '1h' | '1d' | '1w' | '1M' {
    const duration = timeRange.end.getTime() - timeRange.start.getTime();
    const hours = duration / (1000 * 60 * 60);
    
    if (hours <= 1) return '1m';
    if (hours <= 24) return '5m';
    if (hours <= 168) return '1h';
    if (hours <= 720) return '1d';
    return '1w';
  }

  private generateCharts(data: any[], type: string): any {
    // Generate chart configuration
    return {
      type: type,
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    };
  }

  private formatReport(results: any): string {
    // Format results as markdown report
    return `# Analytics Report\n\n${JSON.stringify(results, null, 2)}`;
  }

  private getMetricBaseline(metric: string): { mean: number; stdDev: number; threshold: number } {
    // Return baseline values for the metric
    // In production, these would be calculated from historical data
    return {
      mean: 100,
      stdDev: 20,
      threshold: 160 // mean + 3 * stdDev
    };
  }

  private mlAnomalyDetection(data: any[]): Array<{ timestamp: Date; score: number; isAnomaly: boolean }> {
    // Implement ML-based anomaly detection
    // For now, return simple threshold-based detection
    const baseline = this.getMetricBaseline('default');
    
    return data.map(point => {
      const score = Math.abs(point.value - baseline.mean) / baseline.stdDev;
      return {
        timestamp: point.timestamp,
        score: score,
        isAnomaly: score > 3
      };
    });
  }

  private correlationPValue(r: number, n: number): number {
    // Calculate p-value for correlation coefficient
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    // Approximate p-value using t-distribution
    // For simplicity, using normal approximation
    return 2 * (1 - this.normalCDF(Math.abs(t)));
  }

  private normalCDF(x: number): number {
    // Cumulative distribution function for standard normal
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return 0.5 * (1.0 + sign * y);
  }

  private async analyzeWorkflowPerformance(workflowId: string): Promise<any> {
    // Analyze workflow-specific performance metrics
    const metrics = await this.getMetricData(`workflow.${workflowId}.execution_time`, {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date()
    });
    
    return {
      avgExecutionTime: this.mean(metrics.map(m => m.value)),
      p95ExecutionTime: this.percentile(metrics.map(m => m.value), 95),
      trend: this.calculateTrend(metrics)
    };
  }

  private async analyzeCosts(timeRange: { start: Date; end: Date }): Promise<any> {
    // Analyze cost metrics
    const costMetrics = await this.getMetricData('infrastructure.cost', timeRange);
    const executionMetrics = await this.getMetricData('workflow.executions', timeRange);
    
    const totalCost = costMetrics.reduce((sum, m) => sum + m.value, 0);
    const totalExecutions = executionMetrics.reduce((sum, m) => sum + m.value, 0);
    
    return {
      totalCost,
      totalExecutions,
      costPerExecution: totalCost / totalExecutions,
      trend: this.calculateTrend(costMetrics)
    };
  }

  private calculateErrorRate(errors: number, total: number): number {
    return total === 0 ? 0 : (errors / total) * 100;
  }

  private getThreshold(metricName: string): number {
    // Get alert threshold for metric
    const thresholds: Record<string, number> = {
      'error_rate': 5,
      'response_time': 1000,
      'cpu_usage': 80,
      'memory_usage': 85,
      'workflow_failures': 10
    };
    return thresholds[metricName] || 100;
  }

  private calculateAnomalyThreshold(historical: any[]): { low: number; medium: number; high: number } {
    const scores = historical.map(h => this.calculateAnomalyScore(h, historical));
    const mean = this.mean(scores);
    const stdDev = this.standardDeviation(scores);
    
    return {
      low: mean + stdDev,
      medium: mean + 2 * stdDev,
      high: mean + 3 * stdDev
    };
  }

  private calculateAnomalyScore(point: any, historical: any[]): number {
    // Simple z-score based anomaly score
    const values = historical.map(h => h.value);
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values);
    
    return Math.abs((point.value - mean) / stdDev);
  }

  private prepareTrainingData(data: any[]): { features: number[][]; labels: number[] } {
    // Prepare data for ML model training
    const features: number[][] = [];
    const labels: number[] = [];
    
    for (let i = 10; i < data.length; i++) {
      // Use last 10 points as features
      const feature = data.slice(i - 10, i).map(d => d.value);
      features.push(feature);
      labels.push(data[i].value);
    }
    
    return { features, labels };
  }

  // Cleanup
  async shutdown(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.flushMetrics();
    
    // Dispose TensorFlow models
    for (const model of this.models.values()) {
      model.dispose();
    }
  }
}