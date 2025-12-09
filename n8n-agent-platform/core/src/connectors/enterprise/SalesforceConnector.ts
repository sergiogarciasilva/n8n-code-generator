import { BaseEnterpriseConnector, ConnectorConfig, OperationResult } from './BaseEnterpriseConnector';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import jsforce from 'jsforce';
import { logger } from '../../utils/logger';
import { z } from 'zod';

// Validation schemas
const SalesforceCredentialsSchema = z.object({
  loginUrl: z.string().url().default('https://login.salesforce.com'),
  username: z.string().email(),
  password: z.string(),
  securityToken: z.string(),
  apiVersion: z.string().default('57.0'),
  sandbox: z.boolean().default(false)
});

const QueryOperationSchema = z.object({
  soql: z.string(),
  maxRecords: z.number().default(1000),
  includeDeleted: z.boolean().default(false)
});

const CreateOperationSchema = z.object({
  sobject: z.string(),
  records: z.array(z.record(z.any())),
  allOrNone: z.boolean().default(true)
});

const UpdateOperationSchema = z.object({
  sobject: z.string(),
  records: z.array(z.object({
    Id: z.string(),
    attributes: z.record(z.any()).optional()
  }).passthrough()),
  allOrNone: z.boolean().default(true)
});

const DeleteOperationSchema = z.object({
  sobject: z.string(),
  ids: z.array(z.string()),
  allOrNone: z.boolean().default(true)
});

export class SalesforceConnector extends BaseEnterpriseConnector {

  constructor(db: Pool, redis: RedisClientType) {
    const config: ConnectorConfig = {
      id: 'salesforce',
      name: 'Salesforce',
      type: 'salesforce',
      version: '1.0.0',
      icon: '☁️',
      description: 'Connect to Salesforce CRM for customer data management',
      documentationUrl: 'https://docs.n8n-agent-platform.com/connectors/salesforce',
      requiredScopes: [
        'api',
        'refresh_token',
        'offline_access'
      ],
      supportedOperations: [
        'query',
        'create',
        'update',
        'delete',
        'upsert',
        'describe',
        'bulk_create',
        'bulk_update',
        'bulk_delete',
        'search',
        'metadata'
      ],
      rateLimit: {
        requests: 15000,
        window: '24h'
      }
    };

    super(config, db, redis);
  }

  async testConnection(credentials: Record<string, any>): Promise<{
    success: boolean;
    message?: string;
    metadata?: Record<string, any>;
  }> {
    try {
      const validatedCreds = SalesforceCredentialsSchema.parse(credentials);
      
      const conn = new jsforce.Connection({
        loginUrl: validatedCreds.loginUrl,
        version: validatedCreds.apiVersion
      });

      await conn.login(
        validatedCreds.username,
        validatedCreds.password + validatedCreds.securityToken
      );

      // Get org info
      const identity = await conn.identity();
      const limits = await conn.limits();

      await conn.logout();

      return {
        success: true,
        message: 'Successfully connected to Salesforce',
        metadata: {
          organizationId: identity.organization_id,
          userId: identity.user_id,
          username: identity.username,
          apiLimit: limits.DailyApiRequests?.Max,
          apiUsed: limits.DailyApiRequests?.Remaining
        }
      };
    } catch (error: any) {
      logger.error('Salesforce connection test failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to connect to Salesforce'
      };
    }
  }

  protected async initializeConnection(
    connectionId: string,
    credentials: Record<string, any>
  ): Promise<void> {
    try {
      const validatedCreds = SalesforceCredentialsSchema.parse(credentials);
      
      const conn = new jsforce.Connection({
        loginUrl: validatedCreds.loginUrl,
        version: validatedCreds.apiVersion,
        maxRequest: 10 // Connection pool size
      });

      // Setup auto-refresh
      conn.on('refresh', (accessToken, res) => {
        logger.info(`Salesforce token refreshed for connection ${connectionId}`);
        this.emit('token:refreshed', { connectionId, accessToken });
      });

      await conn.login(
        validatedCreds.username,
        validatedCreds.password + validatedCreds.securityToken
      );

      this.connections.set(connectionId, conn);
      logger.info(`Initialized Salesforce connection ${connectionId}`);
    } catch (error) {
      logger.error(`Failed to initialize Salesforce connection ${connectionId}:`, error);
      throw error;
    }
  }

