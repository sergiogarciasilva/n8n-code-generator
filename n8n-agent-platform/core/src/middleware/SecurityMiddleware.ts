import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AuthManager } from '../auth/AuthManager';
import { PermissionManager } from '../auth/PermissionManager';
import { DatabaseManager } from '../database/DatabaseManager';
import crypto from 'crypto';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    organizationId: string;
    sessionId: string;
    username?: string;
    verified?: boolean;
  };
  apiKey?: {
    keyId: string;
    permissions: string[];
  };
}

export class SecurityMiddleware {
  private authManager: AuthManager;
  private permissionManager: PermissionManager;
  private database: DatabaseManager;

  constructor(
    authManager: AuthManager,
    permissionManager: PermissionManager,
    database: DatabaseManager
  ) {
    this.authManager = authManager;
    this.permissionManager = permissionManager;
    this.database = database;
  }

  // Helmet security headers
  helmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    });
  }

  // Rate limiting configurations
  createRateLimiter(options: {
    windowMs?: number;
    max?: number;
    message?: string;
    keyGenerator?: (req: Request) => string;
  }) {
    return rateLimit({
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      max: options.max || 100,
      message: options.message || 'Too many requests',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: options.keyGenerator || ((req) => {
        // Use user ID if authenticated, otherwise IP
        const authReq = req as AuthenticatedRequest;
        return authReq.user?.userId || req.ip || 'unknown';
      }),
      handler: async (req, res) => {
        // Log rate limit violation
        await this.logSecurityEvent(req as AuthenticatedRequest, 'rate_limit_exceeded');
        res.status(429).json({
          error: options.message || 'Too many requests',
          retryAfter: res.getHeader('Retry-After'),
        });
      },
    });
  }

  // Authentication middleware
  authenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'] as string;

        if (apiKey) {
          // API Key authentication
          await this.authenticateApiKey(req, apiKey);
        } else if (authHeader?.startsWith('Bearer ')) {
          // JWT authentication
          const token = authHeader.substring(7);
          const payload = await this.authManager.verifyToken(token);
          
          req.user = {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            organizationId: payload.organizationId,
            sessionId: payload.sessionId,
          };
        } else {
          return res.status(401).json({ error: 'Authentication required' });
        }

        next();
      } catch (error) {
        await this.logSecurityEvent(req, 'auth_failed', { error: (error as Error).message });
        res.status(401).json({ error: 'Invalid authentication' });
      }
    };
  }

  // Permission checking middleware
  requirePermission(resource: string, action: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user?.userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const resourceId = req.params.id || req.body.resourceId;
        const hasPermission = await this.permissionManager.hasPermission(
          req.user.userId,
          resource,
          action,
          resourceId
        );

        if (!hasPermission) {
          await this.logSecurityEvent(req, 'permission_denied', { resource, action });
          return res.status(403).json({ error: 'Permission denied' });
        }

        next();
      } catch (error) {
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  // CSRF protection
  csrfProtection() {
    const tokens = new Map<string, { token: string; expires: Date }>();

    return {
      generate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const token = crypto.randomBytes(32).toString('hex');
        const sessionId = req.user?.sessionId || req.sessionID;
        
        tokens.set(sessionId, {
          token,
          expires: new Date(Date.now() + 3600000), // 1 hour
        });

        res.locals.csrfToken = token;
        next();
      },
      
      verify: (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
          return next();
        }

        const sessionId = req.user?.sessionId || req.sessionID;
        const tokenData = tokens.get(sessionId);
        const providedToken = req.headers['x-csrf-token'] || req.body._csrf;

        if (!tokenData || tokenData.token !== providedToken || tokenData.expires < new Date()) {
          return res.status(403).json({ error: 'Invalid CSRF token' });
        }

        next();
      },
    };
  }

  // Input validation and sanitization
  validateInput(schema: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { error } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map((d: any) => ({
            field: d.path.join('.'),
            message: d.message,
          })),
        });
      }

      next();
    };
  }

  // SQL injection prevention
  sanitizeQuery() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Sanitize query parameters
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          // Remove SQL keywords and special characters
          req.query[key] = (req.query[key] as string)
            .replace(/[';\\]/g, '')
            .replace(/\b(union|select|insert|update|delete|drop)\b/gi, '');
        }
      }

      // Sanitize body parameters
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }

      next();
    };
  }

  // XSS prevention
  xssProtection() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Set security headers
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeForXSS(req.body);
      }

      next();
    };
  }

  // API versioning
  apiVersion(version: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestedVersion = req.headers['x-api-version'] || 'v1';
      
      if (requestedVersion !== version) {
        return res.status(400).json({
          error: 'API version mismatch',
          supported: version,
          requested: requestedVersion,
        });
      }

      next();
    };
  }

  // Audit logging
  auditLog(action: string) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Log audit entry when response finishes
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const auditEntry = {
          userId: req.user?.userId,
          action,
          resource: req.route?.path,
          method: req.method,
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date(),
        };

        // Async logging - don't await to not slow down response
        this.database.query(
          `INSERT INTO audit_logs 
           (user_id, action, resource, method, status_code, duration, ip, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            auditEntry.userId,
            auditEntry.action,
            auditEntry.resource,
            auditEntry.method,
            auditEntry.statusCode,
            auditEntry.duration,
            auditEntry.ip,
            auditEntry.userAgent,
          ]
        ).catch((error: any) => console.error('Audit log failed:', error));
      });

      next();
    };
  }

  // Content type validation
  validateContentType(allowedTypes: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        
        if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
          return res.status(415).json({
            error: 'Unsupported Media Type',
            allowed: allowedTypes,
          });
        }
      }

      next();
    };
  }

  // Request size limiting
  requestSizeLimit(maxSize: string = '10mb') {
    return (req: Request, res: Response, next: NextFunction) => {
      let size = 0;

      req.on('data', (chunk) => {
        size += chunk.length;
        
        if (size > this.parseSize(maxSize)) {
          res.status(413).json({ error: 'Request entity too large' });
          req.connection.destroy();
        }
      });

      next();
    };
  }

  // Helper methods
  private async authenticateApiKey(req: AuthenticatedRequest, apiKey: string): Promise<void> {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    const result = await this.database.query(
      `SELECT k.*, u.organization_id, u.role 
       FROM api_keys k
       JOIN users u ON k.user_id = u.id
       WHERE k.key_hash = $1 AND k.is_active = true`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid API key');
    }

    const key = result.rows[0];

    // Check expiration
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      throw new Error('API key expired');
    }

    // Update last used
    await this.database.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [key.id]
    );

    req.user = {
      userId: key.user_id,
      email: '', // Not needed for API key auth
      role: key.role,
      organizationId: key.organization_id,
      sessionId: `api-${key.id}`,
    };

    req.apiKey = {
      keyId: key.id,
      permissions: key.permissions,
    };
  }

  private async logSecurityEvent(
    req: AuthenticatedRequest,
    eventType: string,
    metadata?: any
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO security_logs 
         (user_id, event_type, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user?.userId,
          eventType,
          req.ip,
          req.headers['user-agent'],
          metadata ? JSON.stringify(metadata) : null,
        ]
      );
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          // Remove dangerous SQL patterns
          sanitized[key] = obj[key]
            .replace(/[';\\]/g, '')
            .replace(/\b(union|select|insert|update|delete|drop)\b/gi, '');
        } else if (typeof obj[key] === 'object') {
          sanitized[key] = this.sanitizeObject(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
    }

    return sanitized;
  }

  private sanitizeForXSS(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          // Basic XSS sanitization
          sanitized[key] = obj[key]
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
        } else if (typeof obj[key] === 'object') {
          sanitized[key] = this.sanitizeForXSS(obj[key]);
        } else {
          sanitized[key] = obj[key];
        }
      }
    }

    return sanitized;
  }

  private parseSize(size: string): number {
    const units: any = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
    const regex = /^(\d+)(b|kb|mb|gb)$/i;
    const matches = size.match(regex);
    
    if (matches) {
      return parseInt(matches[1]) * units[matches[2].toLowerCase()];
    }
    
    return parseInt(size);
  }
}