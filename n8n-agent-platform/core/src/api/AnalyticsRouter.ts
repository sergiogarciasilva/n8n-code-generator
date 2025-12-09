import { Router, Response } from 'express';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { checkPermission } from '../middleware/permissions';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

// Validation schemas
const MetricsQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  interval: z.enum(['1m', '5m', '1h', '1d', '1w', '1M']).optional(),
  groupBy: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
});

const PredictionRequestSchema = z.object({
  horizonDays: z.number().min(1).max(90).default(7),
});

const CorrelationRequestSchema = z.object({
  metrics: z.array(z.string()).min(2),
  start: z.string().datetime(),
  end: z.string().datetime(),
});

const ReportGenerationSchema = z.object({
  name: z.string(),
  metrics: z.array(z.string()),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  groupBy: z.array(z.string()).optional(),
  format: z.enum(['json', 'csv', 'pdf']),
  includeCharts: z.boolean().optional(),
  includePredictions: z.boolean().optional(),
});

export class AnalyticsRouter {
  private router: Router;
  private analyticsEngine: AnalyticsEngine;
  private db: Pool;
  private chartRenderer: ChartJSNodeCanvas;

  constructor(db: Pool, redis: RedisClientType) {
    this.router = Router();
    this.db = db;
    this.analyticsEngine = new AnalyticsEngine(db, redis);
    this.chartRenderer = new ChartJSNodeCanvas({ width: 800, height: 400 });
    this.setupRoutes();
  }

  private setupRoutes() {
    // All routes require authentication
    this.router.use(authenticateToken);

    // Record metric
    this.router.post('/metrics', this.recordMetric.bind(this));

    // Query metrics
    this.router.get('/metrics/:metric', this.queryMetrics.bind(this));

    // Get predictions
    this.router.get('/predictions/:metric', this.getPredictions.bind(this));

    // Calculate correlations
    this.router.post('/correlations', this.calculateCorrelations.bind(this));

    // Get statistics
    this.router.get('/stats/:metric', this.getStatistics.bind(this));

    // Generate report
    this.router.post('/reports/generate', this.generateReport.bind(this));

    // Get saved reports
    this.router.get('/reports', this.getReports.bind(this));

    // Schedule report
    this.router.post('/reports/:id/schedule', this.scheduleReport.bind(this));

    // Get optimization recommendations
    this.router.get('/optimizations/:workflowId', this.getOptimizations.bind(this));

    // Apply optimization
    this.router.post('/optimizations/:id/apply', this.applyOptimization.bind(this));

    // Real-time anomaly check
    this.router.post('/anomalies/check', this.checkAnomaly.bind(this));

    // Get dashboard summary
    this.router.get('/dashboard', this.getDashboardSummary.bind(this));

    // Export data
    this.router.post('/export', this.exportData.bind(this));
  }

  private async recordMetric(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, value, labels } = req.body;

      await this.analyticsEngine.recordMetric(name, value, {
        ...labels,
        user_id: req.user?.userId || 'unknown',
        organization_id: req.user?.organizationId || 'unknown',
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to record metric:', error);
      res.status(500).json({ error: 'Failed to record metric' });
    }
  }

  private async queryMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      const { metric } = req.params;
      const query = MetricsQuerySchema.parse(req.query);

      const result = await this.analyticsEngine.queryMetrics({
        metric,
        aggregation: 'avg',
        timeRange: {
          start: new Date(query.start),
          end: new Date(query.end),
        },
        interval: query.interval,
        groupBy: query.groupBy,
        filters: {
          ...query.filters,
          organization_id: req.user?.organizationId || 'unknown',
        },
      });

