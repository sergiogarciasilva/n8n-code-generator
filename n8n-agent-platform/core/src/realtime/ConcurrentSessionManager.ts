import { Server as SocketIOServer, Socket } from 'socket.io';
import { DatabaseManager } from '../database/DatabaseManager';
import { AuthManager } from '../auth/AuthManager';
import { PermissionManager } from '../auth/PermissionManager';
import crypto from 'crypto';
import { EventEmitter } from 'events';

interface UserSession {
  userId: string;
  socketId: string;
  sessionId: string;
  role: string;
  organizationId: string;
  activeResource?: string;
  lastActivity: Date;
}

interface ResourceLock {
  resourceId: string;
  resourceType: string;
  userId: string;
  sessionId: string;
  acquiredAt: Date;
  expiresAt: Date;
}

interface CollaborationEvent {
  type: 'cursor' | 'selection' | 'edit' | 'comment';
  userId: string;
  resourceId: string;
  data: any;
  timestamp: Date;
}

export class ConcurrentSessionManager extends EventEmitter {
  private io: SocketIOServer;
  private database: DatabaseManager;
  private authManager: AuthManager;
  private permissionManager: PermissionManager;
  
  private activeSessions: Map<string, UserSession> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private resourceSubscribers: Map<string, Set<string>> = new Map(); // resourceId -> socketIds
  private resourceLocks: Map<string, ResourceLock> = new Map();
  private collaborationState: Map<string, any> = new Map(); // Real-time state

  constructor(
    io: SocketIOServer,
    database: DatabaseManager,
    authManager: AuthManager,
    permissionManager: PermissionManager
  ) {
    super();
    this.io = io;
    this.database = database;
    this.authManager = authManager;
    this.permissionManager = permissionManager;

    this.setupSocketHandlers();
    this.startCleanupInterval();
  }

