import { BaseEnterpriseConnector, ConnectorConfig, OperationResult } from './BaseEnterpriseConnector';
import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { parseStringPromise, Builder } from 'xml2js';

// Validation schemas
const SAPCredentialsSchema = z.object({
  host: z.string(),
  port: z.number().default(443),
  client: z.string(),
  username: z.string(),
  password: z.string(),
  language: z.string().default('EN'),
  protocol: z.enum(['http', 'https']).default('https'),
  sapRouter: z.string().optional(),
  systemNumber: z.string().default('00'),
  authenticationType: z.enum(['basic', 'oauth2', 'x509']).default('basic'),
  oauth2: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    tokenUrl: z.string(),
    scope: z.string().optional()
  }).optional()
});

const RFCCallSchema = z.object({
  functionName: z.string(),
  importParams: z.record(z.any()).default({}),
  tableParams: z.record(z.array(z.any())).default({}),
  changingParams: z.record(z.any()).default({})
});

const ODataQuerySchema = z.object({
  service: z.string(),
  entity: z.string(),
  filter: z.string().optional(),
  select: z.array(z.string()).optional(),
  expand: z.array(z.string()).optional(),
  top: z.number().optional(),
  skip: z.number().optional(),
  orderBy: z.string().optional()
});

const BAPICallSchema = z.object({
  bapiName: z.string(),
  parameters: z.record(z.any()).default({}),
  commit: z.boolean().default(true),
  waitForCommit: z.boolean().default(false)
});

interface SAPConnection {
  axios: AxiosInstance;
  credentials: z.infer<typeof SAPCredentialsSchema>;
  token?: string;
  tokenExpiry?: Date;
}

export class SAPConnector extends BaseEnterpriseConnector {
  private sapConnections: Map<string, SAPConnection> = new Map();

  constructor(db: Pool, redis: RedisClientType) {
    const config: ConnectorConfig = {
      id: 'sap',
      name: 'SAP',
      type: 'sap',
      version: '1.0.0',
      icon: '🏢',
      description: 'Connect to SAP ERP systems for enterprise resource planning',
      documentationUrl: 'https://docs.n8n-agent-platform.com/connectors/sap',
      requiredScopes: [
        'rfc_access',
        'odata_access',
        'bapi_access'
      ],
      supportedOperations: [
        'rfc_call',
        'odata_query',
        'odata_create',
        'odata_update',
        'odata_delete',
        'bapi_call',
        'idoc_send',
        'table_read',
        'report_execute',
        'batch_input'
      ],
      rateLimit: {
        requests: 1000,
        window: '1m'
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
      const validatedCreds = SAPCredentialsSchema.parse(credentials);
      
      // Create test connection
      const testConn = await this.createSAPConnection(validatedCreds);

      // Test with a simple RFC call (RFC_SYSTEM_INFO)
      const response = await testConn.axios.post('/sap/bc/rest/rfc/RFC_SYSTEM_INFO', {
        importParams: {}
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return {
        success: true,
        message: 'Successfully connected to SAP system',
        metadata: {
          systemId: response.data.EXPORT?.RFCSI_EXPORT?.RFCSYSID,
          host: response.data.EXPORT?.RFCSI_EXPORT?.RFCHOST,
          database: response.data.EXPORT?.RFCSI_EXPORT?.RFCDBSYS,
          sapRelease: response.data.EXPORT?.RFCSI_EXPORT?.RFCSAPRL,
          kernelRelease: response.data.EXPORT?.RFCSI_EXPORT?.RFCKERNRL
        }
      };
    } catch (error: any) {
      logger.error('SAP connection test failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to connect to SAP system'
      };
    }
  }

  protected async initializeConnection(
    connectionId: string,
    credentials: Record<string, any>
  ): Promise<void> {
    try {
      const validatedCreds = SAPCredentialsSchema.parse(credentials);
      const sapConn = await this.createSAPConnection(validatedCreds);
      
      this.sapConnections.set(connectionId, sapConn);
      logger.info(`Initialized SAP connection ${connectionId}`);
    } catch (error) {
      logger.error(`Failed to initialize SAP connection ${connectionId}:`, error);
      throw error;
    }
  }

  protected async closeConnection(connectionId: string): Promise<void> {
    this.sapConnections.delete(connectionId);
    logger.info(`Closed SAP connection ${connectionId}`);
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

      const conn = this.sapConnections.get(connectionId);
      if (!conn) {
        throw new Error('Connection not found. Please initialize the connection first.');
      }

      // Refresh token if needed
      await this.refreshTokenIfNeeded(conn);

      let result: any;

      switch (operation) {
        case 'rfc_call':
          result = await this.executeRFCCall(conn, params);
          break;

        case 'odata_query':
          result = await this.executeODataQuery(conn, params);
          break;

        case 'odata_create':
          result = await this.executeODataCreate(conn, params);
          break;

        case 'odata_update':
          result = await this.executeODataUpdate(conn, params);
          break;

        case 'odata_delete':
          result = await this.executeODataDelete(conn, params);
          break;

        case 'bapi_call':
          result = await this.executeBAPICall(conn, params);
          break;

        case 'idoc_send':
          result = await this.executeIDocSend(conn, params);
          break;

        case 'table_read':
          result = await this.executeTableRead(conn, params);
          break;

        case 'report_execute':
          result = await this.executeReport(conn, params);
          break;

        case 'batch_input':
          result = await this.executeBatchInput(conn, params);
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
      logger.error(`SAP operation ${operation} failed:`, error);

      return {
        success: false,
        error: {
          code: error.code || 'OPERATION_FAILED',
          message: error.message,
          details: error.response?.data || error
        },
        metadata: {
          duration: Date.now() - startTime,
          apiCalls: 1,
          bytesTransferred: 0
        }
      };
    }
  }

  private async createSAPConnection(
    credentials: z.infer<typeof SAPCredentialsSchema>
  ): Promise<SAPConnection> {
    const baseURL = `${credentials.protocol}://${credentials.host}:${credentials.port}`;
    
    const axiosConfig: any = {
      baseURL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'sap-client': credentials.client,
        'sap-language': credentials.language
      }
    };

    if (credentials.authenticationType === 'basic') {
      axiosConfig.auth = {
        username: credentials.username,
        password: credentials.password
      };
    }

    const axiosInstance = axios.create(axiosConfig);

    // Add request interceptor for OAuth2
    if (credentials.authenticationType === 'oauth2' && credentials.oauth2) {
      axiosInstance.interceptors.request.use(async (config) => {
        const token = await this.getOAuth2Token(credentials.oauth2!);
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      });
    }

    // Add response interceptor for error handling
    axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logger.error('SAP authentication failed');
        }
        return Promise.reject(error);
      }
    );

