import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { BaseEnterpriseConnector } from './enterprise/BaseEnterpriseConnector';
import { SalesforceConnector } from './enterprise/SalesforceConnector';
import { SAPConnector } from './enterprise/SAPConnector';
import { logger } from '../utils/logger';

export interface ConnectorRegistration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'crm' | 'erp' | 'hr' | 'finance' | 'custom';
  enabled: boolean;
  configSchema?: any;
  documentationUrl?: string;
}

export interface ConnectorUsage {
  connectorId: string;
  organizationId: string;
  connectionCount: number;
  apiCallsToday: number;
  apiCallsMonth: number;
  lastUsed?: Date;
  errors24h: number;
}

export class EnterpriseConnectorManager extends EventEmitter {
  private connectors: Map<string, BaseEnterpriseConnector> = new Map();
  private db: Pool;
  private redis: RedisClientType;
  private initialized: boolean = false;

  constructor(db: Pool, redis: RedisClientType) {
    super();
    this.db = db;
    this.redis = redis;
  }

  /**
   * Initialize the connector manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info('Initializing Enterprise Connector Manager');

      // Register built-in connectors
      await this.registerBuiltInConnectors();

      // Load custom connectors from database
      await this.loadCustomConnectors();

      // Start usage tracking
      this.startUsageTracking();

      this.initialized = true;
      logger.info('Enterprise Connector Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Enterprise Connector Manager:', error);
      throw error;
    }
  }

  /**
   * Register built-in connectors
   */
  private async registerBuiltInConnectors(): Promise<void> {
    // Salesforce
    const salesforce = new SalesforceConnector(this.db, this.redis);
    await salesforce.initialize();
    this.connectors.set('salesforce', salesforce);

    // SAP
    const sap = new SAPConnector(this.db, this.redis);
    await sap.initialize();
    this.connectors.set('sap', sap);

    // Register in database
    const builtInConnectors: ConnectorRegistration[] = [
      {
        id: 'salesforce',
        name: 'Salesforce',
        description: 'Connect to Salesforce CRM for customer data management',
        icon: '☁️',
        category: 'crm',
        enabled: true,
        documentationUrl: 'https://docs.n8n-agent-platform.com/connectors/salesforce'
      },
      {
        id: 'sap',
        name: 'SAP',
        description: 'Connect to SAP ERP systems for enterprise resource planning',
        icon: '🏢',
        category: 'erp',
        enabled: true,
        documentationUrl: 'https://docs.n8n-agent-platform.com/connectors/sap'
      }
    ];

    for (const connector of builtInConnectors) {
      await this.registerConnector(connector);
    }
  }