  private setupSocketHandlers(): void {
    this.io.use(async (socket, next) => {
      try {
        // Authenticate socket connection
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const payload = await this.authManager.verifyToken(token);
        socket.data.user = payload;
        socket.data.sessionId = crypto.randomUUID();
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', async (socket) => {
      const user = socket.data.user;
      
      // Register session
      await this.registerSession(socket);

      // Handle events
      socket.on('subscribe:resource', (data) => this.handleResourceSubscription(socket, data));
      socket.on('unsubscribe:resource', (data) => this.handleResourceUnsubscription(socket, data));
      socket.on('resource:lock', (data) => this.handleResourceLock(socket, data));
      socket.on('resource:unlock', (data) => this.handleResourceUnlock(socket, data));
      socket.on('collaboration:event', (data) => this.handleCollaborationEvent(socket, data));
      socket.on('presence:update', (data) => this.handlePresenceUpdate(socket, data));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  private async registerSession(socket: Socket): Promise<void> {
    const user = socket.data.user;
    const session: UserSession = {
      userId: user.userId,
      socketId: socket.id,
      sessionId: socket.data.sessionId,
      role: user.role,
      organizationId: user.organizationId,
      lastActivity: new Date()
    };

    // Store session
    this.activeSessions.set(socket.id, session);

    // Track user sockets
    if (!this.userSockets.has(user.userId)) {
      this.userSockets.set(user.userId, new Set());
    }
    this.userSockets.get(user.userId)!.add(socket.id);

    // Join organization room
    socket.join(`org:${user.organizationId}`);

    // Notify others about new user
    socket.to(`org:${user.organizationId}`).emit('user:joined', {
      userId: user.userId,
      sessionId: session.sessionId,
      timestamp: new Date()
    });

    // Send current online users to the new connection
    const onlineUsers = await this.getOnlineUsers(user.organizationId);
    socket.emit('users:online', onlineUsers);

    // Log session
    await this.database.query(
      `UPDATE sessions 
       SET last_activity = NOW() 
       WHERE id = $1`,
      [socket.data.sessionId]
    );
  }

  private async handleResourceSubscription(socket: Socket, data: any): Promise<void> {
    const { resourceId, resourceType } = data;
    const session = this.activeSessions.get(socket.id);
    
    if (!session) return;

    // Check permissions
    const hasPermission = await this.permissionManager.hasPermission(
      session.userId,
      resourceType,
      'read',
      resourceId
    );

    if (!hasPermission) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    // Join resource room
    socket.join(`resource:${resourceId}`);

    // Track subscription
    if (!this.resourceSubscribers.has(resourceId)) {
      this.resourceSubscribers.set(resourceId, new Set());
    }
    this.resourceSubscribers.get(resourceId)!.add(socket.id);

    // Update session
    session.activeResource = resourceId;

    // Send current resource state
    const state = await this.getResourceState(resourceId, resourceType);
    socket.emit('resource:state', { resourceId, state });

    // Notify others
    socket.to(`resource:${resourceId}`).emit('user:viewing', {
      userId: session.userId,
      resourceId,
      timestamp: new Date()
    });

    // Send current viewers
    const viewers = this.getResourceViewers(resourceId);
    socket.emit('resource:viewers', { resourceId, viewers });
  }

  private async handleResourceUnsubscription(socket: Socket, data: any): Promise<void> {
    const { resourceId } = data;
    const session = this.activeSessions.get(socket.id);
    
    if (!session) return;

    // Leave resource room
    socket.leave(`resource:${resourceId}`);

    // Remove from subscribers
    const subscribers = this.resourceSubscribers.get(resourceId);
    if (subscribers) {
      subscribers.delete(socket.id);
      if (subscribers.size === 0) {
        this.resourceSubscribers.delete(resourceId);
      }
    }

    // Clear active resource
    if (session.activeResource === resourceId) {
      session.activeResource = undefined;
    }

    // Notify others
    socket.to(`resource:${resourceId}`).emit('user:left', {
      userId: session.userId,
      resourceId,
      timestamp: new Date()
    });
  }

  private async handleResourceLock(socket: Socket, data: any): Promise<void> {
    const { resourceId, resourceType, duration = 300000 } = data; // 5 min default
    const session = this.activeSessions.get(socket.id);
    
    if (!session) return;

    // Check if resource is already locked
    const existingLock = this.resourceLocks.get(resourceId);
    if (existingLock && existingLock.userId !== session.userId) {
      socket.emit('resource:lock:denied', {
        resourceId,
        lockedBy: existingLock.userId,
        expiresAt: existingLock.expiresAt
      });
      return;
    }

    // Check permissions
    const hasPermission = await this.permissionManager.hasPermission(
      session.userId,
      resourceType,
      'update',
      resourceId
    );

    if (!hasPermission) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    // Create lock
    const lock: ResourceLock = {
      resourceId,
      resourceType,
      userId: session.userId,
      sessionId: session.sessionId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + duration)
    };

    this.resourceLocks.set(resourceId, lock);

    // Store in database for persistence
    await this.database.query(
      `INSERT INTO resource_locks 
       (resource_id, resource_type, user_id, session_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (resource_id) 
       DO UPDATE SET user_id = $3, session_id = $4, expires_at = $5`,
      [resourceId, resourceType, session.userId, session.sessionId, lock.expiresAt]
    );

    // Notify all subscribers
    this.io.to(`resource:${resourceId}`).emit('resource:locked', {
      resourceId,
      lockedBy: session.userId,
      expiresAt: lock.expiresAt
    });
  }

  private async handleResourceUnlock(socket: Socket, data: any): Promise<void> {
    const { resourceId } = data;
    const session = this.activeSessions.get(socket.id);
    
    if (!session) return;

    const lock = this.resourceLocks.get(resourceId);
    if (!lock || lock.userId !== session.userId) {
      socket.emit('error', { message: 'No lock held' });
      return;
    }

    // Remove lock
    this.resourceLocks.delete(resourceId);

    // Remove from database
    await this.database.query(
      'DELETE FROM resource_locks WHERE resource_id = $1',
      [resourceId]
    );

    // Notify all subscribers
    this.io.to(`resource:${resourceId}`).emit('resource:unlocked', {
      resourceId,
      unlockedBy: session.userId
    });
  }

  private async handleCollaborationEvent(socket: Socket, data: CollaborationEvent): Promise<void> {
    const session = this.activeSessions.get(socket.id);
    if (!session) return;

    // Validate and enrich event
    const event: CollaborationEvent = {
      ...data,
      userId: session.userId,
      timestamp: new Date()
    };

    // Check permissions based on event type
    const action = event.type === 'cursor' || event.type === 'selection' ? 'read' : 'update';
    const hasPermission = await this.permissionManager.hasPermission(
      session.userId,
      'workflows', // Assuming workflow collaboration
      action,
      event.resourceId
    );

    if (!hasPermission) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    // Update collaboration state
    const stateKey = `${event.resourceId}:${event.type}:${session.userId}`;
    this.collaborationState.set(stateKey, event.data);

    // Broadcast to other users viewing the resource
    socket.to(`resource:${event.resourceId}`).emit('collaboration:event', event);

    // Store important events
    if (event.type === 'edit' || event.type === 'comment') {
      await this.database.query(
        `INSERT INTO collaboration_events 
         (resource_id, user_id, event_type, event_data, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [event.resourceId, session.userId, event.type, JSON.stringify(event.data)]
      );
    }
  }

  private async handlePresenceUpdate(socket: Socket, data: any): Promise<void> {
    const session = this.activeSessions.get(socket.id);
    if (!session) return;

    session.lastActivity = new Date();

    // Broadcast presence to organization
    socket.to(`org:${session.organizationId}`).emit('presence:update', {
      userId: session.userId,
      status: data.status || 'active',
      activeResource: session.activeResource,
      timestamp: new Date()
    });
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    const session = this.activeSessions.get(socket.id);
    if (!session) return;

    // Clean up session
    this.activeSessions.delete(socket.id);

    // Remove from user sockets
    const userSockets = this.userSockets.get(session.userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.userSockets.delete(session.userId);
      }
    }

    // Clean up resource subscriptions
    for (const [resourceId, subscribers] of this.resourceSubscribers) {
      if (subscribers.has(socket.id)) {
        subscribers.delete(socket.id);
        if (subscribers.size === 0) {
          this.resourceSubscribers.delete(resourceId);
        }

        // Notify others
        socket.to(`resource:${resourceId}`).emit('user:left', {
          userId: session.userId,
          resourceId,
          timestamp: new Date()
        });
      }
    }

    // Release any locks held by this session
    for (const [resourceId, lock] of this.resourceLocks) {
      if (lock.sessionId === session.sessionId) {
        this.resourceLocks.delete(resourceId);
        await this.database.query(
          'DELETE FROM resource_locks WHERE resource_id = $1',
          [resourceId]
        );

        this.io.to(`resource:${resourceId}`).emit('resource:unlocked', {
          resourceId,
          reason: 'session_ended'
        });
      }
    }

    // Clear collaboration state
    for (const [key, _] of this.collaborationState) {
      if (key.includes(session.userId)) {
        this.collaborationState.delete(key);
      }
    }

    // Notify organization about user leaving
    if (userSockets?.size === 0) {
      socket.to(`org:${session.organizationId}`).emit('user:left', {
        userId: session.userId,
        timestamp: new Date()
      });
    }
  }

  private async getOnlineUsers(organizationId: string): Promise<any[]> {
    const users = [];
    for (const session of this.activeSessions.values()) {
      if (session.organizationId === organizationId) {
        const userInfo = await this.database.query(
          'SELECT id, username, email, role FROM users WHERE id = $1',
          [session.userId]
        );
        
        if (userInfo.rows.length > 0) {
          users.push({
            ...userInfo.rows[0],
            status: 'online',
            activeResource: session.activeResource,
            lastActivity: session.lastActivity
          });
        }
      }
    }
    return users;
  }

  private getResourceViewers(resourceId: string): any[] {
    const viewers = [];
    const subscribers = this.resourceSubscribers.get(resourceId);
    
    if (subscribers) {
      for (const socketId of subscribers) {
        const session = this.activeSessions.get(socketId);
        if (session) {
          viewers.push({
            userId: session.userId,
            sessionId: session.sessionId,
            joinedAt: new Date()
          });
        }
      }
    }
    
    return viewers;
  }

  private async getResourceState(resourceId: string, resourceType: string): Promise<any> {
    // Get resource state from database
    const result = await this.database.query(
      `SELECT * FROM ${resourceType} WHERE id = $1`,
      [resourceId]
    );
    
    return result.rows[0] || null;
  }

  private startCleanupInterval(): void {
    // Clean up expired locks and inactive sessions
    setInterval(async () => {
      const now = new Date();

      // Clean expired locks
      for (const [resourceId, lock] of this.resourceLocks) {
        if (lock.expiresAt < now) {
          this.resourceLocks.delete(resourceId);
          await this.database.query(
            'DELETE FROM resource_locks WHERE resource_id = $1',
            [resourceId]
          );

          this.io.to(`resource:${resourceId}`).emit('resource:unlocked', {
            resourceId,
            reason: 'expired'
          });
        }
      }

      // Clean inactive sessions (no activity for 30 minutes)
      const inactivityThreshold = new Date(now.getTime() - 30 * 60 * 1000);
      for (const [socketId, session] of this.activeSessions) {
        if (session.lastActivity < inactivityThreshold) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket) {
            socket.disconnect();
          }
        }
      }
    }, 60000); // Run every minute
  }

  // Public methods for other services
  async broadcastToOrganization(organizationId: string, event: string, data: any): Promise<void> {
    this.io.to(`org:${organizationId}`).emit(event, data);
  }

  async broadcastToResource(resourceId: string, event: string, data: any): Promise<void> {
    this.io.to(`resource:${resourceId}`).emit(event, data);
  }

  async getActiveUsers(): Promise<number> {
    return this.userSockets.size;
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    const sessions = [];
    const socketIds = this.userSockets.get(userId);
    
    if (socketIds) {
      for (const socketId of socketIds) {
        const session = this.activeSessions.get(socketId);
        if (session) {
          sessions.push(session);
        }
      }
    }
    
    return sessions;
  }

  async isResourceLocked(resourceId: string): Promise<boolean> {
    return this.resourceLocks.has(resourceId);
  }

  async getResourceLock(resourceId: string): Promise<ResourceLock | undefined> {
    return this.resourceLocks.get(resourceId);
  }
}