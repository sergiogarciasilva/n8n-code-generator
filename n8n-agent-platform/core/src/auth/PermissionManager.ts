import { DatabaseManager } from '../database/DatabaseManager';

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}

export class PermissionManager {
  private database: DatabaseManager;
  private permissionCache: Map<string, Permission[]> = new Map();

  // System roles with predefined permissions
  private systemRoles: Record<string, Permission[]> = {
    admin: [
      { resource: '*', action: '*' } // Full access
    ],
    developer: [
      { resource: 'workflows', action: '*' },
      { resource: 'agents', action: '*' },
      { resource: 'optimizations', action: '*' },
      { resource: 'metrics', action: 'read' },
      { resource: 'logs', action: 'read' },
      { resource: 'api_keys', action: 'manage_own' }
    ],
    analyst: [
      { resource: 'workflows', action: 'read' },
      { resource: 'agents', action: 'read' },
      { resource: 'optimizations', action: 'read' },
      { resource: 'metrics', action: '*' },
      { resource: 'reports', action: '*' },
      { resource: 'logs', action: 'read' }
    ],
    viewer: [
      { resource: 'workflows', action: 'read' },
      { resource: 'agents', action: 'read' },
      { resource: 'metrics', action: 'read' },
      { resource: 'reports', action: 'read' }
    ]
  };

  constructor(database: DatabaseManager) {
    this.database = database;
    this.initializeSystemRoles();
  }

  private async initializeSystemRoles(): Promise<void> {
    for (const [roleName, permissions] of Object.entries(this.systemRoles)) {
      // Check if role already exists
      const existing = await this.database.query(
        `SELECT id FROM roles WHERE name = $1 AND is_system = true`,
        [roleName]
      );
      
      if (existing.rows.length === 0) {
        // Insert new system role
        await this.database.query(
          `INSERT INTO roles (name, description, permissions, is_system)
           VALUES ($1, $2, $3, true)`,
          [
            roleName,
            `System ${roleName} role`,
            JSON.stringify(permissions)
          ]
        );
      } else {
        // Update existing system role
        await this.database.query(
          `UPDATE roles SET permissions = $1 WHERE name = $2 AND is_system = true`,
          [JSON.stringify(permissions), roleName]
        );
      }
    }
  }

  // Check if user has permission
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    resourceOwnerId?: string
  ): Promise<boolean> {
    // Get user's role and organization
    const userResult = await this.database.query(
      'SELECT role, organization_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return false;
    }

    const user = userResult.rows[0];
    const permissions = await this.getUserPermissions(user.role);

    // Check permissions
    for (const permission of permissions) {
      if (this.matchesPermission(permission, resource, action, userId, resourceOwnerId)) {
        return true;
      }
    }

    return false;
  }

  // Get all permissions for a role
  private async getUserPermissions(role: string): Promise<Permission[]> {
    if (this.permissionCache.has(role)) {
      return this.permissionCache.get(role)!;
    }

    const roleResult = await this.database.query(
      'SELECT permissions FROM roles WHERE name = $1',
      [role]
    );

    if (roleResult.rows.length === 0) {
      return [];
    }

    const permissions = roleResult.rows[0].permissions;
    this.permissionCache.set(role, permissions);

    return permissions;
  }

  // Check if permission matches request
  private matchesPermission(
    permission: Permission,
    resource: string,
    action: string,
    userId: string,
    resourceOwnerId?: string
  ): boolean {
    // Check resource match
    if (permission.resource !== '*' && permission.resource !== resource) {
      return false;
    }

    // Check action match
    if (permission.action !== '*' && permission.action !== action) {
      // Special case for manage_own
      if (permission.action === 'manage_own' && resourceOwnerId === userId) {
        return true;
      }
      return false;
    }

    // Check conditions
    if (permission.conditions) {
      // Implement condition checking logic
      // For now, we'll just check ownership
      if (permission.conditions.owner === 'self' && resourceOwnerId !== userId) {
        return false;
      }
    }

    return true;
  }

  // Create custom role
  async createRole(
    name: string,
    description: string,
    permissions: Permission[],
    organizationId: string
  ): Promise<Role> {
    const result = await this.database.query(
      `INSERT INTO roles (name, description, permissions, organization_id, is_system)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [name, description, JSON.stringify(permissions), organizationId]
    );

    return result.rows[0];
  }

  // Update role permissions
  async updateRolePermissions(
    roleId: string,
    permissions: Permission[],
    organizationId: string
  ): Promise<void> {
    await this.database.query(
      `UPDATE roles 
       SET permissions = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3 AND is_system = false`,
      [JSON.stringify(permissions), roleId, organizationId]
    );

    // Clear cache
    this.permissionCache.clear();
  }

  // Assign role to user
  async assignRole(userId: string, role: string): Promise<void> {
    await this.database.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      [role, userId]
    );
  }

  // Get all available actions for a resource
  getResourceActions(resource: string): string[] {
    const resourceActions: Record<string, string[]> = {
      workflows: ['create', 'read', 'update', 'delete', 'execute', 'optimize'],
      agents: ['create', 'read', 'update', 'delete', 'start', 'stop', 'configure'],
      optimizations: ['create', 'read', 'approve', 'reject', 'apply'],
      metrics: ['read', 'export', 'analyze'],
      reports: ['create', 'read', 'export', 'schedule'],
      api_keys: ['create', 'read', 'revoke', 'manage_own'],
      users: ['create', 'read', 'update', 'delete', 'assign_role'],
      settings: ['read', 'update']
    };

    return resourceActions[resource] || ['create', 'read', 'update', 'delete'];
  }

  // Middleware for Express routes
  requirePermission(resource: string, action: string) {
    return async (req: any, res: any, next: any) => {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const hasPermission = await this.hasPermission(
          userId,
          resource,
          action,
          req.params.id // Resource owner ID if applicable
        );

        if (!hasPermission) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        next();
      } catch (error) {
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  // Get user's effective permissions
  async getUserEffectivePermissions(userId: string): Promise<Permission[]> {
    const userResult = await this.database.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return [];
    }

    return this.getUserPermissions(userResult.rows[0].role);
  }

  // Check multiple permissions at once
  async hasAnyPermission(
    userId: string,
    permissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    for (const perm of permissions) {
      if (await this.hasPermission(userId, perm.resource, perm.action)) {
        return true;
      }
    }
    return false;
  }

  // Check all permissions at once
  async hasAllPermissions(
    userId: string,
    permissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    for (const perm of permissions) {
      if (!(await this.hasPermission(userId, perm.resource, perm.action))) {
        return false;
      }
    }
    return true;
  }
}