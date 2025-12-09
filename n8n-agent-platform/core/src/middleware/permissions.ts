import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export interface Permission {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'admin';
}

export function checkPermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Simple permission check - in production this would be more sophisticated
    const { resource, action } = permission;
    const userRole = req.user.role;

    // Admin has all permissions
    if (userRole === 'admin') {
      return next();
    }

    // Basic role-based permissions
    if (userRole === 'user' && action === 'read') {
      return next();
    }

    if (userRole === 'editor' && (action === 'read' || action === 'write')) {
      return next();
    }

    return res.status(403).json({ 
      error: `Insufficient permissions for ${action} on ${resource}` 
    });
  };
}

export function requirePermissions(...permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has all required permissions
    const hasAllPermissions = permissions.every(permission => {
      if (req.user!.role === 'admin') return true;
      
      // Add more sophisticated permission logic here
      return req.user!.role === 'editor' || permission.action === 'read';
    });

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        error: 'Insufficient permissions' 
      });
    }

    next();
  };
}

export function canAccessWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check if user can access the specific workflow
  // This is a simplified implementation
  next();
}

export function canModifyWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role === 'admin' || req.user.role === 'editor') {
    return next();
  }

  return res.status(403).json({ error: 'Cannot modify workflows' });
}