    return {
      axios: axiosInstance,
      credentials
    };
  }

  private async getOAuth2Token(oauth2Config: any): Promise<string> {
    try {
      const response = await axios.post(oauth2Config.tokenUrl, {
        grant_type: 'client_credentials',
        client_id: oauth2Config.clientId,
        client_secret: oauth2Config.clientSecret,
        scope: oauth2Config.scope
      });

      return response.data.access_token;
    } catch (error) {
      logger.error('Failed to get OAuth2 token:', error);
      throw new Error('OAuth2 authentication failed');
    }
  }

  private async refreshTokenIfNeeded(conn: SAPConnection): Promise<void> {
    if (conn.credentials.authenticationType === 'oauth2' && conn.tokenExpiry) {
      const now = new Date();
      if (now >= conn.tokenExpiry) {
        const token = await this.getOAuth2Token(conn.credentials.oauth2!);
        conn.token = token;
        conn.tokenExpiry = new Date(Date.now() + 3600000); // 1 hour
      }
    }
  }

  private async executeRFCCall(conn: SAPConnection, params: any): Promise<any> {
    const validated = RFCCallSchema.parse(params);
    
    const response = await conn.axios.post(`/sap/bc/rest/rfc/${validated.functionName}`, {
      importParams: validated.importParams,
      tableParams: validated.tableParams,
      changingParams: validated.changingParams
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return {
      exportParams: response.data.EXPORT || {},
      tableParams: response.data.TABLE || {},
      changingParams: response.data.CHANGING || {}
    };
  }

  private async executeODataQuery(conn: SAPConnection, params: any): Promise<any> {
    const validated = ODataQuerySchema.parse(params);
    
    let url = `/sap/opu/odata/sap/${validated.service}/${validated.entity}`;
    const queryParams: string[] = [];

    if (validated.filter) queryParams.push(`$filter=${encodeURIComponent(validated.filter)}`);
    if (validated.select) queryParams.push(`$select=${validated.select.join(',')}`);
    if (validated.expand) queryParams.push(`$expand=${validated.expand.join(',')}`);
    if (validated.top) queryParams.push(`$top=${validated.top}`);
    if (validated.skip) queryParams.push(`$skip=${validated.skip}`);
    if (validated.orderBy) queryParams.push(`$orderby=${encodeURIComponent(validated.orderBy)}`);

    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }

    const response = await conn.axios.get(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    return response.data.d || response.data;
  }

  private async executeODataCreate(conn: SAPConnection, params: any): Promise<any> {
    const { service, entity, data } = params;
    
    const response = await conn.axios.post(
      `/sap/opu/odata/sap/${service}/${entity}`,
      data,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.d || response.data;
  }

  private async executeODataUpdate(conn: SAPConnection, params: any): Promise<any> {
    const { service, entity, key, data, method = 'PUT' } = params;
    
    const response = await conn.axios({
      method,
      url: `/sap/opu/odata/sap/${service}/${entity}(${key})`,
      data,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    return response.data.d || response.data || { success: true };
  }

  private async executeODataDelete(conn: SAPConnection, params: any): Promise<any> {
    const { service, entity, key } = params;
    
    await conn.axios.delete(`/sap/opu/odata/sap/${service}/${entity}(${key})`);

    return { success: true, message: 'Entity deleted successfully' };
  }

  private async executeBAPICall(conn: SAPConnection, params: any): Promise<any> {
    const validated = BAPICallSchema.parse(params);
    
    // Execute BAPI
    const bapiResponse = await this.executeRFCCall(conn, {
      functionName: validated.bapiName,
      importParams: validated.parameters
    });

    // Check for BAPI return messages
    const returnMessages = bapiResponse.exportParams?.RETURN || 
                          bapiResponse.tableParams?.RETURN || 
                          [];

    const hasError = Array.isArray(returnMessages) 
      ? returnMessages.some((msg: any) => msg.TYPE === 'E' || msg.TYPE === 'A')
      : returnMessages.TYPE === 'E' || returnMessages.TYPE === 'A';

    if (hasError) {
      throw new Error(`BAPI error: ${JSON.stringify(returnMessages)}`);
    }

    // Commit if requested
    if (validated.commit && !hasError) {
      await this.executeRFCCall(conn, {
        functionName: 'BAPI_TRANSACTION_COMMIT',
        importParams: {
          WAIT: validated.waitForCommit ? 'X' : ''
        }
      });
    }

    return {
      ...bapiResponse,
      committed: validated.commit && !hasError
    };
  }

  private async executeIDocSend(conn: SAPConnection, params: any): Promise<any> {
    const { idocType, messageType, data, receiverPort, receiverPartner } = params;
    
    // Build IDoc structure
    const idocData = {
      EDI_DC40: {
        IDOCTYP: idocType,
        MESTYP: messageType,
        RCVPOR: receiverPort,
        RCVPRN: receiverPartner,
        SNDPOR: conn.credentials.client,
        SNDPRN: conn.credentials.client
      },
      data: data
    };

    // Send IDoc via RFC
    const response = await this.executeRFCCall(conn, {
      functionName: 'IDOC_INBOUND_ASYNCHRONOUS',
      tableParams: {
        IDOC_DATA_REC_40: [idocData]
      }
    });

    return {
      docnum: response.exportParams?.DOCNUM,
      status: response.exportParams?.STATUS
    };
  }

  private async executeTableRead(conn: SAPConnection, params: any): Promise<any> {
    const { tableName, fields = [], where = '', maxRows = 1000 } = params;
    
    const response = await this.executeRFCCall(conn, {
      functionName: 'RFC_READ_TABLE',
      importParams: {
        QUERY_TABLE: tableName,
        DELIMITER: '|',
        ROWCOUNT: maxRows
      },
      tableParams: {
        OPTIONS: where ? [{ TEXT: where }] : [],
        FIELDS: fields.length > 0 
          ? fields.map((f: string) => ({ FIELDNAME: f }))
          : []
      }
    });

    // Parse the data
    const fieldInfo = response.tableParams?.FIELDS || [];
    const rawData = response.tableParams?.DATA || [];

    const parsedData = rawData.map((row: any) => {
      const values = row.WA.split('|');
      const record: any = {};

      fieldInfo.forEach((field: any, index: number) => {
        record[field.FIELDNAME] = values[index]?.trim() || '';
      });

      return record;
    });

    return {
      fields: fieldInfo,
      data: parsedData,
      rowCount: parsedData.length
    };
  }

  private async executeReport(conn: SAPConnection, params: any): Promise<any> {
    const { reportName, variant, parameters = {} } = params;
    
    // Submit report
    const submitResponse = await this.executeRFCCall(conn, {
      functionName: 'SUBMIT_REPORT',
      importParams: {
        REPORT: reportName,
        VARIANT: variant,
        ...parameters
      }
    });

    // Get spool ID
    const spoolId = submitResponse.exportParams?.SPOOLID;
    if (!spoolId) {
      throw new Error('Failed to get spool ID for report execution');
    }

    // Read spool
    const spoolResponse = await this.executeRFCCall(conn, {
      functionName: 'RSPO_RETURN_ABAP_SPOOLJOB',
      importParams: {
        RQIDENT: spoolId
      }
    });

    return {
      spoolId,
      output: spoolResponse.tableParams?.BUFFER || []
    };
  }

  private async executeBatchInput(conn: SAPConnection, params: any): Promise<any> {
    const { sessionName, transactions } = params;
    
    // Create batch input session
    const createResponse = await this.executeRFCCall(conn, {
      functionName: 'BDC_OPEN_GROUP',
      importParams: {
        GROUP: sessionName,
        KEEP: 'X',
        USER: conn.credentials.username
      }
    });

    // Add transactions
    for (const transaction of transactions) {
      await this.executeRFCCall(conn, {
        functionName: 'BDC_INSERT',
        importParams: {
          TCODE: transaction.code
        },
        tableParams: {
          DYNPROTAB: transaction.screens || []
        }
      });
    }

    // Close session
    await this.executeRFCCall(conn, {
      functionName: 'BDC_CLOSE_GROUP'
    });

    return {
      sessionName,
      transactionCount: transactions.length,
      status: 'created'
    };
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
        name: 'rfc_call',
        description: 'Execute an RFC function module',
        category: 'Core',
        parameters: [
          {
            name: 'functionName',
            type: 'string',
            required: true,
            description: 'RFC function module name'
          },
          {
            name: 'importParams',
            type: 'object',
            required: false,
            description: 'Import parameters',
            default: {}
          },
          {
            name: 'tableParams',
            type: 'object',
            required: false,
            description: 'Table parameters',
            default: {}
          }
        ],
        returns: {
          type: 'object',
          description: 'RFC execution results'
        }
      },
      {
        name: 'odata_query',
        description: 'Query data via OData service',
        category: 'OData',
        parameters: [
          {
            name: 'service',
            type: 'string',
            required: true,
            description: 'OData service name'
          },
          {
            name: 'entity',
            type: 'string',
            required: true,
            description: 'Entity set name'
          },
          {
            name: 'filter',
            type: 'string',
            required: false,
            description: 'OData filter expression'
          },
          {
            name: 'select',
            type: 'array',
            required: false,
            description: 'Fields to select'
          }
        ],
        returns: {
          type: 'array',
          description: 'Query results'
        }
      },
      {
        name: 'bapi_call',
        description: 'Execute a BAPI with automatic commit',
        category: 'BAPI',
        parameters: [
          {
            name: 'bapiName',
            type: 'string',
            required: true,
            description: 'BAPI function name'
          },
          {
            name: 'parameters',
            type: 'object',
            required: false,
            description: 'BAPI parameters',
            default: {}
          },
          {
            name: 'commit',
            type: 'boolean',
            required: false,
            description: 'Auto-commit transaction',
            default: true
          }
        ],
        returns: {
          type: 'object',
          description: 'BAPI execution results'
        }
      },
      {
        name: 'table_read',
        description: 'Read data from SAP table',
        category: 'Data',
        parameters: [
          {
            name: 'tableName',
            type: 'string',
            required: true,
            description: 'SAP table name'
          },
          {
            name: 'fields',
            type: 'array',
            required: false,
            description: 'Fields to read'
          },
          {
            name: 'where',
            type: 'string',
            required: false,
            description: 'WHERE clause'
          },
          {
            name: 'maxRows',
            type: 'number',
            required: false,
            description: 'Maximum rows to return',
            default: 1000
          }
        ],
        returns: {
          type: 'object',
          description: 'Table data with field information'
        }
      }
    ];
  }

  /**
   * Get available RFC functions
   */
  async getAvailableRFCs(connectionId: string, pattern: string = '*'): Promise<any> {
    const conn = this.sapConnections.get(connectionId);
    if (!conn) {
      throw new Error('Connection not found');
    }

    const response = await this.executeRFCCall(conn, {
      functionName: 'RFC_FUNCTION_SEARCH',
      importParams: {
        FUNCNAME: pattern
      }
    });

    return response.tableParams?.FUNCTIONS || [];
  }

  /**
   * Get RFC function interface
   */
  async getRFCInterface(connectionId: string, functionName: string): Promise<any> {
    const conn = this.sapConnections.get(connectionId);
    if (!conn) {
      throw new Error('Connection not found');
    }

    const response = await this.executeRFCCall(conn, {
      functionName: 'RFC_GET_FUNCTION_INTERFACE',
      importParams: {
        FUNCNAME: functionName
      }
    });

    return {
      import: response.tableParams?.PARAMS_IMPORT || [],
      export: response.tableParams?.PARAMS_EXPORT || [],
      changing: response.tableParams?.PARAMS_CHANGING || [],
      tables: response.tableParams?.PARAMS_TABLES || [],
      exceptions: response.tableParams?.EXCEPTIONS || []
    };
  }
}