  /**
   * Load custom connectors
   */
  private async loadCustomConnectors(): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT * FROM enterprise_connectors WHERE type = 'custom' AND enabled = true`
      );

      for (const row of result.rows) {
        // Load custom connector implementation
        // This would dynamically load custom connector modules
        logger.info(`Loading custom connector: ${row.name}`);
      }
    } catch (error) {
      logger.error('Failed to load custom connectors:', error);
    }
  }

  /**
   * Register a connector
   */
  async registerConnector(registration: ConnectorRegistration): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO enterprise_connectors 
         (id, name, description, icon, category, enabled, config_schema, documentation_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         icon = EXCLUDED.icon,
         category = EXCLUDED.category,
         enabled = EXCLUDED.enabled,
         config_schema = EXCLUDED.config_schema,
         documentation_url = EXCLUDED.documentation_url,
         updated_at = CURRENT_TIMESTAMP`,
        [
          registration.id,
          registration.name,
          registration.description,
          registration.icon,
          registration.category,
          registration.enabled,
          JSON.stringify(registration.configSchema || {}),
          registration.documentationUrl
        ]
      );

      logger.info(`Registered connector: ${registration.name}`);
      this.emit('connector:registered', registration);
    } catch (error) {
      logger.error(`Failed to register connector ${registration.name}:`, error);
      throw error;
    }
  }

  /**
   * Get all available connectors
   */
  async getAvailableConnectors(): Promise<ConnectorRegistration[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM enterprise_connectors WHERE enabled = true ORDER BY category, name`
      );

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        icon: row.icon,
        category: row.category,
        enabled: row.enabled,
        configSchema: row.config_schema,
        documentationUrl: row.documentation_url
      }));
    } catch (error) {
      logger.error('Failed to get available connectors:', error);
      throw error;
    }
  }

  /**
   * Get connector by ID
   */
  getConnector(connectorId: string): BaseEnterpriseConnector | undefined {
    return this.connectors.get(connectorId);
  }

  /**
   * Create a connection
   */
  async createConnection(
    connectorId: string,
    config: any
  ): Promise<string> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new Error(`Connector ${connectorId} not found`);
    }

    try {
      const connectionId = await connector.createConnection(config);
      
      // Track usage
      await this.trackUsage(connectorId, config.organizationId, 'connection_created');

      return connectionId;
    } catch (error) {
      logger.error(`Failed to create connection for ${connectorId}:`, error);
      throw error;
    }
  }

  /**
   * Execute connector operation
   */
  async execute(
    connectorId: string,
    connectionId: string,
    operation: string,
    params: any
  ): Promise<any> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new Error(`Connector ${connectorId} not found`);
    }

    try {
      // Track API call
      await this.trackUsage(connectorId, null, 'api_call');

      const result = await connector.execute(connectionId, operation, params);

      // Track success/failure
      if (result.success) {
        await this.trackUsage(connectorId, null, 'api_success');
      } else {
        await this.trackUsage(connectorId, null, 'api_error');
      }

      return result;
    } catch (error) {
      await this.trackUsage(connectorId, null, 'api_error');
      throw error;
    }
  }

  /**
   * Get connector operations
   */
  async getConnectorOperations(connectorId: string): Promise<any> {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new Error(`Connector ${connectorId} not found`);
    }

    return await connector.getOperations();
  }

  /**
   * List connections for organization
   */
  async listConnections(
    organizationId: string,
    connectorId?: string
  ): Promise<any[]> {
    try {
      let query = `
        SELECT 
          ec.*,
          c.name as connector_name,
          c.icon as connector_icon,
          c.category as connector_category
        FROM enterprise_connections ec
        JOIN enterprise_connectors c ON ec.connector_id = c.id
        WHERE ec.organization_id = $1
      `;
      const params: any[] = [organizationId];

      if (connectorId) {
        query += ` AND ec.connector_id = $2`;
        params.push(connectorId);
      }

      query += ` ORDER BY ec.created_at DESC`;

      const result = await this.db.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        connectorId: row.connector_id,
        connectorName: row.connector_name,
        connectorIcon: row.connector_icon,
        connectorCategory: row.connector_category,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsed: row.last_used
      }));
    } catch (error) {
      logger.error('Failed to list connections:', error);
      throw error;
    }
  }

  /**
   * Get connection details
   */
  async getConnection(connectionId: string): Promise<any> {
    try {
      const result = await this.db.query(
        `SELECT 
          ec.*,
          c.name as connector_name,
          c.icon as connector_icon
        FROM enterprise_connections ec
        JOIN enterprise_connectors c ON ec.connector_id = c.id
        WHERE ec.id = $1`,
        [connectionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const connection = result.rows[0];
      return {
        id: connection.id,
        name: connection.name,
        connectorId: connection.connector_id,
        connectorName: connection.connector_name,
        connectorIcon: connection.connector_icon,
        metadata: connection.metadata,
        createdAt: connection.created_at,
        updatedAt: connection.updated_at,
        lastUsed: connection.last_used
      };
    } catch (error) {
      logger.error('Failed to get connection:', error);
      throw error;
    }
  }

  /**
   * Update connection
   */
  async updateConnection(
    connectionId: string,
    updates: any
  ): Promise<void> {
    // Get connector ID first
    const connection = await this.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const connector = this.connectors.get(connection.connectorId);
    if (!connector) {
      throw new Error(`Connector ${connection.connectorId} not found`);
    }

    await connector.updateConnection(connectionId, updates);
  }

  /**
   * Delete connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    // Get connector ID first
    const connection = await this.getConnection(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    const connector = this.connectors.get(connection.connectorId);
    if (!connector) {
      throw new Error(`Connector ${connection.connectorId} not found`);
    }

    await connector.deleteConnection(connectionId);
  }

  /**
   * Get usage statistics
   */
  async getUsageStatistics(
    organizationId: string,
    connectorId?: string
  ): Promise<ConnectorUsage[]> {
    try {
      const usage: ConnectorUsage[] = [];

      // Get all connectors or specific one
      const connectorIds = connectorId 
        ? [connectorId] 
        : Array.from(this.connectors.keys());

      for (const id of connectorIds) {
        // Get connection count
        const connCountResult = await this.db.query(
          `SELECT COUNT(*) as count 
           FROM enterprise_connections 
           WHERE organization_id = $1 AND connector_id = $2`,
          [organizationId, id]
        );

        // Get API calls from Redis
        const todayKey = `usage:${id}:${organizationId}:${new Date().toISOString().split('T')[0]}`;
        const monthKey = `usage:${id}:${organizationId}:${new Date().toISOString().slice(0, 7)}`;
        
        const apiCallsToday = parseInt(await this.redis.get(`${todayKey}:calls`) || '0');
        const apiCallsMonth = parseInt(await this.redis.get(`${monthKey}:calls`) || '0');
        const errors24h = parseInt(await this.redis.get(`${todayKey}:errors`) || '0');

        // Get last used
        const lastUsedResult = await this.db.query(
          `SELECT MAX(last_used) as last_used 
           FROM enterprise_connections 
           WHERE organization_id = $1 AND connector_id = $2`,
          [organizationId, id]
        );

        usage.push({
          connectorId: id,
          organizationId,
          connectionCount: parseInt(connCountResult.rows[0].count),
          apiCallsToday,
          apiCallsMonth,
          lastUsed: lastUsedResult.rows[0].last_used,
          errors24h
        });
      }

      return usage;
    } catch (error) {
      logger.error('Failed to get usage statistics:', error);
      throw error;
    }
  }

  /**
   * Track usage
   */
  private async trackUsage(
    connectorId: string,
    organizationId: string | null,
    event: string
  ): Promise<void> {
    try {
      const date = new Date();
      const dayKey = date.toISOString().split('T')[0];
      const monthKey = date.toISOString().slice(0, 7);

      // Track global usage
      await this.redis.incr(`usage:${connectorId}:global:${dayKey}:${event}`);
      await this.redis.incr(`usage:${connectorId}:global:${monthKey}:${event}`);

      // Track org-specific usage if provided
      if (organizationId) {
        await this.redis.incr(`usage:${connectorId}:${organizationId}:${dayKey}:${event}`);
        await this.redis.incr(`usage:${connectorId}:${organizationId}:${monthKey}:${event}`);
      }

      // Set expiry (90 days for daily, 2 years for monthly)
      await this.redis.expire(`usage:${connectorId}:global:${dayKey}:${event}`, 7776000);
      await this.redis.expire(`usage:${connectorId}:global:${monthKey}:${event}`, 63072000);
    } catch (error) {
      logger.error('Failed to track usage:', error);
    }
  }

  /**
   * Start usage tracking
   */
  private startUsageTracking(): void {
    // Update last used timestamp every hour
    setInterval(async () => {
      try {
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 3600000);

        await this.db.query(
          `UPDATE enterprise_connections 
           SET last_used = CURRENT_TIMESTAMP 
           WHERE id IN (
             SELECT DISTINCT connection_id 
             FROM enterprise_connection_logs 
             WHERE created_at >= $1
           )`,
          [hourAgo]
        );
      } catch (error) {
        logger.error('Failed to update last used timestamps:', error);
      }
    }, 3600000); // Every hour
  }

  /**
   * Health check for all connectors
   */
  async healthCheck(): Promise<any> {
    const health: any = {};

    for (const [id, connector] of this.connectors) {
      try {
        // Get connector info
        const info = connector.getInfo();
        
        // Get connection count
        const connResult = await this.db.query(
          `SELECT COUNT(*) as count FROM enterprise_connections WHERE connector_id = $1`,
          [id]
        );

        // Get error rate
        const errorKey = `usage:${id}:global:${new Date().toISOString().split('T')[0]}:errors`;
        const callsKey = `usage:${id}:global:${new Date().toISOString().split('T')[0]}:calls`;
        
        const errors = parseInt(await this.redis.get(errorKey) || '0');
        const calls = parseInt(await this.redis.get(callsKey) || '0');
        const errorRate = calls > 0 ? (errors / calls) * 100 : 0;

        health[id] = {
          name: info.name,
          status: 'healthy',
          connections: parseInt(connResult.rows[0].count),
          errorRate: errorRate.toFixed(2) + '%',
          apiCallsToday: calls
        };
      } catch (error: any) {
        health[id] = {
          status: 'unhealthy',
          error: error?.message || 'Unknown error'
        };
      }
    }

    return health;
  }

  /**
   * Shutdown all connectors
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Enterprise Connector Manager');

    for (const [id, connector] of this.connectors) {
      try {
        await connector.shutdown();
        logger.info(`Shut down connector: ${id}`);
      } catch (error) {
        logger.error(`Error shutting down connector ${id}:`, error);
      }
    }

    this.connectors.clear();
    this.removeAllListeners();
  }
}