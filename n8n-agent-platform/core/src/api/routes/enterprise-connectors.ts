import { Router, Response } from 'express';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { EnterpriseConnectorManager } from '../../connectors/EnterpriseConnectorManager';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { z } from 'zod';

// Validation schemas
const CreateConnectionSchema = z.object({
  connectorId: z.string(),
  name: z.string(),
  credentials: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
});

const ExecuteOperationSchema = z.object({
  operation: z.string(),
  params: z.record(z.any()),
});

const GenerateUsageReportSchema = z.object({
  connectorId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
});

export function createEnterpriseConnectorRoutes(
  db: Pool,
  redis: RedisClientType,
  connectorManager: EnterpriseConnectorManager
): Router {
  const router = Router();

  // Get available connectors
  router.get('/connectors', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const connectors = await connectorManager.getAvailableConnectors();
      res.json({ connectors });
    } catch (error) {
      logger.error('Failed to get available connectors:', error);
      res.status(500).json({ error: 'Failed to get available connectors' });
    }
  });

  // Get connector details
  router.get('/connectors/:connectorId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { connectorId } = req.params;
      const connector = connectorManager.getConnector(connectorId);
      
      if (!connector) {
        return res.status(404).json({ error: 'Connector not found' });
      }

      const info = connector.getInfo();
      const operations = await connector.getOperations();

      res.json({
        connector: {
          ...info,
          operations
        }
      });
    } catch (error) {
      logger.error('Failed to get connector details:', error);
      res.status(500).json({ error: 'Failed to get connector details' });
    }
  });

  // List connections for organization
  router.get('/connections', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { connectorId } = req.query;
      const organizationId = req.user!.organizationId;

      const connections = await connectorManager.listConnections(
        organizationId,
        connectorId as string | undefined
      );

      res.json({ connections });
    } catch (error) {
      logger.error('Failed to list connections:', error);
      res.status(500).json({ error: 'Failed to list connections' });
    }
  });

  // Get connection details
  router.get('/connections/:connectionId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { connectionId } = req.params;
      const connection = await connectorManager.getConnection(connectionId);

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // Verify organization access
      if (connection.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Don't expose credentials
      const { credentials, ...safeConnection } = connection;
      
      res.json({ connection: safeConnection });
    } catch (error) {
      logger.error('Failed to get connection:', error);
      res.status(500).json({ error: 'Failed to get connection' });
    }
  });

  // Create new connection
  router.post('/connections', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = CreateConnectionSchema.parse(req.body);
      const organizationId = req.user!.organizationId;

      const connectionId = await connectorManager.createConnection(
        validated.connectorId,
        {
          ...validated,
          organizationId,
        }
      );

      res.status(201).json({
        connectionId,
        message: 'Connection created successfully'
      });
    } catch (error: any) {
      logger.error('Failed to create connection:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      
      res.status(500).json({ error: error.message || 'Failed to create connection' });
    }
  });

  // Test connection
  router.post('/connections/test', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { connectorId, credentials } = req.body;
      
      if (!connectorId || !credentials) {
        return res.status(400).json({ error: 'Missing connectorId or credentials' });
      }

      const connector = connectorManager.getConnector(connectorId);
      if (!connector) {
        return res.status(404).json({ error: 'Connector not found' });
      }

      const result = await connector.testConnection(credentials);
      res.json(result);
    } catch (error) {
      logger.error('Failed to test connection:', error);
      res.status(500).json({ error: 'Failed to test connection' });
    }
  });

  // Update connection
  router.put('/connections/:connectionId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { connectionId } = req.params;
      const updates = req.body;

      // Verify ownership
      const connection = await connectorManager.getConnection(connectionId);
      if (!connection || connection.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await connectorManager.updateConnection(connectionId, updates);
      res.json({ message: 'Connection updated successfully' });
    } catch (error) {
      logger.error('Failed to update connection:', error);
      res.status(500).json({ error: 'Failed to update connection' });
    }
  });

  // Delete connection
  router.delete('/connections/:connectionId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { connectionId } = req.params;

      // Verify ownership
      const connection = await connectorManager.getConnection(connectionId);
      if (!connection || connection.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await connectorManager.deleteConnection(connectionId);
      res.json({ message: 'Connection deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete connection:', error);
      res.status(500).json({ error: 'Failed to delete connection' });
    }
  });

  // Execute operation
  router.post(
    '/connections/:connectionId/execute',
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { connectionId } = req.params;
        const validated = ExecuteOperationSchema.parse(req.body);

        // Verify ownership
        const connection = await connectorManager.getConnection(connectionId);
        if (!connection || connection.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const result = await connectorManager.execute(
          connection.connectorId,
          connectionId,
          validated.operation,
          validated.params
        );

        res.json(result);
      } catch (error: any) {
        logger.error('Failed to execute operation:', error);
        
        if (error.name === 'ZodError') {
          return res.status(400).json({ error: 'Invalid request data', details: error.errors });
        }
        
        res.status(500).json({ error: error.message || 'Failed to execute operation' });
      }
    }
  );

  // Batch execute
  router.post(
    '/connections/:connectionId/batch',
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { connectionId } = req.params;
        const { operation, data, options } = req.body;

        // Verify ownership
        const connection = await connectorManager.getConnection(connectionId);
        if (!connection || connection.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const connector = connectorManager.getConnector(connection.connectorId);
        if (!connector) {
          return res.status(404).json({ error: 'Connector not found' });
        }

        const results = await connector.executeBatch(connectionId, {
          operation,
          data,
          options,
        });

        res.json({ results });
      } catch (error) {
        logger.error('Failed to execute batch operation:', error);
        res.status(500).json({ error: 'Failed to execute batch operation' });
      }
    }
  );

  // Get usage statistics
  router.get('/usage', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;
      const { connectorId } = req.query;

      const usage = await connectorManager.getUsageStatistics(
        organizationId,
        connectorId as string | undefined
      );

      res.json({ usage });
    } catch (error) {
      logger.error('Failed to get usage statistics:', error);
      res.status(500).json({ error: 'Failed to get usage statistics' });
    }
  });

  // Generate usage report
  router.post('/usage/report', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = GenerateUsageReportSchema.parse(req.body);
      const organizationId = req.user!.organizationId;

      // Get usage data
      const usage = await connectorManager.getUsageStatistics(
        organizationId,
        validated.connectorId
      );

      // Get connections
      const connections = await connectorManager.listConnections(
        organizationId,
        validated.connectorId
      );

      // Calculate detailed metrics
      const report = {
        organizationId,
        generatedAt: new Date().toISOString(),
        period: {
          start: validated.startDate,
          end: validated.endDate,
        },
        summary: {
          totalConnections: connections.length,
          activeConnections: connections.filter(c => c.lastUsed).length,
          totalApiCalls: usage.reduce((sum, u) => sum + u.apiCallsMonth, 0),
          totalErrors: usage.reduce((sum, u) => sum + u.errors24h, 0),
        },
        connectorUsage: usage.map(u => ({
          connectorId: u.connectorId,
          connectionCount: u.connectionCount,
          apiCallsToday: u.apiCallsToday,
          apiCallsMonth: u.apiCallsMonth,
          errors24h: u.errors24h,
          lastUsed: u.lastUsed,
          errorRate: u.apiCallsToday > 0 ? (u.errors24h / u.apiCallsToday * 100).toFixed(2) + '%' : '0%',
        })),
        connectionDetails: connections.map(c => ({
          id: c.id,
          name: c.name,
          connectorId: c.connectorId,
          createdAt: c.createdAt,
          lastUsed: c.lastUsed,
        })),
      };

      // Format response based on requested format
      if (validated.format === 'csv') {
        // Convert to CSV
        const csv = convertToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=usage-report.csv');
        res.send(csv);
      } else if (validated.format === 'pdf') {
        // For PDF, we'd integrate a PDF generation library
        // For now, return JSON with a note
        res.json({
          ...report,
          note: 'PDF generation will be implemented with a PDF library',
        });
      } else {
        res.json(report);
      }
    } catch (error: any) {
      logger.error('Failed to generate usage report:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      
      res.status(500).json({ error: 'Failed to generate usage report' });
    }
  });

  // Health check
  router.get('/health', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const health = await connectorManager.healthCheck();
      res.json({ health });
    } catch (error) {
      logger.error('Failed to get health status:', error);
      res.status(500).json({ error: 'Failed to get health status' });
    }
  });

  // Salesforce-specific routes
  router.get(
    '/connectors/salesforce/:connectionId/objects',
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { connectionId } = req.params;

        // Verify ownership
        const connection = await connectorManager.getConnection(connectionId);
        if (!connection || connection.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const salesforce = connectorManager.getConnector('salesforce') as any;
        const objects = await salesforce.getAvailableObjects(connectionId);

        res.json({ objects });
      } catch (error) {
        logger.error('Failed to get Salesforce objects:', error);
        res.status(500).json({ error: 'Failed to get Salesforce objects' });
      }
    }
  );

  router.get(
    '/connectors/salesforce/:connectionId/objects/:objectName/fields',
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { connectionId, objectName } = req.params;

        // Verify ownership
        const connection = await connectorManager.getConnection(connectionId);
        if (!connection || connection.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const salesforce = connectorManager.getConnector('salesforce') as any;
        const fields = await salesforce.getObjectFields(connectionId, objectName);

        res.json({ fields });
      } catch (error) {
        logger.error('Failed to get Salesforce object fields:', error);
        res.status(500).json({ error: 'Failed to get Salesforce object fields' });
      }
    }
  );

  // SAP-specific routes
  router.get(
    '/connectors/sap/:connectionId/rfcs',
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { connectionId } = req.params;
        const { pattern = '*' } = req.query;

        // Verify ownership
        const connection = await connectorManager.getConnection(connectionId);
        if (!connection || connection.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const sap = connectorManager.getConnector('sap') as any;
        const rfcs = await sap.getAvailableRFCs(connectionId, pattern as string);

        res.json({ rfcs });
      } catch (error) {
        logger.error('Failed to get SAP RFCs:', error);
        res.status(500).json({ error: 'Failed to get SAP RFCs' });
      }
    }
  );

  router.get(
    '/connectors/sap/:connectionId/rfcs/:functionName/interface',
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { connectionId, functionName } = req.params;

        // Verify ownership
        const connection = await connectorManager.getConnection(connectionId);
        if (!connection || connection.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const sap = connectorManager.getConnector('sap') as any;
        const rfcInterface = await sap.getRFCInterface(connectionId, functionName);

        res.json({ interface: rfcInterface });
      } catch (error) {
        logger.error('Failed to get SAP RFC interface:', error);
        res.status(500).json({ error: 'Failed to get SAP RFC interface' });
      }
    }
  );

  return router;
}

