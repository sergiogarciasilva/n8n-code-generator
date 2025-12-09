import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import crypto from 'crypto';

export interface ConnectorConfig {
  id: string;
  name: string;
  type: 'sap' | 'salesforce' | 'dynamics365' | 'oracle' | 'custom';
  version: string;
  icon: string;
  description: string;
  documentationUrl: string;
  requiredScopes: string[];
  supportedOperations: string[];
  rateLimit?: {
    requests: number;
    window: string;
  };
}

export interface ConnectionConfig {
  id: string;
  connectorId: string;
  organizationId: string;
  name: string;
  credentials: Record<string, any>;
  metadata?: Record<string, any>;
  testConnection?: boolean;
  encryptionKey?: string;
}

export interface OperationResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    duration: number;
    apiCalls: number;
    bytesTransferred: number;
  };
}

export interface DataMapping {
  sourceField: string;
  targetField: string;
  transformation?: 'uppercase' | 'lowercase' | 'date' | 'number' | 'boolean' | 'custom';
  customTransformation?: (value: any) => any;
  required?: boolean;
  defaultValue?: any;
}

export interface BatchOperation {
  operation: string;
  data: any[];
  options?: {
    batchSize?: number;
    parallel?: boolean;
    retryOnFailure?: boolean;
    continueOnError?: boolean;
  };
}

export abstract class BaseEnterpriseConnector extends EventEmitter {
  protected config: ConnectorConfig;
  protected db: Pool;
  protected redis: RedisClientType;
  protected connections: Map<string, any> = new Map();
  protected rateLimiters: Map<string, any> = new Map();

  constructor(config: ConnectorConfig, db: Pool, redis: RedisClientType) {
    super();
    this.config = config;
    this.db = db;
    this.redis = redis;
  }

  /**
   * Initialize the connector
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing ${this.config.name} connector`);
    await this.loadConnections();
    this.setupRateLimiters();
  }

  /**
   * Test connection with credentials
   */
  abstract testConnection(credentials: Record<string, any>): Promise<{
    success: boolean;
    message?: string;
    metadata?: Record<string, any>;
  }>;

  /**
   * Execute an operation
   */
  abstract execute(
    connectionId: string,
    operation: string,
    params: Record<string, any>
  ): Promise<OperationResult>;

  /**
   * Get available operations for this connector
   */
  abstract getOperations(): Promise<Array<{
    name: string;
    description: string;
    category: string;
    parameters: Array<{
      name: string;
      type: string;
      required: boolean;
      description: string;
      default?: any;
    }>;
    returns: {
      type: string;
      description: string;
    };
  }>>;