      res.json(result);
    } catch (error) {
      logger.error('Failed to query metrics:', error);
      res.status(500).json({ error: 'Failed to query metrics' });
    }
  }

  private async getPredictions(req: AuthenticatedRequest, res: Response) {
    try {
      const { metric } = req.params;
      const { horizonDays } = PredictionRequestSchema.parse(req.query);

      const predictions = await this.analyticsEngine.predict(metric, horizonDays);

      res.json(predictions);
    } catch (error) {
      logger.error('Failed to get predictions:', error);
      res.status(500).json({ error: 'Failed to generate predictions' });
    }
  }

  private async calculateCorrelations(req: AuthenticatedRequest, res: Response) {
    try {
      const data = CorrelationRequestSchema.parse(req.body);

      const correlations = await this.analyticsEngine.analyzeCorrelations(
        data.metrics,
        {
          start: new Date(data.start),
          end: new Date(data.end),
        }
      );

      res.json(correlations);
    } catch (error) {
      logger.error('Failed to calculate correlations:', error);
      res.status(500).json({ error: 'Failed to calculate correlations' });
    }
  }

  private async getStatistics(req: AuthenticatedRequest, res: Response) {
    try {
      const { metric } = req.params;
      const { start, end } = req.query;

      const stats = await this.analyticsEngine.calculateStats(metric, {
        start: new Date(start as string),
        end: new Date(end as string),
      });

      res.json(stats);
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      res.status(500).json({ error: 'Failed to calculate statistics' });
    }
  }

  private async generateReport(req: AuthenticatedRequest, res: Response) {
    try {
      const config = ReportGenerationSchema.parse(req.body);

      const report = await this.analyticsEngine.generateReport({
        name: config.name || 'Analytics Report',
        metrics: config.metrics || ['execution_count', 'success_rate'],
        ...config,
        timeRange: {
          start: new Date(config.timeRange.start),
          end: new Date(config.timeRange.end),
        },
        format: config.format || 'json'
      });

      // Save report execution
      await this.db.query(
        `INSERT INTO report_executions (report_id, status, file_url, completed_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [null, 'completed', null]
      );

      if (config.format === 'json') {
        res.json(report);
      } else if (config.format === 'csv') {
        const csv = this.convertToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${config.name}.csv"`);
        res.send(csv);
      } else if (config.format === 'pdf') {
        const pdf = await this.generatePDF(report, config);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${config.name}.pdf"`);
        res.send(pdf);
      }
    } catch (error) {
      logger.error('Failed to generate report:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }

  private async getReports(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await this.db.query(
        `SELECT * FROM analytics_reports 
         WHERE created_by = $1 
         ORDER BY created_at DESC`,
        [req.user?.userId || 'unknown']
      );

      res.json(result.rows);
    } catch (error) {
      logger.error('Failed to get reports:', error);
      res.status(500).json({ error: 'Failed to get reports' });
    }
  }

  private async scheduleReport(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { schedule, recipients } = req.body;

      await this.db.query(
        `UPDATE analytics_reports 
         SET schedule = $2, recipients = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND created_by = $4`,
        [id, schedule, recipients, req.user?.userId || 'unknown']
      );

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to schedule report:', error);
      res.status(500).json({ error: 'Failed to schedule report' });
    }
  }

  private async getOptimizations(req: AuthenticatedRequest, res: Response) {
    try {
      const { workflowId } = req.params;

      // Check permission - simplified for now
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'editor')) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      const recommendations = await this.analyticsEngine.generateOptimizationRecommendations(
        workflowId
      );

      // Save recommendations
      for (const rec of recommendations) {
        await this.db.query(
          `INSERT INTO optimization_recommendations 
           (workflow_id, type, priority, title, description, expected_improvement, implementation_details)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [
            workflowId,
            rec.type,
            rec.priority,
            rec.recommendation,
            rec.recommendation,
            rec.expectedImprovement,
            { implementation: rec.implementation },
          ]
        );
      }

      res.json(recommendations);
    } catch (error) {
      logger.error('Failed to get optimizations:', error);
      res.status(500).json({ error: 'Failed to generate optimizations' });
    }
  }

  private async applyOptimization(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      // Get optimization details
      const result = await this.db.query(
        `SELECT * FROM optimization_recommendations WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Optimization not found' });
      }

      const optimization = result.rows[0];

      // Check permission - simplified for now
      if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'editor')) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Apply optimization (this would integrate with the workflow system)
      // For now, just mark as applied
      await this.db.query(
        `UPDATE optimization_recommendations 
         SET status = 'applied', applied_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to apply optimization:', error);
      res.status(500).json({ error: 'Failed to apply optimization' });
    }
  }

  private async checkAnomaly(req: AuthenticatedRequest, res: Response) {
    try {
      const { metric, value } = req.body;

      const anomaly = await this.analyticsEngine.detectRealtimeAnomalies(metric, value);

      if (anomaly.isAnomaly) {
        // Save anomaly
        await this.db.query(
          `INSERT INTO anomalies (metric_name, timestamp, value, severity, reason)
           VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4)`,
          [metric, value, anomaly.severity, anomaly.reason]
        );
      }

      res.json(anomaly);
    } catch (error) {
      logger.error('Failed to check anomaly:', error);
      res.status(500).json({ error: 'Failed to check anomaly' });
    }
  }

  private async getDashboardSummary(req: AuthenticatedRequest, res: Response) {
    try {
      // Get summary from materialized view
      const summaryResult = await this.db.query(
        `SELECT * FROM analytics_dashboard_summary`
      );

      // Get recent anomalies
      const anomaliesResult = await this.db.query(
        `SELECT * FROM anomalies 
         WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
         AND resolved = FALSE
         ORDER BY severity DESC, created_at DESC
         LIMIT 10`
      );

      // Get top workflows by execution
      const topWorkflowsResult = await this.db.query(
        `SELECT 
           w.id, 
           w.name, 
           COUNT(we.id) as execution_count,
           AVG(we.execution_time) as avg_execution_time,
           SUM(CASE WHEN we.status = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
         FROM workflows w
         JOIN workflow_executions we ON w.id = we.workflow_id
         WHERE we.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
         GROUP BY w.id, w.name
         ORDER BY execution_count DESC
         LIMIT 5`
      );

      res.json({
        summary: summaryResult.rows,
        anomalies: anomaliesResult.rows,
        topWorkflows: topWorkflowsResult.rows,
      });
    } catch (error) {
      logger.error('Failed to get dashboard summary:', error);
      res.status(500).json({ error: 'Failed to get dashboard summary' });
    }
  }

  private async exportData(req: AuthenticatedRequest, res: Response) {
    try {
      const { metrics, timeRange, format } = req.body;

      const data = await Promise.all(
        metrics.map(async (metric: string) => {
          const result = await this.analyticsEngine.queryMetrics({
            metric,
            aggregation: 'avg',
            timeRange: {
              start: new Date(timeRange.start),
              end: new Date(timeRange.end),
            },
            interval: '1h',
          });
          return { metric, data: result };
        })
      );

      if (format === 'csv') {
        const csv = this.convertToCSV({ sections: data });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analytics-export.csv"');
        res.send(csv);
      } else {
        res.json(data);
      }
    } catch (error) {
      logger.error('Failed to export data:', error);
      res.status(500).json({ error: 'Failed to export data' });
    }
  }

  private convertToCSV(report: any): string {
    const flatData: any[] = [];

    report.sections.forEach((section: any) => {
      section.data.forEach((point: any) => {
        flatData.push({
          metric: section.metric,
          timestamp: point.timestamp,
          value: point.value,
          ...point.labels,
        });
      });
    });

    const parser = new Parser();
    return parser.parse(flatData);
  }

  private async generatePDF(report: any, config: any): Promise<Buffer> {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Title
    doc.fontSize(24).text(config.name, { align: 'center' });
    doc.moveDown();

    // Time range
    doc.fontSize(12).text(
      `Period: ${new Date(config.timeRange.start).toLocaleDateString()} - ${new Date(
        config.timeRange.end
      ).toLocaleDateString()}`
    );
    doc.moveDown();

    // Sections
    for (const section of report.sections) {
      doc.addPage();
      doc.fontSize(18).text(section.metric);
      doc.moveDown();

      // Statistics
      if (section.statistics) {
        doc.fontSize(12);
        doc.text(`Mean: ${section.statistics.basic.mean.toFixed(2)}`);
        doc.text(`Median: ${section.statistics.basic.median.toFixed(2)}`);
        doc.text(`Std Dev: ${section.statistics.basic.stdDev.toFixed(2)}`);
        doc.moveDown();
      }

      // Chart
      if (config.includeCharts && section.charts) {
        const chartImage = await this.chartRenderer.renderToBuffer({
          type: 'line',
          data: {
            labels: section.data.map((d: any) => new Date(d.timestamp).toLocaleDateString()),
            datasets: [
              {
                label: section.metric,
                data: section.data.map((d: any) => d.value),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
              },
            ],
          },
        });

        doc.image(chartImage, {
          fit: [500, 300],
          align: 'center',
        });
      }
    }

    doc.end();

    return Buffer.concat(chunks);
  }

  getRouter(): Router {
    return this.router;
  }
}