// Helper function to convert report to CSV
function convertToCSV(report: any): string {
  const lines: string[] = [];
  
  // Summary section
  lines.push('Summary');
  lines.push('Generated At,' + report.generatedAt);
  lines.push('Total Connections,' + report.summary.totalConnections);
  lines.push('Active Connections,' + report.summary.activeConnections);
  lines.push('Total API Calls,' + report.summary.totalApiCalls);
  lines.push('Total Errors,' + report.summary.totalErrors);
  lines.push('');
  
  // Connector usage
  lines.push('Connector Usage');
  lines.push('Connector ID,Connections,API Calls Today,API Calls Month,Errors 24h,Error Rate,Last Used');
  report.connectorUsage.forEach((usage: any) => {
    lines.push([
      usage.connectorId,
      usage.connectionCount,
      usage.apiCallsToday,
      usage.apiCallsMonth,
      usage.errors24h,
      usage.errorRate,
      usage.lastUsed || 'Never'
    ].join(','));
  });
  lines.push('');
  
  // Connection details
  lines.push('Connection Details');
  lines.push('ID,Name,Connector,Created At,Last Used');
  report.connectionDetails.forEach((conn: any) => {
    lines.push([
      conn.id,
      conn.name,
      conn.connectorId,
      conn.createdAt,
      conn.lastUsed || 'Never'
    ].join(','));
  });
  
  return lines.join('\n');
}