  /**
   * Create a new connection
   */
  async createConnection(config: ConnectionConfig): Promise<string> {
    try {
      // Test connection first
      const testResult = await this.testConnection(config.credentials);
      if (!testResult.success) {
        throw new Error(`Connection test failed: ${testResult.message}`);
      }

      // Encrypt credentials
      const encryptedCredentials = this.encryptCredentials(
        config.credentials,
        config.encryptionKey || this.generateEncryptionKey()
      );

      // Save to database
      const result = await this.db.query(
        `INSERT INTO enterprise_connections 
         (id, connector_id, organization_id, name, encrypted_credentials, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          config.id || this.generateId(),
          this.config.id,
          config.organizationId,
          config.name,
          encryptedCredentials,
          JSON.stringify(config.metadata || {})
        ]
      );

      const connectionId = result.rows[0].id;

      // Initialize connection
      await this.initializeConnection(connectionId, config.credentials);

      // Cache connection
      await this.cacheConnection(connectionId, config);

      this.emit('connection:created', {
        connectionId,
        connectorId: this.config.id,
        organizationId: config.organizationId
      });

      return connectionId;
    } catch (error) {
      logger.error(`Failed to create connection for ${this.config.name}:`, error);
      throw error;
    }
  }

  /**
   * Update connection
   */
  async updateConnection(
    connectionId: string,
    updates: Partial<ConnectionConfig>
  ): Promise<void> {
    try {
      const connection = await this.getConnection(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Test new credentials if provided
      if (updates.credentials) {
        const testResult = await this.testConnection(updates.credentials);
        if (!testResult.success) {
          throw new Error(`Connection test failed: ${testResult.message}`);
        }

        // Encrypt new credentials
        const encryptedCredentials = this.encryptCredentials(
          updates.credentials,
          connection.encryptionKey || ''
        );

        await this.db.query(
          `UPDATE enterprise_connections 
           SET encrypted_credentials = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [encryptedCredentials, connectionId]
        );

        // Reinitialize connection
        await this.initializeConnection(connectionId, updates.credentials);
      }

      // Update other fields
      if (updates.name || updates.metadata) {
        await this.db.query(
          `UPDATE enterprise_connections 
           SET name = COALESCE($1, name), 
               metadata = COALESCE($2, metadata),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [updates.name, JSON.stringify(updates.metadata), connectionId]
        );
      }

      // Update cache
      await this.cacheConnection(connectionId, { ...connection, ...updates });

      this.emit('connection:updated', { connectionId });
    } catch (error) {
      logger.error(`Failed to update connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Delete connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    try {
      // Close active connection
      await this.closeConnection(connectionId);

      // Delete from database
      await this.db.query(
        'DELETE FROM enterprise_connections WHERE id = $1',
        [connectionId]
      );

      // Remove from cache
      await this.redis.del(`connection:${connectionId}`);
      this.connections.delete(connectionId);

      this.emit('connection:deleted', { connectionId });
    } catch (error) {
      logger.error(`Failed to delete connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Get connection by ID
   */
  async getConnection(connectionId: string): Promise<ConnectionConfig | null> {
    try {
      // Check cache first
      const cached = await this.redis.get(`connection:${connectionId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Load from database
      const result = await this.db.query(
        `SELECT * FROM enterprise_connections WHERE id = $1`,
        [connectionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const connection = result.rows[0];
      const decryptedCredentials = this.decryptCredentials(
        connection.encrypted_credentials,
        connection.encryption_key
      );

      const config: ConnectionConfig = {
        id: connection.id,
        connectorId: connection.connector_id,
        organizationId: connection.organization_id,
        name: connection.name,
        credentials: decryptedCredentials,
        metadata: connection.metadata,
        encryptionKey: connection.encryption_key
      };

      // Cache for future use
      await this.cacheConnection(connectionId, config);

      return config;
    } catch (error) {
      logger.error(`Failed to get connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * List connections for an organization
   */
  async listConnections(organizationId: string): Promise<ConnectionConfig[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM enterprise_connections 
         WHERE organization_id = $1 AND connector_id = $2
         ORDER BY created_at DESC`,
        [organizationId, this.config.id]
      );

      return result.rows.map(row => ({
        id: row.id,
        connectorId: row.connector_id,
        organizationId: row.organization_id,
        name: row.name,
        credentials: {}, // Don't expose credentials in list
        metadata: row.metadata
      }));
    } catch (error) {
      logger.error(`Failed to list connections for org ${organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Execute batch operations
   */
  async executeBatch(
    connectionId: string,
    batch: BatchOperation
  ): Promise<OperationResult[]> {
    const results: OperationResult[] = [];
    const { operation, data, options = {} } = batch;
    const {
      batchSize = 100,
      parallel = false,
      retryOnFailure = true,
      continueOnError = false
    } = options;

    // Split data into batches
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    logger.info(
      `Executing batch operation ${operation} with ${batches.length} batches`
    );

    if (parallel) {
      // Execute batches in parallel
      const batchPromises = batches.map(async (batchData, index) => {
        try {
          const result = await this.execute(connectionId, operation, {
            data: batchData,
            batchIndex: index
          });
          return result;
        } catch (error: any) {
          if (!continueOnError) throw error;
          return {
            success: false,
            error: {
              code: 'BATCH_ERROR',
              message: error?.message || 'Unknown error',
              details: { batchIndex: index }
            }
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } else {
      // Execute batches sequentially
      for (let i = 0; i < batches.length; i++) {
        try {
          const result = await this.execute(connectionId, operation, {
            data: batches[i],
            batchIndex: i
          });
          results.push(result);
        } catch (error: any) {
          if (!continueOnError) throw error;
          results.push({
            success: false,
            error: {
              code: 'BATCH_ERROR',
              message: error?.message || 'Unknown error',
              details: { batchIndex: i }
            }
          });
        }
      }
    }

    return results;
  }

  /**
   * Map data between systems
   */
  protected mapData(
    data: Record<string, any>,
    mappings: DataMapping[]
  ): Record<string, any> {
    const mapped: Record<string, any> = {};

    for (const mapping of mappings) {
      let value = data[mapping.sourceField];

      // Apply transformation
      if (mapping.transformation) {
        value = this.transformValue(value, mapping.transformation);
      } else if (mapping.customTransformation) {
        value = mapping.customTransformation(value);
      }

      // Handle required fields
      if (mapping.required && (value === undefined || value === null)) {
        if (mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        } else {
          throw new Error(`Required field ${mapping.sourceField} is missing`);
        }
      }

      mapped[mapping.targetField] = value;
    }

    return mapped;
  }

  /**
   * Transform value based on type
   */
  protected transformValue(value: any, transformation: string): any {
    switch (transformation) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'date':
        return new Date(value).toISOString();
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      default:
        return value;
    }
  }

  /**
   * Handle rate limiting
   */
  protected async checkRateLimit(connectionId: string): Promise<boolean> {
    if (!this.config.rateLimit) return true;

    const key = `ratelimit:${this.config.id}:${connectionId}`;
    const { requests, window } = this.config.rateLimit;

    // Get current count
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      // Set expiry on first request
      const windowMs = this.parseWindow(window);
      await this.redis.expire(key, Math.floor(windowMs / 1000));
    }

    if (current > requests) {
      logger.warn(
        `Rate limit exceeded for ${this.config.name} connection ${connectionId}`
      );
      return false;
    }

    return true;
  }

  /**
   * Parse rate limit window
   */
  private parseWindow(window: string): number {
    const match = window.match(/(\d+)([smhd])/);
    if (!match) throw new Error(`Invalid rate limit window: ${window}`);

    const [, value, unit] = match;
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    return parseInt(value) * multipliers[unit as keyof typeof multipliers];
  }

  /**
   * Initialize connection (to be implemented by subclasses)
   */
  protected abstract initializeConnection(
    connectionId: string,
    credentials: Record<string, any>
  ): Promise<void>;

  /**
   * Close connection (to be implemented by subclasses)
   */
  protected abstract closeConnection(connectionId: string): Promise<void>;

  /**
   * Encrypt credentials
   */
  private encryptCredentials(
    credentials: Record<string, any>,
    key: string
  ): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'hex'), iv);

    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted
    });
  }

  /**
   * Decrypt credentials
   */
  private decryptCredentials(
    encryptedData: string,
    key: string
  ): Record<string, any> {
    const { iv, authTag, encrypted } = JSON.parse(encryptedData);
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Generate encryption key
   */
  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cache connection
   */
  private async cacheConnection(
    connectionId: string,
    config: ConnectionConfig
  ): Promise<void> {
    const ttl = 3600; // 1 hour
    await this.redis.setEx(
      `connection:${connectionId}`,
      ttl,
      JSON.stringify(config)
    );
  }

  /**
   * Load all connections on startup
   */
  private async loadConnections(): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT id FROM enterprise_connections WHERE connector_id = $1`,
        [this.config.id]
      );

      for (const row of result.rows) {
        const connection = await this.getConnection(row.id);
        if (connection) {
          await this.initializeConnection(row.id, connection.credentials);
        }
      }

      logger.info(
        `Loaded ${result.rows.length} connections for ${this.config.name}`
      );
    } catch (error) {
      logger.error(`Failed to load connections for ${this.config.name}:`, error);
    }
  }

  /**
   * Setup rate limiters
   */
  private setupRateLimiters(): void {
    if (!this.config.rateLimit) return;

    // Rate limiter setup would go here
    logger.info(`Rate limiting configured for ${this.config.name}`);
  }

  /**
   * Get connector info
   */
  getInfo(): ConnectorConfig {
    return this.config;
  }

  /**
   * Shutdown connector
   */
  async shutdown(): Promise<void> {
    logger.info(`Shutting down ${this.config.name} connector`);

    // Close all connections
    for (const connectionId of this.connections.keys()) {
      await this.closeConnection(connectionId);
    }

    this.connections.clear();
    this.removeAllListeners();
  }
}