  protected async closeConnection(connectionId: string): Promise<void> {
    const conn = this.connections.get(connectionId) as jsforce.Connection;
    if (conn) {
      try {
        await conn.logout();
      } catch (error) {
        logger.warn(`Error logging out Salesforce connection ${connectionId}:`, error);
      }
      this.connections.delete(connectionId);
    }
  }

  async execute(
    connectionId: string,
    operation: string,
    params: Record<string, any>
  ): Promise<OperationResult> {
    const startTime = Date.now();

    try {
      // Check rate limit
      const canProceed = await this.checkRateLimit(connectionId);
      if (!canProceed) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'API rate limit exceeded. Please try again later.'
          }
        };
      }

      const conn = this.connections.get(connectionId) as jsforce.Connection;
      if (!conn) {
        throw new Error('Connection not found. Please initialize the connection first.');
      }

      let result: any;

      switch (operation) {
        case 'query':
          result = await this.executeQuery(conn, params);
          break;

        case 'create':
          result = await this.executeCreate(conn, params);
          break;

        case 'update':
          result = await this.executeUpdate(conn, params);
          break;

        case 'delete':
          result = await this.executeDelete(conn, params);
          break;

        case 'upsert':
          result = await this.executeUpsert(conn, params);
          break;

        case 'describe':
          result = await this.executeDescribe(conn, params);
          break;

        case 'bulk_create':
          result = await this.executeBulkCreate(conn, params);
          break;

        case 'bulk_update':
          result = await this.executeBulkUpdate(conn, params);
          break;

        case 'bulk_delete':
          result = await this.executeBulkDelete(conn, params);
          break;

        case 'search':
          result = await this.executeSearch(conn, params);
          break;

        case 'metadata':
          result = await this.executeMetadata(conn, params);
          break;

        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: result,
        metadata: {
          duration,
          apiCalls: 1,
          bytesTransferred: JSON.stringify(result).length
        }
      };
    } catch (error: any) {
      logger.error(`Salesforce operation ${operation} failed:`, error);

      return {
        success: false,
        error: {
          code: error.errorCode || 'OPERATION_FAILED',
          message: error.message,
          details: error
        },
        metadata: {
          duration: Date.now() - startTime,
          apiCalls: 1,
          bytesTransferred: 0
        }
      };
    }
  }

  private async executeQuery(conn: jsforce.Connection, params: any): Promise<any> {
    const validated = QueryOperationSchema.parse(params);
    
    const query = conn.query(validated.soql)
      .maxFetch(validated.maxRecords);

    if (validated.includeDeleted) {
      query.include('deleted');
    }

    const records = await query.run();
    
    return {
      totalSize: records.totalSize,
      done: records.done,
      records: records.records
    };
  }

  private async executeCreate(conn: jsforce.Connection, params: any): Promise<any> {
    const validated = CreateOperationSchema.parse(params);
    
    const results = await conn.sobject(validated.sobject)
      .create(validated.records, { allOrNone: validated.allOrNone });

    return Array.isArray(results) ? results : [results];
  }

  private async executeUpdate(conn: jsforce.Connection, params: any): Promise<any> {
    const validated = UpdateOperationSchema.parse(params);
    
    const results = await conn.sobject(validated.sobject)
      .update(validated.records, { allOrNone: validated.allOrNone });

    return Array.isArray(results) ? results : [results];
  }

  private async executeDelete(conn: jsforce.Connection, params: any): Promise<any> {
    const validated = DeleteOperationSchema.parse(params);
    
    const results = await conn.sobject(validated.sobject)
      .destroy(validated.ids);

    return Array.isArray(results) ? results : [results];
  }

  private async executeUpsert(conn: jsforce.Connection, params: any): Promise<any> {
    const { sobject, records, externalIdField, allOrNone = true } = params;
    
    const results = await conn.sobject(sobject)
      .upsert(records, externalIdField, { allOrNone });

    return Array.isArray(results) ? results : [results];
  }

  private async executeDescribe(conn: jsforce.Connection, params: any): Promise<any> {
    const { sobject } = params;
    
    if (sobject) {
      return await conn.sobject(sobject).describe();
    } else {
      return await conn.describeGlobal();
    }
  }

  private async executeBulkCreate(conn: jsforce.Connection, params: any): Promise<any> {
    const { sobject, records, pollInterval = 5000, timeout = 600000 } = params;
    
    const job = conn.bulk.createJob(sobject, 'insert');
    const batch = job.createBatch();
    
    return new Promise((resolve, reject) => {
      batch.execute(records);
      
      batch.on('error', reject);
      batch.on('queue', (batchInfo) => {
        logger.info(`Bulk create job queued: ${batchInfo.id}`);
        batch.poll(pollInterval, timeout);
      });
      
      batch.on('response', (results) => {
        resolve({
          jobId: (job as any).id,
          batchId: (batch as any).id,
          results: Array.isArray(results) ? results : [results]
        });
      });
    });
  }

  private async executeBulkUpdate(conn: jsforce.Connection, params: any): Promise<any> {
    const { sobject, records, pollInterval = 5000, timeout = 600000 } = params;
    
    const job = conn.bulk.createJob(sobject, 'update');
    const batch = job.createBatch();
    
    return new Promise((resolve, reject) => {
      batch.execute(records);
      
      batch.on('error', reject);
      batch.on('queue', (batchInfo) => {
        logger.info(`Bulk update job queued: ${batchInfo.id}`);
        batch.poll(pollInterval, timeout);
      });
      
      batch.on('response', (results) => {
        resolve({
          jobId: (job as any).id,
          batchId: (batch as any).id,
          results: Array.isArray(results) ? results : [results]
        });
      });
    });
  }

  private async executeBulkDelete(conn: jsforce.Connection, params: any): Promise<any> {
    const { sobject, ids, pollInterval = 5000, timeout = 600000 } = params;
    
    const job = conn.bulk.createJob(sobject, 'delete');
    const batch = job.createBatch();
    
    return new Promise((resolve, reject) => {
      batch.execute(ids.map((id: string) => ({ Id: id })));
      
      batch.on('error', reject);
      batch.on('queue', (batchInfo) => {
        logger.info(`Bulk delete job queued: ${batchInfo.id}`);
        batch.poll(pollInterval, timeout);
      });
      
      batch.on('response', (results) => {
        resolve({
          jobId: (job as any).id,
          batchId: (batch as any).id,
          results: Array.isArray(results) ? results : [results]
        });
      });
    });
  }

  private async executeSearch(conn: jsforce.Connection, params: any): Promise<any> {
    const { sosl, includeDeleted = false } = params;
    
    const results = await conn.search(sosl);
    
    return {
      searchRecords: results.searchRecords,
      totalSize: results.searchRecords.length
    };
  }

  private async executeMetadata(conn: jsforce.Connection, params: any): Promise<any> {
    const { types, apiVersion } = params;
    
    const metadata = conn.metadata;
    
    if (types) {
      return await metadata.list(types, apiVersion);
    } else {
      return await metadata.describe(apiVersion);
    }
  }

  async getOperations(): Promise<Array<{
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
  }>> {
    return [
      {
        name: 'query',
        description: 'Execute a SOQL query',
        category: 'Read',
        parameters: [
          {
            name: 'soql',
            type: 'string',
            required: true,
            description: 'SOQL query string'
          },
          {
            name: 'maxRecords',
            type: 'number',
            required: false,
            description: 'Maximum records to fetch',
            default: 1000
          },
          {
            name: 'includeDeleted',
            type: 'boolean',
            required: false,
            description: 'Include deleted records',
            default: false
          }
        ],
        returns: {
          type: 'object',
          description: 'Query results with records array'
        }
      },
      {
        name: 'create',
        description: 'Create one or more records',
        category: 'Write',
        parameters: [
          {
            name: 'sobject',
            type: 'string',
            required: true,
            description: 'Salesforce object type (e.g., Account, Contact)'
          },
          {
            name: 'records',
            type: 'array',
            required: true,
            description: 'Array of records to create'
          },
          {
            name: 'allOrNone',
            type: 'boolean',
            required: false,
            description: 'Roll back all records if any fail',
            default: true
          }
        ],
        returns: {
          type: 'array',
          description: 'Array of create results with success status and ids'
        }
      },
      {
        name: 'update',
        description: 'Update one or more records',
        category: 'Write',
        parameters: [
          {
            name: 'sobject',
            type: 'string',
            required: true,
            description: 'Salesforce object type'
          },
          {
            name: 'records',
            type: 'array',
            required: true,
            description: 'Array of records with Id field'
          },
          {
            name: 'allOrNone',
            type: 'boolean',
            required: false,
            description: 'Roll back all records if any fail',
            default: true
          }
        ],
        returns: {
          type: 'array',
          description: 'Array of update results'
        }
      },
      {
        name: 'delete',
        description: 'Delete one or more records',
        category: 'Write',
        parameters: [
          {
            name: 'sobject',
            type: 'string',
            required: true,
            description: 'Salesforce object type'
          },
          {
            name: 'ids',
            type: 'array',
            required: true,
            description: 'Array of record IDs to delete'
          },
          {
            name: 'allOrNone',
            type: 'boolean',
            required: false,
            description: 'Roll back all records if any fail',
            default: true
          }
        ],
        returns: {
          type: 'array',
          description: 'Array of delete results'
        }
      },
      {
        name: 'upsert',
        description: 'Insert or update records based on external ID',
        category: 'Write',
        parameters: [
          {
            name: 'sobject',
            type: 'string',
            required: true,
            description: 'Salesforce object type'
          },
          {
            name: 'records',
            type: 'array',
            required: true,
            description: 'Array of records to upsert'
          },
          {
            name: 'externalIdField',
            type: 'string',
            required: true,
            description: 'External ID field name'
          },
          {
            name: 'allOrNone',
            type: 'boolean',
            required: false,
            description: 'Roll back all records if any fail',
            default: true
          }
        ],
        returns: {
          type: 'array',
          description: 'Array of upsert results'
        }
      },
      {
        name: 'bulk_create',
        description: 'Bulk create large number of records',
        category: 'Bulk',
        parameters: [
          {
            name: 'sobject',
            type: 'string',
            required: true,
            description: 'Salesforce object type'
          },
          {
            name: 'records',
            type: 'array',
            required: true,
            description: 'Array of records (up to 10,000)'
          },
          {
            name: 'pollInterval',
            type: 'number',
            required: false,
            description: 'Poll interval in milliseconds',
            default: 5000
          },
          {
            name: 'timeout',
            type: 'number',
            required: false,
            description: 'Timeout in milliseconds',
            default: 600000
          }
        ],
        returns: {
          type: 'object',
          description: 'Bulk job results with job and batch IDs'
        }
      }
    ];
  }

  /**
   * Get Salesforce object fields
   */
  async getObjectFields(
    connectionId: string,
    objectName: string
  ): Promise<any> {
    const conn = this.connections.get(connectionId) as jsforce.Connection;
    if (!conn) {
      throw new Error('Connection not found');
    }

    const describe = await conn.sobject(objectName).describe();
    
    return describe.fields.map(field => ({
      name: field.name,
      label: field.label,
      type: field.type,
      required: !field.nillable && !field.defaultedOnCreate,
      updateable: field.updateable,
      createable: field.createable,
      picklistValues: field.picklistValues
    }));
  }

  /**
   * Get available Salesforce objects
   */
  async getAvailableObjects(connectionId: string): Promise<any> {
    const conn = this.connections.get(connectionId) as jsforce.Connection;
    if (!conn) {
      throw new Error('Connection not found');
    }

    const globalDescribe = await conn.describeGlobal();
    
    return globalDescribe.sobjects
      .filter(obj => obj.queryable)
      .map(obj => ({
        name: obj.name,
        label: obj.label,
        custom: obj.custom,
        createable: obj.createable,
        updateable: obj.updateable,
        deleteable: obj.deletable
      }));
  }
}