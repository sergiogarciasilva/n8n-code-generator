import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface Client {
    id: string;
    socket: Socket;
    type: 'vscode' | 'dashboard' | 'unknown';
    metadata: any;
    connectedAt: Date;
}

export class WebSocketManager {
    private clients: Map<string, Client> = new Map();
    private rooms: Map<string, Set<string>> = new Map();

    constructor(private io: SocketIOServer) {}

    initialize(): void {
        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        logger.info('WebSocket manager initialized');
    }

    private handleConnection(socket: Socket): void {
        const clientId = uuidv4();
        const client: Client = {
            id: clientId,
            socket,
            type: 'unknown',
            metadata: {},
            connectedAt: new Date()
        };

        this.clients.set(clientId, client);
        logger.info(`WebSocket client connected: ${clientId}`);

        // Handle client identification
        socket.on('identify', (data) => {
            client.type = data.type || 'unknown';
            client.metadata = data.metadata || {};
            
            // Join type-specific room
            socket.join(`type:${client.type}`);
            
            logger.info(`Client ${clientId} identified as ${client.type}`);
            
            socket.emit('identified', {
                clientId,
                timestamp: new Date()
            });
        });

        // Handle room subscriptions
        socket.on('subscribe', (data) => {
            const { rooms } = data;
            if (Array.isArray(rooms)) {
                rooms.forEach(room => {
                    socket.join(room);
                    this.addToRoom(room, clientId);
                });
            }
        });

        socket.on('unsubscribe', (data) => {
            const { rooms } = data;
            if (Array.isArray(rooms)) {
                rooms.forEach(room => {
                    socket.leave(room);
                    this.removeFromRoom(room, clientId);
                });
            }
        });

        // Handle custom events
        socket.on('agent:run', async (data, callback) => {
            this.emit('agent:run:request', {
                clientId,
                ...data
            });
            
            if (callback) {
                callback({ status: 'queued', requestId: uuidv4() });
            }
        });

        socket.on('workflow:validate', async (data, callback) => {
            this.emit('workflow:validate:request', {
                clientId,
                ...data
            });
            
            if (callback) {
                callback({ status: 'processing' });
            }
        });

        socket.on('metrics:get', async (data, callback) => {
            this.emit('metrics:request', {
                clientId,
                ...data
            });
        });

        // Handle ping/pong for connection health
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            this.handleDisconnection(clientId);
        });

        // Send initial status
        socket.emit('connected', {
            clientId,
            serverTime: new Date(),
            version: '1.0.0'
        });
    }

    private handleDisconnection(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Remove from all rooms
        this.rooms.forEach((members, room) => {
            members.delete(clientId);
        });

        // Remove client
        this.clients.delete(clientId);
        
        logger.info(`WebSocket client disconnected: ${clientId}`);
    }

    private addToRoom(room: string, clientId: string): void {
        if (!this.rooms.has(room)) {
            this.rooms.set(room, new Set());
        }
        this.rooms.get(room)!.add(clientId);
    }

    private removeFromRoom(room: string, clientId: string): void {
        const members = this.rooms.get(room);
        if (members) {
            members.delete(clientId);
            if (members.size === 0) {
                this.rooms.delete(room);
            }
        }
    }

    // Broadcast methods
    broadcast(event: string, data: any): void {
        this.io.emit(event, {
            ...data,
            timestamp: new Date()
        });
        
        logger.debug(`Broadcast event ${event} to all clients`);
    }

    broadcastToType(type: string, event: string, data: any): void {
        this.io.to(`type:${type}`).emit(event, {
            ...data,
            timestamp: new Date()
        });
        
        logger.debug(`Broadcast event ${event} to ${type} clients`);
    }

    broadcastToRoom(room: string, event: string, data: any): void {
        this.io.to(room).emit(event, {
            ...data,
            timestamp: new Date()
        });
        
        logger.debug(`Broadcast event ${event} to room ${room}`);
    }

    sendToClient(clientId: string, event: string, data: any): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.socket.emit(event, {
                ...data,
                timestamp: new Date()
            });
        }
    }

    // Event emitter proxy (for internal use)
    private emit(event: string, data: any): void {
        // This would emit to internal event bus
        // For now, just log
        logger.debug(`Internal event: ${event}`, data);
    }

    // Utility methods
    getClientCount(): number {
        return this.clients.size;
    }

    getClientsByType(type: string): Client[] {
        return Array.from(this.clients.values()).filter(c => c.type === type);
    }

    getRoomMembers(room: string): string[] {
        return Array.from(this.rooms.get(room) || []);
    }

    isClientConnected(clientId: string): boolean {
        return this.clients.has(clientId);
    }

    // Agent-specific broadcasts
    broadcastAgentStatus(agentId: string, status: any): void {
        this.broadcast('agent:status:update', {
            agentId,
            status
        });
    }

    broadcastWorkflowChange(change: any): void {
        this.broadcast('workflow:changed', change);
        
        // Also send to workflow-specific room
        if (change.workflowId) {
            this.broadcastToRoom(`workflow:${change.workflowId}`, 'workflow:changed', change);
        }
    }

    broadcastOptimizationSuggestion(suggestion: any): void {
        this.broadcast('optimization:suggestion', suggestion);
        
        // Send to VS Code clients specifically
        this.broadcastToType('vscode', 'optimization:suggestion:vscode', {
            ...suggestion,
            actions: ['apply', 'reject', 'modify']
        });
    }

    broadcastMetrics(metrics: any): void {
        this.broadcast('metrics:update', metrics);
        
        // Send detailed metrics to dashboard
        this.broadcastToType('dashboard', 'metrics:detailed', metrics);
    }

    // Connection statistics
    getConnectionStats(): any {
        const stats = {
            totalClients: this.clients.size,
            clientsByType: {} as any,
            rooms: {} as any,
            uptime: process.uptime()
        };

        // Count clients by type
        this.clients.forEach(client => {
            stats.clientsByType[client.type] = (stats.clientsByType[client.type] || 0) + 1;
        });

        // Room statistics
        this.rooms.forEach((members, room) => {
            stats.rooms[room] = members.size;
        });

        return stats;
    }

    // Cleanup methods
    disconnectClient(clientId: string, reason?: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.socket.disconnect();
            logger.info(`Forcefully disconnected client ${clientId}: ${reason || 'No reason provided'}`);
        }
    }

    disconnectAllClients(reason?: string): void {
        this.clients.forEach((client, clientId) => {
            this.disconnectClient(clientId, reason);
        });
    }

    cleanup(): void {
        this.disconnectAllClients('Server shutdown');
        this.clients.clear();
        this.rooms.clear();
    }
}